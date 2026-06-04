
-- Ensure UPDATE/DELETE payloads include full row data
ALTER TABLE public.global_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.global_chat_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.global_chat_settings REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_levels REPLICA IDENTITY FULL;

-- Add to supabase_realtime publication (idempotent via DO block)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'global_chat_messages',
    'global_chat_reactions',
    'global_chat_settings',
    'profiles',
    'user_levels'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
