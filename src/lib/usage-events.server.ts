import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function recordAiUsageEvent(opts: {
  userId?: string | null;
  source: string;
  creditsUsed?: number;
  model?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!opts.userId) return;
  const credits = Math.max(0, Math.floor(opts.creditsUsed ?? 0));

  try {
    const { error } = await supabaseAdmin.from("ai_usage_events").insert({
      user_id: opts.userId,
      source: opts.source,
      credits_used: credits,
      model: opts.model ?? null,
      metadata: opts.metadata ?? {},
    } as any);
    if (!error) return;
  } catch {
    // Fall through to legacy schemas that only had user_id + created_at.
  }

  try {
    await supabaseAdmin.from("ai_usage_events").insert({ user_id: opts.userId } as any);
  } catch {
    // Usage analytics must never break a successful generation.
  }
}
