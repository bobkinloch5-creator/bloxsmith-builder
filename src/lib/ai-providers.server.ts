import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BLOXSMITH_MODEL,
  BLOXSMITH_THINK_MODEL,
  BLOXSMITH_FAST_MODEL,
  BLOXSMITH_LARGE_MODEL,
  createGroqProvider,
  sanitizingFetch,
} from "./ai-gateway.server";
import {
  COMET_SAFE_FALLBACK_MODELS,
  SITE_PROVIDER_DEFAULT_MODEL,
  SITE_PROVIDER_MODELS,
  getModelToolCapabilities,
  resolveCometModel,
  resolveNeokensModel,
} from "./ai-models";
import { getCometApiKey, getCometBaseUrl } from "./comet-config.server";
import { getNeokensApiKey, getNeokensBaseUrl } from "./neokens-config.server";

export type ProviderId = "openai" | "anthropic" | "google" | "groq" | "neokens" | "comet";
export type ModelKind = "chat" | "build" | "fast" | "large";

export type ModelProfile = {
  inputTokenBudget: number;
  maxOutputTokens: number;
  chatOutputTokens: number;
  timeoutMs: number;
  chatTimeoutMs: number;
  stopSteps: number;
  supportsTools: boolean;
  supportsVision: boolean;
  historyTurns: number;
  historyChars: number;
};

export type ProviderHealthEvent = {
  feature: "chat" | "build" | "plan" | "fix" | "other";
  provider: ProviderId;
  model: string;
  source?: "mcp" | "api_key";
  ok: boolean;
  durationMs?: number;
  errorKind?:
    | "auth"
    | "context"
    | "json"
    | "model_not_found"
    | "not_configured"
    | "provider"
    | "rate_limit"
    | "timeout"
    | "tool"
    | "unknown";
  projectId?: string | null;
  userId?: string | null;
};

export async function recordProviderHealth(event: ProviderHealthEvent): Promise<void> {
  const row = {
    user_id: event.userId ?? null,
    project_id: event.projectId ?? null,
    feature: event.feature,
    provider: event.provider,
    model: event.model,
    source: event.source ?? null,
    ok: event.ok,
    duration_ms: event.durationMs ?? null,
    error_kind: event.errorKind ?? null,
  };

  try {
    const { error } = await supabaseAdmin.from("ai_provider_events").insert(row);
    if (error && !/relation .*ai_provider_events.* does not exist/i.test(error.message ?? "")) {
      console.warn("[ai-provider-health] insert failed:", error.message);
    }
  } catch (err) {
    console.warn("[ai-provider-health] skipped:", err);
  }
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  groq: "Groq",
  neokens: "Neokens (multi-model)",
  comet: "BloxSmith AI",
};

// Curated model lists per provider. Keep the lists short — only models that
// reliably handle Lua/Luau and tool calling.
export const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  openai: [
    "gpt-5.2",
    "gpt-5.2-codex",
    "gpt-5.1",
    "gpt-5.1-codex",
    "gpt-5.1-codex-max",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-codex",
    "gpt-4.1",
    "gpt-4.1-mini",
  ],
  anthropic: [
    "claude-sonnet-4-6",
    "claude-sonnet-4-5",
    "claude-opus-4-1",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
  ],
  google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3-flash-preview"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  // Neokens proxies many models behind a single key — see neokens.com/docs.
  // The active catalog is centralized in ai-models.ts so the picker, health
  // checks, and generation calls stay in sync.
  neokens: [...SITE_PROVIDER_MODELS.neokens],
  comet: [...SITE_PROVIDER_MODELS.comet],
};

export const PROVIDER_DEFAULT_MODEL: Record<ProviderId, string> = {
  openai: "gpt-5.2",
  anthropic: "claude-sonnet-4-6",
  google: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  neokens: SITE_PROVIDER_DEFAULT_MODEL.neokens,
  comet: SITE_PROVIDER_DEFAULT_MODEL.comet,
};

// Some model IDs in the UI are virtual aliases — they map to a real provider
// model plus a request-time flag. The "-thinking" variants reuse the same
// underlying model with adaptive thinking enabled at call time.
//
const VIRTUAL_MODEL_ALIASES: Record<string, { realModel: string; thinking?: boolean }> = {};

/**
 * Resolves a user-facing model ID (which may be a virtual alias like
 * "claude-sonnet-4-6-thinking") to the real model name the provider's API
 * actually accepts, plus any implicit request flags (thinking on/off).
 */
export function resolveModelAlias(modelName: string): { realModel: string; thinking: boolean } {
  const alias = VIRTUAL_MODEL_ALIASES[modelName];
  if (alias) return { realModel: alias.realModel, thinking: !!alias.thinking };
  return { realModel: modelName, thinking: false };
}

export function getModelProfile(
  provider: ProviderId,
  modelName: string,
  opts: { thinking?: boolean; heavyBuild?: boolean; retry?: boolean } = {},
): ModelProfile {
  const id = modelName.toLowerCase();
  const isSmall =
    id.includes("8b") ||
    id.includes("9b") ||
    id.includes("nano") ||
    id.includes("flash-lite") ||
    id.includes("haiku");
  const isHuge =
    id.includes("gemini-3.1") ||
    id.includes("gemini-3-pro") ||
    id.includes("gemini-2.5-pro") ||
    id.includes("claude-opus") ||
    id.includes("gpt-5-codex") ||
    /^gpt-5\.[1-5](?:$|-codex|-codex-max)/.test(id) ||
    id.includes("397b") ||
    id.includes("grok-4.20") ||
    id.includes("reasoning") ||
    id.includes("70b") ||
    id.includes("kimi-k2") ||
    id.includes("sonnet");
  const isGemini = provider === "google" || id.includes("gemini");
  const isOpenAI = provider === "openai" || id.includes("gpt-");
  const isClaude = provider === "anthropic" || id.includes("claude");
  const toolCaps = getModelToolCapabilities(modelName);

  const inputTokenBudget = isHuge ? 120_000 : isSmall ? 18_000 : 48_000;
  const maxOutputTokens = opts.thinking
    ? isHuge
      ? 16_000
      : 9_000
    : opts.retry
      ? isHuge
        ? 9_000
        : 6_500
      : opts.heavyBuild
        ? isHuge
          ? 12_000
          : 8_000
        : isHuge
          ? 7_500
          : 5_500;

  return {
    inputTokenBudget,
    maxOutputTokens,
    chatOutputTokens: opts.thinking ? (isHuge ? 2_400 : 1_800) : isSmall ? 900 : 1_400,
    // Timeouts. These were tightened in an earlier pass and combined with
    // the expanded system prompt produced 502 Bad Gateway errors on
    // heavier builds when Cloudflare's worker wall-time ran out before
    // the upstream model finished streaming. Restored to generous values
    // so the bigger prompt has room to complete; perceived speed comes
    // from the model and prompt upgrades, not from cutting the timeout.
    timeoutMs: opts.thinking ? 45_000 : opts.heavyBuild ? 42_000 : isSmall ? 20_000 : 30_000,
    chatTimeoutMs: opts.thinking ? 40_000 : isSmall ? 12_000 : 18_000,
    // Step budget for the tool loop. Map / city / toolbox builds fire several
    // roblox_asset_search + roblox_asset_info calls; with too few steps the
    // model spends them all researching and never writes the final JSON (the
    // "empty bubble" bug). Give non-tiny models enough headroom to research AND
    // finalize. The generateTextWithToolFallback finalize step is the backstop.
    stopSteps: opts.thinking ? 14 : opts.heavyBuild ? 12 : isSmall ? 5 : 9,
    supportsTools:
      !opts.retry &&
      !(provider === "groq" && id.includes("gemma")) &&
      (provider !== "comet" || toolCaps.tools),
    supportsVision:
      isGemini ||
      isClaude ||
      (isOpenAI && !id.includes("nano")) ||
      (provider === "neokens" &&
        (id.includes("gemini") || id.includes("gpt-5") || id.includes("claude"))) ||
      (provider === "comet" &&
        (id.includes("gemini") || id.includes("gpt-") || id.includes("claude"))),
    historyTurns: opts.thinking ? (isHuge ? 10 : 6) : isSmall ? 4 : 6,
    historyChars: opts.thinking ? (isHuge ? 2_200 : 1_500) : isSmall ? 900 : 1_300,
  };
}

const NEOKENS_MODEL_BY_KIND: Record<ModelKind, string> = {
  chat: "gemini-3-flash",
  build: "gpt-5.2-codex",
  fast: "gemini-3-flash",
  large: "gemini-3.1-pro",
};

const NEOKENS_MODEL_CANDIDATES_BY_KIND: Record<ModelKind, readonly string[]> = {
  chat: ["gemini-3-flash", "gpt-5.3-codex", "claude-haiku-4-5-20251001"],
  fast: ["gemini-3-flash", "gpt-5.3-codex", "gpt-5.1-codex"],
  build: [
    "gpt-5.2-codex",
    "claude-sonnet-4-6-thinking",
    "gpt-5.3-codex",
    "gemini-3.1-pro",
    "gpt-5.2",
    "gemini-3-flash",
  ],
  large: [
    "gemini-3.1-pro",
    "claude-sonnet-4-6-thinking",
    "gpt-5.2-codex",
    "gpt-5.5",
    "gemini-3-flash",
  ],
};

const COMET_MODEL_BY_KIND: Record<ModelKind, string> = {
  chat: "deepseek-v4-flash",
  build: "claude-sonnet-4-6",
  fast: "deepseek-v4-flash",
  large: "claude-opus-4-7",
};

const COMET_STABLE_FALLBACK_MODELS = COMET_SAFE_FALLBACK_MODELS;

const COMET_MODEL_CANDIDATES_BY_KIND: Record<ModelKind, readonly string[]> = {
  chat: COMET_STABLE_FALLBACK_MODELS,
  fast: COMET_STABLE_FALLBACK_MODELS,
  build: ["claude-sonnet-4-6", "deepseek-v4-flash", "claude-opus-4-7"],
  large: ["claude-opus-4-7", "claude-sonnet-4-6", ...COMET_STABLE_FALLBACK_MODELS],
};

function uniqueModelNames(models: readonly string[]): string[] {
  return [...new Set(models.filter(Boolean))];
}

/*
const oldSanitizingFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === "string") {
    try {
      const parsed = JSON.parse(init.body);
      if (Array.isArray(parsed?.messages)) {
        parsed.messages = parsed.messages.map((m: any) => {
          if (!m || typeof m !== "object") return m;
          const { reasoning_content, reasoning, ...rest } = m;
          return rest;
        });
        init = { ...init, body: JSON.stringify(parsed) };
      }
    } catch {
      // Leave non-JSON request bodies untouched.
    }
  }
  return fetch(input as any, init);
};
*/

function providerEndpoint(provider: ProviderId): { name: string; baseURL: string } {
  switch (provider) {
    case "openai":
      return { name: "openai", baseURL: "https://api.openai.com/v1" };
    case "groq":
      return { name: "groq", baseURL: "https://api.groq.com/openai/v1" };
    // Anthropic and Google both expose OpenAI-compatible endpoints
    case "anthropic":
      return { name: "anthropic", baseURL: "https://api.anthropic.com/v1" };
    case "google":
      return {
        name: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      };
    case "neokens":
      // Neokens credits gateway — OpenAI-compatible, one key for many models.
      return { name: "neokens", baseURL: getNeokensBaseUrl() };
    case "comet":
      return {
        name: "comet",
        baseURL: getCometBaseUrl(),
      };
  }
}

export function createProvider(
  provider: ProviderId,
  apiKey: string,
): (modelId: string) => LanguageModel {
  const { name, baseURL } = providerEndpoint(provider);
  return createOpenAICompatible({
    name,
    baseURL,
    apiKey,
    fetch: sanitizingFetch,
  });
}

export type ResolvedGateway = {
  source: "mcp" | "api_key";
  provider: ProviderId;
  modelName: string;
  // The vercel AI SDK model handle to pass into generateText / streamText.
  model: LanguageModel;
};

export function resolveBuiltInGatewayCandidates(opts: {
  kind: ModelKind;
  thinking?: boolean;
}): ResolvedGateway[] {
  const candidates: ResolvedGateway[] = [];
  const cometKey = getCometApiKey();
  if (cometKey) {
    const gw = createProvider("comet", cometKey);
    const cometCandidates = uniqueModelNames([
      COMET_MODEL_BY_KIND[opts.kind] ?? SITE_PROVIDER_DEFAULT_MODEL.comet,
      ...(COMET_MODEL_CANDIDATES_BY_KIND[opts.kind] ?? COMET_SAFE_FALLBACK_MODELS),
    ]);
    for (const uiModelName of cometCandidates) {
      const { model: modelName } = resolveCometModel(uiModelName);
      candidates.push({ source: "mcp", provider: "comet", modelName, model: gw(modelName) });
    }
  }

  const neokensKey = getNeokensApiKey();
  if (neokensKey) {
    const gw = createProvider("neokens", neokensKey);
    const neokensCandidates = uniqueModelNames([
      NEOKENS_MODEL_BY_KIND[opts.kind] ?? SITE_PROVIDER_DEFAULT_MODEL.neokens,
      ...(NEOKENS_MODEL_CANDIDATES_BY_KIND[opts.kind] ?? [SITE_PROVIDER_DEFAULT_MODEL.neokens]),
    ]);
    for (const uiModelName of neokensCandidates) {
      const { model: modelName } = resolveNeokensModel(uiModelName);
      candidates.push({ source: "mcp", provider: "neokens", modelName, model: gw(modelName) });
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const gw = createGroqProvider(groqKey);
    const modelName =
      opts.kind === "large"
        ? BLOXSMITH_LARGE_MODEL
        : opts.kind === "fast"
          ? BLOXSMITH_FAST_MODEL
          : opts.thinking
            ? BLOXSMITH_THINK_MODEL
            : BLOXSMITH_MODEL;
    candidates.push({ source: "mcp", provider: "groq", modelName, model: gw(modelName) });
  }

  if (!candidates.length) {
    throw new Error(
      "AI gateway not configured — COMETAPI_KEY/COMET_API_KEY, NEOKENS_API_KEY/ANTHROPIC_API_KEY, or GROQ_API_KEY missing.",
    );
  }

  return candidates;
}

export function resolveBuiltInGateway(opts: {
  kind: ModelKind;
  thinking?: boolean;
}): ResolvedGateway {
  return resolveBuiltInGatewayCandidates(opts)[0];
}

/**
 * Resolves which AI gateway + model to use for a given user + project.
 *
 * - If the project has `mode = 'api_key'` and the user has a stored key for
 *   the chosen provider, use that.
 * - Otherwise fall back to the built-in Groq path (current default).
 *
 * The fallback is deliberate: if a user toggles to API-key mode but hasn't
 * pasted a key yet, we don't want their next chat to hard-fail.
 */
export async function resolveAiGateway(opts: {
  userId: string;
  projectId: string | null | undefined;
  kind: ModelKind;
  thinking?: boolean;
}): Promise<ResolvedGateway> {
  const fallback = (): ResolvedGateway => resolveBuiltInGateway(opts);

  if (!opts.projectId) return fallback();

  const { data: settings } = await supabaseAdmin
    .from("project_ai_settings")
    .select("mode,provider,model")
    .eq("project_id", opts.projectId)
    .maybeSingle();

  if (!settings || settings.mode !== "api_key" || !settings.provider) {
    return fallback();
  }

  const provider = settings.provider as ProviderId;
  const rawModel = settings.model || PROVIDER_DEFAULT_MODEL[provider];

  // BloxSmith AI, Neokens & Groq are site-wide gateways — use env keys, no per-user key.
  if (provider === "neokens" || provider === "comet") {
    const neoKey = getNeokensApiKey();
    const cometKey = getCometApiKey();
    const key = provider === "comet" ? cometKey : neoKey;
    if (!key) return fallback();
    const { chooseAvailableSiteModel } = await import("./ai-model-health.server");
    const availableModel = await chooseAvailableSiteModel(provider, rawModel);
    const resolver = provider === "comet" ? resolveCometModel : resolveNeokensModel;
    const { model: modelName, thinking: implicitThinking } = resolver(availableModel);
    if (implicitThinking) opts.thinking = true;
    const gw = createProvider(provider, key);
    return { source: "api_key", provider, modelName, model: gw(modelName) };
  }

  // Map virtual aliases (e.g. "claude-sonnet-4-6-thinking") to the real
  // model ID + implicit flags. The thinking flag is OR-ed onto whatever
  // the caller passed in opts, so an explicit Thinking toggle still works.
  const aliased = resolveModelAlias(rawModel);
  const modelName = aliased.realModel;
  if (aliased.thinking) opts.thinking = true;

  if (provider === "groq") {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return fallback();
    const gw = createGroqProvider(groqKey);
    return { source: "api_key", provider, modelName, model: gw(modelName) };
  }

  const getProviderApiKey = supabaseAdmin.rpc as unknown as (
    fn: "get_provider_api_key",
    args: { _user_id: string; _provider: ProviderId },
  ) => Promise<{ data: unknown }>;
  const { data: apiKey } = await getProviderApiKey("get_provider_api_key", {
    _user_id: opts.userId,
    _provider: provider,
  });

  if (!apiKey || typeof apiKey !== "string") {
    return fallback();
  }

  const gw = createProvider(provider, apiKey);

  return {
    source: "api_key",
    provider,
    modelName,
    model: gw(modelName),
  };
}
