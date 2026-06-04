// Shared helper: wraps `generateText` so a Groq-side "tool call validation
// failed" (a.k.a. the AI invented a fake `json` tool) automatically retries
// once WITHOUT tools, asking the model for plain JSON.
//
// Fixes errors like:
//   Tool call validation failed: attempted to call tool 'json'
//   which was not in request.tools.

type GenerateTextFn = (opts: any) => Promise<{ text: string; [k: string]: any }>;

const TOOL_VALIDATION_RE =
  /tool[_ ]use[_ ]failed|tool call validation|attempted to call tool|tool .*not in request\.tools|tools? (are|is) not supported|function calling|invalid tool|unsupported.*tool/i;

const JSON_ONLY_INSTRUCTION = `

=== STRICT OUTPUT MODE (retry) ===
The previous attempt failed because this model could not complete tool calling.
Do NOT call any tools on this attempt. Use only the context and Roblox knowledge already in the prompt. Return ONLY a single valid JSON object
with the shape:
{ "message": string, "files": [...], "actions": [...] }
No markdown, no code fences, no commentary, no tool calls.`;

// Forces the model to convert whatever it just researched (tool results) into
// the final build JSON. Used when a tool-using run ends WITHOUT emitting a
// usable build object (the #1 cause of "empty bubble / nothing happens" for
// map / city / toolbox builds — the model spends all its steps calling
// roblox_asset_search and never writes the JSON).
const FINALIZE_INSTRUCTION = `

=== FINALIZE NOW (no more tools) ===
You have already gathered everything you need. Do NOT call any more tools.
Output the COMPLETE build as a single valid JSON object RIGHT NOW:
{ "message": string, "files": [...], "actions": [...] }
The "actions" array MUST contain the real build (create / script / insert_toolbox_asset / terrainFill / lighting / spawn ...). Use any assetIds you found from your tool calls.
For code/UI/gameplay requests, the "files" array MUST include complete Script, LocalScript, or ModuleScript source where needed.
An empty "files" array AND empty "actions" array is a FAILED response unless the user only asked a pure question. No markdown, no code fences, no commentary.`;

type BuildJsonShape = {
  hasContract: boolean;
  fileCount: number;
  actionCount: number;
};

function parseBuildJsonShape(text: string | null | undefined): BuildJsonShape | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || start >= end) return null;
  const slice = text.slice(start, end + 1);
  if (!/"actions"|"files"|"message"/.test(slice)) return null;

  const parse = (value: string) => JSON.parse(value.replace(/,\s*([}\]])/g, "$1"));
  try {
    const obj = parse(slice);
    if (!obj || typeof obj !== "object") return null;
    const fileCount = Array.isArray(obj.files) ? obj.files.length : 0;
    const actionCount = Array.isArray(obj.actions) ? obj.actions.length : 0;
    return {
      hasContract: "actions" in obj || "files" in obj,
      fileCount,
      actionCount,
    };
  } catch {
    return null;
  }
}

// Does the model's returned text actually contain a build JSON object with at
// least a message/files/actions shape? We are deliberately lenient: we only
// need to know "is there a parseable {…} that looks like our contract".
export function hasUsableBuildJson(text: string | null | undefined): boolean {
  return !!parseBuildJsonShape(text)?.hasContract;
}

function hasSubstantiveBuildPayload(text: string | null | undefined): boolean {
  const shape = parseBuildJsonShape(text);
  return !!shape?.hasContract && shape.fileCount + shape.actionCount > 0;
}

function flattenTextContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("\n");
  }
  return "";
}

function shouldRequireBuildPayload(opts: any): boolean {
  const promptText =
    typeof opts?.prompt === "string"
      ? opts.prompt
      : Array.isArray(opts?.messages)
        ? opts.messages.map((m: any) => flattenTextContent(m?.content)).join("\n")
        : "";
  if (!promptText) return false;
  const lower = promptText.toLowerCase();
  const looksLikePureQuestion =
    /\b(how|what|why|when|where|explain|tell me about)\b/.test(lower) &&
    !/\b(make|add|create|build|generate|spawn|insert|fix|update|change|polish|improve|better|gui|ui|menu|shop|map|script|tool|sound|music|game)\b/.test(
      lower,
    );
  if (looksLikePureQuestion) return false;
  return /\b(make|add|create|build|generate|spawn|insert|fix|update|change|polish|improve|better|premium|gui|ui|menu|shop|inventory|hud|map|world|game|script|tool|weapon|npc|enemy|sound|music|asset|toolbox|terrain|lighting|vfx|animation)\b/.test(
    lower,
  );
}

export type AIToolEvent = {
  tool: string;
  args?: unknown;
  result?: unknown;
  ok: boolean;
};

type ToolStep = {
  toolCalls?: Array<{
    toolName?: string;
    name?: string;
    args?: unknown;
    input?: unknown;
    toolCallId?: string;
  }>;
  toolResults?: Array<{
    toolCallId?: string;
    result?: unknown;
    output?: unknown;
    isError?: boolean;
  }>;
};

export function extractToolActivity(
  textRes: { steps?: ToolStep[] } | null | undefined,
): AIToolEvent[] {
  const steps = textRes?.steps ?? [];
  const events: AIToolEvent[] = [];
  for (const step of steps) {
    const calls = step?.toolCalls ?? [];
    const results = step?.toolResults ?? [];
    for (const c of calls) {
      const toolName = c.toolName ?? c.name ?? "tool";
      const args = c.args ?? c.input ?? undefined;
      const matched = results.find((r) => r.toolCallId === c.toolCallId);
      const resultVal = matched?.result ?? matched?.output;
      const ok =
        !matched?.isError &&
        !(
          resultVal &&
          typeof resultVal === "object" &&
          "error" in resultVal &&
          (resultVal as { error?: unknown }).error
        );
      events.push({ tool: toolName, args, result: resultVal, ok });
    }
  }
  return events;
}

export async function generateTextWithToolFallback(
  generateText: GenerateTextFn,
  opts: any,
  label: string,
) {
  const hasTools = !!opts?.tools && Object.keys(opts.tools).length > 0;
  console.log(
    `[ai] ${label} call → tools=${hasTools ? Object.keys(opts.tools).length : 0} model=${opts?.model?.modelId ?? "unknown"}`,
  );
  try {
    const res = await generateText(opts);

    // RECOVERY: a tool-using run that ended WITHOUT a build JSON object.
    // This is the main reason map / city / "insert from toolbox" requests
    // come back as an empty assistant bubble: the model burns its step budget
    // on roblox_asset_search calls and stops before writing the final JSON.
    // We force ONE toolless follow-up that turns the gathered context into the
    // build object. (Grass/shop/etc. never hit this — they use instant
    // templates and skip the model entirely.)
    const needsBuildPayload = shouldRequireBuildPayload(opts);
    const emptyBuildPayload = needsBuildPayload && !hasSubstantiveBuildPayload(res?.text);
    if (hasTools && (!hasUsableBuildJson(res?.text) || emptyBuildPayload)) {
      const toolEvents = extractToolActivity(res as any);
      console.warn(
        `[ai] ${label}: tool run produced ${emptyBuildPayload ? "empty build JSON" : "no build JSON"} (text len=${(res?.text ?? "").length}, toolCalls=${toolEvents.length}). Forcing finalize step.`,
      );
      const { tools: _ft, stopWhen: _fs, ...rest } = opts;

      // Feed what the model just did/said back to it so the finalize step has
      // the asset IDs and reasoning available.
      const priorText = (res?.text ?? "").slice(0, 6000);
      const toolSummary = toolEvents
        .slice(0, 24)
        .map((e) => {
          let r = "";
          try {
            r = typeof e.result === "string" ? e.result : JSON.stringify(e.result);
          } catch {
            r = "";
          }
          return `- ${e.tool}(${JSON.stringify(e.args ?? {})}) → ${(r || "(ok)").slice(0, 400)}`;
        })
        .join("\n");

      const gatheredBlock =
        (priorText ? priorText + "\n\n" : "") +
        (toolSummary ? `Tool results gathered:\n${toolSummary}\n\n` : "");

      // Callers use EITHER `messages` (chat-style) OR `prompt` (single-string).
      // Support both so the finalize step never sends an invalid request.
      let finalizeFields: Record<string, unknown>;
      if (Array.isArray(opts.messages)) {
        finalizeFields = {
          messages: [
            ...opts.messages,
            {
              role: "assistant" as const,
              content: gatheredBlock || "(researched; ready to finalize)",
            },
            {
              role: "user" as const,
              content:
                "Now output the final build as a single valid JSON object. Do not call any tools. Include real actions.",
            },
          ],
        };
      } else {
        finalizeFields = {
          prompt:
            (opts.prompt ?? "") +
            "\n\n" +
            (gatheredBlock ? gatheredBlock + "\n" : "") +
            "Now output the final build as a single valid JSON object. Do not call any tools. Include real actions.",
        };
      }

      try {
        const finalized = await generateText({
          ...rest,
          system: (opts.system ?? "") + FINALIZE_INSTRUCTION,
          ...finalizeFields,
        });
        if (
          hasUsableBuildJson(finalized?.text) &&
          (!needsBuildPayload || hasSubstantiveBuildPayload(finalized?.text))
        ) {
          console.log(`[ai] ${label}: finalize step recovered a build JSON.`);
          // Preserve the original tool activity for the UI.
          return { ...finalized, steps: [...(res?.steps ?? []), ...(finalized?.steps ?? [])] };
        }
        console.warn(`[ai] ${label}: finalize step still produced no usable JSON.`);
        return finalized?.text ? finalized : res;
      } catch (finErr) {
        console.warn(
          `[ai] ${label}: finalize step threw, returning original result. ${String(finErr).slice(0, 200)}`,
        );
        return res;
      }
    }

    return res;
  } catch (err: unknown) {
    const msg = String(err instanceof Error ? err.message : err);
    if (!TOOL_VALIDATION_RE.test(msg)) throw err;

    console.warn(
      `[ai] ${label}: tool validation failed, retrying without tools. raw=${msg.slice(0, 240)}`,
    );

    // Strip tools/stopWhen and append a strict JSON-only instruction.
    const { tools: _t, stopWhen: _s, ...rest } = opts;
    const retrySystem = (opts.system ?? "") + JSON_ONLY_INSTRUCTION;
    const retried = await generateText({
      ...rest,
      system: retrySystem,
    });
    console.log(`[ai] ${label}: retry without tools succeeded`);
    return retried;
  }
}
