-- Keep auth/profile bootstrap and global chat RPC compatible with the current
-- frontend shape. This is intentionally idempotent so it can repair partially
-- applied Supabase projects without disturbing existing data.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS specialization text,
  ADD COLUMN IF NOT EXISTS credits integer,
  ADD COLUMN IF NOT EXISTS discord_claimed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS hide_email boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_name_gradient text[],
  ADD COLUMN IF NOT EXISTS chat_text_gradient text[],
  ADD COLUMN IF NOT EXISTS chat_icon text,
  ADD COLUMN IF NOT EXISTS chat_nickname text,
  ADD COLUMN IF NOT EXISTS chat_font text,
  ADD COLUMN IF NOT EXISTS profile_accent text,
  ADD COLUMN IF NOT EXISTS profile_card_color text DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS profile_card_effect text DEFAULT 'soft_glow',
  ADD COLUMN IF NOT EXISTS profile_effect text,
  ADD COLUMN IF NOT EXISTS profile_background text,
  ADD COLUMN IF NOT EXISTS custom_background_url text,
  ADD COLUMN IF NOT EXISTS profile_layout text DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS pfp_effect text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS status_message text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS private_profile boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS presence_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS presence_status text DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS show_activity boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_badges text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_decoration text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_reward_claimed boolean DEFAULT false;

UPDATE public.profiles
   SET credits = COALESCE(credits, 150),
       discord_claimed = COALESCE(discord_claimed, false),
       hide_email = COALESCE(hide_email, true),
       profile_card_color = COALESCE(profile_card_color, '#0f172a'),
       profile_card_effect = COALESCE(profile_card_effect, 'soft_glow'),
       profile_layout = COALESCE(profile_layout, 'classic'),
       pfp_effect = COALESCE(pfp_effect, 'none'),
       private_profile = COALESCE(private_profile, false),
       presence_enabled = COALESCE(presence_enabled, true),
       presence_status = COALESCE(presence_status, 'online'),
       show_activity = COALESCE(show_activity, true),
       profile_badges = COALESCE(profile_badges, '{}'::text[]),
       profile_decoration = COALESCE(profile_decoration, 'none'),
       onboarding_step = COALESCE(onboarding_step, 0),
       onboarding_reward_claimed = COALESCE(onboarding_reward_claimed, false);

ALTER TABLE public.profiles
  ALTER COLUMN credits SET DEFAULT 150,
  ALTER COLUMN discord_claimed SET DEFAULT false,
  ALTER COLUMN hide_email SET DEFAULT true,
  ALTER COLUMN profile_card_color SET DEFAULT '#0f172a',
  ALTER COLUMN profile_card_effect SET DEFAULT 'soft_glow',
  ALTER COLUMN profile_layout SET DEFAULT 'classic',
  ALTER COLUMN pfp_effect SET DEFAULT 'none',
  ALTER COLUMN private_profile SET DEFAULT false,
  ALTER COLUMN presence_enabled SET DEFAULT true,
  ALTER COLUMN presence_status SET DEFAULT 'online',
  ALTER COLUMN show_activity SET DEFAULT true,
  ALTER COLUMN profile_badges SET DEFAULT '{}',
  ALTER COLUMN profile_decoration SET DEFAULT 'none',
  ALTER COLUMN onboarding_step SET DEFAULT 0,
  ALTER COLUMN onboarding_reward_claimed SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ensure_profile$
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
  _starter int;
  _old_credits int;
  _inserted int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _safe_email := coalesce(nullif(_email, ''), _uid::text || '@bloxsmith.local');
  _is_owner := _email = 'bobkinloch5@gmail.com';
  _starter := CASE WHEN _is_owner THEN 999999 ELSE 150 END;

  INSERT INTO public.profiles(id, email, display_name, avatar_url, credits, referral_code, hide_email)
  VALUES (_uid, _safe_email, _name, _avatar, _starter, substr(md5(_uid::text), 1, 8), true)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted = 0 THEN
    SELECT credits INTO _old_credits
      FROM public.profiles
     WHERE id = _uid
     FOR UPDATE;

    UPDATE public.profiles
       SET email = coalesce(nullif(_email, ''), email, _safe_email),
           display_name = coalesce(display_name, _name),
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

REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_channels (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text,
  view_role public.app_role NOT NULL DEFAULT 'user',
  post_role public.app_role NOT NULL DEFAULT 'user',
  position integer NOT NULL DEFAULT 0,
  icon text
);

INSERT INTO public.chat_channels (slug, name, description, view_role, post_role, position, icon)
VALUES
  ('general', 'general', 'Hang out and chat with everyone', 'user', 'user', 10, 'hash'),
  ('help', 'help', 'Ask questions and get help from the community', 'user', 'user', 20, 'life-buoy')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_post_channel(_slug text, _uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $can_post_channel$
  SELECT COALESCE((
    SELECT CASE c.post_role
      WHEN 'user' THEN _uid IS NOT NULL
      WHEN 'admin' THEN public.is_admin(_uid)
      WHEN 'owner' THEN public.has_role(_uid, 'owner')
      ELSE false
    END
    FROM public.chat_channels c
    WHERE c.slug = _slug
  ), false);
$can_post_channel$;

GRANT EXECUTE ON FUNCTION public.can_post_channel(text, uuid) TO authenticated, service_role;

ALTER TABLE public.global_chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS channel_id text NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_global_chat_messages_channel
  ON public.global_chat_messages (channel_id, created_at DESC);

ALTER TABLE public.global_chat_settings
  ADD COLUMN IF NOT EXISTS max_message_length integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS allow_attachments boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.send_global_chat_message_v2(
  _content text,
  _reply_to_id uuid DEFAULT NULL,
  _attachment_url text DEFAULT NULL,
  _attachment_type text DEFAULT NULL,
  _channel_id text DEFAULT 'general'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $send_chat$
DECLARE
  _uid uuid := auth.uid();
  _slow int;
  _max_len int;
  _allow_att boolean;
  _last timestamptz;
  _muted timestamptz;
  _banned boolean;
  _new_id uuid;
  _txt text := trim(coalesce(_content, ''));
  _chan text := coalesce(nullif(trim(_channel_id), ''), 'general');
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.ensure_my_profile();

  IF NOT EXISTS (SELECT 1 FROM public.chat_channels WHERE slug = _chan) THEN
    _chan := 'general';
  END IF;

  IF NOT public.can_post_channel(_chan, _uid) THEN
    RAISE EXCEPTION 'forbidden_channel';
  END IF;

  SELECT banned INTO _banned FROM public.profiles WHERE id = _uid;
  IF COALESCE(_banned, false) THEN
    RAISE EXCEPTION 'banned';
  END IF;

  IF _txt ~* '(https?://|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|net|org|io|gg|xyz|co|me|app|dev|store|club|link|tk|info|biz|fun|live|tv|ru|cn|us|uk)(/|$|\s))' THEN
    RAISE EXCEPTION 'links_not_allowed';
  END IF;
  IF _txt ~* '(discord\.gg|discord(app)?\.com|dsc\.gg|t\.me/|telegram\.me|bit\.ly|tinyurl|grabify)' THEN
    RAISE EXCEPTION 'links_not_allowed';
  END IF;

  SELECT slow_mode_seconds,
         COALESCE(max_message_length, 500),
         COALESCE(allow_attachments, true)
    INTO _slow, _max_len, _allow_att
    FROM public.global_chat_settings
   WHERE id = 1;

  IF _attachment_url IS NOT NULL AND NOT COALESCE(_allow_att, true) THEN
    RAISE EXCEPTION 'attachments_disabled';
  END IF;
  IF _txt = '' AND _attachment_url IS NULL THEN
    RAISE EXCEPTION 'empty_message';
  END IF;
  IF length(_txt) > COALESCE(_max_len, 500) THEN
    RAISE EXCEPTION 'message_too_long';
  END IF;

  SELECT muted_until INTO _muted FROM public.global_chat_mutes WHERE user_id = _uid;
  IF _muted IS NOT NULL AND _muted > now() THEN
    RAISE EXCEPTION 'muted_until %', _muted;
  END IF;

  IF COALESCE(_slow, 0) > 0 AND NOT public.is_admin(_uid) THEN
    SELECT max(created_at) INTO _last
      FROM public.global_chat_messages
     WHERE user_id = _uid
       AND channel_id = _chan
       AND created_at > now() - make_interval(secs => _slow);
    IF _last IS NOT NULL THEN
      RAISE EXCEPTION 'slow_mode % seconds', _slow;
    END IF;
  END IF;

  IF _txt <> '' AND EXISTS (
    SELECT 1
      FROM public.global_chat_messages
     WHERE user_id = _uid
       AND content = _txt
       AND channel_id = _chan
       AND created_at > now() - interval '30 seconds'
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'duplicate_message';
  END IF;

  INSERT INTO public.global_chat_messages (
    user_id,
    content,
    reply_to_id,
    attachment_url,
    attachment_type,
    channel_id
  )
  VALUES (_uid, _txt, _reply_to_id, _attachment_url, _attachment_type, _chan)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$send_chat$;

REVOKE EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
