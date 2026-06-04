import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractAIText } from "@/lib/ai-gateway.server";

/**
 * Translate a chat message to a target language via Lovable AI Gateway.
 * Returns { text, detected, target }.
 */
export const translateChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      content: z.string().min(1).max(2000),
      target: z.string().min(2).max(20).default("English"),
    }).parse,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { text: data.content, detected: "unknown", target: data.target, ok: false as const };
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
                `You are a translator. Detect the language of the user's message and translate it into ${data.target}. ` +
                `Respond ONLY as compact JSON: {"detected":"<language name>","text":"<translation>"}. ` +
                `If the message is already in ${data.target}, set text equal to the original. Preserve emojis, @mentions, and #channel tags exactly.`,
            },
            { role: "user", content: data.content.slice(0, 1500) },
          ],
          temperature: 0,
          max_completion_tokens: 400,
        }),
      });
      if (!res.ok) {
        return { text: data.content, detected: "unknown", target: data.target, ok: false as const };
      }
      const json: any = await res.json();
      const raw: string = extractAIText(json);
      if (!raw) {
        console.error("Translation AI returned no visible text. Raw response:", JSON.stringify(json, null, 2));
      }
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { text: raw || data.content, detected: "unknown", target: data.target, ok: true as const };
      try {
        const parsed = JSON.parse(match[0]) as { detected?: string; text?: string };
        return {
          text: parsed.text || data.content,
          detected: parsed.detected || "unknown",
          target: data.target,
          ok: true as const,
        };
      } catch {
        return { text: raw, detected: "unknown", target: data.target, ok: true as const };
      }
    } catch {
      return { text: data.content, detected: "unknown", target: data.target, ok: false as const };
    }
  });
