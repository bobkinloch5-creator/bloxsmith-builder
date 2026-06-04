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

const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";

export type Tripo3DOptions = {
  userId: string;
  prompt: string;
  inputMode?: "text" | "image";
  imageDataUrl?: string | null;
  quality?: "turbo" | "standard" | "detailed";
  format?: "GLB" | "OBJ" | "FBX";
  faceLimit?: number;
  style?: string | null;
  texture?: boolean;
  rigged?: boolean;
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
  form.append("file", new Blob([new Uint8Array(parsed.bytes)], { type: parsed.mime }), `reference.${ext}`);
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
      throw new Error(`Tripo task ${taskId} ${status}.`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Tripo task timed out. Try again in a moment.");
}

async function storeModelFile(
  userId: string,
  url: string,
  ext: string,
): Promise<{ filePath: string; fileUrl: string }> {
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`Could not download the generated model (${dl.status}).`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType =
    ext === "zip" ? "application/zip" : ext === "glb" ? "model/gltf-binary" : "application/octet-stream";
  const { error: upErr } = await supabaseAdmin.storage
    .from("generated-3d-models")
    .upload(filePath, buf, { contentType, upsert: false });
  if (upErr) throw new Error(`Could not save the model file: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from("generated-3d-models").getPublicUrl(filePath);
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
  const { error: upErr } = await supabaseAdmin.storage
    .from("generated-3d-models")
    .upload(filePath, Buffer.from(content, "utf8"), { contentType, upsert: false });
  if (upErr) throw new Error(`Could not save the generated Studio package: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from("generated-3d-models").getPublicUrl(filePath);
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
            enable_image_autofix: true,
          }
        : {
            type: "text_to_model",
            model_version: modelVersion,
            prompt: opts.prompt.slice(0, 1024),
            texture: opts.texture !== false,
          };
    if (opts.style) genBody.style = opts.style;
    const genTaskId = await createTask(genBody, useFallback);
    const gen = await pollTask(genTaskId, { timeoutMs: 180_000, useFallback });
    const renderedImageUrl: string | undefined = gen.output?.rendered_image;

    // The base text_to_model output is a GLB — store it for the WebGL preview.
    const rawGlbUrl: string =
      gen.output?.pbr_model || gen.output?.model || gen.output?.base_model || "";
    let previewGlbUrl: string | undefined;
    if (rawGlbUrl) {
      try {
        const glb = await storeModelFile(opts.userId, rawGlbUrl, "glb");
        previewGlbUrl = glb.fileUrl;
      } catch (e) {
        console.warn("[tripo] preview GLB store failed:", String(e).slice(0, 120));
      }
    }

    // 2. If the user wants GLB, the download IS the preview file — done.
    if (downloadFormat === "GLB") {
      if (!previewGlbUrl) {
        if (!rawGlbUrl)
          return { ok: false, error: "Tripo finished but returned no downloadable model." };
        const stored = await storeModelFile(opts.userId, rawGlbUrl, "glb");
        previewGlbUrl = stored.fileUrl;
        return {
          ok: true,
          fileUrl: stored.fileUrl,
          filePath: stored.filePath,
          format: "GLB",
          previewGlbUrl,
          tripoTaskId: genTaskId,
          renderedImageUrl,
        };
      }
      return {
        ok: true,
        fileUrl: previewGlbUrl,
        filePath: "",
        format: "GLB",
        previewGlbUrl,
        tripoTaskId: genTaskId,
        renderedImageUrl,
      };
    }

    // 3. Otherwise convert to the requested format (OBJ/FBX) for download.
    let fileUrl = "";
    let ext = downloadFormat.toLowerCase();
    try {
      const convTaskId = await createTask({
        type: "convert_model",
        format: downloadFormat,
        original_model_task_id: genTaskId,
        face_limit: faceLimit,
        flatten_bottom: true,
        pivot_to_center_bottom: true,
        with_animation: opts.rigged === true,
        animate_in_place: opts.animateInPlace === true,
        fbx_preset: opts.rigged === true && downloadFormat === "FBX" ? "mixamo" : undefined,
      }, useFallback);
      const conv = await pollTask(convTaskId, { timeoutMs: 150_000, useFallback });
      fileUrl = conv.output?.model || conv.output?.pbr_model || conv.output?.base_model || "";
      ext = "zip"; // OBJ/FBX come packaged with textures
    } catch (convErr) {
      console.warn(
        "[tripo] conversion failed, falling back to GLB:",
        String(convErr).slice(0, 160),
      );
      fileUrl = rawGlbUrl;
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
      tripoTaskId: genTaskId,
      renderedImageUrl,
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
