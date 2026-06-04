import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AiUsageLimitResult =
  | { limited: false; used: number; limit: number; resetAt: string | null; bypassed: boolean }
  | { limited: true; used: number; limit: number; resetAt: string; bypassed: false };

const DEFAULT_DAILY_LIMIT = 8;
const DEFAULT_WINDOW_HOURS = 24;
const EXPENSIVE_MODEL_WINDOW_HOURS = 24;

const EXPENSIVE_MODEL_LIMITS = [
  {
    pattern: /claude-opus-4-8/i,
    label: "Claude Opus 4.8",
    limit: Number(process.env.AI_CLAUDE_OPUS_48_DAILY_LIMIT || "1"),
  },
  {
    pattern: /claude-opus/i,
    label: "Claude Opus",
    limit: Number(process.env.AI_CLAUDE_OPUS_DAILY_LIMIT || "1"),
  },
  {
    pattern: /gpt-5\.[45]-pro|(?:^|\/)gpt-5\.4$|(?:^|\/)gpt-5\.5(?:$|-)/i,
    label: "premium GPT",
    limit: Number(process.env.AI_PREMIUM_MODEL_DAILY_LIMIT || "1"),
  },
] as const;

type RoleReader = {
  from(table: "user_roles"): {
    select(columns: string): {
      eq(column: string, value: string): PromiseLike<{ data: Array<{ role: string }> | null }>;
    };
  };
};

type RateLimitTable = {
  select(
    columns: string,
    options?: { count?: "exact" },
  ): {
    eq(
      column: string,
      value: string,
    ): {
      gte(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          options: { ascending: boolean },
        ): {
          limit(count: number): Promise<{
            count: number | null;
            data: Array<{
              created_at: string;
              source?: string | null;
              metadata?: Record<string, unknown> | null;
            }> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
  insert(row: {
    user_id: string;
    source: string;
    metadata: Record<string, unknown>;
  }): Promise<{ error?: { message?: string } | null }>;
};

function rateLimitTable() {
  return (supabaseAdmin as unknown as { from(table: "ai_rate_limit_events"): RateLimitTable }).from(
    "ai_rate_limit_events",
  );
}

function limitConfig() {
  const limit = Number(process.env.AI_DAILY_REQUEST_LIMIT || DEFAULT_DAILY_LIMIT);
  const windowHours = Number(process.env.AI_DAILY_WINDOW_HOURS || DEFAULT_WINDOW_HOURS);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_DAILY_LIMIT,
    windowHours:
      Number.isFinite(windowHours) && windowHours > 0
        ? Math.floor(windowHours)
        : DEFAULT_WINDOW_HOURS,
  };
}

export async function userBypassesAiLimit(userId: string, supabase: unknown): Promise<boolean> {
  try {
    const roleReader = supabase as RoleReader;
    const { data } = await roleReader.from("user_roles").select("role").eq("user_id", userId);
    return (data ?? []).some((r: { role: string }) =>
      ["owner", "admin", "moderator"].includes(r.role),
    );
  } catch {
    return false;
  }
}

function resetFromOldest(oldest: string | null | undefined, windowHours: number) {
  if (!oldest) return null;
  const time = Date.parse(oldest);
  if (!Number.isFinite(time)) return null;
  return new Date(time + windowHours * 60 * 60 * 1000).toISOString();
}

export async function checkAiUsageLimit(opts: {
  userId: string;
  supabase: unknown;
}): Promise<AiUsageLimitResult> {
  const bypassed = await userBypassesAiLimit(opts.userId, opts.supabase);
  const { limit, windowHours } = limitConfig();
  if (bypassed) return { limited: false, used: 0, limit, resetAt: null, bypassed: true };

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const { count, data, error } = await rateLimitTable()
    .select("created_at", { count: "exact" })
    .eq("user_id", opts.userId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error && !/relation .*ai_rate_limit_events.* does not exist/i.test(error.message ?? "")) {
    console.warn("[ai-limit] count failed:", error.message);
  }

  const used = count ?? 0;
  const resetAt = resetFromOldest(
    (data as Array<{ created_at: string }> | null)?.[0]?.created_at,
    windowHours,
  );
  if (used >= limit) {
    return {
      limited: true,
      used,
      limit,
      resetAt: resetAt ?? new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString(),
      bypassed: false,
    };
  }
  return { limited: false, used, limit, resetAt, bypassed: false };
}

export async function recordAiLimitUse(opts: {
  userId: string;
  supabase: unknown;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  if (await userBypassesAiLimit(opts.userId, opts.supabase)) return;
  try {
    await rateLimitTable().insert({
      user_id: opts.userId,
      source: opts.source,
      metadata: opts.metadata ?? {},
    });
  } catch (error) {
    console.warn("[ai-limit] record failed:", error instanceof Error ? error.message : error);
  }
}

export async function enforceAiUsageLimit(opts: {
  userId: string;
  supabase: unknown;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  const status = await checkAiUsageLimit(opts);
  if (status.limited) {
    const reset = new Date(status.resetAt).toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
    });
    throw new Error(
      `Daily AI limit reached (${status.used}/${status.limit}). Your timer resets ${reset}.`,
    );
  }
  await recordAiLimitUse(opts);
  return status;
}

function expensiveModelRule(modelName: string) {
  return EXPENSIVE_MODEL_LIMITS.find((rule) => rule.pattern.test(modelName));
}

export async function enforceExpensiveModelLimit(opts: {
  userId: string;
  supabase: unknown;
  provider: string;
  modelName: string;
}) {
  if (await userBypassesAiLimit(opts.userId, opts.supabase)) return;

  const rule = expensiveModelRule(opts.modelName);
  const limit = Number.isFinite(rule?.limit) ? Math.max(0, Math.floor(rule?.limit ?? 0)) : 0;
  if (!rule || limit <= 0) return;

  const since = new Date(Date.now() - EXPENSIVE_MODEL_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await rateLimitTable()
    .select("created_at,source,metadata")
    .eq("user_id", opts.userId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error && !/relation .*ai_rate_limit_events.* does not exist/i.test(error.message ?? "")) {
    console.warn("[ai-limit] expensive model count failed:", error.message);
  }

  const usedEvents = (data ?? []).filter((event) => {
    const model = String(event.metadata?.modelName ?? event.metadata?.model ?? "");
    return event.source === "expensive_model" && rule.pattern.test(model);
  });

  if (usedEvents.length >= limit) {
    const resetAt =
      resetFromOldest(usedEvents[0]?.created_at, EXPENSIVE_MODEL_WINDOW_HOURS) ??
      new Date(Date.now() + EXPENSIVE_MODEL_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const reset = new Date(resetAt).toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
    });
    throw new Error(
      `${rule.label} is limited to ${limit} use${limit === 1 ? "" : "s"} every 24 hours to protect BloxSmith AI credits. Try a cheaper model until ${reset}.`,
    );
  }

  await rateLimitTable().insert({
    user_id: opts.userId,
    source: "expensive_model",
    metadata: {
      provider: opts.provider,
      modelName: opts.modelName,
      label: rule.label,
      dailyLimit: limit,
    },
  });
}
