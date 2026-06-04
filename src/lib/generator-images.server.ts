// Studio image generation (multi-variation generator UI) — Gemini backend.
//
// This routes the dedicated /image-generator studio through the SAME Google
// Gemini pipeline the clothing studio and in-chat tools use, so there is ONE
// image backend and ONE key to configure (GEMINI_API_KEY). The older Lovable
// gateway path was removed because the project only has a Gemini key.

import { generateImageFromPrompt, saveGeneratedImage } from "./image-gen.server";
import { getCometApiKey, getCometBaseUrl } from "./comet-config.server";

// UI exposes several model ids; with a Gemini-only key we map them all to the
// configured Gemini image model. The mapping is kept so the UI/types don't have
// to change, and so a future multi-provider key can re-expand this cleanly.
export type StudioImageModel =
  | "google/gemini-2.5-flash-image"
  | "google/gemini-3-pro-image-preview"
  | "google/gemini-3.1-flash-image-preview"
  | "openai/gpt-image-2"
  | "openai/gpt-image-1-mini"
  | "comet/nano-banana-2"
  | "comet/gpt-image-2"
  | "comet/gemini-3-pro-image-preview";

type Quality = "low" | "medium" | "high";
type Aspect = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";

export const GENERATOR_CREDIT_COSTS = {
  imagePerVariation: 2,
  clothing: 2,
} as const;

const ASPECT_HINTS: Record<Aspect, string> = {
  "1:1": "Square 1:1 composition, centered and clean.",
  "16:9": "Wide 16:9 Roblox thumbnail composition with strong focal depth.",
  "9:16": "Tall 9:16 mobile/vertical composition.",
  "4:3": "4:3 landscape composition.",
  "3:4": "3:4 portrait composition.",
  "3:2": "3:2 landscape composition.",
  "2:3": "2:3 portrait composition.",
};

// Gemini generateContent supports these aspect ratios for gemini-3 image models.
// Map any unsupported studio ratios to the closest supported one.
function toGeminiAspect(a: Aspect): "16:9" | "1:1" | "9:16" | "4:3" | "3:4" {
  switch (a) {
    case "3:2":
      return "4:3";
    case "2:3":
      return "3:4";
    default:
      return a;
  }
}

function parseDataUrl(dataUrl?: string): { base64: string; mime: string } | null {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  return { base64: dataUrl.slice(comma + 1), mime };
}

function toCometSize(a: Aspect): string {
  switch (a) {
    case "16:9":
    case "3:2":
      return "1536x1024";
    case "9:16":
    case "2:3":
      return "1024x1536";
    case "4:3":
      return "1280x960";
    case "3:4":
      return "960x1280";
    default:
      return "1024x1024";
  }
}

async function fetchImageBytes(url: string): Promise<{ bytes: Buffer; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`BloxSmith AI image download failed (HTTP ${res.status}).`);
  const mime = res.headers.get("content-type") || "image/png";
  return { bytes: Buffer.from(await res.arrayBuffer()), mime };
}

async function generateCometStudioImage(opts: {
  userId: string;
  model: StudioImageModel;
  prompt: string;
  aspectRatio: Aspect;
  quality: Quality;
  altText: string;
}) {
  const cometKey = getCometApiKey();
  if (!cometKey)
    throw new Error(
      "BloxSmith AI image generation is unavailable. Ask an admin to check the server key.",
    );

  const model = opts.model.replace(/^comet\//, "");
  const res = await fetch(
    `${getCometBaseUrl()}/images/generations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cometKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt,
        n: 1,
        size: toCometSize(opts.aspectRatio),
        quality: opts.quality === "high" ? "hd" : "standard",
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403)
      throw new Error("BloxSmith AI rejected the server key.");
    if (res.status === 429)
      throw new Error("BloxSmith AI image generation is rate-limited. Try again later.");
    throw new Error(
      `BloxSmith AI image generation failed (HTTP ${res.status}): ${text.slice(0, 180)}`,
    );
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = json?.data?.[0];
  let bytes: Buffer | null = null;
  let mime = "image/png";
  if (item?.b64_json) {
    bytes = Buffer.from(String(item.b64_json), "base64");
  } else if (item?.url) {
    const fetched = await fetchImageBytes(String(item.url));
    bytes = fetched.bytes;
    mime = fetched.mime;
  }

  if (!bytes) throw new Error("BloxSmith AI did not return an image. Try a simpler prompt.");
  const saved = await saveGeneratedImage(opts.userId, bytes, mime, opts.altText, `comet/${model}`);
  if ("error" in saved) throw new Error(saved.error);
  return saved;
}

export async function generateStoredStudioImage(opts: {
  userId: string;
  prompt: string;
  altText: string;
  quality: Quality;
  aspectRatio: Aspect;
  model: StudioImageModel;
  negativePrompt?: string;
  styleHint?: string;
  referenceImageDataUrl?: string;
  mode: "image" | "clothing";
}) {
  const basePrompt = [
    opts.prompt,
    opts.styleHint,
    ASPECT_HINTS[opts.aspectRatio],
    opts.negativePrompt ? `Avoid: ${opts.negativePrompt}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const ref = parseDataUrl(opts.referenceImageDataUrl);

  if (opts.model.startsWith("comet/") && !ref) {
    const result = await generateCometStudioImage({
      userId: opts.userId,
      model: opts.model,
      prompt: basePrompt,
      aspectRatio: opts.aspectRatio,
      quality: opts.quality,
      altText: opts.altText,
    });
    return {
      url: result.imageUrl,
      modelUsed: result.modelUsed || opts.model,
      fellBack: false,
      promptUsed: basePrompt,
    };
  }

  const result = await generateImageFromPrompt({
    userId: opts.userId,
    prompt: basePrompt,
    aspectRatio: toGeminiAspect(opts.aspectRatio),
    referenceImageBase64: ref?.base64,
    referenceMime: ref?.mime,
    altText: opts.altText,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  return {
    url: result.imageUrl,
    modelUsed:
      result.modelUsed || process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
    fellBack: false,
    promptUsed: basePrompt,
  };
}
