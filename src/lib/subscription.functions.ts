import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  PRO_MONTHLY_BONUS_CREDITS,
  PRO_PLAN_ID,
  PRO_PLAN_PRICE_USD,
  type SubscriptionSummary,
} from "@/lib/subscriptions";

const SubmitProSchema = z.object({
  paymentReference: z.string().trim().min(6).max(240),
  paymentNote: z.string().trim().max(500).optional().nullable(),
});

export const getMySubscriptionFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [subscriptionRes, requestRes] = await Promise.all([
      (supabase as any)
        .from("user_subscriptions")
        .select("plan_id,status,current_period_end,cancel_at_period_end")
        .eq("user_id", userId)
        .maybeSingle(),
      (supabase as any)
        .from("subscription_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (subscriptionRes.error && !/does not exist|schema cache/i.test(subscriptionRes.error.message)) {
      throw new Error(subscriptionRes.error.message);
    }
    if (requestRes.error && !/does not exist|schema cache/i.test(requestRes.error.message)) {
      throw new Error(requestRes.error.message);
    }

    const row = subscriptionRes.data as any;
    const summary: SubscriptionSummary = {
      planId: row?.plan_id ?? null,
      status: row?.status ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
      isPro:
        !!row?.current_period_end &&
        ["active", "canceled"].includes(row?.status) &&
        new Date(row.current_period_end).getTime() > Date.now(),
    };

    return {
      subscription: summary,
      requests: requestRes.data ?? [],
      plan: {
        id: PRO_PLAN_ID,
        priceUsd: PRO_PLAN_PRICE_USD,
        bonusCredits: PRO_MONTHLY_BONUS_CREDITS,
      },
    };
  });

export const submitProSubscriptionRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitProSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any).rpc("submit_subscription_request", {
      _plan_id: PRO_PLAN_ID,
      _amount: PRO_PLAN_PRICE_USD,
      _payment_reference: data.paymentReference,
      _payment_note: data.paymentNote || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelMyProSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any).rpc("cancel_my_subscription");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
