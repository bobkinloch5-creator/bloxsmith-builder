import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getCometApiKey, getCometBaseUrl } from "./comet-config.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ensureCreditsAvailable,
  isGeneratorOwner,
  spendCreditsAfterSuccess,
} from "./generator-credits.server";

// ---------------------------------------------------------------------------
// CometAPI Sora video generation. Async task model: POST /v1/videos,
// poll GET /v1/videos/{id}, then download GET /v1/videos/{id}/content.
// The model slug + paths are isolated here in case CometAPI shifts them.
// ---------------------------------------------------------------------------
const DEFAULT_COMET_VIDEO_TASKS_URL = "https://api.cometapi.com/v1/videos";
const DEFAULT_COMET_VIDEO_MODEL = "sora-2-pro";
const REFERENCE_IMAGE_BUCKET = "generated-images";

export const COMET_VIDEO_MODEL_OPTIONS = [
  {
    id: "sora-2-pro",
    label: "Sora 2 Pro",
    creditCost: 100,
    description: "Premium cinematic text/image-to-video (OpenAI).",
  },
  {
    id: "veo3.1",
    label: "Veo 3.1",
    creditCost: 120,
    description: "Google-style cinematic generation through Comet.",
  },
  {
    id: "veo3.1-fast",
    label: "Veo 3.1 Fast",
    creditCost: 30,
    description: "Cheap Google Veo variant ($0.08/sec) — great for short clips.",
  },
  {
    id: "doubao-seedance-2-0",
    label: "Doubao Seedance 2.0",
    creditCost: 25,
    description: "Multi-shot cinematic video ($0.063/sec) — best budget cinematic option.",
  },
  {
    id: "vidu-q3-turbo",
    label: "Vidu Q3 Turbo",
    creditCost: 12,
    description: "Cheapest video option ($0.028/sec) — fast 1080p clips up to 16s.",
  },
  {
    id: "vidu-q3",
    label: "Vidu Q3",
    creditCost: 20,
    description: "Higher-quality Vidu Q3 ($0.056/sec) — solid balance of price + fidelity.",
  },
  {
    id: "wan2.7",
    label: "Wan 2.7",
    creditCost: 30,
    description: "Qwen video model ($0.08/sec) with strong reference consistency.",
  },
  {
    id: "grok-imagine-video",
    label: "Grok Imagine Video",
    creditCost: 90,
    description: "Creative xAI-style video generation through Comet.",
  },
] as const;

export type CometVideoModelId = (typeof COMET_VIDEO_MODEL_OPTIONS)[number]["id"];
export const DEFAULT_COMET_VIDEO_MODEL_EXPORT = DEFAULT_COMET_VIDEO_MODEL as CometVideoModelId;
export const VIDEO_MODEL_CREDIT_COSTS: Record<CometVideoModelId, number> =
  COMET_VIDEO_MODEL_OPTIONS.reduce(
    (acc, option) => ({ ...acc, [option.id]: option.creditCost }),
    {} as Record<CometVideoModelId, number>,
  );

// Video is gated TWO ways: a hard 1-per-week cap AND a heavy credit cost.
// Sora/Comet video bills per generated second, and a long clip is expensive, so this is
// priced as a premium one-off rather than a casual generator.
const DEFAULT_VIDEO_CREDIT_COST = VIDEO_MODEL_CREDIT_COSTS[DEFAULT_COMET_VIDEO_MODEL_EXPORT];

// Weekly limit: at most this many videos per user per rolling window.
// Owners/admins/mods bypass. Enforced server-side from video_generations.
const RATE_LIMIT_DAYS = 7;
const RATE_LIMIT_COUNT = 1;

// Keep the UI options constrained to short clips; Comet/OpenAI Sora defaults to short async jobs.
const DurationEnum = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
  z.literal(15),
]);
const ResolutionEnum = z.enum(["720p", "1080p"]);
const VideoModelEnum = z.enum([
  "sora-2-pro",
  "veo3.1",
  "veo3.1-fast",
  "doubao-seedance-2-0",
  "vidu-q3-turbo",
  "vidu-q3",
  "wan2.7",
  "grok-imagine-video",
] satisfies [CometVideoModelId, ...CometVideoModelId[]]);

const StartSchema = z.object({
  prompt: z.string().min(3).max(1500),
  model: VideoModelEnum.default(DEFAULT_COMET_VIDEO_MODEL_EXPORT),
  durationS: DurationEnum.default(6),
  resolution: ResolutionEnum.default("1080p"),
  // Optional image to animate (image-to-video). Data URL, capped in size.
  referenceImageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/)
    .max(8_000_000)
    .optional(),
});

const PollSchema = z.object({ taskId: z.string().min(1).max(200) });
const RateLimitSchema = z
  .object({
    model: VideoModelEnum.default(DEFAULT_COMET_VIDEO_MODEL_EXPORT),
  })
  .optional()
  .default({ model: DEFAULT_COMET_VIDEO_MODEL_EXPORT });

export type VideoJobStatus = "queued" | "processing" | "completed" | "failed";
export type VideoJob = {
  taskId: string;
  status: VideoJobStatus;
  videoUrl?: string;
  error?: string;
};

export type VideoRateLimit = {
  allowed: boolean;
  nextAvailableAt: string | null;
  creditCost: number;
};

type JsonRecord = Record<string, unknown>;
type ProviderError = { message?: string };
type QueryResult<T> = { data: T | null; error: ProviderError | null };
type VideoGenerationRow = { created_at: string };
type VideoGenerationInsert = {
  user_id: string;
  task_id: string;
  prompt: string;
  credits_spent: number;
};
type VideoGenerationsQuery = {
  select(columns: string): VideoGenerationsQuery;
  eq(column: string, value: unknown): VideoGenerationsQuery;
  gte(column: string, value: unknown): VideoGenerationsQuery;
  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<QueryResult<VideoGenerationRow[]>>;
  insert(row: VideoGenerationInsert): Promise<QueryResult<unknown>>;
};
type AuthedContext = { supabase: unknown; userId: string };

class VideoRateLimitError extends Error {
  rateLimited = true;
  nextAvailableAt: string | null;

  constructor(message: string, nextAvailableAt: string | null) {
    super(message);
    this.nextAvailableAt = nextAvailableAt;
  }
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function nestedValue(json: JsonRecord, path: string[]) {
  let current: unknown = json;
  for (const key of path) {
    const record = toRecord(current);
    if (!(key in record)) return undefined;
    current = record[key];
  }
  return current;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function nestedString(json: JsonRecord, path: string[]) {
  return firstString(nestedValue(json, path));
}

function videoGenerationsTable() {
  return (
    supabaseAdmin as unknown as { from(table: "video_generations"): VideoGenerationsQuery }
  ).from("video_generations");
}

function authHeaders(contentType = true): Record<string, string> {
  const key = getCometApiKey();
  if (!key) throw new Error("Video generation isn't configured (COMETAPI_KEY missing).");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (contentType) headers["Content-Type"] = "application/json";
  return headers;
}

function absoluteCometUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_COMET_VIDEO_TASKS_URL;
  if (trimmed.startsWith("/")) {
    return `${new URL(DEFAULT_COMET_VIDEO_TASKS_URL).origin}${trimmed}`.replace(/\/+$/, "");
  }
  return (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).replace(/\/+$/, "");
}

function getCometVideoTasksUrl(taskId?: string) {
  const explicit = process.env.COMET_VIDEO_TASKS_URL || process.env.COMET_SEEDANCE_TASKS_URL;
  const base = explicit
    ? absoluteCometUrl(explicit)
    : `${new URL(absoluteCometUrl(getCometBaseUrl())).origin}/v1/videos`;
  return taskId ? `${base}/${encodeURIComponent(taskId)}` : base;
}

function isCometVideoModel(value: string): value is CometVideoModelId {
  return COMET_VIDEO_MODEL_OPTIONS.some((option) => option.id === value);
}

function getCometVideoModel(selected?: CometVideoModelId) {
  if (selected) return selected;
  const configured = process.env.COMET_VIDEO_MODEL || process.env.COMET_SEEDANCE_MODEL;
  return configured && isCometVideoModel(configured) ? configured : DEFAULT_COMET_VIDEO_MODEL;
}

function getVideoCreditCost(model: CometVideoModelId) {
  return VIDEO_MODEL_CREDIT_COSTS[model] ?? DEFAULT_VIDEO_CREDIT_COST;
}

function getCometVideoContentUrl(taskId: string) {
  return `${getCometVideoTasksUrl(taskId)}/content`;
}

async function readJsonResponse(res: Response): Promise<JsonRecord> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return toRecord(JSON.parse(text));
  } catch {
    return { message: text };
  }
}

function parseReferenceImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) throw new Error("Reference image must be a PNG, JPEG, or WEBP image.");

  const mime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { mime, ext, bytes: Buffer.from(match[2], "base64") };
}

async function uploadReferenceImage(dataUrl: string, userId: string) {
  const { mime, ext, bytes } = parseReferenceImageDataUrl(dataUrl);
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const path = `${userId}/video-reference-${Date.now()}-${randomId}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(REFERENCE_IMAGE_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });

  if (error) throw new Error(`Reference image upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(REFERENCE_IMAGE_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Reference image upload did not return a public URL.");
  return data.publicUrl;
}

function parseTaskId(json: JsonRecord): string | null {
  return (
    firstString(
      json.id,
      json.task_id,
      nestedValue(json, ["data", "id"]),
      nestedValue(json, ["data", "task_id"]),
      nestedValue(json, ["task", "id"]),
      nestedValue(json, ["data", "task", "id"]),
    ) ?? null
  );
}

function parseStatus(json: JsonRecord, fallbackId: string): VideoJob {
  const raw =
    json.status ??
    nestedValue(json, ["data", "status"]) ??
    nestedValue(json, ["task", "status"]) ??
    "processing";
  const status = String(raw).toLowerCase();
  const videoUrl =
    firstString(
      nestedValue(json, ["video", "url"]),
      json.video_url,
      nestedValue(json, ["data", "video_url"]),
      nestedValue(json, ["content", "video_url"]),
      nestedValue(json, ["data", "content", "video_url"]),
      nestedValue(json, ["result", "video_url"]),
      nestedValue(json, ["result", "download_url"]),
      nestedValue(json, ["data", "result", "video_url"]),
      nestedValue(json, ["data", "result", "download_url"]),
      nestedValue(json, ["output", "video_url"]),
      nestedValue(json, ["output", "download_url"]),
    ) ?? undefined;
  const taskId = parseTaskId(json) ?? fallbackId;

  if (status === "completed" || status === "succeeded" || status === "success" || videoUrl) {
    return { taskId, status: "completed", videoUrl };
  }
  if (status === "failed" || status === "error") {
    return {
      taskId,
      status: "failed",
      error:
        nestedString(json, ["error", "message"]) ?? firstString(json.error) ?? "Generation failed.",
    };
  }
  if (status === "queued" || status === "pending") return { taskId, status: "queued" };
  return { taskId, status: "processing" };
}

function soraSize(resolution: z.infer<typeof ResolutionEnum>) {
  return resolution === "1080p" ? "1080x1920" : "720x1280";
}

function createSoraVideoForm(data: z.infer<typeof StartSchema>) {
  const form = new FormData();
  form.append("prompt", data.prompt);
  form.append("model", getCometVideoModel(data.model));
  form.append("seconds", String(data.durationS));
  form.append("size", soraSize(data.resolution));

  if (data.referenceImageDataUrl) {
    const { mime, ext, bytes } = parseReferenceImageDataUrl(data.referenceImageDataUrl);
    const blob = new Blob([bytes], { type: mime });
    form.append("image", blob, `reference.${ext}`);
  }

  return form;
}

async function uploadGeneratedVideo(taskId: string, bytes: Buffer, userId: string) {
  const path = `${userId}/generated-video-${Date.now()}-${taskId}.mp4`;
  const { error } = await supabaseAdmin.storage.from(REFERENCE_IMAGE_BUCKET).upload(path, bytes, {
    contentType: "video/mp4",
    upsert: false,
  });
  if (error) throw new Error(`Video upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(REFERENCE_IMAGE_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Video upload did not return a public URL.");
  return data.publicUrl;
}

async function downloadGeneratedVideo(taskId: string, userId: string) {
  const res = await fetch(getCometVideoContentUrl(taskId), {
    method: "GET",
    headers: authHeaders(false),
  });
  if (!res.ok) {
    const json = await readJsonResponse(res);
    throw new Error(
      nestedString(json, ["error", "message"]) ??
        firstString(json.message) ??
        `Video download failed (${res.status}).`,
    );
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return uploadGeneratedVideo(taskId, bytes, userId);
}

async function fetchTask(taskId: string, userId: string): Promise<VideoJob> {
  const url = getCometVideoTasksUrl(taskId);
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
  });
  const json = await readJsonResponse(res);
  if (!res.ok) {
    return {
      taskId,
      status: "failed",
      error: nestedString(json, ["error", "message"]) ?? `Status check failed (${res.status}).`,
    };
  }
  const status = parseStatus(json, taskId);
  if (status.status === "completed" && !status.videoUrl) {
    try {
      return { ...status, videoUrl: await downloadGeneratedVideo(status.taskId, userId) };
    } catch (err) {
      return {
        ...status,
        status: "failed",
        error: err instanceof Error ? err.message : "Video completed but could not be downloaded.",
      };
    }
  }
  return status;
}

// Checks the rolling weekly window. Owners/admins/mods bypass.
async function checkWeeklyLimit(
  userId: string,
  isOwner: boolean,
  creditCost: number,
): Promise<VideoRateLimit> {
  if (isOwner) return { allowed: true, nextAvailableAt: null, creditCost: 0 };

  const since = new Date(Date.now() - RATE_LIMIT_DAYS * 86400_000).toISOString();
  const { data, error } = await videoGenerationsTable()
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  // If the table is missing, fail OPEN on the limit (don't block) — the
  // credit charge still applies, so generation isn't free.
  if (error) {
    return { allowed: true, nextAvailableAt: null, creditCost };
  }

  const rows = data ?? [];
  const used = rows.length;
  if (used < RATE_LIMIT_COUNT) {
    return { allowed: true, nextAvailableAt: null, creditCost };
  }
  const earliest = rows[rows.length - 1].created_at;
  const nextAvailableAt = new Date(
    new Date(earliest).getTime() + RATE_LIMIT_DAYS * 86400_000,
  ).toISOString();
  return { allowed: false, nextAvailableAt, creditCost };
}

async function recordGeneration(userId: string, taskId: string, prompt: string, credits: number) {
  try {
    await videoGenerationsTable().insert({
      user_id: userId,
      task_id: taskId,
      prompt: prompt.slice(0, 1000),
      credits_spent: credits,
    });
  } catch {
    // Non-fatal: the limit just won't count this one if the table is absent.
  }
}

/**
 * Lets the UI show the user's weekly status + cost before they try.
 */
export const getVideoRateLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RateLimitSchema.parse(input))
  .handler(async ({ data, context }): Promise<VideoRateLimit> => {
    const { supabase, userId } = context as AuthedContext;
    const isOwner = await isGeneratorOwner(userId, supabase);
    return checkWeeklyLimit(userId, isOwner, getVideoCreditCost(data.model));
  });

export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartSchema.parse(input))
  .handler(async ({ data, context }): Promise<VideoJob> => {
    const { supabase, userId } = context as AuthedContext;

    // Content safety on the prompt (reuse the shared checker).
    const { checkTextSafeFor3D, checkImageSafeFor3D } = await import("./content-safety.server");
    const safety = checkTextSafeFor3D(data.prompt);
    if (!safety.safe) throw new Error(safety.reason);
    if (data.referenceImageDataUrl) {
      const imgSafety = await checkImageSafeFor3D(data.referenceImageDataUrl);
      if (!imgSafety.safe) throw new Error(imgSafety.reason);
    }

    const isOwner = await isGeneratorOwner(userId, supabase);
    const creditCost = getVideoCreditCost(data.model);

    // Gate 1: hard weekly limit. Even paying users get only 1 per week.
    const limit = await checkWeeklyLimit(userId, isOwner, creditCost);
    if (!limit.allowed) {
      const when = limit.nextAvailableAt
        ? new Date(limit.nextAvailableAt).toLocaleString()
        : "next week";
      throw new VideoRateLimitError(
        `You can generate 1 video per week. Your next video unlocks ${when}.`,
        limit.nextAvailableAt,
      );
    }

    // Gate 2: credits (heavy). Checked up front, charged after a successful submit.
    await ensureCreditsAvailable({ userId, amount: creditCost, isOwner });

    // Submit the task.
    const url = getCometVideoTasksUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(false),
      body: createSoraVideoForm(data),
    });
    const json = await readJsonResponse(res);
    if (!res.ok) {
      const providerMessage =
        nestedString(json, ["error", "message"]) ??
        firstString(json.message) ??
        `Couldn't start video generation (${res.status}).`;
      throw new Error(
        /invalid url/i.test(String(providerMessage))
          ? `${providerMessage}. Check COMET_VIDEO_TASKS_URL is ${DEFAULT_COMET_VIDEO_TASKS_URL} and COMET_VIDEO_MODEL is ${DEFAULT_COMET_VIDEO_MODEL}.`
          : providerMessage,
      );
    }

    const taskId = parseTaskId(json);
    if (!taskId) {
      const immediate = parseStatus(json, "immediate");
      if (immediate.videoUrl) {
        await spendCreditsAfterSuccess({
          supabase,
          amount: creditCost,
          isOwner,
          userId,
          reason: "video generation",
          insufficientMessage: "Not enough credits for video generation.",
        });
        await recordGeneration(
          userId,
          immediate.taskId || "immediate",
          data.prompt,
          isOwner ? 0 : creditCost,
        );
        return immediate;
      }
      throw new Error("Couldn't read a task id from the generation response.");
    }

    // Charge once the task is accepted, then record it for the weekly counter.
    await spendCreditsAfterSuccess({
      supabase,
      amount: creditCost,
      isOwner,
      userId,
      reason: "video generation",
      insufficientMessage: "Not enough credits for video generation.",
    });
    await recordGeneration(userId, taskId, data.prompt, isOwner ? 0 : creditCost);

    return { taskId, status: "queued" };
  });

export const checkVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollSchema.parse(input))
  .handler(async ({ data, context }): Promise<VideoJob> => {
    const { userId } = context as AuthedContext;
    return fetchTask(data.taskId, userId);
  });

export const VIDEO_CREDIT_COST_EXPORT = DEFAULT_VIDEO_CREDIT_COST;
export const VIDEO_WEEKLY_LIMIT = RATE_LIMIT_COUNT;
