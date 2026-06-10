export type SiteProviderId = "neokens" | "comet";

export const SITE_PROVIDER_LABELS: Record<SiteProviderId, string> = {
  neokens: "Neokens (free)",
  comet: "BloxSmith AI",
};

export const SITE_PROVIDER_MODELS: Record<SiteProviderId, string[]> = {
  neokens: [
    "gemini-3-flash",
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6-thinking",
    "gpt-5.2",
    "gpt-5.3-codex",
    "gpt-5.4",
  ],
  comet: [
    // CometAPI account catalog. Ordered cheapest → premium. If any model
    // reports "no available channel for group default", that is a CometAPI
    // account/channel limit rather than a local slug mismatch.
    "deepseek-v4-flash",
    "gpt-5.4-nano",
    "minimax-m2-7",
    "gemini-3.1-flash-lite-preview",
    "gpt-5.4-mini",
    "grok-4.20-0309-reasoning",
    "kimi-k2.6",
    "glm-5.1",
    "qwen3.5-397b-a17b",
    "deepseek-v3.2",
    "deepseek-v4-pro",
    "gemini-3.5-flash",
    "gemini-3-pro-preview",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-fable-5",
  ],
};

// Free accounts get the reliable budget models. BloxSmith Pro and Owner
// accounts unlock the full premium catalog, including Claude Fable 5.
export const FREE_ACCESS_MODELS: ReadonlySet<string> = new Set([
  "gemini-3-flash",
  "claude-haiku-4-5-20251001",
  "gpt-5.3-codex",
  "deepseek-v4-flash",
  "gpt-5.4-nano",
  "minimax-m2-7",
  "gemini-3.1-flash-lite-preview",
]);

export const PRO_ONLY_MODELS: ReadonlySet<string> = new Set(
  Object.values(SITE_PROVIDER_MODELS)
    .flat()
    .filter((model) => !FREE_ACCESS_MODELS.has(model)),
);

// Kept for backwards compatibility with older call sites. Fable is no longer
// Older code paths imported this symbol when Fable was owner-only. It is empty
// now because Pro users can access Fable through the subscription gate.
export const OWNER_ONLY_MODELS: ReadonlySet<string> = new Set([]);
export const COMING_SOON_MODELS: ReadonlySet<string> = new Set([]);

export function isOwnerOnlyModel(modelId: string | null | undefined): boolean {
  return !!modelId && OWNER_ONLY_MODELS.has(modelId);
}

export function isProOnlyModel(modelId: string | null | undefined): boolean {
  return !!modelId && PRO_ONLY_MODELS.has(modelId);
}

export function isFreeAccessModel(modelId: string | null | undefined): boolean {
  return !!modelId && FREE_ACCESS_MODELS.has(modelId);
}

export function isModelAllowedForPlan(
  modelId: string | null | undefined,
  opts: { isOwner?: boolean; isPro?: boolean },
): boolean {
  if (!modelId) return true;
  if (opts.isOwner || opts.isPro) return true;
  return FREE_ACCESS_MODELS.has(modelId);
}

export const SITE_PROVIDER_DEFAULT_MODEL: Record<SiteProviderId, string> = {
  neokens: "gemini-3-flash",
  comet: "deepseek-v4-flash",
};

export const SITE_MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-5-4-nano":
    "Cheapest GPT on Comet ($0.16/$1 per M). Best for fast chat, tiny Roblox edits, and prompt cleanup.",
  "gpt-5-4-mini":
    "Cheap mid-tier GPT on Comet ($0.6/$3.6 per M). Balanced reasoning + web tools for daily Roblox scripting.",
  "minimax-m2-7":
    "Very cheap long-context MiniMax ($0.24/$0.96 per M) — fast 100tps, great for big project prompts and multi-script planning.",
  "minimax-m3":
    "MiniMax M3 ($0.48/$1.92 per M) — multimodal 1M-context frontier coding model at budget pricing.",
  "grok-4-2":
    "Grok 4.20 multi-agent ($1/$2 per M, 2M context). Strong tool-use and structured outputs at low cost.",
  "gemini-3-5-flash":
    "Gemini 3.5 Flash ($1.2/$7.2 per M) — fast smart model with built-in search/grounding for Roblox docs.",
  "gpt-5.4-nano":
    "Cheapest BloxSmith AI model for quick chat, tiny Roblox edits, short bug fixes, prompt cleanup, and simple UI copy. Best when users need fast help without burning many credits.",
  "deepseek-v4-flash":
    "Budget coding workhorse for Roblox/Luau with web/tools enabled. Strong for RemoteEvents, leaderstats, shops, tycoon loops, compact ModuleScripts, and checking current Roblox docs.",
  "grok-4.20-0309-reasoning":
    "Comet reasoning model for creative Roblox planning, difficult debugging, gameplay systems, and idea-heavy builds where deeper thinking helps before code is written.",
  "kimi-k2.6":
    "Comet long-context coding model for reading larger Roblox project context, planning multi-script edits, and keeping implementation output organized.",
  "glm-5.1":
    "Comet general coding model for everyday Roblox scripts, UI logic, economy fixes, and clean structured build responses.",
  "gemini-3.1-flash-lite-preview":
    "Fast low-cost Comet Gemini preview route for quick Roblox answers, short script fixes, prompt cleanup, and lightweight planning.",
  "qwen3.5-397b-a17b":
    "Large Comet Qwen route for structured Luau generation, multi-file systems, data models, and precise code-heavy Roblox tasks.",
  "deepseek-v3.2":
    "Comet DeepSeek coding route for Roblox debugging, refactors, ModuleScripts, RemoteEvents, and implementation-heavy fixes.",
  "gemini-3-pro-preview":
    "Premium Comet Gemini preview route for large project context, deep Roblox architecture, multimodal-style reasoning, and harder build plans.",
  "minimax-m2.7":
    "Cheap long-context builder for bigger Roblox prompts. Good for reading more project context, planning several scripts at once, and keeping output fast.",
  "qwen3.6-plus":
    "Low-cost structured coding model with web/tools enabled. Good for clean Luau formatting, JSON-style build outputs, admin commands, small combat systems, and precise edits.",
  "gpt-5.4-mini":
    "Balanced BloxSmith AI model with web/tools enabled for medium Roblox systems, current API checks, and better reasoning than nano while staying budget-friendly.",
  "gpt-5.5-all":
    "Premium all-purpose BloxSmith AI model for difficult Roblox architecture, code, planning, web/tool workflows, and image-aware help when available. It is intentionally expensive and tightly capped for normal users so the shared AI balance is protected.",
  "qwen3.7-max":
    "Smart mid-price web/tool-capable model for larger Roblox scripts, UI logic, economy balancing, refactors, and agentic research workflows.",
  "gemini-3.5-flash":
    "Latest fast Gemini option in the BloxSmith AI pool with web/tools enabled. Good for grounded answers, visual/screenshot-style reasoning, long project context, and quick build planning.",
  "grok-4.3":
    "Creative web/tool-capable reasoning model for Roblox game ideas, mechanics, naming, quests, monetization concepts, and current-trend research.",
  "deepseek-v4-pro":
    "Higher-quality DeepSeek option with web/tools enabled for harder Roblox coding, multi-file systems, deeper debugging, and larger architecture decisions.",
  "claude-haiku-4-5":
    "Cheap Claude-style cleanup model for careful refactors, readable Luau explanations, script tidying, and comments.",
  "claude-opus-4-8-thinking":
    "Very expensive deepest-reasoning model for rare, difficult builds only: full game architecture, severe bugs, security-sensitive economy/DataStore work, and large multi-system rewrites. Normal users are capped tightly so it cannot drain the shared balance.",
  "claude-opus-4-8":
    "Very expensive deepest-reasoning Claude model for rare, difficult Comet builds only: full game architecture, severe bugs, security-sensitive economy/DataStore work, and large multi-system rewrites.",
  "claude-sonnet-4-7-thinking":
    "Newest Sonnet with adaptive thinking — fast frontier reasoning. Best for full-game architecture, anti-exploit, and hard debugging at a lower cost than Opus. What it does for your game: builds simulators/tycoons with leaderstats, gamepasses, and DataStore saves.",
  "claude-opus-4-7":
    "Premium Claude reasoning route on Comet for deep Roblox architecture, hard debugging, and large multi-file builds.",
  "claude-sonnet-4-6-thinking":
    "Frontier reasoning with adaptive thinking. Best for full-game architecture, complex anti-exploit, and hard debugging where it should slow down and think first. What it does for your game: builds full simulators/tycoons with leaderstats, gamepasses, and DataStore saves.",
  "claude-sonnet-4-6":
    "Stable Claude Sonnet route on Comet for full-game architecture, complex anti-exploit, and hard debugging at a lower cost than Opus.",
  "claude-haiku-4-5-20251001":
    "Cheap and careful for cleaning messy Luau, refactoring scripts, and writing tidy ModuleScripts. What it does for your game: tidies up existing scripts, renames variables, adds comments, and splits monolith scripts into ModuleScripts.",
  "gpt-5.2":
    "OpenAI flagship for general Roblox building and refactors. What it does for your game: handles full systems, UI, and scripts with solid all-round quality.",
  "gpt-5.2-codex":
    "Code-tuned 5.2 for heavier Luau work. What it does for your game: long ModuleScripts, OOP class systems, and math-heavy gameplay code.",
  "gpt-5.3-codex":
    "Budget code-tuned GPT for clean Luau, refactors, and fast implementation passes. What it does for your game: writes ModuleScripts, fixes tools, and keeps Roblox systems tidy without premium-model cost.",
  "gpt-5.4":
    "Premium GPT reasoning for harder Roblox architecture, debugging, and multi-step builds. What it does for your game: plans complex systems, reviews edge cases, and handles larger scripted features.",
  "gpt-5.5":
    "Top-tier GPT for the hardest builds and deep debugging. What it does for your game: tackles large game systems, tricky race conditions, and high-care refactors when cheaper models are not enough.",
  "gpt-5.1":
    "Reliable general-purpose model for everyday builds and edits. What it does for your game: scripts, GUIs, RemoteEvents, and mid-size systems.",
  "gpt-5.1-codex":
    "Code-focused 5.1 for clean Luau and refactors. What it does for your game: ModuleScripts, tools, and tidy gameplay logic.",
  "gpt-5.1-codex-max":
    "Largest 5.1 code model for the most demanding Luau builds. What it does for your game: big multi-file systems, complex combat, and large refactors in one pass.",
  "gemini-3.1-pro":
    "Google's top reasoning model — large context, great for whole-project understanding and big builds. What it does for your game: reasons over your entire place, plans large systems, and handles long multi-file generations.",
  "gemini-3-flash":
    "Fast all-rounder for everyday Roblox scripting: GUIs, RemoteEvents, and small gameplay edits. Cheap and quick. What it does for your game: edits ScreenGuis, adds buttons, wires RemoteEvents, and ships small tweaks in seconds.",
  "claude-fable-5":
    "BloxSmith Pro premium model for the hardest Roblox work: advanced reasoning, long project planning, full game architecture, complex scripting help, debugging, and high-quality agentic builds. It is unlocked for active Pro and Owner accounts.",
};

// ─────────────────────────────────────────────────────────────────────────
// Credit cost multipliers per model.
//
// Higher-tier models cost more credits per generation. Base credit cost
// (chat=1, plan=1, fix=2, generate=3, autopilot=10) is multiplied by this
// number and rounded up. Owners/admins always pay 0. UI shows this badge
// next to each model so users can pick by budget.
// ─────────────────────────────────────────────────────────────────────────
export const MODEL_CREDIT_MULTIPLIERS: Record<string, number> = {
  // BloxSmith AI budget models — hyphenated keys match the real Comet slugs.
  "gpt-5-4-nano": 0.35,
  "deepseek-v4-flash": 0.5,
  "grok-4.20-0309-reasoning": 4,
  "kimi-k2.6": 2,
  "glm-5.1": 2,
  "gemini-3.1-flash-lite-preview": 0.75,
  "qwen3.5-397b-a17b": 3,
  "deepseek-v3.2": 2,
  "gemini-3-pro-preview": 4,
  "minimax-m2-7": 0.65,
  "gpt-5-4-mini": 0.8,
  "gpt-5-4-pro": 6,
  "gpt-5-5": 4,
  "gpt-5-5-all": 12,
  "qwen3-7-max": 1.5,
  "gemini-3-5-flash": 2,
  "gemini-3-1-pro-preview": 2.5,
  "grok-4-3": 2,
  "grok-4-2": 2,
  "deepseek-v4": 2.5,
  "minimax-m3": 1.5,
  // Legacy dotted keys kept as harmless fallbacks for any old references.
  "gpt-5.4-nano": 0.35,
  "minimax-m2.7": 0.65,
  "qwen3.6-plus": 0.75,
  "gpt-5.4-mini": 0.8,
  "gpt-5.5-all": 12,
  "qwen3.7-max": 1.5,
  "gemini-3.5-flash": 2,
  "grok-4.3": 2,
  "deepseek-v4-pro": 2.5,
  "claude-haiku-4-5": 1,
  "claude-sonnet-4-6": 3,
  "claude-opus-4-7": 7,
  "claude-opus-4-7-thinking": 7,
  "claude-opus-4-8": 20,
  // Claude
  "claude-opus-4-8-thinking": 20,
  "claude-sonnet-4-7-thinking": 3,
  "claude-sonnet-4-6-thinking": 3,
  "claude-haiku-4-5-20251001": 1,
  // GPT
  "gpt-5.2": 2,
  "gpt-5.2-codex": 2,
  "gpt-5.1": 1,
  "gpt-5.1-codex": 1,
  "gpt-5.1-codex-max": 2,
  "gpt-5.3-codex": 1,
  "gpt-5.4": 3,
  "gpt-5.5": 5,
  // Gemini
  "gemini-3.1-pro": 2,
  "gemini-3-flash": 1,
  // Pro premium experimental
  "claude-fable-5": 30,
};

export const DEFAULT_MODEL_CREDIT_MULTIPLIER = 1;

export type ModelTokenPricing = {
  input: number;
  output: number;
  cachedInput: number;
};

// USD per 1M tokens from the active Neokens catalog. Omitted models have no
// confirmed price in the source list and should not display a price badge.
export const MODEL_TOKEN_PRICING_USD_PER_MILLION: Record<string, ModelTokenPricing> = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4, cachedInput: 0.08 },
  "claude-sonnet-4-6-thinking": { input: 3, output: 15, cachedInput: 0.3 },
  "claude-sonnet-4-7-thinking": { input: 3, output: 15, cachedInput: 0.3 },
  "gpt-5.1": { input: 2.5, output: 10, cachedInput: 0.25 },
  "gpt-5.1-codex": { input: 2.5, output: 10, cachedInput: 0.25 },
  "gpt-5.1-codex-max": { input: 5, output: 20, cachedInput: 0.5 },
  "gpt-5.2": { input: 3, output: 12, cachedInput: 0.3 },
  "gpt-5.2-codex": { input: 3, output: 12, cachedInput: 0.3 },
  "gpt-5.3-codex": { input: 1.5, output: 6, cachedInput: 0.15 },
  "gpt-5.4": { input: 5, output: 20, cachedInput: 0.5 },
  "gpt-5.5": { input: 10, output: 40, cachedInput: 1 },
  "gemini-3-flash": { input: 0.075, output: 0.3, cachedInput: 0.01 },
};

export const MODEL_TOOL_CAPABILITIES: Record<
  string,
  { tools: boolean; webSearch: boolean; thinking: boolean; label: string }
> = {
  "gpt-5.4-nano": {
    tools: true,
    webSearch: false,
    thinking: false,
    label: "Basic tools",
  },
  "deepseek-v4-flash": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + Roblox docs",
  },
  "grok-4.20-0309-reasoning": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + reasoning",
  },
  "kimi-k2.6": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + long context",
  },
  "glm-5.1": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + coding",
  },
  "gemini-3.1-flash-lite-preview": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + fast",
  },
  "qwen3.5-397b-a17b": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + structured",
  },
  "deepseek-v3.2": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + deep coding",
  },
  "gemini-3-pro-preview": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + premium",
  },
  "minimax-m2.7": {
    tools: true,
    webSearch: false,
    thinking: false,
    label: "Long context",
  },
  "qwen3.6-plus": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + structured tools",
  },
  "gpt-5.4-mini": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + coding",
  },
  "gpt-5.5-all": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + premium reasoning",
  },
  "qwen3.7-max": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + agent tools",
  },
  "gemini-3-flash": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + docs",
  },
  "gemini-3.5-flash": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + vision",
  },
  "gemini-3.1-pro": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + large context",
  },
  "grok-4.3": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + creative",
  },
  "deepseek-v4-pro": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + deep coding",
  },
  "claude-haiku-4-5": {
    tools: true,
    webSearch: false,
    thinking: false,
    label: "Careful tools",
  },
  "claude-haiku-4-5-20251001": {
    tools: true,
    webSearch: false,
    thinking: false,
    label: "Careful tools",
  },
  "claude-sonnet-4-6-thinking": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + reasoning",
  },
  "claude-sonnet-4-7-thinking": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + reasoning",
  },
  "claude-sonnet-4-6": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + reasoning",
  },
  "claude-opus-4-7": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + premium",
  },
  "claude-opus-4-8": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + elite",
  },
  "claude-opus-4-8-thinking": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + elite",
  },
  "gpt-5.1": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + coding",
  },
  "gpt-5.1-codex": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + coding",
  },
  "gpt-5.1-codex-max": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + deep coding",
  },
  "gpt-5.2": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + coding",
  },
  "gpt-5.2-codex": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + coding",
  },
  "gpt-5.3-codex": {
    tools: true,
    webSearch: true,
    thinking: false,
    label: "Web + coding",
  },
  "gpt-5.4": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + reasoning",
  },
  "gpt-5.5": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Web + premium reasoning",
  },
  "claude-fable-5": {
    tools: true,
    webSearch: true,
    thinking: true,
    label: "Pro premium reasoning",
  },
};

export function getModelToolCapabilities(modelName: string | null | undefined) {
  if (!modelName) return { tools: true, webSearch: false, thinking: false, label: "Tools" };
  const direct = MODEL_TOOL_CAPABILITIES[modelName];
  if (direct) return direct;
  if (modelName.endsWith("-thinking")) {
    const base = modelName.slice(0, -"-thinking".length);
    const baseCaps = MODEL_TOOL_CAPABILITIES[base];
    if (baseCaps) return { ...baseCaps, thinking: true };
  }
  return {
    tools: true,
    webSearch: /\b(gemini|grok|deepseek|qwen|sonnet|opus|gpt-5\.[45]-mini)\b/i.test(modelName),
    thinking: /\b(thinking|sonnet|opus|pro|max|grok|deepseek-v4-pro|qwen3\.7)\b/i.test(modelName),
    label: "Tools",
  };
}

/**
 * Look up the credit-cost multiplier for a UI model id. Falls back to 1x
 * for unknown models so a new id never accidentally over-charges the user.
 * Also handles the "-thinking" alias by stripping the suffix.
 */
export function getModelCreditMultiplier(modelName: string | null | undefined): number {
  if (!modelName) return DEFAULT_MODEL_CREDIT_MULTIPLIER;
  const direct = MODEL_CREDIT_MULTIPLIERS[modelName];
  if (typeof direct === "number") return direct;
  if (modelName.endsWith("-thinking")) {
    const base = modelName.slice(0, -"-thinking".length);
    const m = MODEL_CREDIT_MULTIPLIERS[base];
    if (typeof m === "number") return m;
  }
  return DEFAULT_MODEL_CREDIT_MULTIPLIER;
}

export function getModelTokenPricing(
  modelName: string | null | undefined,
): ModelTokenPricing | null {
  if (!modelName) return null;
  const direct = MODEL_TOKEN_PRICING_USD_PER_MILLION[modelName];
  if (direct) return direct;
  if (modelName.endsWith("-thinking")) {
    const base = modelName.slice(0, -"-thinking".length);
    return MODEL_TOKEN_PRICING_USD_PER_MILLION[base] ?? null;
  }
  return null;
}

/**
 * Apply the multiplier to a base credit cost. Rounds up so partial credits
 * always favor the platform (a 0.5x model still costs at least 1 credit).
 */
export function applyModelCreditMultiplier(baseCost: number, modelName: string | null | undefined) {
  const mult = getModelCreditMultiplier(modelName);
  return Math.max(1, Math.ceil(baseCost * mult));
}

// ─────────────────────────────────────────────────────────────────────────
// Neokens model mapping.
//
// The UI model id (the key) is what the picker shows and stores. The value is
// the EXACT model id Neokens accepts at api.quatarly.cloud, plus whether this
// UI id implies "thinking" mode.
//
// EDIT THIS to match your Neokens dashboard. If a UI id already equals the
// real Neokens id, you can omit it (unmapped ids pass through unchanged).
// Neokens currently lists Claude "-thinking" variants as literal model ids, so
// do not alias them to the non-thinking base ids here.
//
// Format:  "ui-id": { neokens: "real-neokens-id", thinking?: true }
// ─────────────────────────────────────────────────────────────────────────
export const NEOKENS_MODEL_MAP: Record<string, { neokens: string; thinking?: boolean }> = {
  // Everything else (gpt-*, gemini-*, claude-haiku-*) passes through unchanged
  // because the UI id already equals the real Neokens id. Add an entry here
  // only if your dashboard later uses a different id, e.g.:
  // "custom-ui-id": { neokens: "real-provider-id" },
};

// A Neokens model id that is known to work, used as a last-resort fallback when
// a selected model errors at the gateway. Set this to your most reliable id.
export const NEOKENS_SAFE_FALLBACK_MODEL = "gemini-3-flash";

// CometAPI fallback chain, tried in order, used as last-resort recovery when
// a selected model errors at the gateway (e.g. "no available channel for
// group default and model X" — that means the shared CometAPI account has no
// channel allocated for that model). Order from cheapest/most-stable to
// progressively heavier so builds always recover.
export const COMET_SAFE_FALLBACK_MODELS = [
  "deepseek-v4-flash",
  "gemini-3.1-flash-lite-preview",
  "deepseek-v3.2",
  "claude-sonnet-4-6",
  "claude-opus-4-7",
] as const;
// Backwards-compat: single id consumers still import.
export const COMET_SAFE_FALLBACK_MODEL = COMET_SAFE_FALLBACK_MODELS[0];

// Maps the app's UI model ids to the REAL CometAPI model ids.
// Comet's public model page URLs are dash-separated, but the API examples and
// version tables use dotted ids such as "gpt-5.4-mini", "qwen3.7-max", and
// "gemini-3.5-flash". Sending URL slugs like "gpt-5-4-mini" makes CometAPI
// return model_not_found.
export const COMET_MODEL_MAP: Record<string, { comet: string; thinking?: boolean }> = {
  // OpenAI
  "gpt-5.4-nano": { comet: "gpt-5.4-nano" },
  "gpt-5.4-mini": { comet: "gpt-5.4-mini" },
  "gpt-5.5-all": { comet: "gpt-5.5-all" },
  // DeepSeek
  "deepseek-v4-flash": { comet: "deepseek-v4-flash" },
  "deepseek-v3.2": { comet: "deepseek-v3.2", thinking: true },
  "deepseek-v4-pro": { comet: "deepseek-v4-pro" },
  // Moonshot Kimi / Zhipu GLM
  "kimi-k2.6": { comet: "kimi-k2.6" },
  "glm-5.1": { comet: "glm-5.1" },
  // MiniMax
  "minimax-m2.7": { comet: "minimax-m2.7" },
  "minimax-m2-7": { comet: "minimax-m2.7" },
  "minimax-m3": { comet: "minimax-m3" },
  // Qwen / Aliyun
  "qwen3.6-plus": { comet: "qwen3.6-plus" },
  "qwen3.5-397b-a17b": { comet: "qwen3.5-397b-a17b", thinking: true },
  "qwen3.7-max": { comet: "qwen3.7-max" },
  // Google Gemini
  "gemini-3-flash": { comet: "gemini-3-flash-preview" },
  "gemini-3.1-flash-lite-preview": { comet: "gemini-3.1-flash-lite-preview" },
  "gemini-3.5-flash": { comet: "gemini-3.5-flash" },
  "gemini-3.1-pro": { comet: "gemini-3.1-pro-preview" },
  "gemini-3-pro-preview": { comet: "gemini-3-pro-preview", thinking: true },
  // xAI Grok
  "grok-4.3": { comet: "grok-4.3" },
  "grok-4-2": { comet: "grok-4.2" },
  "grok-4.20-0309-reasoning": { comet: "grok-4.20-0309-reasoning", thinking: true },
  // Anthropic Claude (thinking variants enable extended thinking)
  "claude-haiku-4-5": { comet: "claude-haiku-4-5-20251001" },
  "claude-sonnet-4-6": { comet: "claude-sonnet-4-6" },
  "claude-opus-4-7": { comet: "claude-opus-4-7" },
  "claude-opus-4-8": { comet: "claude-opus-4-8" },
  "claude-sonnet-4-6-thinking": { comet: "claude-sonnet-4-6", thinking: true },
  "claude-opus-4-8-thinking": { comet: "claude-opus-4-8", thinking: true },
  // Pro premium experimental route
  "claude-fable-5": { comet: "claude-fable-5" },
};

/**
 * Resolve a UI model id to the real Neokens model id + thinking flag.
 * Unmapped ids pass through unchanged (thinking inferred from a "-thinking"
 * suffix as a safety net).
 */
export function resolveNeokensModel(uiModelId: string): { model: string; thinking: boolean } {
  const mapped = NEOKENS_MODEL_MAP[uiModelId];
  if (mapped) return { model: mapped.neokens, thinking: !!mapped.thinking };
  if (uiModelId.endsWith("-thinking")) {
    return { model: uiModelId, thinking: true };
  }
  return { model: uiModelId, thinking: false };
}

export function resolveCometModel(uiModelId: string): { model: string; thinking: boolean } {
  const mapped = COMET_MODEL_MAP[uiModelId];
  if (mapped) return { model: mapped.comet, thinking: !!mapped.thinking };
  if (uiModelId.endsWith("-thinking")) {
    return { model: uiModelId.slice(0, -"-thinking".length), thinking: true };
  }
  return { model: uiModelId, thinking: false };
}
