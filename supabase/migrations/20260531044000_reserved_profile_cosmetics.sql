-- Keep owner/admin-style cosmetics out of normal user profiles.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_icon text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_decoration text NOT NULL DEFAULT 'none';

CREATE OR REPLACE FUNCTION public.validate_reserved_profile_cosmetics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _can_use_reserved boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.id
      AND ur.role IN ('owner', 'admin')
  )
  INTO _can_use_reserved;

  IF NOT _can_use_reserved AND NEW.chat_icon = 'crown' THEN
    RAISE EXCEPTION 'The crown chat icon is reserved for owners/admins';
  END IF;

  IF NOT _can_use_reserved
     AND NEW.profile_decoration IN ('crown', 'cosmic_crown', 'coin_crown', 'royal_wings') THEN
    RAISE EXCEPTION 'That profile decoration is reserved for owners/admins';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_reserved_profile_cosmetics_trg ON public.profiles;
CREATE TRIGGER validate_reserved_profile_cosmetics_trg
BEFORE INSERT OR UPDATE OF chat_icon, profile_decoration ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_reserved_profile_cosmetics();
