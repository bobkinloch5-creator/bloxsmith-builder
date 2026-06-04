import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractAIText } from "@/lib/ai-gateway.server";

/**
 * AI moderation for Global Chat messages.
 * Uses the Lovable AI Gateway (gemini flash lite) to classify a message.
 * Returns { allow, severity, reason }.
 */
export const moderateChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      content: z.string().min(1).max(2000),
    }).parse,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { allow: true as boolean, severity: "ok", reason: null as string | null };
    }
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-lite-preview",
          messages: [
            {
              role: "system",
              content:
                'You are a strict chat moderator. Classify the user message as JSON: {"severity":"ok"|"warn"|"block","reason":"short reason or empty"}. Block: slurs, sexual content, doxxing, threats, hate, self-harm. Warn: heavy insults, harassment. Ok: everything else (including casual swearing). Respond with ONLY the JSON object.',
            },
            { role: "user", content: data.content.slice(0, 1000) },
          ],
          temperature: 0,
          max_completion_tokens: 80,
        }),
      });
      if (!res.ok) {
        return { allow: true, severity: "ok", reason: null };
      }
      const j: any = await res.json();
      const raw: string = extractAIText(j);
      if (!raw) {
        console.error("Moderation AI returned no visible text. Raw response:", JSON.stringify(j, null, 2));
      }
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { allow: true, severity: "ok", reason: null };
      const parsed = JSON.parse(match[0]);
      const severity = (parsed.severity || "ok") as "ok" | "warn" | "block";
      return {
        allow: severity !== "block",
        severity,
        reason: typeof parsed.reason === "string" ? parsed.reason : null,
      };
    } catch {
      return { allow: true, severity: "ok", reason: null };
    }
  });
