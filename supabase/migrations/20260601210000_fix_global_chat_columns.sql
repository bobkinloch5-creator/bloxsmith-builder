-- ============================================================================
-- FIX: global_chat 400 (Bad Request)
--
-- The frontend selects these columns from global_chat_messages:
--   id, user_id, content, created_at, deleted_at, reply_to_id,
--   attachment_url, attachment_type, pinned_at, flagged, channel_id,
--   is_announcement
--
-- The 400 happens when one or more of those columns don't exist on the live
-- database (the column-adding migrations were never applied). This script is
-- idempotent — every statement uses IF NOT EXISTS, so it is safe to run even
-- if some columns already exist. Run it once in the Supabase SQL Editor.
-- ============================================================================

-- The chat_channels table is referenced by channel_id's FK. Make sure a
-- minimal version exists with a 'general' channel before adding the column.
CREATE TABLE IF NOT EXISTS public.chat_channels (
  slug text PRIMARY KEY,
  name text NOT NULL DEFAULT 'General',
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.chat_channels (slug, name)
VALUES ('general', 'General')
ON CONFLICT (slug) DO NOTHING;

-- Ensure every selected column exists on global_chat_messages.
ALTER TABLE public.global_chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz,
  ADD COLUMN IF NOT EXISTS reply_to_id      uuid,
  ADD COLUMN IF NOT EXISTS attachment_url   text,
  ADD COLUMN IF NOT EXISTS attachment_type  text,
  ADD COLUMN IF NOT EXISTS pinned_at        timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by        uuid,
  ADD COLUMN IF NOT EXISTS flagged          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_reason   text,
  ADD COLUMN IF NOT EXISTS is_announcement  boolean NOT NULL DEFAULT false;

-- channel_id needs the chat_channels table to exist (done above). Add it
-- without the FK first (so it can't fail), then attach the FK if missing.
ALTER TABLE public.global_chat_messages
  ADD COLUMN IF NOT EXISTS channel_id text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'global_chat_messages_channel_id_fkey'
      AND table_name = 'global_chat_messages'
  ) THEN
    ALTER TABLE public.global_chat_messages
      ADD CONSTRAINT global_chat_messages_channel_id_fkey
      FOREIGN KEY (channel_id) REFERENCES public.chat_channels(slug);
  END IF;
END $$;

-- Helpful index for the ordered, non-deleted feed the UI fetches.
CREATE INDEX IF NOT EXISTS global_chat_messages_feed_idx
  ON public.global_chat_messages (channel_id, created_at DESC)
  WHERE deleted_at IS NULL;
