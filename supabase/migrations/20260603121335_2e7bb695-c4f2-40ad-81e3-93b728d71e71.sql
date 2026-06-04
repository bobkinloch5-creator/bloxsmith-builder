DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can read own profile media'
  ) THEN
    CREATE POLICY "Users can read own profile media"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'profile-media'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own profile media'
  ) THEN
    CREATE POLICY "Users can upload own profile media"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'profile-media'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own profile media'
  ) THEN
    CREATE POLICY "Users can update own profile media"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'profile-media'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'profile-media'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own profile media'
  ) THEN
    CREATE POLICY "Users can delete own profile media"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'profile-media'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.plugin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  delivered_at timestamptz,
  executed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plugin_actions TO authenticated;
GRANT ALL ON public.plugin_actions TO service_role;
ALTER TABLE public.plugin_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS plugin_actions_proj_status_idx ON public.plugin_actions(project_id, status, created_at);
DROP POLICY IF EXISTS "members read actions" ON public.plugin_actions;
DROP POLICY IF EXISTS "members insert actions" ON public.plugin_actions;
CREATE POLICY "members read actions" ON public.plugin_actions
  FOR SELECT TO authenticated USING (public.can_access_project(project_id, auth.uid()));
CREATE POLICY "members insert actions" ON public.plugin_actions
  FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.project_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.project_chat_messages TO authenticated;
GRANT ALL ON public.project_chat_messages TO service_role;
ALTER TABLE public.project_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS project_chat_messages_project_idx ON public.project_chat_messages(project_id, created_at);
DROP POLICY IF EXISTS "project members read team chat" ON public.project_chat_messages;
DROP POLICY IF EXISTS "project members post team chat" ON public.project_chat_messages;
DROP POLICY IF EXISTS "authors delete own team chat" ON public.project_chat_messages;
DROP POLICY IF EXISTS "users read own team chat" ON public.project_chat_messages;
DROP POLICY IF EXISTS "users post own team chat" ON public.project_chat_messages;
DROP POLICY IF EXISTS "users delete own team chat" ON public.project_chat_messages;
CREATE POLICY "project members read team chat" ON public.project_chat_messages
  FOR SELECT TO authenticated USING (public.can_access_project(project_id, auth.uid()));
CREATE POLICY "project members post team chat" ON public.project_chat_messages
  FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "authors delete own team chat" ON public.project_chat_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_project_owner(project_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.build_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  plan jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_plans TO authenticated;
GRANT ALL ON public.build_plans TO service_role;
ALTER TABLE public.build_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_build_plans_project ON public.build_plans(project_id, created_at DESC);
DROP POLICY IF EXISTS "members read plans" ON public.build_plans;
DROP POLICY IF EXISTS "members insert plans" ON public.build_plans;
DROP POLICY IF EXISTS "members update plans" ON public.build_plans;
DROP POLICY IF EXISTS "owners delete plans" ON public.build_plans;
CREATE POLICY "members read plans" ON public.build_plans
  FOR SELECT TO authenticated USING (public.can_access_project(project_id, auth.uid()));
CREATE POLICY "members insert plans" ON public.build_plans
  FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "members update plans" ON public.build_plans
  FOR UPDATE TO authenticated USING (public.can_access_project(project_id, auth.uid())) WITH CHECK (public.can_access_project(project_id, auth.uid()));
CREATE POLICY "owners delete plans" ON public.build_plans
  FOR DELETE TO authenticated USING (public.is_project_owner(project_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.build_plans(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'feature',
  status text NOT NULL DEFAULT 'todo',
  payload jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks(project_id, position);
DROP POLICY IF EXISTS "members read tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "members insert tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "members update tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "members delete tasks" ON public.project_tasks;
CREATE POLICY "members read tasks" ON public.project_tasks
  FOR SELECT TO authenticated USING (public.can_access_project(project_id, auth.uid()));
CREATE POLICY "members insert tasks" ON public.project_tasks
  FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "members update tasks" ON public.project_tasks
  FOR UPDATE TO authenticated USING (public.can_access_project(project_id, auth.uid())) WITH CHECK (public.can_access_project(project_id, auth.uid()));
CREATE POLICY "members delete tasks" ON public.project_tasks
  FOR DELETE TO authenticated USING (public.can_access_project(project_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.ui_generations_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ui_generations (
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
CREATE INDEX IF NOT EXISTS ui_generations_user_created_idx ON public.ui_generations (user_id, created_at DESC);
DROP POLICY IF EXISTS "Users read own UI generations" ON public.ui_generations;
DROP POLICY IF EXISTS "Users insert own UI generations" ON public.ui_generations;
DROP POLICY IF EXISTS "Users update own UI generations" ON public.ui_generations;
DROP POLICY IF EXISTS "Users delete own UI generations" ON public.ui_generations;
CREATE POLICY "Users read own UI generations" ON public.ui_generations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own UI generations" ON public.ui_generations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own UI generations" ON public.ui_generations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own UI generations" ON public.ui_generations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS ui_generations_set_updated_at ON public.ui_generations;
CREATE TRIGGER ui_generations_set_updated_at
  BEFORE UPDATE ON public.ui_generations
  FOR EACH ROW EXECUTE FUNCTION public.ui_generations_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.promotion_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok','youtube','other')),
  url text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  credits_awarded integer NOT NULL DEFAULT 0,
  reject_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.promotion_submissions TO authenticated;
GRANT ALL ON public.promotion_submissions TO service_role;
ALTER TABLE public.promotion_submissions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS promotion_submissions_user_url_pending_idx ON public.promotion_submissions(user_id, url) WHERE status = 'pending';
DROP POLICY IF EXISTS "users insert own promo submissions" ON public.promotion_submissions;
DROP POLICY IF EXISTS "users read own promo submissions" ON public.promotion_submissions;
DROP POLICY IF EXISTS "admins read all promo submissions" ON public.promotion_submissions;
DROP POLICY IF EXISTS "admins update promo submissions" ON public.promotion_submissions;
CREATE POLICY "users insert own promo submissions" ON public.promotion_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "users read own promo submissions" ON public.promotion_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all promo submissions" ON public.promotion_submissions
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update promo submissions" ON public.promotion_submissions
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));