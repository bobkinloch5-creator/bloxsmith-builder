// Meshy AI integration — text-to-3D and image-to-3D for BloxSmith.
//
// Mirrors the Tripo provider (tripo3d.server.ts) and returns the SAME
// Tripo3DResult shape so it drops into generate3DModelFn's orchestration
// (safety -> weekly limit -> credit pre-check -> generate -> store -> charge)
// with no changes to the consuming code.
//
// Flow (Meshy OpenAPI, base https://api.meshy.ai):
//   Text-to-3D (v2):
//     1. POST /openapi/v2/text-to-3d { mode:"preview", prompt, art_style, target_polycount }
//        -> { result: <previewTaskId> }
//     2. Poll GET /openapi/v2/text-to-3d/<id> until status SUCCEEDED.
//     3. (optional) POST { mode:"refine", preview_task_id } for PBR textures,
//        then poll again. The refine result carries textured model_urls.
//   Image-to-3D (v1):
//     1. POST /openapi/v1/image-to-3d { image_url:<dataURI>, enable_pbr, should_texture }
//        -> { result: <taskId> }; poll GET /openapi/v1/image-to-3d/<id>.
//   Each finished task exposes model_urls { glb, fbx, obj, usdz } + thumbnail_url.
//   We download the requested format (GLB preferred for the WebGL preview) and
//   store it in the Supabase "generated-3d-models" bucket so the link is
//   permanent (Meshy's URLs expire).
//
// The API key is read from process.env.MESHY_API_KEY — never hardcoded, never
// sent to the browser.

import { storeModelFile, type Tripo3DResult, type Tripo3DOptions } from "./tripo3d.server";

const MESHY_BASE = "https://api.meshy.ai";

// Reuse the same options shape Tripo takes — the orchestration passes one opts
// object regardless of provider.
export type Meshy3DOptions = Tripo3DOptions;

function resolveKey(): string {
  const key = process.env.MESHY_API_KEY || process.env.MESHY_KEY;
  if (!key) {
    throw new Error(
      "MESHY_API_KEY is not set. Add it to your environment variables to enable Meshy 3D generation.",
    );
  }
  return key;
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resolveKey()}`,
  };
}

// Map BloxSmith quality -> Meshy target polycount + art style hint.
const POLYCOUNT_BY_QUALITY: Record<string, number> = {
  turbo: 12_000,
  standard: 30_000,
  detailed: 60_000,
};

type MeshyTask = {
  status: string;
  progress: number;
  model_urls?: Record<string, string | null>;
  thumbnail_url?: string | null;
  task_error?: { message?: string } | null;
};

async function createTask(path: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${MESHY_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Meshy task creation failed (${res.status}): ${json?.message || json?.error || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const taskId = json?.result ?? json?.id;
  if (!taskId) throw new Error("Meshy did not return a task id.");
  return String(taskId);
}

async function pollTask(
  path: string,
  taskId: string,
  opts: { timeoutMs: number; intervalMs?: number } = { timeoutMs: 180_000 },
): Promise<MeshyTask> {
  const interval = opts.intervalMs ?? 4_000;
  const deadline = Date.now() + opts.timeoutMs;
  const failed = new Set(["FAILED", "EXPIRED", "CANCELED", "CANCELLED"]);

  while (Date.now() < deadline) {
    const res = await fetch(`${MESHY_BASE}${path}/${taskId}`, {
      method: "GET",
      headers: authHeaders(),
    });
    const json: any = await res.json().catch(() => ({}));
    const status = String(json?.status ?? "PENDING").toUpperCase();

    if (status === "SUCCEEDED") {
      return {
        status,
        progress: 100,
        model_urls: json?.model_urls ?? {},
        thumbnail_url: json?.thumbnail_url ?? null,
      };
    }
    if (failed.has(status)) {
      const reason = json?.task_error?.message ? `: ${json.task_error.message}` : ".";
      throw new Error(`Meshy task ${taskId} ${status.toLowerCase()}${reason}`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Meshy task timed out. Try again in a moment.");
}

function pickModelUrl(
  urls: Record<string, string | null> | undefined,
  format: "GLB" | "OBJ" | "FBX",
): { url: string; ext: string } | null {
  if (!urls) return null;
  const wanted = format.toLowerCase();
  // Prefer the requested format, then fall back to GLB (always Roblox-importable).
  const order = [wanted, "glb", "fbx", "obj"];
  for (const key of order) {
    const u = urls[key];
    if (u && typeof u === "string") return { url: u, ext: key };
  }
  return null;
}

/**
 * Generate a 3D model via Meshy and return the same Tripo3DResult shape the
 * orchestration expects. `tripoTaskId` carries the Meshy task id (the field is
 * provider-agnostic in the result record).
 */
export async function generateMeshy3DModel(opts: Meshy3DOptions): Promise<Tripo3DResult> {
  try {
    const quality = opts.quality ?? "turbo";
    const downloadFormat = opts.format ?? "GLB";
    const targetPoly = Math.min(
      Math.max(opts.faceLimit ?? POLYCOUNT_BY_QUALITY[quality] ?? 12_000, 1_000),
      300_000,
    );
    const artStyle = opts.style && /sculpt|stat/i.test(opts.style) ? "sculpture" : "realistic";

    // 1. Create the generation task (text or image).
    let finalTaskId: string;
    let finalPath: string;
    if (opts.inputMode === "image" && opts.imageDataUrl) {
      // Meshy image-to-3D accepts a data URI directly for image_url.
      finalPath = "/openapi/v1/image-to-3d";
      finalTaskId = await createTask(finalPath, {
        image_url: opts.imageDataUrl,
        enable_pbr: opts.texture !== false,
        should_texture: opts.texture !== false,
        should_remesh: true,
        target_polycount: targetPoly,
      });
      await pollTask(finalPath, finalTaskId, { timeoutMs: 240_000 });
    } else {
      // Text-to-3D: preview pass, then a refine pass for real textures.
      const previewPath = "/openapi/v2/text-to-3d";
      const previewId = await createTask(previewPath, {
        mode: "preview",
        prompt: opts.prompt.slice(0, 600),
        art_style: artStyle,
        should_remesh: true,
        target_polycount: targetPoly,
      });
      await pollTask(previewPath, previewId, { timeoutMs: 240_000 });

      finalPath = previewPath;
      finalTaskId = previewId;
      if (opts.texture !== false) {
        try {
          const refineId = await createTask(previewPath, {
            mode: "refine",
            preview_task_id: previewId,
            enable_pbr: true,
          });
          await pollTask(previewPath, refineId, { timeoutMs: 240_000 });
          finalTaskId = refineId;
        } catch (refineErr) {
          // Keep the untextured preview if refine fails rather than hard-failing.
          console.warn("[meshy] refine failed, using preview:", String(refineErr).slice(0, 140));
        }
      }
    }

    // 2. Read the finished task's model URLs.
    const finished = await pollTask(finalPath, finalTaskId, { timeoutMs: 30_000 });
    const renderedImageUrl = finished.thumbnail_url ?? undefined;

    // 3. Store the requested download format (or GLB) permanently, plus a GLB
    //    for the WebGL preview.
    const glb = pickModelUrl(finished.model_urls, "GLB");
    let previewGlbUrl: string | undefined;
    if (glb && glb.ext === "glb") {
      try {
        const storedGlb = await storeModelFile(opts.userId, glb.url, "glb");
        previewGlbUrl = storedGlb.fileUrl;
      } catch (e) {
        console.warn("[meshy] preview GLB store failed:", String(e).slice(0, 120));
      }
    }

    const chosen = pickModelUrl(finished.model_urls, downloadFormat);
    if (!chosen) {
      return { ok: false, error: "Meshy finished but returned no downloadable model." };
    }

    // If the chosen format is GLB and we already stored it, reuse that file.
    if (chosen.ext === "glb" && previewGlbUrl) {
      return {
        ok: true,
        fileUrl: previewGlbUrl,
        filePath: "",
        format: "GLB",
        previewGlbUrl,
        tripoTaskId: finalTaskId,
        renderedImageUrl,
      };
    }

    const stored = await storeModelFile(opts.userId, chosen.url, chosen.ext);
    return {
      ok: true,
      fileUrl: stored.fileUrl,
      filePath: stored.filePath,
      format: chosen.ext === "glb" ? "GLB" : downloadFormat,
      previewGlbUrl,
      tripoTaskId: finalTaskId,
      renderedImageUrl,
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
