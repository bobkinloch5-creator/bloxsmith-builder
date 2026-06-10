import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Role = "owner" | "admin" | "moderator" | "user";

async function getAdminContext(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row: { role: string }) => row.role as Role);
  if (!roles.some((role) => role === "admin" || role === "owner")) {
    throw new Error("Forbidden");
  }
  return { supabaseAdmin, roles, isOwner: roles.includes("owner") };
}

async function requireOwner(userId: string) {
  const context = await getAdminContext(userId);
  if (!context.isOwner) throw new Error("Only the owner can perform this action.");
  return context;
}

async function targetRoles(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { role: string }) => row.role as Role);
}

async function assertTargetAllowed(opts: {
  actorId: string;
  targetUserId: string;
  ownerOnly?: boolean;
}) {
  const actor = opts.ownerOnly
    ? await requireOwner(opts.actorId)
    : await getAdminContext(opts.actorId);
  const roles = await targetRoles(opts.targetUserId);
  if (roles.includes("owner")) throw new Error("The owner account is protected.");
  if (!actor.isOwner && roles.includes("admin")) {
    throw new Error("Admins cannot modify another admin account.");
  }
  return actor;
}

async function writeAudit(opts: {
  actorId: string;
  targetUserId?: string | null;
  action: string;
  amount?: number | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("moderator_actions").insert({
      actor_id: opts.actorId,
      target_user_id: opts.targetUserId ?? null,
      action: opts.action,
      amount: opts.amount ?? null,
      metadata: opts.metadata ?? {},
    });
  } catch (error) {
    console.warn("[admin] audit log skipped:", error instanceof Error ? error.message : error);
  }
}

async function writeCreditLedger(opts: {
  userId: string;
  amount: number;
  balance: number;
  reason: string;
  actorId: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const modern = await (supabaseAdmin as any).from("credit_transactions").insert({
    user_id: opts.userId,
    amount: opts.amount,
    tx_type: opts.amount >= 0 ? "grant" : "spend",
    description: opts.reason,
    metadata: { balance: opts.balance, actor_id: opts.actorId },
  });
  if (!modern.error) return;

  const legacy = await (supabaseAdmin as any).from("credit_transactions").insert({
    user_id: opts.userId,
    amount: opts.amount,
    balance: opts.balance,
    reason: opts.reason,
  });
  if (legacy.error) {
    console.warn("[admin] credit ledger insert skipped:", legacy.error.message);
  }
}

export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdminContext(context.userId);
    return { isAdmin: true, isOwner: admin.isOwner };
  });

export const loadAdminDashboardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, isOwner } = await getAdminContext(context.userId);

    const [
      profilesResult,
      rolesResult,
      projectsResult,
      generationsResult,
      paymentsResult,
      subscriptionRequestsResult,
      promosResult,
      submissionsResult,
      creditsResult,
      actionsResult,
      userCount,
      projectCount,
      generationCount,
      authUsers,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,user_id,display_name,credits,banned,ban_reason,created_at")
        .order("created_at", { ascending: false })
        .limit(250),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("projects").select("user_id").limit(10_000),
      supabaseAdmin.from("generations").select("user_id").limit(10_000),
      (supabaseAdmin as any)
        .from("payment_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any)
        .from("subscription_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("promotion_submissions")
        .select("id,user_id,platform,url,note,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("credit_transactions")
        .select("id,user_id,amount,tx_type,description,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      (supabaseAdmin as any)
        .from("moderator_actions")
        .select("id,actor_id,target_user_id,action,amount,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("projects").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("generations").select("id", { count: "exact", head: true }),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const requiredErrors = [
      profilesResult.error,
      rolesResult.error,
      projectsResult.error,
      generationsResult.error,
      paymentsResult.error,
      subscriptionRequestsResult.error &&
        !/does not exist|schema cache/i.test(subscriptionRequestsResult.error.message),
      promosResult.error,
      submissionsResult.error,
      creditsResult.error,
    ].filter(Boolean);
    if (requiredErrors.length) {
      throw new Error(requiredErrors.map((error: any) => error.message).join("; "));
    }

    const emails = new Map<string, string>();
    const confirmed = new Map<string, boolean>();
    if (!authUsers.error) {
      for (const authUser of authUsers.data.users) {
        if (authUser.email) emails.set(authUser.id, authUser.email);
        confirmed.set(authUser.id, Boolean(authUser.email_confirmed_at));
      }
    }

    const roles = new Map<string, string[]>();
    for (const row of (rolesResult.data ?? []) as Array<{ user_id: string; role: string }>) {
      roles.set(row.user_id, [...(roles.get(row.user_id) ?? []), row.role]);
    }
    const projectCounts = new Map<string, number>();
    for (const row of (projectsResult.data ?? []) as Array<{ user_id: string }>) {
      projectCounts.set(row.user_id, (projectCounts.get(row.user_id) ?? 0) + 1);
    }
    const generationCounts = new Map<string, number>();
    for (const row of (generationsResult.data ?? []) as Array<{ user_id: string }>) {
      generationCounts.set(row.user_id, (generationCounts.get(row.user_id) ?? 0) + 1);
    }

    const users = ((profilesResult.data ?? []) as any[]).map((profile) => {
      const authUserId = profile.user_id || profile.id;
      return {
        id: authUserId,
        email: emails.get(authUserId) ?? "",
        display_name: profile.display_name,
        credits: Number(profile.credits ?? 0),
        banned: Boolean(profile.banned),
        ban_reason: profile.ban_reason,
        roles: roles.get(authUserId) ?? ["user"],
        projects: projectCounts.get(authUserId) ?? 0,
        generations: generationCounts.get(authUserId) ?? 0,
        email_confirmed: confirmed.get(authUserId) ?? false,
        created_at: profile.created_at,
      };
    });

    return {
      isOwner,
      stats: {
        users: userCount.count ?? users.length,
        projects: projectCount.count ?? projectsResult.data?.length ?? 0,
        generations: generationCount.count ?? generationsResult.data?.length ?? 0,
        banned: users.filter((user) => user.banned).length,
        pendingPayments: paymentsResult.data?.length ?? 0,
        pendingSubscriptions: subscriptionRequestsResult.error
          ? 0
          : (subscriptionRequestsResult.data?.length ?? 0),
        pendingPromotions: submissionsResult.data?.length ?? 0,
      },
      users,
      paymentRequests: paymentsResult.data ?? [],
      subscriptionRequests: subscriptionRequestsResult.error
        ? []
        : (subscriptionRequestsResult.data ?? []),
      promos: promosResult.data ?? [],
      promotionSubmissions: submissionsResult.data ?? [],
      creditActivity: creditsResult.data ?? [],
      moderatorActions: actionsResult.error ? [] : (actionsResult.data ?? []),
    };
  });

export type AdminAdjustCreditsResult = { ok: true; credits: number } | { ok: false; error: string };

const creditInput = z.object({
  userId: z.string().uuid(),
  amount: z
    .number()
    .int()
    .refine((number) => number !== 0 && Math.abs(number) <= 1_000_000),
  reason: z.string().trim().min(1).max(120),
});

export const adminAdjustCreditsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creditInput.parse(input))
  .handler(async ({ data, context }): Promise<AdminAdjustCreditsResult> => {
    try {
      const { supabaseAdmin } = await assertTargetAllowed({
        actorId: context.userId,
        targetUserId: data.userId,
        ownerOnly: true,
      });
      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .or(`id.eq.${data.userId},user_id.eq.${data.userId}`)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!profile) throw new Error("User profile not found.");

      const current = Number((profile as { credits: number | null }).credits ?? 0);
      const next = Math.max(0, current + data.amount);
      const actualDelta = next - current;
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ credits: next, updated_at: new Date().toISOString() })
        .or(`id.eq.${data.userId},user_id.eq.${data.userId}`);
      if (updateError) throw new Error(updateError.message);

      await writeCreditLedger({
        userId: data.userId,
        amount: actualDelta,
        balance: next,
        reason: data.reason,
        actorId: context.userId,
      });
      await writeAudit({
        actorId: context.userId,
        targetUserId: data.userId,
        action: actualDelta >= 0 ? "admin_grant_credits" : "admin_remove_credits",
        amount: actualDelta,
        metadata: { balance: next, reason: data.reason },
      });
      return { ok: true, credits: next };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Credit update failed." };
    }
  });

export const adminSetCreditBalanceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        balance: z.number().int().min(0).max(10_000_000),
        reason: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await assertTargetAllowed({
      actorId: context.userId,
      targetUserId: data.userId,
      ownerOnly: true,
    });
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .or(`id.eq.${data.userId},user_id.eq.${data.userId}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("User profile not found.");
    const previous = Number(profile.credits ?? 0);
    const delta = data.balance - previous;
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ credits: data.balance, updated_at: new Date().toISOString() })
      .or(`id.eq.${data.userId},user_id.eq.${data.userId}`);
    if (updateError) throw new Error(updateError.message);
    if (delta !== 0) {
      await writeCreditLedger({
        userId: data.userId,
        amount: delta,
        balance: data.balance,
        reason: data.reason,
        actorId: context.userId,
      });
    }
    await writeAudit({
      actorId: context.userId,
      targetUserId: data.userId,
      action: "admin_set_credit_balance",
      amount: delta,
      metadata: { previous, balance: data.balance, reason: data.reason },
    });
    return { credits: data.balance };
  });

export const adminSetBanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        banned: z.boolean(),
        reason: z.string().trim().max(240).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertTargetAllowed({
      actorId: context.userId,
      targetUserId: data.userId,
    });
    if (data.banned && !data.reason) throw new Error("A ban reason is required.");
    const { error } = await actor.supabaseAdmin
      .from("profiles")
      .update({
        banned: data.banned,
        ban_reason: data.banned ? data.reason : null,
        banned_at: data.banned ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${data.userId},user_id.eq.${data.userId}`);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId,
      targetUserId: data.userId,
      action: data.banned ? "ban_user" : "unban_user",
      metadata: { reason: data.reason },
    });
    return { banned: data.banned };
  });

export const adminSetRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "moderator"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await assertTargetAllowed({
      actorId: context.userId,
      targetUserId: data.userId,
      ownerOnly: true,
    });
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    await writeAudit({
      actorId: context.userId,
      targetUserId: data.userId,
      action: data.grant ? `grant_${data.role}` : `revoke_${data.role}`,
    });
    return { role: data.role, granted: data.grant };
  });

export const adminResetAiUsageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), reason: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await assertTargetAllowed({
      actorId: context.userId,
      targetUserId: data.userId,
    });
    let deleted = 0;
    for (const table of ["ai_rate_limit_events", "ai_usage_events"] as const) {
      const { data: rows, error } = await (supabaseAdmin as any)
        .from(table)
        .delete()
        .eq("user_id", data.userId)
        .select("id");
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        throw new Error(error.message);
      }
      deleted += rows?.length ?? 0;
    }
    await writeAudit({
      actorId: context.userId,
      targetUserId: data.userId,
      action: "reset_ai_usage",
      metadata: { deleted, reason: data.reason },
    });
    return { deleted };
  });

const promoInput = z.object({
  code: z.string().trim().min(3).max(32),
  promoType: z.enum(["credits", "purchase_discount", "purchase_bonus"]),
  credits: z.number().int().min(1).max(1_000_000),
  discountPercent: z.number().int().min(1).max(95).nullable(),
  minimumAmount: z.number().min(0).max(100_000),
  appliesTo: z.string().trim().min(1).max(40),
  maxRedemptions: z.number().int().min(1).max(1_000_000).nullable(),
  expiresAt: z.string().datetime().nullable(),
});

export const adminCreatePromoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => promoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireOwner(context.userId);
    const code = data.code.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (code.length < 3) throw new Error("Promo code must contain at least 3 letters or numbers.");
    const { error } = await supabaseAdmin.from("promo_codes").insert({
      code,
      promo_type: data.promoType,
      credits: data.promoType === "credits" ? data.credits : 1,
      discount_percent: data.promoType === "credits" ? null : data.discountPercent,
      minimum_amount: data.minimumAmount,
      applies_to: data.appliesTo,
      max_redemptions: data.maxRedemptions,
      expires_at: data.expiresAt,
      created_by: context.userId,
      active: true,
    });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId,
      action: "create_promo",
      amount: data.promoType === "credits" ? data.credits : data.discountPercent,
      metadata: { code, promo_type: data.promoType },
    });
    return { code };
  });

export const adminUpdatePromoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ promoId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireOwner(context.userId);
    const { error } = await supabaseAdmin
      .from("promo_codes")
      .update({ active: data.active })
      .eq("id", data.promoId);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId,
      action: data.active ? "enable_promo" : "disable_promo",
      metadata: { promo_id: data.promoId },
    });
    return { active: data.active };
  });

export const adminDeletePromoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ promoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireOwner(context.userId);
    const { error } = await supabaseAdmin.from("promo_codes").delete().eq("id", data.promoId);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId,
      action: "delete_promo",
      metadata: { promo_id: data.promoId },
    });
    return { deleted: true };
  });

export const adminReviewPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        approve: z.boolean(),
        reason: z.string().trim().max(240).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireOwner(context.userId);
    const rpc = data.approve
      ? await (supabaseAdmin as any).rpc("admin_approve_payment", { _request_id: data.requestId })
      : await (supabaseAdmin as any).rpc("admin_reject_payment", {
          _request_id: data.requestId,
          _reason: data.reason || "rejected by owner",
        });
    if (rpc.error) throw new Error(rpc.error.message);
    await writeAudit({
      actorId: context.userId,
      action: data.approve ? "approve_payment" : "reject_payment",
      metadata: { request_id: data.requestId, reason: data.reason },
    });
    return { approved: data.approve };
  });

export const adminReviewSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        approve: z.boolean(),
        reason: z.string().trim().max(240).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireOwner(context.userId);
    const rpc = data.approve
      ? await (supabaseAdmin as any).rpc("admin_approve_subscription", {
          _request_id: data.requestId,
        })
      : await (supabaseAdmin as any).rpc("admin_reject_subscription", {
          _request_id: data.requestId,
          _reason: data.reason || "Payment could not be verified",
        });
    if (rpc.error) throw new Error(rpc.error.message);
    await writeAudit({
      actorId: context.userId,
      action: data.approve ? "approve_pro_subscription" : "reject_pro_subscription",
      metadata: { request_id: data.requestId, reason: data.reason },
    });
    return { approved: data.approve };
  });

export const adminReviewPromotionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        submissionId: z.string().uuid(),
        approve: z.boolean(),
        credits: z.number().int().min(1).max(500).nullable(),
        reason: z.string().trim().max(240).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireOwner(context.userId);
    if (data.approve && !data.credits) throw new Error("Credit amount is required.");
    const rpc = data.approve
      ? await (supabaseAdmin as any).rpc("admin_approve_promotion", {
          _submission_id: data.submissionId,
          _credits: data.credits,
        })
      : await (supabaseAdmin as any).rpc("admin_reject_promotion", {
          _submission_id: data.submissionId,
          _reason: data.reason || "Does not meet promotion guidelines",
        });
    if (rpc.error) throw new Error(rpc.error.message);
    await writeAudit({
      actorId: context.userId,
      action: data.approve ? "approve_promotion" : "reject_promotion",
      amount: data.credits,
      metadata: { submission_id: data.submissionId, reason: data.reason },
    });
    return { approved: data.approve };
  });
