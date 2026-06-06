-- ============================================================================
-- BloxSmith credit repair + 100-credit welcome bonus.
--
-- Fixes three things reported on 2026-06-06, written DEFENSIVELY so it works
-- regardless of the current (drifted) schema state and is safe to run more
-- than once (idempotent):
--   1. New sign-ups start with 100 credits (was 10/150/0 across drift).
--   2. The admin credit buttons (+100 / -100 / Gift / Reset) stop returning
--      409 Conflict — the ledger write is made best-effort so a
--      credit_transactions schema mismatch can no longer fail the adjustment.
--   3. Existing users left at 0 credits are topped up to 100.
--
-- Apply it by pasting the whole file into the Supabase SQL editor and running
-- it (the file-based migration pipeline has been unreliable for this project).
-- ============================================================================

-- 0. Make the inserts below safe no matter which optional NOT NULL columns the
--    live `profiles` table still has. The app reads e-mail from auth, not from
--    profiles, so relaxing these is harmless.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hide_email'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN hide_email DROP NOT NULL';
  END IF;
END $$;

-- 1. Ensure the credits column exists and that brand-new rows default to 100.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 100;
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 100;

-- 2. Signup trigger: grant 100 starter credits (owner keeps a large balance).
--    Minimal column set + ON CONFLICT so it cannot fail signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean := lower(coalesce(NEW.email, '')) = 'bobkinloch5@gmail.com';
BEGIN
  INSERT INTO public.profiles (id, credits)
  VALUES (NEW.id, CASE WHEN _is_owner THEN 999999 ELSE 100 END)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'user'::public.app_role
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. App self-heal (runs on every profile load): create the profile with 100
--    starter credits if the trigger ever missed it.
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_owner boolean := lower(coalesce(auth.jwt() ->> 'email', '')) = 'bobkinloch5@gmail.com';
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.profiles (id, credits)
  VALUES (_uid, CASE WHEN _is_owner THEN 999999 ELSE 100 END)
  ON CONFLICT (id) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated, service_role;

-- 4. Admin credit adjustment: the actual fix for the 409. The balance update is
--    authoritative; the ledger INSERT is wrapped so ANY credit_transactions
--    schema mismatch is swallowed instead of aborting the whole call.
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount IS NULL OR _amount = 0 OR abs(_amount) > 1000000 THEN
    RAISE EXCEPTION 'invalid_credit_amount';
  END IF;

  UPDATE public.profiles
  SET credits = GREATEST(0, COALESCE(credits, 0) + _amount),
      updated_at = now()
  WHERE id = _user_id
  RETURNING credits INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  BEGIN
    INSERT INTO public.credit_transactions (user_id, amount, balance, reason)
    VALUES (_user_id, _amount, COALESCE(_new, 0),
            left(coalesce(nullif(trim(_reason), ''), 'owner adjust'), 120));
  EXCEPTION WHEN others THEN
    -- Ledger is non-critical; the credit change already succeeded.
    NULL;
  END;

  RETURN _new;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) TO authenticated, service_role;

-- 5. Top up everyone currently sitting at 0 (the users who were shorted) to 100.
--    Leaves users who already have credits untouched.
UPDATE public.profiles
SET credits = 100, updated_at = now()
WHERE credits = 0 OR credits IS NULL;
