DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
  END LOOP;
END $$;

-- Public/anon read access on tables that have public-facing flows.
GRANT SELECT ON public.chat_channels TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.projects TO anon;
GRANT SELECT ON public.user_badges TO anon;
GRANT SELECT ON public.user_levels TO anon;
GRANT SELECT ON public.global_chat_messages TO anon;
GRANT SELECT ON public.global_chat_reactions TO anon;
GRANT SELECT ON public.promo_codes TO anon;

-- Ensure sequences are usable by authenticated writers.
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', s.sequence_name);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', s.sequence_name);
  END LOOP;
END $$;
