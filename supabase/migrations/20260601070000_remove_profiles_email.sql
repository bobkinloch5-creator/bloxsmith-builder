-- Migration to remove email column from profiles table and update functions.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ensure_profile$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt()->>'email', ''));
  _name text := coalesce(
    auth.jwt()->'user_metadata'->>'display_name',
    auth.jwt()->'user_metadata'->>'full_name',
    nullif(split_part(coalesce(auth.jwt()->>'email', ''), '@', 1), ''),
    'BloxSmith Builder'
  );
  _avatar text := auth.jwt()->'user_metadata'->>'avatar_url';
  _is_owner boolean;
  _starter int;
  _old_credits int;
  _inserted int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _is_owner := _email = 'bobkinloch5@gmail.com';
  _starter := CASE WHEN _is_owner THEN 999999 ELSE 150 END;

  INSERT INTO public.profiles(id, display_name, avatar_url, credits, referral_code, hide_email)
  VALUES (_uid, _name, _avatar, _starter, substr(md5(_uid::text), 1, 8), true)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted = 0 THEN
    SELECT credits INTO _old_credits
      FROM public.profiles
     WHERE id = _uid
     FOR UPDATE;

    UPDATE public.profiles
       SET display_name = coalesce(display_name, _name),
           avatar_url = coalesce(avatar_url, _avatar),
           credits = CASE
             WHEN COALESCE(credits, 0) < _starter
              AND NOT EXISTS (
                SELECT 1 FROM public.credit_transactions t
                 WHERE t.user_id = _uid
                   AND t.amount < 0
              )
             THEN _starter
             ELSE COALESCE(credits, _starter)
           END,
           updated_at = now()
     WHERE id = _uid;

    IF COALESCE(_old_credits, 0) < _starter
       AND NOT EXISTS (
         SELECT 1 FROM public.credit_transactions t
          WHERE t.user_id = _uid
            AND t.amount < 0
       ) THEN
      INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
      VALUES (_uid, _starter - COALESCE(_old_credits, 0), _starter, 'starter_credit_repair');
    END IF;
  ELSE
    INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
    VALUES (_uid, _starter, _starter, 'starter');
  END IF;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (_uid, 'user')
  ON CONFLICT DO NOTHING;

  IF _is_owner THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END;
$ensure_profile$;

NOTIFY pgrst, 'reload schema';
