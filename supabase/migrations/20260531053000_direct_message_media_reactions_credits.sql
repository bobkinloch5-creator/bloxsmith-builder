-- Rich direct messages: image attachments, emoji reactions, and safe credit gifts.

INSERT INTO storage.buckets (id, name, public)
VALUES ('dm-media', 'dm-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "dm media readable" ON storage.objects;
CREATE POLICY "dm media readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'dm-media');

DROP POLICY IF EXISTS "users upload own dm media" ON storage.objects;
CREATE POLICY "users upload own dm media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dm-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "users update own dm media" ON storage.objects;
CREATE POLICY "users update own dm media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dm-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'dm-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "users delete own dm media" ON storage.objects;
CREATE POLICY "users delete own dm media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dm-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

ALTER TABLE public.direct_messages
  ALTER COLUMN content SET DEFAULT '';

ALTER TABLE public.direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_content_check,
  DROP CONSTRAINT IF EXISTS direct_messages_content_or_attachment_check,
  ADD CONSTRAINT direct_messages_content_or_attachment_check
  CHECK (
    char_length(content) <= 2000
    AND (char_length(btrim(content)) > 0 OR attachment_url IS NOT NULL)
    AND (attachment_type IS NULL OR attachment_type IN ('image', 'credit'))
  );

CREATE TABLE IF NOT EXISTS public.direct_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_direct_message_reactions_message
  ON public.direct_message_reactions(message_id);

GRANT SELECT, INSERT, DELETE ON public.direct_message_reactions TO authenticated;
GRANT ALL ON public.direct_message_reactions TO service_role;

ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm reactions visible to participants" ON public.direct_message_reactions;
CREATE POLICY "dm reactions visible to participants"
ON public.direct_message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.direct_messages m
    WHERE m.id = direct_message_reactions.message_id
      AND auth.uid() IN (m.sender_id, m.recipient_id)
  )
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "dm reactions insert own participant" ON public.direct_message_reactions;
CREATE POLICY "dm reactions insert own participant"
ON public.direct_message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.direct_messages m
    WHERE m.id = direct_message_reactions.message_id
      AND auth.uid() IN (m.sender_id, m.recipient_id)
  )
);

DROP POLICY IF EXISTS "dm reactions delete own or admin" ON public.direct_message_reactions;
CREATE POLICY "dm reactions delete own or admin"
ON public.direct_message_reactions
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.transfer_credits_to_user(
  _recipient uuid,
  _amount integer,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender uuid := auth.uid();
  _sender_balance integer;
  _recipient_balance integer;
  _safe_note text := left(coalesce(_note, ''), 80);
BEGIN
  IF _sender IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _recipient IS NULL OR _recipient = _sender THEN
    RAISE EXCEPTION 'invalid_recipient';
  END IF;
  IF _amount IS NULL OR _amount < 1 OR _amount > 500 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF NOT (public.are_friends(_sender, _recipient) OR public.is_admin(_sender)) THEN
    RAISE EXCEPTION 'recipient_must_be_friend';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = _recipient FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipient_not_found';
  END IF;

  UPDATE public.profiles
     SET credits = credits - _amount,
         updated_at = now()
   WHERE id = _sender
     AND credits >= _amount
   RETURNING credits INTO _sender_balance;

  IF _sender_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE public.profiles
     SET credits = credits + _amount,
         updated_at = now()
   WHERE id = _recipient
   RETURNING credits INTO _recipient_balance;

  INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
  VALUES
    (_sender, -_amount, _sender_balance, 'gift_sent:' || _recipient::text),
    (_recipient, _amount, _recipient_balance, 'gift_received:' || _sender::text);

  INSERT INTO public.direct_messages(sender_id, recipient_id, content, attachment_type)
  VALUES (
    _sender,
    _recipient,
    'sent ' || _amount::text || ' credits' ||
      CASE WHEN btrim(_safe_note) <> '' THEN ': ' || _safe_note ELSE '' END,
    'credit'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'amount', _amount,
    'sender_balance', _sender_balance,
    'recipient_balance', _recipient_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_credits_to_user(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_credits_to_user(uuid, integer, text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_reactions;
