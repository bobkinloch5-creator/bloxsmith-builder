-- Tighten BloxSmith AI timers so normal users cannot drain the shared provider key.
-- Staff roles keep unlimited testing access.

CREATE OR REPLACE FUNCTION public.get_ai_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_staff boolean := false;
  _5h_used int := 0;
  _24h_used int := 0;
  _7d_used int := 0;
  _next_5h timestamptz;
  _next_24h timestamptz;
  _next_7d timestamptz;
  _5h_limit int := 4;
  _24h_limit int := 8;
  _7d_limit int := 25;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('limit_5h', 0, 'used_5h', 0, 'limit_24h', 0, 'used_24h', 0, 'limit_7d', 0, 'used_7d', 0);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('owner', 'admin', 'moderator')
  )
  INTO _is_staff;

  IF _is_staff THEN
    RETURN jsonb_build_object(
      'owner', true,
      'limit_5h', 999999, 'used_5h', 0,
      'limit_24h', 999999, 'used_24h', 0,
      'limit_7d', 999999, 'used_7d', 0
    );
  END IF;

  SELECT COUNT(*), MIN(created_at) + interval '5 hours'
    INTO _5h_used, _next_5h
    FROM public.ai_rate_limit_events
    WHERE user_id = _uid AND created_at > now() - interval '5 hours';

  SELECT COUNT(*), MIN(created_at) + interval '24 hours'
    INTO _24h_used, _next_24h
    FROM public.ai_rate_limit_events
    WHERE user_id = _uid AND created_at > now() - interval '24 hours';

  SELECT COUNT(*), MIN(created_at) + interval '7 days'
    INTO _7d_used, _next_7d
    FROM public.ai_rate_limit_events
    WHERE user_id = _uid AND created_at > now() - interval '7 days';

  RETURN jsonb_build_object(
    'limit_5h', _5h_limit,
    'used_5h', _5h_used,
    'reset_5h', _next_5h,
    'limit_24h', _24h_limit,
    'used_24h', _24h_used,
    'reset_24h', _next_24h,
    'limit_7d', _7d_limit,
    'used_7d', _7d_used,
    'reset_7d', _next_7d
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_record_ai_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_staff boolean := false;
  _24h int := 0;
  _24h_limit int := 8;
  _next_24h timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('owner', 'admin', 'moderator')
  )
  INTO _is_staff;

  IF _is_staff THEN
    RETURN jsonb_build_object('ok', true, 'owner', true, 'limit_24h', 999999, 'used_24h', 0);
  END IF;

  SELECT COUNT(*), MIN(created_at) + interval '24 hours'
    INTO _24h, _next_24h
    FROM public.ai_rate_limit_events
    WHERE user_id = _uid AND created_at > now() - interval '24 hours';

  IF _24h >= _24h_limit THEN
    RAISE EXCEPTION 'rate_limited_24h:%', COALESCE(_next_24h::text, '');
  END IF;

  INSERT INTO public.ai_rate_limit_events(user_id, source)
  VALUES (_uid, 'ai_request');

  DELETE FROM public.ai_rate_limit_events
  WHERE created_at < now() - interval '8 days';

  RETURN jsonb_build_object(
    'ok', true,
    'limit_24h', _24h_limit,
    'used_24h', _24h + 1,
    'reset_24h', _next_24h
  );
END;
$$;
