-- Global chat safety, announcements, owner credit events, giveaways, and minigame rewards.

ALTER TABLE public.global_chat_messages
  ADD COLUMN IF NOT EXISTS is_announcement boolean NOT NULL DEFAULT false;

ALTER TABLE public.global_chat_blocked_words
  ADD COLUMN IF NOT EXISTS match_mode text NOT NULL DEFAULT 'normalized'
    CHECK (match_mode IN ('partial', 'normalized', 'wildcard')),
  ADD COLUMN IF NOT EXISTS reason text;

CREATE OR REPLACE FUNCTION public.normalize_chat_text(_txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(lower(coalesce(_txt, '')), '@!1|305$7', 'aiiieosst'),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_wildcard_to_regex(_pattern text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '^' || replace(regexp_replace(lower(coalesce(_pattern, '')), '([.\+?^${}()|\[\]\\])', '\\\1', 'g'), '*', '.*') || '$';
$$;

CREATE OR REPLACE FUNCTION public.check_global_chat_block(_content text)
RETURNS TABLE(word text, severity text, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lower text := lower(coalesce(_content, ''));
  _norm text := public.normalize_chat_text(_content);
  _row record;
  _word_norm text;
BEGIN
  FOR _row IN
    SELECT bw.word, bw.severity, bw.match_mode, bw.reason
      FROM public.global_chat_blocked_words bw
  LOOP
    _word_norm := public.normalize_chat_text(_row.word);
    IF _row.match_mode = 'wildcard' AND _lower ~ public.chat_wildcard_to_regex(_row.word) THEN
      word := _row.word; severity := _row.severity; reason := coalesce(_row.reason, 'blocked content'); RETURN NEXT; RETURN;
    ELSIF _row.match_mode = 'partial' AND position(lower(_row.word) in _lower) > 0 THEN
      word := _row.word; severity := _row.severity; reason := coalesce(_row.reason, 'blocked content'); RETURN NEXT; RETURN;
    ELSIF _row.match_mode = 'normalized' AND length(_word_norm) >= 3 AND position(_word_norm in _norm) > 0 THEN
      word := _row.word; severity := _row.severity; reason := coalesce(_row.reason, 'blocked content'); RETURN NEXT; RETURN;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_chat_add_blocked_words(
  _words text[],
  _severity text DEFAULT 'block',
  _reason text DEFAULT 'community safety'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _word text;
  _count integer := 0;
BEGIN
  IF NOT public.is_moderator(_uid) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _severity NOT IN ('block', 'warn') THEN RAISE EXCEPTION 'invalid_severity'; END IF;

  FOREACH _word IN ARRAY coalesce(_words, ARRAY[]::text[]) LOOP
    _word := lower(btrim(_word));
    IF _word <> '' AND char_length(_word) <= 80 THEN
      INSERT INTO public.global_chat_blocked_words(word, severity, match_mode, reason, created_by)
      VALUES (_word, _severity, 'normalized', left(coalesce(_reason, 'community safety'), 120), _uid)
      ON CONFLICT (word) DO UPDATE
        SET severity = excluded.severity,
            match_mode = excluded.match_mode,
            reason = excluded.reason;
      _count := _count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.global_chat_audit(actor_id, action, details)
  VALUES (_uid, 'blocked_words_bulk_upsert', jsonb_build_object('count', _count, 'severity', _severity));
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_chat_add_blocked_words(text[], text, text) TO authenticated;

INSERT INTO public.global_chat_blocked_words(word, severity, match_mode, reason)
VALUES
  ('nsfw', 'block', 'normalized', 'NSFW content'),
  ('porn', 'block', 'normalized', 'NSFW content'),
  ('sex', 'block', 'normalized', 'sexual content'),
  ('nude', 'block', 'normalized', 'sexual content'),
  ('gore', 'block', 'normalized', 'graphic violence'),
  ('behead', 'block', 'normalized', 'graphic violence'),
  ('rape', 'block', 'normalized', 'sexual violence'),
  ('kill yourself', 'block', 'normalized', 'self-harm or threat'),
  ('kys', 'block', 'normalized', 'self-harm or threat'),
  ('dox', 'block', 'normalized', 'privacy abuse'),
  ('doxx', 'block', 'normalized', 'privacy abuse'),
  ('grabify', 'block', 'partial', 'unsafe link'),
  ('discord.gg', 'block', 'partial', 'external invite'),
  ('free robux', 'block', 'normalized', 'scam phrase'),
  ('nazi', 'block', 'normalized', 'hate content'),
  ('hitler', 'block', 'normalized', 'hate content'),
  ('terrorist', 'warn', 'normalized', 'violent extremist term')
ON CONFLICT (word) DO NOTHING;

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
  _block_word text;
  _block_severity text;
  _block_reason text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.ensure_my_profile();

  IF NOT EXISTS (SELECT 1 FROM public.chat_channels WHERE slug = _chan) THEN _chan := 'general'; END IF;
  IF NOT public.can_post_channel(_chan, _uid) THEN RAISE EXCEPTION 'forbidden_channel'; END IF;

  SELECT banned INTO _banned FROM public.profiles WHERE id = _uid;
  IF COALESCE(_banned, false) THEN RAISE EXCEPTION 'banned'; END IF;

  IF _txt ~* '(https?://|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|net|org|io|gg|xyz|co|me|app|dev|store|club|link|tk|info|biz|fun|live|tv|ru|cn|us|uk)(/|$|\s))'
     OR _txt ~* '(discord\.gg|discord(app)?\.com|dsc\.gg|t\.me/|telegram\.me|bit\.ly|tinyurl|grabify)' THEN
    INSERT INTO public.global_chat_audit(actor_id, action, details)
    VALUES (_uid, 'automod_block', jsonb_build_object('reason', 'links_not_allowed'));
    RAISE EXCEPTION 'links_not_allowed';
  END IF;

  SELECT word, severity, reason INTO _block_word, _block_severity, _block_reason
    FROM public.check_global_chat_block(_txt) LIMIT 1;
  IF _block_word IS NOT NULL THEN
    INSERT INTO public.global_chat_audit(actor_id, action, details)
    VALUES (_uid, 'automod_block', jsonb_build_object('word', _block_word, 'severity', _block_severity, 'reason', _block_reason));
    INSERT INTO public.global_chat_warnings(user_id, issued_by, reason)
    VALUES (_uid, _uid, 'Automod blocked message: ' || _block_reason);
    RAISE EXCEPTION 'blocked_word:%', _block_reason;
  END IF;

  SELECT slow_mode_seconds, COALESCE(max_message_length, 500), COALESCE(allow_attachments, true)
    INTO _slow, _max_len, _allow_att
    FROM public.global_chat_settings WHERE id = 1;

  IF _attachment_url IS NOT NULL AND NOT COALESCE(_allow_att, true) THEN RAISE EXCEPTION 'attachments_disabled'; END IF;
  IF _txt = '' AND _attachment_url IS NULL THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF length(_txt) > COALESCE(_max_len, 500) THEN RAISE EXCEPTION 'message_too_long'; END IF;

  SELECT muted_until INTO _muted FROM public.global_chat_mutes WHERE user_id = _uid;
  IF _muted IS NOT NULL AND _muted > now() THEN RAISE EXCEPTION 'muted_until %', _muted; END IF;

  IF COALESCE(_slow, 0) > 0 AND NOT public.is_admin(_uid) THEN
    SELECT max(created_at) INTO _last
      FROM public.global_chat_messages
     WHERE user_id = _uid AND channel_id = _chan AND created_at > now() - make_interval(secs => _slow);
    IF _last IS NOT NULL THEN RAISE EXCEPTION 'slow_mode % seconds', _slow; END IF;
  END IF;

  IF _txt <> '' AND EXISTS (
    SELECT 1 FROM public.global_chat_messages
     WHERE user_id = _uid AND content = _txt AND channel_id = _chan
       AND created_at > now() - interval '30 seconds' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'duplicate_message';
  END IF;

  INSERT INTO public.global_chat_messages(user_id, content, reply_to_id, attachment_url, attachment_type, channel_id)
  VALUES (_uid, _txt, _reply_to_id, _attachment_url, _attachment_type, _chan)
  RETURNING id INTO _new_id;
  RETURN _new_id;
END;
$send_chat$;

REVOKE EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_global_chat_message_v2(text, uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_chat_announce(_content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _txt text := trim(_content);
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _txt IS NULL OR _txt = '' OR char_length(_txt) > 500 THEN RAISE EXCEPTION 'invalid_announcement'; END IF;
  INSERT INTO public.global_chat_messages(user_id, content, pinned_at, pinned_by, channel_id, is_announcement)
  VALUES (_uid, '📣 ' || _txt, now(), _uid, 'announcements', true)
  RETURNING id INTO _id;
  INSERT INTO public.global_chat_audit(actor_id, action, target_message_id, details)
  VALUES (_uid, 'announce', _id, jsonb_build_object('content', _txt, 'notify', 'all_enabled'));
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_chat_announce(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_credit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('everyone_credits', 'chat_boost')),
  title text NOT NULL,
  amount integer NOT NULL DEFAULT 0 CHECK (amount >= 0 AND amount <= 25),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_credit_events TO authenticated;
GRANT ALL ON public.chat_credit_events TO service_role;
ALTER TABLE public.chat_credit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat credit events readable" ON public.chat_credit_events;
CREATE POLICY "chat credit events readable" ON public.chat_credit_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "owners manage chat credit events" ON public.chat_credit_events;
CREATE POLICY "owners manage chat credit events" ON public.chat_credit_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.owner_start_credit_event(_title text, _amount integer DEFAULT 5, _minutes integer DEFAULT 15)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _count int; _profile record; _balance int;
BEGIN
  IF NOT public.has_role(_uid, 'owner') THEN RAISE EXCEPTION 'owner_only'; END IF;
  IF _amount < 1 OR _amount > 5 THEN RAISE EXCEPTION 'amount_limit_1_to_5'; END IF;
  IF _minutes < 5 OR _minutes > 60 THEN RAISE EXCEPTION 'duration_limit'; END IF;
  SELECT count(*) INTO _count FROM public.chat_credit_events WHERE created_at > now() - interval '12 hours';
  IF _count >= 2 THEN RAISE EXCEPTION 'credit_event_cooldown'; END IF;

  INSERT INTO public.chat_credit_events(kind, title, amount, ends_at, created_by)
  VALUES ('everyone_credits', left(coalesce(_title, 'Admin Event'), 80), _amount, now() + make_interval(mins => _minutes), _uid)
  RETURNING id INTO _id;

  FOR _profile IN SELECT id FROM public.profiles WHERE banned IS DISTINCT FROM true LOOP
    UPDATE public.profiles SET credits = credits + _amount, updated_at = now()
    WHERE id = _profile.id RETURNING credits INTO _balance;
    INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
    VALUES (_profile.id, _amount, _balance, 'admin_event:' || _id::text);
  END LOOP;

  INSERT INTO public.global_chat_messages(user_id, content, pinned_at, pinned_by, channel_id, is_announcement)
  VALUES (
    _uid,
    '📣 Admin Event: everyone received ' || _amount::text || ' credits. Enjoy and keep chat friendly!',
    now(),
    _uid,
    'announcements',
    true
  );
  INSERT INTO public.global_chat_audit(actor_id, action, details)
  VALUES (_uid, 'owner_credit_event', jsonb_build_object('event_id', _id, 'amount', _amount));
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_start_credit_event(text, integer, integer) TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prize_credits integer NOT NULL CHECK (prize_credits BETWEEN 1 AND 500),
  max_entries integer NOT NULL DEFAULT 250 CHECK (max_entries BETWEEN 1 AND 1000),
  winner_count integer NOT NULL DEFAULT 1 CHECK (winner_count BETWEEN 1 AND 10),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ended', 'cancelled')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_giveaway_entries (
  giveaway_id uuid NOT NULL REFERENCES public.chat_giveaways(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (giveaway_id, user_id)
);

GRANT SELECT ON public.chat_giveaways TO authenticated;
GRANT SELECT, INSERT ON public.chat_giveaway_entries TO authenticated;
GRANT ALL ON public.chat_giveaways, public.chat_giveaway_entries TO service_role;
ALTER TABLE public.chat_giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_giveaway_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "giveaways readable" ON public.chat_giveaways;
CREATE POLICY "giveaways readable" ON public.chat_giveaways FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admins manage giveaways" ON public.chat_giveaways;
CREATE POLICY "admins manage giveaways" ON public.chat_giveaways FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "giveaway entries visible own or staff" ON public.chat_giveaway_entries;
CREATE POLICY "giveaway entries visible own or staff" ON public.chat_giveaway_entries FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_moderator(auth.uid()));
DROP POLICY IF EXISTS "users enter giveaways" ON public.chat_giveaway_entries;
CREATE POLICY "users enter giveaways" ON public.chat_giveaway_entries FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.admin_create_chat_giveaway(_title text, _prize_credits integer, _minutes integer DEFAULT 10, _winner_count integer DEFAULT 1)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF _prize_credits < 1 OR _prize_credits > 500 THEN RAISE EXCEPTION 'invalid_prize'; END IF;
  IF _minutes < 1 OR _minutes > 1440 THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  INSERT INTO public.chat_giveaways(title, prize_credits, winner_count, ends_at, created_by)
  VALUES (left(coalesce(_title, 'BloxSmith Giveaway'), 80), _prize_credits, least(greatest(_winner_count, 1), 10), now() + make_interval(mins => _minutes), _uid)
  RETURNING id INTO _id;
  PERFORM public.admin_chat_announce('Giveaway started: ' || _title || ' — ' || _prize_credits::text || ' credits. Type /giveaway ' || _id::text || ' to join.');
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_chat_giveaway(text, integer, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_chat_giveaway(_giveaway_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _max int; _count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT max_entries INTO _max FROM public.chat_giveaways WHERE id = _giveaway_id AND status = 'open' AND ends_at > now();
  IF _max IS NULL THEN RAISE EXCEPTION 'giveaway_closed'; END IF;
  SELECT count(*) INTO _count FROM public.chat_giveaway_entries WHERE giveaway_id = _giveaway_id;
  IF _count >= _max THEN RAISE EXCEPTION 'giveaway_full'; END IF;
  INSERT INTO public.chat_giveaway_entries(giveaway_id, user_id) VALUES (_giveaway_id, _uid) ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_chat_giveaway(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_finish_chat_giveaway(_giveaway_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _g record;
  _winner record;
  _winners uuid[] := ARRAY[]::uuid[];
  _balance int;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'admin_only'; END IF;
  SELECT * INTO _g FROM public.chat_giveaways WHERE id = _giveaway_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'giveaway_not_found'; END IF;
  IF _g.status <> 'open' THEN RAISE EXCEPTION 'giveaway_already_closed'; END IF;

  FOR _winner IN
    SELECT user_id
    FROM public.chat_giveaway_entries
    WHERE giveaway_id = _giveaway_id
    ORDER BY random()
    LIMIT _g.winner_count
  LOOP
    UPDATE public.profiles SET credits = credits + _g.prize_credits, updated_at = now()
    WHERE id = _winner.user_id RETURNING credits INTO _balance;
    INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
    VALUES (_winner.user_id, _g.prize_credits, _balance, 'giveaway:' || _giveaway_id::text);
    _winners := array_append(_winners, _winner.user_id);
  END LOOP;

  UPDATE public.chat_giveaways SET status = 'ended' WHERE id = _giveaway_id;
  INSERT INTO public.global_chat_audit(actor_id, action, details)
  VALUES (_uid, 'giveaway_finish', jsonb_build_object('giveaway_id', _giveaway_id, 'winners', _winners));

  PERFORM public.admin_chat_announce(
    'Giveaway ended: ' || _g.title || '. Winners: ' ||
    CASE WHEN array_length(_winners, 1) IS NULL THEN 'no eligible entries' ELSE array_length(_winners, 1)::text END ||
    '. Prize: ' || _g.prize_credits::text || ' credits.'
  );

  RETURN jsonb_build_object('winners', _winners, 'prize_credits', _g.prize_credits);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_finish_chat_giveaway(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_minigame_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_key text NOT NULL,
  score integer NOT NULL,
  credits integer NOT NULL,
  proof text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_minigame_claims_user_time ON public.chat_minigame_claims(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.chat_minigame_claims TO authenticated;
GRANT ALL ON public.chat_minigame_claims TO service_role;
ALTER TABLE public.chat_minigame_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own minigame claims" ON public.chat_minigame_claims;
CREATE POLICY "users read own minigame claims" ON public.chat_minigame_claims FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_moderator(auth.uid()));
DROP POLICY IF EXISTS "users insert own minigame claims" ON public.chat_minigame_claims;
CREATE POLICY "users insert own minigame claims" ON public.chat_minigame_claims FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_chat_minigame_reward(_game_key text, _score integer, _proof text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _today date := (now() at time zone 'utc')::date; _earned int; _credits int; _balance int; _recent int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _score < 60 THEN RAISE EXCEPTION 'score_too_low'; END IF;
  SELECT count(*) INTO _recent FROM public.chat_minigame_claims WHERE user_id = _uid AND created_at > now() - interval '5 minutes';
  IF _recent > 0 THEN RAISE EXCEPTION 'cooldown'; END IF;
  SELECT coalesce(sum(credits), 0) INTO _earned FROM public.chat_minigame_claims WHERE user_id = _uid AND (created_at at time zone 'utc')::date = _today;
  IF _earned >= 20 THEN RAISE EXCEPTION 'daily_limit'; END IF;
  _credits := least(5, greatest(1, floor(_score / 100)));
  _credits := least(_credits, 20 - _earned);
  INSERT INTO public.chat_minigame_claims(user_id, game_key, score, credits, proof) VALUES (_uid, left(coalesce(_game_key, 'reaction'), 40), _score, _credits, left(coalesce(_proof, ''), 120));
  UPDATE public.profiles SET credits = credits + _credits, updated_at = now() WHERE id = _uid RETURNING credits INTO _balance;
  INSERT INTO public.credit_transactions(user_id, amount, balance, reason) VALUES (_uid, _credits, _balance, 'chat_minigame:' || left(coalesce(_game_key, 'reaction'), 40));
  RETURN jsonb_build_object('credits', _credits, 'balance', _balance, 'daily_earned', _earned + _credits);
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_chat_minigame_reward(text, integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
