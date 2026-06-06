// Meshy AI integration — text-to-3D and image-to-3D for BloxSmith.
//
// Mirrors the shape of generate3DModel() in tripo3d.server.ts so the calling
// server function can choose between Tripo and Meshy with a `provider` switch.
//
// Docs: https://docs.meshy.ai (v2 text-to-3d, v1 image-to-3d).
// Key:  process.env.MESHY_API_KEY

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildMeshyAnimationTask,
  buildMeshyRigTask,
  isMeshyAnimationPreset,
} from "./meshy-animation";
import type { ModelAnimationPreset, ModelRigType } from "./tripo-animation";

const MESHY_BASE = "https://api.meshy.ai/openapi";

export type MeshyOptions = {
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
};

export type MeshyResult =
  | {
      ok: true;
      fileUrl: string;
      filePath: string;
      format: "GLB" | "OBJ" | "FBX";
      previewGlbUrl?: string;
      meshyTaskId: string;
      renderedImageUrl?: string;
    }
  | { ok: false; error: string };

function resolveKey(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key)
    throw new Error(
      "MESHY_API_KEY is not set. Add it to your environment variables to enable Meshy 3D generation.",
    );
  return key;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resolveKey()}`,
  };
}

async function createTextPreviewTask(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${MESHY_BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Meshy task creation failed (${res.status}): ${json?.message || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const taskId = json?.result ?? json?.id;
  if (!taskId) throw new Error("Meshy did not return a task id.");
  return String(taskId);
}

async function createImageTask(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${MESHY_BASE}/v1/image-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Meshy image-to-3D failed (${res.status}): ${json?.message || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const taskId = json?.result ?? json?.id;
  if (!taskId) throw new Error("Meshy did not return a task id.");
  return String(taskId);
}

async function createAdvancedTask(
  endpoint: "v1/rigging" | "v1/animations",
  body: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${MESHY_BASE}/${endpoint}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const label = endpoint === "v1/rigging" ? "rigging" : "animation";
    throw new Error(
      `Meshy ${label} failed (${res.status}): ${json?.message || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const taskId = json?.result ?? json?.id;
  if (!taskId) throw new Error("Meshy did not return a task id.");
  return String(taskId);
}

type MeshyPoll = {
  status: string;
  progress: number;
  model_urls?: { glb?: string; fbx?: string; obj?: string; usdz?: string };
  thumbnail_url?: string;
};

async function pollTask(
  endpoint: "v2/text-to-3d" | "v1/image-to-3d",
  taskId: string,
  timeoutMs = 240_000,
  intervalMs = 4_000,
): Promise<MeshyPoll> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MESHY_BASE}/${endpoint}/${taskId}`, { headers: authHeaders() });
    const json: any = await res.json().catch(() => ({}));
    const status = String(json?.status ?? "PENDING").toUpperCase();
    if (status === "SUCCEEDED") {
      return {
        status,
        progress: 100,
        model_urls: json?.model_urls ?? {},
        thumbnail_url: json?.thumbnail_url,
      };
    }
    if (status === "FAILED" || status === "CANCELED" || status === "EXPIRED") {
      throw new Error(
        `Meshy task ${taskId} ${status.toLowerCase()}: ${json?.task_error?.message ?? ""}`.trim(),
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Meshy task timed out. Try again in a moment.");
}

type MeshyRiggingResult = {
  rigged_character_fbx_url?: string;
  rigged_character_glb_url?: string;
  basic_animations?: {
    walking_glb_url?: string;
    walking_fbx_url?: string;
    running_glb_url?: string;
    running_fbx_url?: string;
  };
};

type MeshyAnimationResult = {
  animation_glb_url?: string;
  animation_fbx_url?: string;
};

async function pollAdvancedTask<T>(
  endpoint: "v1/rigging" | "v1/animations",
  taskId: string,
  timeoutMs = 240_000,
  intervalMs = 4_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MESHY_BASE}/${endpoint}/${taskId}`, { headers: authHeaders() });
    const json: any = await res.json().catch(() => ({}));
    const status = String(json?.status ?? "PENDING").toUpperCase();
    if (status === "SUCCEEDED") return (json?.result ?? {}) as T;
    if (status === "FAILED" || status === "CANCELED" || status === "EXPIRED") {
      throw new Error(
        `Meshy ${endpoint === "v1/rigging" ? "rigging" : "animation"} task ${status.toLowerCase()}: ${json?.task_error?.message ?? ""}`.trim(),
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Meshy ${endpoint === "v1/rigging" ? "rigging" : "animation"} timed out.`);
}

async function refineTextTask(
  previewTaskId: string,
  opts: { prompt: string; detailed: boolean; pbr: boolean },
): Promise<string> {
  const res = await fetch(`${MESHY_BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      mode: "refine",
      preview_task_id: previewTaskId,
      ai_model: "meshy-6",
      enable_pbr: opts.pbr,
      hd_texture: opts.detailed,
      remove_lighting: true,
      texture_prompt: opts.prompt.slice(0, 600),
      target_formats: ["glb", "obj", "fbx"],
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Meshy refine failed (${res.status}): ${json?.message || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const taskId = json?.result ?? json?.id;
  if (!taskId) throw new Error("Meshy refine did not return a task id.");
  return String(taskId);
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
    ext === "glb"
      ? "model/gltf-binary"
      : ext === "fbx"
        ? "application/octet-stream"
        : "application/octet-stream";
  const { ensureGeneratedModelsBucket, GENERATED_MODELS_BUCKET } = await import("./tripo3d.server");
  await ensureGeneratedModelsBucket();
  const { error: upErr } = await supabaseAdmin.storage
    .from(GENERATED_MODELS_BUCKET)
    .upload(filePath, buf, { contentType, upsert: false });
  if (upErr) throw new Error(`Could not save the model file: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from(GENERATED_MODELS_BUCKET).getPublicUrl(filePath);
  return { filePath, fileUrl: pub.publicUrl };
}

function mapPolycount(faceLimit?: number) {
  const n = Math.min(Math.max(faceLimit ?? 10000, 1000), 50000);
  return n;
}

export async function generate3DModelMeshy(opts: MeshyOptions): Promise<MeshyResult> {
  try {
    const downloadFormat = opts.format ?? "GLB";
    const polycount = mapPolycount(opts.faceLimit);
    let previewTaskId: string;
    let endpoint: "v2/text-to-3d" | "v1/image-to-3d";
    let renderedImageUrl: string | undefined;
    let urls: MeshyPoll["model_urls"] = {};
    let finalGenerationTaskId = "";

    if (opts.inputMode === "image" && opts.imageDataUrl) {
      endpoint = "v1/image-to-3d";
      previewTaskId = await createImageTask({
        image_url: opts.imageDataUrl, // Meshy accepts data URIs
        enable_pbr: opts.pbr === true,
        should_texture: opts.rigged || opts.texture !== false,
        texture_prompt: opts.prompt.slice(0, 600),
        ai_model: "meshy-6",
        topology: "triangle",
        target_polycount: polycount,
        should_remesh: true,
        auto_size: true,
        origin_at: "bottom",
        target_formats: ["glb", "obj", "fbx"],
      });
      const done = await pollTask(endpoint, previewTaskId, 300_000);
      urls = done.model_urls ?? {};
      renderedImageUrl = done.thumbnail_url;
      finalGenerationTaskId = previewTaskId;
    } else {
      endpoint = "v2/text-to-3d";
      const previewBody: Record<string, unknown> = {
        mode: "preview",
        prompt: opts.prompt.slice(0, 600),
        negative_prompt: opts.negativePrompt?.slice(0, 600),
        model_type: opts.quality === "turbo" ? "lowpoly" : "standard",
        ai_model: "meshy-6",
        topology: "triangle",
        target_polycount: polycount,
        should_remesh: true,
        auto_size: true,
        origin_at: "bottom",
        target_formats: ["glb", "obj", "fbx"],
      };
      previewTaskId = await createTextPreviewTask(previewBody);
      const preview = await pollTask(endpoint, previewTaskId, 240_000);
      renderedImageUrl = preview.thumbnail_url;

      // For "detailed" quality, run the refine pass (adds textures + cleaner mesh).
      if ((opts.quality ?? "turbo") !== "turbo" || opts.rigged) {
        const refineId = await refineTextTask(previewTaskId, {
          prompt:
            "Clean matte painted base color. High roughness, no baked highlights, no wet or plastic shine. " +
            opts.prompt,
          detailed: opts.quality === "detailed",
          pbr: opts.pbr === true,
        });
        const refined = await pollTask(endpoint, refineId, 300_000);
        urls = refined.model_urls ?? {};
        renderedImageUrl = refined.thumbnail_url ?? renderedImageUrl;
        finalGenerationTaskId = refineId;
      } else {
        urls = preview.model_urls ?? {};
        finalGenerationTaskId = previewTaskId;
      }
    }

    let glbUrl = urls?.glb;
    let fbxUrl = urls?.fbx;
    let objUrl = urls?.obj;
    let finalTaskId = finalGenerationTaskId || previewTaskId;

    if (opts.rigged) {
      if (opts.rigType && opts.rigType !== "auto" && opts.rigType !== "biped") {
        return {
          ok: false,
          error: "Meshy currently rigs humanoid bipeds only. Choose Biped or use Tripo for creatures.",
        };
      }
      const animationPreset = opts.animationPreset ?? "none";
      if (!isMeshyAnimationPreset(animationPreset)) {
        return {
          ok: false,
          error:
            "That animation is not available through Meshy. Choose idle, walk, run, jump, slash, shoot, hurt, or fall.",
        };
      }

      const rigTaskId = await createAdvancedTask(
        "v1/rigging",
        buildMeshyRigTask(finalGenerationTaskId),
      );
      const rig = await pollAdvancedTask<MeshyRiggingResult>("v1/rigging", rigTaskId, 240_000);
      finalTaskId = rigTaskId;
      glbUrl = rig.rigged_character_glb_url;
      fbxUrl = rig.rigged_character_fbx_url;
      objUrl = undefined;

      const basic =
        animationPreset === "walk"
          ? {
              glb: rig.basic_animations?.walking_glb_url,
              fbx: rig.basic_animations?.walking_fbx_url,
            }
          : animationPreset === "run"
            ? {
                glb: rig.basic_animations?.running_glb_url,
                fbx: rig.basic_animations?.running_fbx_url,
              }
            : null;

      if (basic?.glb && basic?.fbx) {
        glbUrl = basic.glb;
        fbxUrl = basic.fbx;
      } else if (animationPreset !== "none") {
        const animationTaskId = await createAdvancedTask(
          "v1/animations",
          buildMeshyAnimationTask(rigTaskId, animationPreset),
        );
        const animated = await pollAdvancedTask<MeshyAnimationResult>(
          "v1/animations",
          animationTaskId,
          240_000,
        );
        finalTaskId = animationTaskId;
        glbUrl = animated.animation_glb_url;
        fbxUrl = animated.animation_fbx_url;
      }

      if (!glbUrl) {
        return { ok: false, error: "Meshy rigged the model but returned no rigged GLB file." };
      }
    }

    let previewStored: { filePath: string; fileUrl: string } | undefined;
    let previewGlbUrl: string | undefined;
    if (glbUrl) {
      try {
        previewStored = await storeModelFile(opts.userId, glbUrl, "glb");
        previewGlbUrl = previewStored.fileUrl;
      } catch (e) {
        console.warn("[meshy] preview GLB store failed:", String(e).slice(0, 120));
      }
    }

    const wanted = downloadFormat === "FBX" ? fbxUrl : downloadFormat === "OBJ" ? objUrl : glbUrl;
    const wantedExt = downloadFormat.toLowerCase();
    const sourceUrl = wanted || glbUrl;
    if (!sourceUrl)
      return { ok: false, error: "Meshy finished but returned no downloadable model." };

    let stored: { filePath: string; fileUrl: string };
    if (downloadFormat === "GLB" && previewStored) {
      stored = previewStored;
    } else {
      stored = await storeModelFile(opts.userId, sourceUrl, wanted ? wantedExt : "glb");
    }

    return {
      ok: true,
      fileUrl: stored.fileUrl,
      filePath: stored.filePath,
      format: wanted ? downloadFormat : "GLB",
      previewGlbUrl,
      meshyTaskId: finalTaskId,
      renderedImageUrl,
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
