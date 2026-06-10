export const REASONING_LEVELS = [
  {
    id: "fast",
    label: "Fast / Low Reasoning",
    shortLabel: "Fast",
    description: "Cheaper credits, quicker answers.",
    multiplier: 0.75,
  },
  {
    id: "balanced",
    label: "Balanced Reasoning",
    shortLabel: "Balanced",
    description: "Normal credit cost, better quality.",
    multiplier: 1,
  },
  {
    id: "deep",
    label: "Deep Reasoning",
    shortLabel: "Deep",
    description: "Higher credit cost, smarter planning and stronger results.",
    multiplier: 1.75,
  },
  {
    id: "maximum",
    label: "Maximum Reasoning",
    shortLabel: "Maximum",
    description: "Most credits, best for full games, complex scripts, debugging, and big projects.",
    multiplier: 2.75,
  },
] as const;

export type ReasoningLevel = (typeof REASONING_LEVELS)[number]["id"];

export const DEFAULT_REASONING_LEVEL: ReasoningLevel = "balanced";

export function getReasoningLevel(level: string | null | undefined) {
  return REASONING_LEVELS.find((item) => item.id === level) ?? REASONING_LEVELS[1];
}

export function shouldUseThinking(level: ReasoningLevel) {
  return level === "deep" || level === "maximum";
}

export function normalizeReasoningLevel(
  level: string | null | undefined,
  thinkingFallback = false,
): ReasoningLevel {
  if (level === "fast" || level === "balanced" || level === "deep" || level === "maximum") {
    return level;
  }
  return thinkingFallback ? "deep" : DEFAULT_REASONING_LEVEL;
}

export function applyReasoningCreditMultiplier(baseCost: number, level: ReasoningLevel) {
  const multiplier = getReasoningLevel(level).multiplier;
  return Math.max(1, Math.ceil(baseCost * multiplier));
}

export function estimateReasoningCredits(
  baseCost: number,
  modelMultiplier: number,
  level: ReasoningLevel,
) {
  return Math.max(1, Math.ceil(baseCost * modelMultiplier * getReasoningLevel(level).multiplier));
}
