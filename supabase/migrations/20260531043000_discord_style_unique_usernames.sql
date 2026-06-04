-- Discord-style profile usernames.
-- Display names remain flexible, while username is a unique lowercase handle.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_normalized text;

CREATE OR REPLACE FUNCTION public.normalize_profile_username(_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _clean text;
BEGIN
  _clean := lower(coalesce(btrim(_value), ''));
  _clean := regexp_replace(_clean, '[^a-z0-9_.]+', '', 'g');
  _clean := regexp_replace(_clean, '[_.]{2,}', '_', 'g');
  _clean := btrim(_clean, '._');
  _clean := left(_clean, 32);

  IF char_length(_clean) < 2 THEN
    RETURN NULL;
  END IF;

  RETURN _clean;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base text;
  _candidate text;
  _suffix integer := 0;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.username IS NOT DISTINCT FROM OLD.username
     AND NEW.username_normalized IS NOT NULL THEN
    RETURN NEW;
  END IF;

  _base := public.normalize_profile_username(NEW.username);
  IF _base IS NULL THEN
    _base := public.normalize_profile_username(NEW.display_name);
  END IF;
  IF _base IS NULL THEN
    _base := 'builder_' || left(replace(NEW.id::text, '-', ''), 8);
  END IF;

  _candidate := _base;
  WHILE EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id <> NEW.id
      AND p.username_normalized = _candidate
  ) LOOP
    _suffix := _suffix + 1;
    _candidate := left(_base, greatest(2, 32 - char_length(_suffix::text) - 1)) || '_' || _suffix::text;
  END LOOP;

  NEW.username := _candidate;
  NEW.username_normalized := _candidate;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  _row record;
  _base text;
  _candidate text;
  _suffix integer;
BEGIN
  FOR _row IN
    SELECT id, display_name, username
    FROM public.profiles
    WHERE username_normalized IS NULL
       OR username IS NULL
       OR username_normalized <> public.normalize_profile_username(username)
  LOOP
    _base := public.normalize_profile_username(_row.username);
    IF _base IS NULL THEN
      _base := public.normalize_profile_username(_row.display_name);
    END IF;
    IF _base IS NULL THEN
      _base := 'builder_' || left(replace(_row.id::text, '-', ''), 8);
    END IF;

    _candidate := _base;
    _suffix := 0;
    WHILE EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id <> _row.id
        AND p.username_normalized = _candidate
    ) LOOP
      _suffix := _suffix + 1;
      _candidate := left(_base, greatest(2, 32 - char_length(_suffix::text) - 1)) || '_' || _suffix::text;
    END LOOP;

    UPDATE public.profiles
       SET username = _candidate,
           username_normalized = _candidate
     WHERE id = _row.id;
  END LOOP;
END;
$$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_valid
  CHECK (
    username IS NULL OR (
      username = public.normalize_profile_username(username)
      AND username ~ '^[a-z0-9_.]{2,32}$'
    )
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_normalized_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_normalized_valid
  CHECK (
    username_normalized IS NULL OR (
      username_normalized = public.normalize_profile_username(username_normalized)
      AND username_normalized ~ '^[a-z0-9_.]{2,32}$'
    )
  );

DROP INDEX IF EXISTS public.profiles_username_normalized_unique_idx;
CREATE UNIQUE INDEX profiles_username_normalized_unique_idx
  ON public.profiles (username_normalized)
  WHERE username_normalized IS NOT NULL;

DROP TRIGGER IF EXISTS set_profile_username_trg ON public.profiles;
CREATE TRIGGER set_profile_username_trg
BEFORE INSERT OR UPDATE OF username, display_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_username();
