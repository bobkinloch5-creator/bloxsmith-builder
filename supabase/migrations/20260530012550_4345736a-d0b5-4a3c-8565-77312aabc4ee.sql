CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt()->>'email', ''));
  _safe_email text;
  _name text := coalesce(
    auth.jwt()->'user_metadata'->>'display_name',
    auth.jwt()->'user_metadata'->>'full_name',
    nullif(split_part(coalesce(auth.jwt()->>'email', ''), '@', 1), ''),
    'BloxSmith Builder'
  );
  _avatar text := auth.jwt()->'user_metadata'->>'avatar_url';
  _is_owner boolean;
  _row_count int := 0;
  _starter int;
  _ref text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _safe_email := coalesce(nullif(_email, ''), _uid::text || '@bloxsmith.local');
  _is_owner := _email = 'bobkinloch5@gmail.com';
  _starter := CASE WHEN _is_owner THEN 999999 ELSE 10 END;
  _ref := lower(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  INSERT INTO public.profiles(id, email, display_name, avatar_url, credits, referral_code)
  VALUES (_uid, _safe_email, _name, _avatar, _starter, _ref)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS _row_count = ROW_COUNT;

  IF _row_count = 0 THEN
    UPDATE public.profiles
      SET email = coalesce(nullif(_email, ''), email),
          display_name = coalesce(display_name, _name),
          avatar_url = coalesce(avatar_url, _avatar),
          updated_at = now()
      WHERE id = _uid;
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
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_badge(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_chat_announce(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_feature_project(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_quick_changelog(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.report_chat_user(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_badge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_chat_announce(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_feature_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_quick_changelog(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_chat_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text) TO authenticated;