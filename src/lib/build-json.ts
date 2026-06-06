// Robust extraction of the strict build JSON object from a model's raw text
// output. Handles markdown code fences, a leading sentence before the JSON,
// trailing commas, and raw newlines/tabs inside Luau source strings — all
// common reasons a build came back "empty" even though the model produced one.
//
// CRITICAL for "thin builds": when a large build hits the model's max-output
// token cap, the JSON is TRUNCATED mid-stream and its top-level brackets never
// close. The strict parses below all fail, which previously made the whole
// build resolve to null → an empty { files: [], actions: [] } result, throwing
// away a nearly-complete build. salvageTruncatedJson recovers every COMPLETE
// files/actions entry instead, so a cut-off city build still lands the parts
// the model finished rather than nothing.
//
// This module is intentionally dependency-free so it can be unit-tested in
// isolation (see build-json.test.ts).

export type BuildJson = { message?: string; files?: unknown[]; actions?: unknown[] };

export function extractBuildJson(raw: string): BuildJson | null {
  if (!raw) return null;
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1] && fence[1].includes("{")) text = fence[1].trim();

  const start = text.indexOf("{");
  if (start === -1) return null;

  const end = text.lastIndexOf("}");
  // No closing brace at all → output was cut off before any top-level close.
  // Salvage what completed from the first "{" onward.
  if (end === -1 || start >= end) {
    return salvageTruncatedJson(text.slice(start));
  }

  const slice = text.slice(start, end + 1);

  const attempts = [
    slice,
    slice.replace(/,\s*([}\]])/g, "$1"),
    slice
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
        m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"),
      ),
  ];
  for (const a of attempts) {
    try {
      const obj = JSON.parse(a);
      if (obj && typeof obj === "object") return obj as BuildJson;
    } catch {
      /* try next */
    }
  }

  // Strict parses failed — almost always truncated output. Salvage from `start`
  // (the full remaining text, not the trimmed slice) so a "}" that merely closed
  // an incomplete nested value isn't mistaken for the real top-level close.
  return salvageTruncatedJson(text.slice(start));
}

// Recover a valid object from a truncated JSON string by cutting at the last
// position where a complete value had just closed, then appending the closers
// for every still-open bracket. Bracket/quote scanning is string-aware, so
// braces and brackets inside string literals are ignored.
export function salvageTruncatedJson(input: string): BuildJson | null {
  let inStr = false;
  let esc = false;
  const stack: string[] = []; // expected closing chars, in the order opened
  let bestCut = -1; // exclusive index just after the last complete value
  let bestStack: string[] = []; // still-open closers at bestCut

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length === 0) break; // unbalanced extra closer — stop scanning
      stack.pop();
      // A complete value just closed: the text up to here is parseable once the
      // still-open parent brackets are closed. Record it as a safe cut point.
      bestCut = i + 1;
      bestStack = stack.slice();
    }
  }

  if (bestCut === -1) return null;

  // Close the still-open parents innermost-first (reverse of open order). Any
  // trailing comma after the last complete value is naturally excluded because
  // bestCut sits right after the value's closing bracket, before the comma.
  const closers = bestStack.slice().reverse().join("");
  const repaired = input.slice(0, bestCut) + closers;
  try {
    const obj = JSON.parse(repaired);
    return obj && typeof obj === "object" ? (obj as BuildJson) : null;
  } catch {
    return null;
  }
}
