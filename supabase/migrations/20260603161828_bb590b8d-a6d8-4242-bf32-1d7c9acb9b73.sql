
-- 1. Re-apply column-level REVOKE on sensitive profile columns
REVOKE SELECT (email, credits, ban_reason, banned_at, referred_by, referral_code, onboarding_reward_claimed, hide_email)
  ON public.profiles FROM anon, authenticated, PUBLIC;

-- 2. Allow users to delete their own 3D model generation records
CREATE POLICY "users delete own 3d generations"
ON public.model_generations_3d
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
