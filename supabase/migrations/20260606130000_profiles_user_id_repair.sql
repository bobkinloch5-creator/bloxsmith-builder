-- ============================================================================
-- Profiles user_id / email constraint repair.
--
-- The live `profiles` table has a NOT NULL `user_id` column, but the app's
-- profile-creation path (ensure_my_profile, which runs on EVERY page load, and
-- handle_new_user) only sets `id`. That makes every new-profile insert fail with:
--   null value in column "user_id" of relation "profiles" violates not-null
-- which breaks profile creation and cascades into global chat and other
-- profile-dependent features.
--
-- Fix: a BEFORE INSERT/UPDATE trigger keeps `id` and `user_id` in sync, so an
-- insert that sets either one satisfies both — regardless of which key the code
-- uses. Existing rows are backfilled, and a leftover NOT NULL on `email` is
-- relaxed so inserts that omit it don't fail either. Everything is guarded so it
-- is a safe no-op on schemas that lack these columns, and is idempotent.
--
-- Apply it by pasting this whole file into the Supabase SQL editor and running it.
-- ============================================================================
DO $repair$
BEGIN
  -- 1. user_id: backfill + auto-sync trigger (only if the column exists).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET user_id = id WHERE user_id IS NULL';

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.profiles_sync_keys()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $body$
      BEGIN
        IF NEW.user_id IS NULL THEN NEW.user_id := NEW.id; END IF;
        IF NEW.id IS NULL THEN NEW.id := NEW.user_id; END IF;
        RETURN NEW;
      END
      $body$;
    $fn$;

    EXECUTE 'DROP TRIGGER IF EXISTS profiles_sync_keys_trg ON public.profiles';
    EXECUTE 'CREATE TRIGGER profiles_sync_keys_trg
      BEFORE INSERT OR UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.profiles_sync_keys()';
  END IF;

  -- 2. Relax a leftover NOT NULL on email so profile inserts that omit it work.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'email' AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL';
  END IF;
END
$repair$;
