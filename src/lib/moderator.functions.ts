import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_PROVIDER_MODELS } from "@/lib/ai-models";
import { hasCometApiKey } from "@/lib/comet-config.server";
import { hasNeokensApiKey } from "@/lib/neokens-config.server";

async function getRoles(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function assertModerator(userId: string) {
  const roles = await getRoles(userId);
  if (!roles.some((role) => role === "owner" || role === "admin" || role === "moderator")) {
    throw new Error("Forbidden");
  }
  return roles;
}

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const requireModerator = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertModerator(context.userId);
    return { isModerator: true };
  });

export const loadModeratorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await assertModerator(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roleRows }, { data: creditRows }, { data: actions }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id,display_name,credits,banned,ban_reason,created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin.from("user_roles").select("user_id,role"),
        supabaseAdmin
          .from("credit_transactions")
          .select("id,user_id,amount,tx_type,description,created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        (supabaseAdmin as any)
          .from("moderator_actions")
          .select("id,actor_id,target_user_id,action,amount,metadata,created_at")
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

    const authUsers = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const confirmed = new Map<string, boolean>();
    const emailMap = new Map<string, string>();
    if (!authUsers.error) {
      for (const authUser of authUsers.data.users) {
        confirmed.set(authUser.id, Boolean(authUser.email_confirmed_at));
        if (authUser.email) emailMap.set(authUser.id, authUser.email);
      }
    }

    const rolesByUser = new Map<string, string[]>();
    for (const row of (roleRows ?? []) as Array<{ user_id: string; role: string }>) {
      rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role]);
    }

    const users = (
      (profiles ?? []) as Array<{
        id: string;
        display_name: string | null;
        credits: number;
        banned: boolean;
        ban_reason: string | null;
        created_at: string;
      }>
    ).map((profile) => ({
      ...profile,
      email: emailMap.get(profile.id) ?? "",
      roles: rolesByUser.get(profile.id) ?? ["user"],
      email_confirmed: confirmed.get(profile.id) ?? false,
    }));

    const actionList = (actions ?? []) as Array<{
      actor_id: string;
      action: string;
      amount: number | null;
      created_at: string;
    }>;

    const todaysGifts = actionList
      .filter(
        (action) =>
          action.actor_id === userId &&
          action.action === "gift_credits" &&
          action.created_at >= todayIso(),
      )
      .reduce((sum, action) => sum + Math.max(0, action.amount ?? 0), 0);

    const todaysPromoCount = actionList.filter(
      (action) =>
        action.actor_id === userId &&
        action.action === "create_promo" &&
        action.created_at >= todayIso(),
    ).length;

    return {
      users,
      creditActivity: creditRows ?? [],
      moderatorActions: (actions ?? []) as any[],
      limits: {
        creditGiftUsed: todaysGifts,
        creditGiftLimit: 100,
        promoCreated: todaysPromoCount,
        promoLimit: 5,
        maxGiftAmount: 25,
        maxPromoCredits: 25,
        maxPromoUses: 25,
      },
    };
  });

export const moderatorGiftCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().int().min(1).max(25),
        reason: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertModerator(context.userId);
    const { supabase } = context;
    const { data: balance, error } = await (supabase as any).rpc("moderator_gift_credits", {
      _user_id: data.userId,
      _amount: data.amount,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { balance };
  });

export const moderatorCreatePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().trim().min(3).max(24),
        credits: z.number().int().min(1).max(25),
        maxRedemptions: z.number().int().min(1).max(25),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    await assertModerator(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (code.length < 3) throw new Error("Promo code must contain letters or numbers.");

    const { data: actions, error: actionErr } = await (supabaseAdmin as any)
      .from("moderator_actions")
      .select("id")
      .eq("actor_id", userId)
      .eq("action", "create_promo")
      .gte("created_at", todayIso());
    if (actionErr) throw new Error(actionErr.message);
    if ((actions ?? []).length >= 5) throw new Error("Moderator daily promo-code limit reached.");

    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("promo_codes").insert({
      code,
      credits: data.credits,
      max_redemptions: data.maxRedemptions,
      expires_at: expires,
      created_by: userId,
      active: true,
    });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("moderator_actions").insert({
      actor_id: userId,
      action: "create_promo",
      amount: data.credits,
      metadata: { code, max_redemptions: data.maxRedemptions, expires_at: expires },
    });

    return { code, credits: data.credits, maxRedemptions: data.maxRedemptions, expiresAt: expires };
  });

export const resendConfirmationForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), email: z.string().email() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertModerator(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    if (userErr) throw new Error(userErr.message);
    if (authUser.user?.email_confirmed_at) {
      return { sent: false, reason: "already_confirmed" };
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase publishable email settings.");

    const authClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const redirectTo =
      process.env.SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/dashboard`
        : "https://bloxsmith.pro/dashboard");
    const { error } = await authClient.auth.resend({
      type: "signup",
      email: data.email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("moderator_actions").insert({
      actor_id: context.userId,
      target_user_id: data.userId,
      action: "resend_confirmation",
      metadata: { email: data.email },
    });
    return { sent: true };
  });

export const getModeratorModelStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertModerator(context.userId);
    return {
      checkedAt: new Date().toISOString(),
      providers: Object.entries(SITE_PROVIDER_MODELS).map(([provider, models]) => ({
        provider,
        configured:
          provider === "groq"
            ? Boolean(process.env.GROQ_API_KEY)
            : provider === "neokens"
              ? hasNeokensApiKey()
              : provider === "comet"
                ? hasCometApiKey()
                : false,
        models,
      })),
    };
  });
