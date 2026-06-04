import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extract a human-readable message from an unknown caught value.
 * Use in `catch (e: unknown)` blocks instead of assuming `e.message` exists.
 */
export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string") return e || fallback;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

/**
 * Strip a reasoning model's "thinking" out of user-facing text.
 *
 * Some models (Groq gpt-oss / qwq, Comet reasoning routes, deepseek-r1) emit
 * their chain-of-thought inline in the response body — either wrapped in
 * <think>…</think> tags, or as bare prose like "We need to rewrite the
 * prompt…". If a small token budget cuts the model off mid-thought, that raw
 * reasoning is all we get back. This removes it so only the real answer shows.
 */
export function stripModelReasoning(raw: string | null | undefined): string {
  if (!raw) return "";
  let t = String(raw);

  // 1. Remove well-formed reasoning blocks: <think>…</think>, <thinking>…,
  //    <reason>…, <reasoning>…, <scratchpad>…, and [THINK]…[/THINK].
  t = t.replace(
    /<\s*(think|thinking|reason|reasoning|scratchpad)\s*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  t = t.replace(/\[\s*(think|thinking)\s*\][\s\S]*?\[\s*\/\s*\1\s*\]/gi, "");

  // 2. Drop any leftover lone reasoning tags (unbalanced/truncated).
  t = t.replace(/<\s*\/?\s*(think|thinking|reason|reasoning|scratchpad)\s*>/gi, "");

  // 3. If the model marked its final answer explicitly, keep only what follows
  //    the LAST such marker (handles "…thinking… Final answer: <result>").
  const markerRe =
    /(?:^|\n)\s*(?:final(?:\s+answer)?|answer|result|rewritten(?:\s+prompt)?|output|here(?:'s| is)(?:\s+the)?(?:\s+rewritten)?(?:\s+prompt)?)\s*[:\-—]\s*/gi;
  let lastMarkerEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(t)) !== null) lastMarkerEnd = m.index + m[0].length;
  if (lastMarkerEnd >= 0) {
    const after = t.slice(lastMarkerEnd).trim();
    if (after) t = after;
  }

  return t.trim();
}

/**
 * Heuristic: does this text look like a model's leaked chain-of-thought rather
 * than a clean answer? Used as a safety net so we can fall back to the user's
 * original input instead of showing reasoning garbage.
 */
export function looksLikeModelReasoning(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  const starters =
    /^(?:we need to\b|the user (?:wants|said|asked|just|already)\b|okay[,.\s]|alright[,.\s]|first[,.\s]|let me\b|let's\b|so[,.:\s]|i (?:should|need|will|can|think)\b|according to (?:the )?rule\b|hmm\b|now[,.\s]|thinking[:\s])/i;
  if (starters.test(trimmed)) return true;

  const head = trimmed.slice(0, 600).toLowerCase();
  const metaPhrases = [
    "rewrite the original prompt",
    "the original prompt",
    "output one sentence",
    "no markdown",
    "max 25",
    "hard cap",
    "keep it short",
    "according to rule",
    "the user wants",
    "we can infer",
    "should be made concrete",
    "max ~25 words",
  ];
  return metaPhrases.filter((p) => head.includes(p)).length >= 2;
}

