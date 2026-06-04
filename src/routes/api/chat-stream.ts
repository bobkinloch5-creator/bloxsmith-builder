import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

type Provider = "lovable" | "comet" | "neokens";

const MODEL_CONFIG: Record<string, { cost: number; provider: Provider; upstreamId?: string }> = {
  // Lovable AI Gateway
  "google/gemini-3-flash-preview": { cost: 1, provider: "lovable" },
  "google/gemini-2.5-flash": { cost: 1, provider: "lovable" },
  "google/gemini-2.5-flash-lite": { cost: 1, provider: "lovable" },
  "google/gemini-2.5-pro": { cost: 3, provider: "lovable" },
  "openai/gpt-5-nano": { cost: 1, provider: "lovable" },
  "openai/gpt-5-mini": { cost: 2, provider: "lovable" },
  "openai/gpt-5": { cost: 5, provider: "lovable" },
  // CometAPI — premium models
  "anthropic/claude-sonnet-4-5": { cost: 8, provider: "comet", upstreamId: "claude-sonnet-4-5" },
  "anthropic/claude-opus-4-1": { cost: 15, provider: "comet", upstreamId: "claude-opus-4-1" },
  "xai/grok-4": { cost: 8, provider: "comet", upstreamId: "grok-4-0709" },
  "xai/grok-code-fast-1": { cost: 4, provider: "comet", upstreamId: "grok-code-fast-1" },
  // Neokens / Quatarly Cloud (OpenAI-compatible at https://api.quatarly.cloud/v1)
  "gemini-3-flash": { cost: 1, provider: "neokens" },
  "gemini-3.1-pro": { cost: 3, provider: "neokens" },
  "claude-haiku-4-5-20251001": { cost: 1, provider: "neokens" },
  "claude-sonnet-4-6-thinking": { cost: 3, provider: "neokens" },
  "claude-opus-4-7-thinking": { cost: 7, provider: "neokens" },
  "gpt-5.1": { cost: 2, provider: "neokens" },
  "gpt-5.2": { cost: 3, provider: "neokens" },
  "gpt-5.3-codex": { cost: 2, provider: "neokens" },
  "gpt-5.4": { cost: 4, provider: "neokens" },
  "gpt-5.5": { cost: 6, provider: "neokens" },
};
const ALLOWED_MODELS = new Set(Object.keys(MODEL_CONFIG));

const SYSTEM_PROMPT = `You are BloxSmith, an expert AI assistant for building Roblox games.
You help users design games, write Luau scripts, build maps, create assets, and ship full Roblox experiences.
Always produce clean, working Luau code when asked, explain decisions briefly, and ask for clarification only when truly necessary.`;

export const Route = createFileRoute("/api/chat-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization") || "";
          const token = authHeader.replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401 });

          const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: userData, error: userErr } = await sb.auth.getUser(token);
          if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          const body = await request.json().catch(() => ({}));
          const chatId: string | undefined = body.chatId;
          const userMessage: string = (body.message || "").toString().slice(0, 8000).trim();
          const model: string = ALLOWED_MODELS.has(body.model)
            ? body.model
            : "google/gemini-3-flash-preview";
          if (!userMessage) return new Response("Empty message", { status: 400 });

          const modelCfg = MODEL_CONFIG[model];
          const cost = modelCfg.cost;

          // Deduct credits
          const { data: spent, error: spendErr } = await sb.rpc("spend_credits", {
            _user_id: userId,
            _amount: cost,
            _description: `Chat (${model})`,
            _metadata: { model },
          });
          if (spendErr || !spent) {
            return new Response(
              JSON.stringify({ error: "insufficient_credits", message: "Not enough credits. Visit /pricing to top up." }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }

          // Ensure chat exists
          let activeChatId = chatId;
          if (!activeChatId) {
            const { data: newChat, error: chatErr } = await sb
              .from("chats")
              .insert({
                user_id: userId,
                title: userMessage.slice(0, 60),
                model,
              })
              .select("id")
              .single();
            if (chatErr || !newChat) return new Response("Could not create chat", { status: 500 });
            activeChatId = newChat.id;
          } else {
            await sb.from("chats").update({ updated_at: new Date().toISOString(), model }).eq("id", activeChatId).eq("user_id", userId);
          }

          // Save user message
          await sb.from("chat_messages").insert({
            chat_id: activeChatId,
            user_id: userId,
            role: "user",
            content: userMessage,
          });

          // Load history
          const { data: history } = await sb
            .from("chat_messages")
            .select("role, content")
            .eq("chat_id", activeChatId)
            .order("created_at", { ascending: true })
            .limit(40);

          const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
          ];

          let upstreamUrl: string;
          let upstreamKey: string | undefined;
          let upstreamModel: string;
          if (modelCfg.provider === "comet") {
            upstreamUrl = "https://api.cometapi.com/v1/chat/completions";
            upstreamKey = process.env.COMETAPI_KEY || process.env.COMET_API_KEY;
            upstreamModel = modelCfg.upstreamId || model;
            if (!upstreamKey) {
              await Promise.resolve(sb.rpc("spend_credits", { _user_id: userId, _amount: -cost, _description: "Refund: CometAPI not configured", _metadata: { model } })).catch(() => {});
              return new Response(
                JSON.stringify({ error: "comet_not_configured", message: "Premium models require CometAPI to be configured by the admin." }),
                { status: 503, headers: { "Content-Type": "application/json" } },
              );
            }
          } else if (modelCfg.provider === "neokens") {
            upstreamUrl = "https://api.quatarly.cloud/v1/chat/completions";
            upstreamKey =
              process.env.NEOKENS_API_KEY ||
              process.env.NEOKENS_KEY ||
              process.env.ANTHROPIC_API_KEY ||
              process.env.ANTHROPIC_AUTH_TOKEN;
            upstreamModel = modelCfg.upstreamId || model;
            if (!upstreamKey) {
              await Promise.resolve(sb.rpc("spend_credits", { _user_id: userId, _amount: -cost, _description: "Refund: Neokens not configured", _metadata: { model } })).catch(() => {});
              return new Response(
                JSON.stringify({ error: "neokens_not_configured", message: "Neokens models require NEOKENS_API_KEY to be configured by the admin." }),
                { status: 503, headers: { "Content-Type": "application/json" } },
              );
            }
          } else {
            upstreamUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
            upstreamKey = process.env.LOVABLE_API_KEY;
            upstreamModel = model;
          }

          const upstream = await fetch(upstreamUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${upstreamKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: upstreamModel, messages, stream: true }),
          });

          if (!upstream.ok || !upstream.body) {
            const errText = await upstream.text().catch(() => "");
            const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 500;
            return new Response(
              JSON.stringify({
                error: status === 429 ? "rate_limited" : status === 402 ? "ai_credits" : "ai_error",
                message: errText || "AI gateway error",
              }),
              { status, headers: { "Content-Type": "application/json" } },
            );
          }

          // Tee stream: pass through to client AND accumulate full text, then persist assistant msg + emit chat id event
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let fullText = "";
          let buffer = "";

          const stream = new ReadableStream({
            async start(controller) {
              // First, send chat metadata
              controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ chatId: activeChatId, model, cost })}\n\n`));

              const reader = upstream.body!.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
                buffer += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buffer.indexOf("\n")) !== -1) {
                  const line = buffer.slice(0, idx).replace(/\r$/, "");
                  buffer = buffer.slice(idx + 1);
                  if (!line.startsWith("data: ")) continue;
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (typeof delta === "string") fullText += delta;
                  } catch {}
                }
              }

              // Persist assistant message
              if (fullText.trim()) {
                await sb.from("chat_messages").insert({
                  chat_id: activeChatId!,
                  user_id: userId,
                  role: "assistant",
                  content: fullText,
                  metadata: { model },
                });
              }
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (e: any) {
          return new Response(
            JSON.stringify({ error: "server_error", message: e?.message || "Unexpected error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
