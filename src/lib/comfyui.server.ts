// ComfyUI fallback image generator.
//
// When the user (or the project owner) runs a local ComfyUI instance and
// exposes it through a public URL (ngrok, tunnel, LAN), we try it FIRST for
// image generations. If COMFYUI_URL is unset, unreachable, or the workflow
// fails, the caller falls back to the existing Neokens/Gemini path in
// `image-gen.server.ts`.
//
// Endpoint shape: a thin POST /prompt-style flow. We support two modes:
//  1. ComfyUI native /prompt + /history polling (default; works out of the
//     box with ComfyUI's built-in server).
//  2. A "simple" mode where the user's endpoint accepts
//     `{ prompt, negative_prompt, width, height }` and returns
//     `{ image: "data:image/png;base64,..." }` or `{ b64: "..." }`. Useful
//     for users running a custom wrapper.
//
// Mode is auto-detected: if COMFYUI_WORKFLOW_JSON is set, we use native mode
// with that workflow as the template (prompt text substitution into the
// `__PROMPT__` placeholder). Otherwise we use simple mode.

const SIMPLE_TIMEOUT_MS = 90_000;
const NATIVE_POLL_INTERVAL_MS = 1_500;
const NATIVE_POLL_TIMEOUT_MS = 120_000;

export type ComfyResult =
  | { ok: true; bytes: Buffer; mime: string; modelUsed: string }
  | { ok: false; reason: string };

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.COMFYUI_API_KEY) h["Authorization"] = `Bearer ${process.env.COMFYUI_API_KEY}`;
  return h;
}

function aspectToSize(aspectRatio?: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1024, height: 576 };
    case "9:16":
      return { width: 576, height: 1024 };
    case "4:3":
      return { width: 1024, height: 768 };
    case "3:4":
      return { width: 768, height: 1024 };
    default:
      return { width: 1024, height: 1024 };
  }
}

function decodeDataUrl(dataUrl: string): { bytes: Buffer; mime: string } | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.startsWith("data:")) return null;
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  return { bytes: Buffer.from(dataUrl.slice(comma + 1), "base64"), mime: mime || "image/png" };
}

/**
 * Attempt a ComfyUI image generation. Returns `{ ok: false }` quickly when
 * COMFYUI_URL is not configured so the caller can fall back without delay.
 */
export async function tryComfyUI(opts: {
  prompt: string;
  aspectRatio?: string;
}): Promise<ComfyResult> {
  const baseUrl = process.env.COMFYUI_URL?.replace(/\/+$/, "");
  if (!baseUrl) return { ok: false, reason: "not_configured" };

  const { width, height } = aspectToSize(opts.aspectRatio);

  // --- Simple mode: POST /generate with a plain JSON body. -------------------
  if (!process.env.COMFYUI_WORKFLOW_JSON) {
    try {
      const r = await fetch(`${baseUrl}/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: opts.prompt,
          negative_prompt: "low quality, blurry, watermark, text",
          width,
          height,
        }),
        signal: AbortSignal.timeout(SIMPLE_TIMEOUT_MS),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        return { ok: false, reason: `comfyui_http_${r.status}: ${txt.slice(0, 120)}` };
      }
      const j: { image?: string; b64?: string; data?: string } = await r.json();
      const raw = j.image || j.b64 || j.data;
      if (!raw) return { ok: false, reason: "comfyui_no_image_in_response" };
      const decoded = raw.startsWith("data:")
        ? decodeDataUrl(raw)
        : { bytes: Buffer.from(raw, "base64"), mime: "image/png" };
      if (!decoded) return { ok: false, reason: "comfyui_bad_data_url" };
      return { ok: true, bytes: decoded.bytes, mime: decoded.mime, modelUsed: "comfyui-local" };
    } catch (e) {
      return { ok: false, reason: `comfyui_unreachable: ${(e as Error).message}` };
    }
  }

  // --- Native mode: POST /prompt + poll /history -----------------------------
  try {
    const workflow = JSON.parse(process.env.COMFYUI_WORKFLOW_JSON!) as Record<string, unknown>;
    const stamped = JSON.parse(JSON.stringify(workflow).replace(/__PROMPT__/g, opts.prompt));
    const submit = await fetch(`${baseUrl}/prompt`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ prompt: stamped }),
      signal: AbortSignal.timeout(SIMPLE_TIMEOUT_MS),
    });
    if (!submit.ok) {
      return { ok: false, reason: `comfyui_submit_http_${submit.status}` };
    }
    const { prompt_id } = (await submit.json()) as { prompt_id?: string };
    if (!prompt_id) return { ok: false, reason: "comfyui_no_prompt_id" };

    const deadline = Date.now() + NATIVE_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, NATIVE_POLL_INTERVAL_MS));
      const hist = await fetch(`${baseUrl}/history/${prompt_id}`, { headers: authHeaders() });
      if (!hist.ok) continue;
      const data = (await hist.json()) as Record<string, { outputs?: Record<string, unknown> }>;
      const entry = data[prompt_id];
      const outputs = entry?.outputs ?? {};
      for (const node of Object.values(outputs)) {
        const images = (node as { images?: { filename: string; subfolder?: string; type?: string }[] }).images;
        if (images && images[0]) {
          const im = images[0];
          const url = `${baseUrl}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder ?? "")}&type=${encodeURIComponent(im.type ?? "output")}`;
          const imgRes = await fetch(url, { headers: authHeaders() });
          if (!imgRes.ok) continue;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          return { ok: true, bytes: buf, mime: "image/png", modelUsed: "comfyui-local" };
        }
      }
    }
    return { ok: false, reason: "comfyui_timeout_waiting_for_image" };
  } catch (e) {
    return { ok: false, reason: `comfyui_native_error: ${(e as Error).message}` };
  }
}

export function isComfyUIConfigured(): boolean {
  return !!process.env.COMFYUI_URL;
}
