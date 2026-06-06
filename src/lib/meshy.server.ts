// Meshy AI integration — text-to-3D and image-to-3D for BloxSmith.
//
// Mirrors the shape of generate3DModel() in tripo3d.server.ts so the calling
// server function can choose between Tripo and Meshy with a `provider` switch.
//
// Docs: https://docs.meshy.ai (v2 text-to-3d, v1 image-to-3d).
// Key:  process.env.MESHY_API_KEY

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MESHY_BASE = "https://api.meshy.ai/openapi";

export type MeshyOptions = {
  userId: string;
  prompt: string;
  inputMode?: "text" | "image";
  imageDataUrl?: string | null;
  quality?: "turbo" | "standard" | "detailed";
  format?: "GLB" | "OBJ" | "FBX";
  faceLimit?: number;
  style?: string | null;
  texture?: boolean;
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
      throw new Error(`Meshy task ${taskId} ${status.toLowerCase()}: ${json?.task_error?.message ?? ""}`.trim());
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Meshy task timed out. Try again in a moment.");
}

async function refineTextTask(previewTaskId: string): Promise<string> {
  const res = await fetch(`${MESHY_BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mode: "refine", preview_task_id: previewTaskId }),
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
  const { error: upErr } = await supabaseAdmin.storage
    .from("generated-3d-models")
    .upload(filePath, buf, { contentType, upsert: false });
  if (upErr) throw new Error(`Could not save the model file: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from("generated-3d-models").getPublicUrl(filePath);
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
    const artStyle = (opts.style && /sculpture|cartoon|realistic/i.test(opts.style)
      ? opts.style.toLowerCase()
      : "realistic") as "realistic" | "sculpture" | "cartoon";

    let previewTaskId: string;
    let endpoint: "v2/text-to-3d" | "v1/image-to-3d";
    let renderedImageUrl: string | undefined;
    let urls: MeshyPoll["model_urls"] = {};

    if (opts.inputMode === "image" && opts.imageDataUrl) {
      endpoint = "v1/image-to-3d";
      previewTaskId = await createImageTask({
        image_url: opts.imageDataUrl, // Meshy accepts data URIs
        enable_pbr: opts.texture !== false,
        ai_model: "meshy-4",
        topology: "triangle",
        target_polycount: polycount,
        should_remesh: true,
      });
      const done = await pollTask(endpoint, previewTaskId, 300_000);
      urls = done.model_urls ?? {};
      renderedImageUrl = done.thumbnail_url;
    } else {
      endpoint = "v2/text-to-3d";
      previewTaskId = await createTextPreviewTask({
        mode: "preview",
        prompt: opts.prompt.slice(0, 600),
        art_style: artStyle,
        ai_model: "meshy-4",
        topology: "triangle",
        target_polycount: polycount,
        should_remesh: true,
      });
      const preview = await pollTask(endpoint, previewTaskId, 240_000);
      renderedImageUrl = preview.thumbnail_url;

      // For "detailed" quality, run the refine pass (adds textures + cleaner mesh).
      if ((opts.quality ?? "turbo") !== "turbo") {
        const refineId = await refineTextTask(previewTaskId);
        const refined = await pollTask(endpoint, refineId, 300_000);
        urls = refined.model_urls ?? {};
        renderedImageUrl = refined.thumbnail_url ?? renderedImageUrl;
      } else {
        urls = preview.model_urls ?? {};
      }
    }

    const glbUrl = urls?.glb;
    const fbxUrl = urls?.fbx;
    const objUrl = urls?.obj;

    let previewGlbUrl: string | undefined;
    if (glbUrl) {
      try {
        const stored = await storeModelFile(opts.userId, glbUrl, "glb");
        previewGlbUrl = stored.fileUrl;
      } catch (e) {
        console.warn("[meshy] preview GLB store failed:", String(e).slice(0, 120));
      }
    }

    const wanted =
      downloadFormat === "FBX" ? fbxUrl : downloadFormat === "OBJ" ? objUrl : glbUrl;
    const wantedExt = downloadFormat.toLowerCase();
    const sourceUrl = wanted || glbUrl;
    if (!sourceUrl)
      return { ok: false, error: "Meshy finished but returned no downloadable model." };

    let stored: { filePath: string; fileUrl: string };
    if (downloadFormat === "GLB" && previewGlbUrl) {
      stored = { filePath: "", fileUrl: previewGlbUrl };
    } else {
      stored = await storeModelFile(opts.userId, sourceUrl, wanted ? wantedExt : "glb");
    }

    return {
      ok: true,
      fileUrl: stored.fileUrl,
      filePath: stored.filePath,
      format: wanted ? downloadFormat : "GLB",
      previewGlbUrl,
      meshyTaskId: previewTaskId,
      renderedImageUrl,
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
