// Tripo3D integration — text-to-3D model generation for BloxSmith.
//
// Flow (per Tripo OpenAPI docs, base https://api.tripo3d.ai/v2/openapi):
//   1. POST /task  { type: "text_to_model", model_version: "Turbo-v1.0-...", prompt }
//      → data.task_id
//   2. Poll GET /task/{task_id} until status === "success" (or a finalized
//      failure state). Output model URL expires in ~5 minutes.
//   3. POST /task  { type: "convert_model", format: "OBJ", original_model_task_id }
//      → a new task_id. Poll again. OBJ imports cleanly into Studio's 3D
//      Importer (Roblox cannot load an external mesh at runtime, so we hand the
//      user a downloadable file + import instructions).
//   4. Download the resulting file within the expiry window and store it in the
//      Supabase "generated-3d-models" bucket so the link never expires for the
//      user.
//
// The API key is read from process.env.TRIPO_API_KEY — never hardcoded.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildTripoAnimationTask,
  buildTripoRigTask,
  isModelRigType,
  type ModelAnimationPreset,
  type ModelRigType,
} from "./tripo-animation";

const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";

export type Tripo3DOptions = {
  userId: string;
  prompt: string;
  negativePrompt?: string;
  inputMode?: "text" | "image";
  imageDataUrl?: string | null;
  quality?: "turbo" | "standard" | "detailed";
  format?: "GLB" | "OBJ" | "FBX";
  faceLimit?: number;
  style?: string | null;
  texture?: boolean;
  pbr?: boolean;
  rigged?: boolean;
  rigType?: ModelRigType;
  animationPreset?: ModelAnimationPreset;
  animateInPlace?: boolean;
  /** When true, use TRIPO_FALLBACK_API_KEY instead of the primary key. */
  useFallbackKey?: boolean;
};

const MODEL_VERSION_BY_QUALITY: Record<string, string> = {
  turbo: "Turbo-v1.0-20250506",
  standard: "v2.5-20250123",
  detailed: "v3.0",
};

export type Tripo3DResult =
  | {
      ok: true;
      fileUrl: string; // permanent public URL of the chosen download format
      filePath: string; // path inside the bucket
      format: "GLB" | "OBJ" | "FBX";
      previewGlbUrl?: string; // permanent GLB URL for the WebGL preview
      tripoTaskId: string;
      renderedImageUrl?: string;
    }
  | { ok: false; error: string };

function resolveKey(useFallback?: boolean): string {
  if (useFallback) {
    const fk = process.env.TRIPO_FALLBACK_API_KEY;
    if (!fk) {
      throw new Error(
        "TRIPO_FALLBACK_API_KEY is not set. Add it to enable fallback 3D generation.",
      );
    }
    return fk;
  }
  const key = process.env.TRIPO_API_KEY || process.env.TRIPO_KEY;
  if (!key) {
    throw new Error(
      "TRIPO_API_KEY is not set. Add it to your environment variables to enable 3D generation.",
    );
  }
  return key;
}

function authHeaders(useFallback?: boolean): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resolveKey(useFallback)}`,
  };
}

function bearerHeaders(useFallback?: boolean): Record<string, string> {
  return { Authorization: `Bearer ${resolveKey(useFallback)}` };
}

async function createTask(body: Record<string, unknown>, useFallback?: boolean): Promise<string> {
  const res = await fetch(`${TRIPO_BASE}/task`, {
    method: "POST",
    headers: authHeaders(useFallback),
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Tripo task creation failed (${res.status}): ${json?.message || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const taskId = json?.data?.task_id;
  if (!taskId) throw new Error("Tripo did not return a task_id.");
  return taskId as string;
}

async function uploadImage(dataUrl: string, useFallback?: boolean): Promise<string> {
  const { parseImageDataUrl } = await import("./content-safety.server");
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) throw new Error("Upload a PNG, JPG, or WEBP image.");
  const form = new FormData();
  const ext = parsed.mime === "image/png" ? "png" : parsed.mime === "image/webp" ? "webp" : "jpg";
  form.append(
    "file",
    new Blob([new Uint8Array(parsed.bytes)], { type: parsed.mime }),
    `reference.${ext}`,
  );
  const res = await fetch(`${TRIPO_BASE}/upload`, {
    method: "POST",
    headers: bearerHeaders(useFallback),
    body: form,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Tripo image upload failed (${res.status}): ${json?.message || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const token = json?.data?.image_token || json?.data?.file_token;
  if (!token) throw new Error("Tripo did not return an image token.");
  return String(token);
}

type PollResult = { status: string; output: any; progress: number };

async function pollTask(
  taskId: string,
  opts: { timeoutMs: number; intervalMs?: number; useFallback?: boolean } = { timeoutMs: 120_000 },
): Promise<PollResult> {
  const interval = opts.intervalMs ?? 3_000;
  const deadline = Date.now() + opts.timeoutMs;
  const failed = new Set(["failed", "banned", "expired", "cancelled", "unknown"]);

  while (Date.now() < deadline) {
    const res = await fetch(`${TRIPO_BASE}/task/${taskId}`, {
      method: "GET",
      headers: authHeaders(opts.useFallback),
    });
    const json: any = await res.json().catch(() => ({}));
    const data = json?.data ?? {};
    const status = String(data.status ?? "unknown");

    if (status === "success") {
      return { status, output: data.output ?? {}, progress: 100 };
    }
    if (failed.has(status)) {
      const detail = data.error_msg || data.message || data.error_code;
      throw new Error(`Tripo task ${taskId} ${status}${detail ? `: ${detail}` : "."}`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Tripo task timed out. Try again in a moment.");
}

export const GENERATED_MODELS_BUCKET = "generated-3d-models";
let bucketEnsured = false;

/**
 * Guarantee the storage bucket exists before we upload to it.
 *
 * The SQL migration creates `generated-3d-models`, but on hosted/Lovable
 * Supabase that migration may never have been applied — in which case every
 * upload fails with "Bucket not found" (which is exactly the error users hit).
 * The service-role client is allowed to create buckets, so we self-heal here.
 * Idempotent: an "already exists" response is treated as success, and the
 * result is cached so we only attempt creation once per server instance.
 */
export async function ensureGeneratedModelsBucket(): Promise<void> {
  if (bucketEnsured) return;
  const { error } = await supabaseAdmin.storage.createBucket(GENERATED_MODELS_BUCKET, {
    public: true,
  });
  if (error && !/exist|already|duplicate/i.test(String(error.message ?? error))) {
    // Creation genuinely failed (e.g. permissions). Don't cache success — let
    // the caller's upload surface the definitive error to the user.
    console.warn(
      "[3d] could not ensure storage bucket:",
      String(error.message ?? error).slice(0, 160),
    );
    return;
  }
  bucketEnsured = true;
}

export async function storeModelFile(
  userId: string,
  url: string,
  ext: string,
): Promise<{ filePath: string; fileUrl: string }> {
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`Could not download the generated model (${dl.status}).`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType =
    ext === "zip"
      ? "application/zip"
      : ext === "glb"
        ? "model/gltf-binary"
        : "application/octet-stream";
  await ensureGeneratedModelsBucket();
  const { error: upErr } = await supabaseAdmin.storage
    .from(GENERATED_MODELS_BUCKET)
    .upload(filePath, buf, { contentType, upsert: false });
  if (upErr) throw new Error(`Could not save the model file: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from(GENERATED_MODELS_BUCKET).getPublicUrl(filePath);
  return { filePath, fileUrl: pub.publicUrl };
}

export async function storeGeneratedAssetFile(
  userId: string,
  content: string,
  ext: string,
  contentType = "text/plain",
): Promise<{ filePath: string; fileUrl: string }> {
  const cleanExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "txt";
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;
  await ensureGeneratedModelsBucket();
  const { error: upErr } = await supabaseAdmin.storage
    .from(GENERATED_MODELS_BUCKET)
    .upload(filePath, Buffer.from(content, "utf8"), { contentType, upsert: false });
  if (upErr) throw new Error(`Could not save the generated Studio package: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from(GENERATED_MODELS_BUCKET).getPublicUrl(filePath);
  return { filePath, fileUrl: pub.publicUrl };
}

/**
 * Generate a 3D model from a text prompt with options, store the chosen
 * download format AND a GLB for the WebGL preview, and return permanent URLs.
 * Heavy/slow — callers must enforce the weekly limit + credit charge.
 */
export async function generate3DModel(opts: Tripo3DOptions): Promise<Tripo3DResult> {
  const useFallback = opts.useFallbackKey === true;
  try {
    const quality = opts.quality ?? "turbo";
    const downloadFormat = opts.format ?? "GLB";
    const faceLimit = Math.min(Math.max(opts.faceLimit ?? 10000, 1000), 50000);
    const modelVersion = MODEL_VERSION_BY_QUALITY[quality] ?? MODEL_VERSION_BY_QUALITY.turbo;

    // 1. Generate from text or from a moderated reference image.
    const genBody: Record<string, unknown> =
      opts.inputMode === "image" && opts.imageDataUrl
        ? {
            type: "image_to_model",
            model_version: modelVersion,
            file: { type: "image", file_token: await uploadImage(opts.imageDataUrl, useFallback) },
            prompt: opts.prompt.slice(0, 1024),
            texture: opts.texture !== false,
            pbr: opts.pbr === true,
            face_limit: faceLimit,
            texture_quality: quality === "detailed" ? "detailed" : "standard",
            auto_size: true,
            enable_image_autofix: true,
          }
        : {
            type: "text_to_model",
            model_version: modelVersion,
            prompt: opts.prompt.slice(0, 1024),
            negative_prompt: opts.negativePrompt?.slice(0, 255),
            texture: opts.texture !== false,
            pbr: opts.pbr === true,
            face_limit: faceLimit,
            texture_quality: quality === "detailed" ? "detailed" : "standard",
            auto_size: true,
          };
    if (opts.style) genBody.style = opts.style;
    const genTaskId = await createTask(genBody, useFallback);
    const gen = await pollTask(genTaskId, { timeoutMs: 180_000, useFallback });
    const renderedImageUrl: string | undefined = gen.output?.rendered_image;

    // The base text_to_model output is a GLB. Rigging and animation tasks below
    // replace this URL with their own GLB so the browser can preview the actual
    // skeleton/animation instead of the original static mesh.
    const rawGlbUrl: string =
      gen.output?.pbr_model || gen.output?.model || gen.output?.base_model || "";
    if (!rawGlbUrl) {
      return { ok: false, error: "Tripo finished but returned no downloadable model." };
    }

    let finalTaskId = genTaskId;
    let finalGlbUrl = rawGlbUrl;

    // 2. Real rigging: verify that the mesh can be articulated, then create a
    // provider skeleton (Mixamo-compatible for explicit bipeds). This is
    // different from convert_model's with_animation flag, which only preserves
    // animation that already exists.
    if (opts.rigged) {
      const checkTaskId = await createTask(
        {
          type: "animate_prerigcheck",
          original_model_task_id: genTaskId,
        },
        useFallback,
      );
      const check = await pollTask(checkTaskId, { timeoutMs: 120_000, useFallback });
      if (check.output?.riggable === false) {
        return {
          ok: false,
          error:
            "The generated mesh is not riggable. Use one complete character or creature with clearly separated limbs and a neutral pose.",
        };
      }

      const requestedRigType = opts.rigType ?? "auto";
      const detectedRigType = isModelRigType(check.output?.rig_type)
        ? check.output.rig_type
        : "auto";
      const rigType = requestedRigType === "auto" ? detectedRigType : requestedRigType;
      const rigBody = buildTripoRigTask(genTaskId, rigType);
      const rigTaskId = await createTask(rigBody, useFallback);
      const rig = await pollTask(rigTaskId, { timeoutMs: 180_000, useFallback });
      finalTaskId = rigTaskId;
      finalGlbUrl = rig.output?.model || rig.output?.pbr_model || rig.output?.base_model || "";
      if (!finalGlbUrl) {
        return { ok: false, error: "Tripo rigged the model but returned no rigged file." };
      }

      if (opts.animationPreset && opts.animationPreset !== "none") {
        const animationTaskId = await createTask(
          buildTripoAnimationTask(
            rigTaskId,
            opts.animationPreset,
            rigType,
            opts.animateInPlace === true,
          ),
          useFallback,
        );
        const animated = await pollTask(animationTaskId, {
          timeoutMs: 180_000,
          useFallback,
        });
        finalTaskId = animationTaskId;
        finalGlbUrl =
          animated.output?.model || animated.output?.pbr_model || animated.output?.base_model || "";
        if (!finalGlbUrl) {
          return { ok: false, error: "Tripo animated the model but returned no animated file." };
        }
      }
    }

    // Store the final GLB once. For rigged output this is the skeleton/animation
    // users see in the preview; for normal output it is the generated mesh.
    const preview = await storeModelFile(opts.userId, finalGlbUrl, "glb");
    const previewGlbUrl = preview.fileUrl;

    if (downloadFormat === "GLB") {
      return {
        ok: true,
        fileUrl: preview.fileUrl,
        filePath: preview.filePath,
        format: "GLB",
        previewGlbUrl,
        tripoTaskId: finalTaskId,
        renderedImageUrl,
      };
    }

    // 3. Convert the final task, including its skeleton and baked animation, to
    // the requested Roblox import format.
    let fileUrl = "";
    let ext = downloadFormat.toLowerCase();
    try {
      const convTaskId = await createTask(
        {
          type: "convert_model",
          format: downloadFormat,
          original_model_task_id: finalTaskId,
          face_limit: faceLimit,
          flatten_bottom: true,
          pivot_to_center_bottom: true,
          with_animation: opts.rigged === true,
          animate_in_place: opts.animateInPlace === true,
          fbx_preset: opts.rigged === true && downloadFormat === "FBX" ? "mixamo" : undefined,
        },
        useFallback,
      );
      const conv = await pollTask(convTaskId, { timeoutMs: 150_000, useFallback });
      fileUrl = conv.output?.model || conv.output?.pbr_model || conv.output?.base_model || "";
      ext = "zip"; // OBJ/FBX come packaged with textures
    } catch (convErr) {
      console.warn(
        "[tripo] conversion failed, falling back to GLB:",
        String(convErr).slice(0, 160),
      );
      fileUrl = finalGlbUrl;
      ext = "glb";
    }

    if (!fileUrl) return { ok: false, error: "Tripo finished but returned no downloadable model." };

    const stored = await storeModelFile(opts.userId, fileUrl, ext);

    return {
      ok: true,
      fileUrl: stored.fileUrl,
      filePath: stored.filePath,
      format: ext === "glb" ? "GLB" : downloadFormat,
      previewGlbUrl,
      tripoTaskId: finalTaskId,
      renderedImageUrl,
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
