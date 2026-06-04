CREATE OR REPLACE FUNCTION public.ui_generations_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.ui_generations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL,
  style text,
  prompt text,
  spec jsonb NOT NULL,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ui_generations TO authenticated;
GRANT ALL ON public.ui_generations TO service_role;

ALTER TABLE public.ui_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own UI generations" ON public.ui_generations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own UI generations" ON public.ui_generations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own UI generations" ON public.ui_generations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own UI generations" ON public.ui_generations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX ui_generations_user_created_idx
  ON public.ui_generations (user_id, created_at DESC);

CREATE TRIGGER ui_generations_set_updated_at
BEFORE UPDATE ON public.ui_generations
FOR EACH ROW EXECUTE FUNCTION public.ui_generations_touch_updated_at();