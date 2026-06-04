import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { prompt?: string; size?: string };
        try {
          body = (await request.json()) as { prompt?: string; size?: string };
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }
        const prompt = (body.prompt ?? "").toString().trim();
        if (!prompt || prompt.length > 4000) {
          return new Response("prompt is required (1-4000 chars)", { status: 400 });
        }
        const size = body.size === "1536x1024" || body.size === "1024x1536" ? body.size : "1024x1024";

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-image-2",
            prompt,
            quality: "low",
            size,
            stream: true,
            partial_images: 2,
          }),
          signal: request.signal,
        });
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Image generation failed", { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
