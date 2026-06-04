import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ONBOARDING_REWARD_CREDITS = 10;

const SaveSchema = z.object({
  step: z.number().int().min(0).max(20),
  completed: z.boolean().optional(),
});

export const saveOnboardingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.completed === true) {
      // Primary path: the complete_onboarding RPC handles the one-time reward
      // atomically (checks onboarding_reward_claimed, grants, sets the flag).
      try {
        const { data: result, error } = await (supabase as any).rpc("complete_onboarding", {
          _step: data.step,
          _reward: ONBOARDING_REWARD_CREDITS,
        });
        if (error) throw error;
        return {
          ok: true,
          completed: true,
          creditsAwarded: Number(result?.credits_awarded ?? 0),
        };
      } catch (rpcErr) {
        // Fallback: the RPC may be missing if its migration hasn't been run on
        // this database. Do the same one-time-reward logic in code so the user
        // still gets credited exactly once instead of getting nothing.
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("onboarding_reward_claimed")
          .eq("id", userId)
          .maybeSingle();

        const alreadyClaimed = !!profile?.onboarding_reward_claimed;

        await (supabase as any)
          .from("profiles")
          .update({
            onboarding_step: Math.min(20, Math.max(0, data.step)),
            onboarding_completed_at: new Date().toISOString(),
            onboarding_reward_claimed: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        let creditsAwarded = 0;
        if (!alreadyClaimed) {
          // grant_credits_service adds credits to a specific user (server-side).
          const { error: grantErr } = await (supabase as any).rpc("grant_credits_service", {
            _user_id: userId,
            _amount: ONBOARDING_REWARD_CREDITS,
            _reason: "onboarding_complete",
          });
          if (!grantErr) creditsAwarded = ONBOARDING_REWARD_CREDITS;
        }
        return { ok: true, completed: true, creditsAwarded };
      }
    }

    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({ onboarding_step: data.step, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true, completed: false, creditsAwarded: 0 };
  });
