CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.global_chat_messages WHERE created_at < now() - interval '7 days';
  DELETE FROM public.global_chat_reactions WHERE message_id NOT IN (SELECT id FROM public.global_chat_messages);
  DELETE FROM public.project_chat_messages WHERE created_at < now() - interval '7 days';
END;
$$;

-- Unschedule any prior job with the same name, then schedule hourly
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'purge_old_chat_messages_hourly';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'purge_old_chat_messages_hourly',
  '0 * * * *',
  $$SELECT public.purge_old_chat_messages();$$
);

-- Run once immediately to clean up existing old messages
SELECT public.purge_old_chat_messages();