
-- 1) plugin_tokens: store hashed tokens only
ALTER TABLE public.plugin_tokens ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.plugin_tokens ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- Invalidate any existing plaintext tokens by clearing rows (they would have been unusable anyway since API expects token_hash)
DELETE FROM public.plugin_tokens WHERE token_hash IS NULL;
ALTER TABLE public.plugin_tokens DROP COLUMN IF EXISTS token;
ALTER TABLE public.plugin_tokens ALTER COLUMN token_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plugin_tokens_token_hash_key ON public.plugin_tokens(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS plugin_tokens_user_id_key ON public.plugin_tokens(user_id);

-- 2) profiles: revoke column-level SELECT on sensitive fields from anon and authenticated
DO $$
DECLARE
  col text;
  cols text[] := ARRAY['email','credits','referral_code','referred_by','hide_email','onboarding_reward_claimed','ban_reason','banned_at'];
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name=col
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM anon, authenticated', col);
    END IF;
  END LOOP;
END $$;
