export const UI_GENERATOR_MODELS = [
  {
    id: "gemini-flash",
    label: "Gemini 3 Flash",
    provider: "neokens",
    model: "gemini-3-flash",
    credits: 2,
    tier: "Cheapest",
    description: "Fast, clean layouts for everyday menus, HUDs, shops, and simple screens.",
  },
  {
    id: "deepseek-flash",
    label: "DeepSeek V4 Flash",
    provider: "comet",
    model: "deepseek-v4-flash",
    credits: 3,
    tier: "Budget",
    description: "Stronger scripting and structured UI behavior while staying inexpensive.",
  },
  {
    id: "gpt-codex",
    label: "GPT 5.3 Codex",
    provider: "neokens",
    model: "gpt-5.3-codex",
    credits: 5,
    tier: "Balanced",
    description: "Reliable Luau wiring, complex menus, inventories, settings, and responsive HUDs.",
  },
  {
    id: "claude-sonnet",
    label: "Claude Sonnet 4.6",
    provider: "comet",
    model: "claude-sonnet-4-6",
    credits: 8,
    tier: "Advanced",
    description: "Polished composition, stronger UX decisions, and multi-panel game interfaces.",
  },
  {
    id: "gpt-premium",
    label: "GPT 5.4",
    provider: "neokens",
    model: "gpt-5.4",
    credits: 10,
    tier: "Premium",
    description:
      "High-detail UI systems with deeper reasoning, interactions, and visual hierarchy.",
  },
  {
    id: "claude-opus",
    label: "Claude Opus 4.7",
    provider: "comet",
    model: "claude-opus-4-7",
    credits: 15,
    tier: "Maximum",
    description:
      "Best quality for ambitious, highly themed, interconnected professional interfaces.",
  },
] as const;

export type UIGeneratorModelId = (typeof UI_GENERATOR_MODELS)[number]["id"];
export type UIGeneratorModel = (typeof UI_GENERATOR_MODELS)[number];

export const DEFAULT_UI_GENERATOR_MODEL_ID: UIGeneratorModelId = "gemini-flash";

export function getUIGeneratorModel(id: string | null | undefined): UIGeneratorModel {
  return (
    UI_GENERATOR_MODELS.find((model) => model.id === id) ??
    UI_GENERATOR_MODELS.find((model) => model.id === DEFAULT_UI_GENERATOR_MODEL_ID)!
  );
}
