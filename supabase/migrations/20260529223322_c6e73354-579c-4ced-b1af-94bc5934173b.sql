-- Add missing tables, columns, and RPCs from migrations 2-16

-- blocked email domains
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  domain text PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_email_domains TO authenticated;
GRANT ALL ON public.blocked_email_domains TO service_role;
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage blocked domains" ON public.blocked_email_domains;
CREATE POLICY "admins manage blocked domains" ON public.blocked_email_domains FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- build_plans
CREATE TABLE IF NOT EXISTS public.build_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  plan jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_build_plans_project ON public.build_plans(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_plans TO authenticated;
GRANT ALL ON public.build_plans TO service_role;
ALTER TABLE public.build_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read plans" ON public.build_plans;
CREATE POLICY "members read plans" ON public.build_plans FOR SELECT TO authenticated USING (public.can_access_project(project_id, auth.uid()));
DROP POLICY IF EXISTS "members insert plans" ON public.build_plans;
CREATE POLICY "members insert plans" ON public.build_plans FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());
DROP POLICY IF EXISTS "members update plans" ON public.build_plans;
CREATE POLICY "members update plans" ON public.build_plans FOR UPDATE TO authenticated USING (public.can_access_project(project_id, auth.uid())) WITH CHECK (public.can_access_project(project_id, auth.uid()));
DROP POLICY IF EXISTS "owners delete plans" ON public.build_plans;
CREATE POLICY "owners delete plans" ON public.build_plans FOR DELETE TO authenticated USING (public.is_project_owner(project_id, auth.uid()));

-- project_tasks
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  plan_id uuid,
  user_id uuid NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'feature',
  status text NOT NULL DEFAULT 'todo',
  payload jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks(project_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read tasks" ON public.project_tasks;
CREATE POLICY "members read tasks" ON public.project_tasks FOR SELECT TO authenticated USING (public.can_access_project(project_id, auth.uid()));
DROP POLICY IF EXISTS "members insert tasks" ON public.project_tasks;
CREATE POLICY "members insert tasks" ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());
DROP POLICY IF EXISTS "members update tasks" ON public.project_tasks;
CREATE POLICY "members update tasks" ON public.project_tasks FOR UPDATE TO authenticated USING (public.can_access_project(project_id, auth.uid())) WITH CHECK (public.can_access_project(project_id, auth.uid()));
DROP POLICY IF EXISTS "members delete tasks" ON public.project_tasks;
CREATE POLICY "members delete tasks" ON public.project_tasks FOR DELETE TO authenticated USING (public.can_access_project(project_id, auth.uid()));

-- templates
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  thumbnail_url text,
  credits_cost integer NOT NULL DEFAULT 0,
  difficulty text NOT NULL DEFAULT 'beginner',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  build_spec jsonb NOT NULL,
  install_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category, active);
GRANT SELECT ON public.templates TO authenticated, anon;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads active templates" ON public.templates;
CREATE POLICY "anyone reads active templates" ON public.templates FOR SELECT TO authenticated, anon USING (active = true);
DROP POLICY IF EXISTS "admins manage templates" ON public.templates;
CREATE POLICY "admins manage templates" ON public.templates FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- template_installs
CREATE TABLE IF NOT EXISTS public.template_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  credits_charged integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_template_installs_user ON public.template_installs(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.template_installs TO authenticated;
GRANT ALL ON public.template_installs TO service_role;
ALTER TABLE public.template_installs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own installs" ON public.template_installs;
CREATE POLICY "users read own installs" ON public.template_installs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "users insert own installs" ON public.template_installs;
CREATE POLICY "users insert own installs" ON public.template_installs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- project_scans
CREATE TABLE IF NOT EXISTS public.project_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  report jsonb NOT NULL,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_scans_project ON public.project_scans(project_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.project_scans TO authenticated;
GRANT ALL ON public.project_scans TO service_role;
ALTER TABLE public.project_scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read scans" ON public.project_scans;
CREATE POLICY "members read scans" ON public.project_scans FOR SELECT TO authenticated USING (public.can_access_project(project_id, auth.uid()));
DROP POLICY IF EXISTS "members insert scans" ON public.project_scans;
CREATE POLICY "members insert scans" ON public.project_scans FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());
DROP POLICY IF EXISTS "owners delete scans" ON public.project_scans;
CREATE POLICY "owners delete scans" ON public.project_scans FOR DELETE TO authenticated USING (public.is_project_owner(project_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_build_plans_touch ON public.build_plans;
CREATE TRIGGER trg_build_plans_touch BEFORE UPDATE ON public.build_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_project_tasks_touch ON public.project_tasks;
CREATE TRIGGER trg_project_tasks_touch BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_templates_touch ON public.templates;
CREATE TRIGGER trg_templates_touch BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- generated-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public read generated-images" ON storage.objects;
CREATE POLICY "Public read generated-images" ON storage.objects FOR SELECT USING (bucket_id = 'generated-images');

-- Add Roblox + showcase columns to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS roblox_universe_id text,
  ADD COLUMN IF NOT EXISTS roblox_place_id text,
  ADD COLUMN IF NOT EXISTS roblox_last_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS roblox_last_version int,
  ADD COLUMN IF NOT EXISTS showcase_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS showcase_title text,
  ADD COLUMN IF NOT EXISTS showcase_description text,
  ADD COLUMN IF NOT EXISTS showcase_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS showcase_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS showcase_likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS showcase_remix_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forked_from_project_id uuid;

CREATE INDEX IF NOT EXISTS idx_projects_showcase_published ON public.projects(showcase_published, showcase_published_at DESC) WHERE showcase_published = true;
DROP POLICY IF EXISTS "public reads showcased projects" ON public.projects;
CREATE POLICY "public reads showcased projects" ON public.projects FOR SELECT TO anon, authenticated USING (showcase_published = true);
GRANT SELECT ON public.projects TO anon;

-- showcase_likes
CREATE TABLE IF NOT EXISTS public.showcase_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT ON public.showcase_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.showcase_likes TO authenticated;
GRANT ALL ON public.showcase_likes TO service_role;
ALTER TABLE public.showcase_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads likes" ON public.showcase_likes;
CREATE POLICY "anyone reads likes" ON public.showcase_likes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "users like own" ON public.showcase_likes;
CREATE POLICY "users like own" ON public.showcase_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users unlike own" ON public.showcase_likes;
CREATE POLICY "users unlike own" ON public.showcase_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_showcase_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects SET showcase_likes_count = showcase_likes_count + 1 WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects SET showcase_likes_count = GREATEST(0, showcase_likes_count - 1) WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_showcase_likes_count ON public.showcase_likes;
CREATE TRIGGER trg_showcase_likes_count AFTER INSERT OR DELETE ON public.showcase_likes FOR EACH ROW EXECUTE FUNCTION public.tg_showcase_likes_count();

CREATE OR REPLACE FUNCTION public.remix_showcase_project(_source_id uuid, _new_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _src public.projects; _new_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _src FROM public.projects WHERE id = _source_id AND showcase_published = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found_or_not_public'; END IF;
  INSERT INTO public.projects (user_id, name, description, game_type, ai_rules, status, forked_from_project_id)
  VALUES (_uid, COALESCE(_new_name, _src.name || ' (Remix)'), _src.description, _src.game_type, _src.ai_rules, 'draft', _src.id)
  RETURNING id INTO _new_id;
  INSERT INTO public.project_files (project_id, path, file_type, service_location, content)
  SELECT _new_id, path, file_type, service_location, content FROM public.project_files WHERE project_id = _source_id;
  UPDATE public.projects SET showcase_remix_count = showcase_remix_count + 1 WHERE id = _source_id;
  RETURN _new_id;
END $$;

-- ai_provider_events
CREATE TABLE IF NOT EXISTS public.ai_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  project_id uuid NULL,
  feature text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  source text NULL,
  ok boolean NOT NULL,
  duration_ms integer NULL,
  error_kind text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_provider_events_created_at_idx ON public.ai_provider_events(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_provider_events_provider_model_idx ON public.ai_provider_events(provider, model, created_at DESC);
ALTER TABLE public.ai_provider_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_provider_events TO service_role;
DROP POLICY IF EXISTS "service role manages ai provider events" ON public.ai_provider_events;
CREATE POLICY "service role manages ai provider events" ON public.ai_provider_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- project_ai_memories
CREATE TABLE IF NOT EXISTS public.project_ai_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  kind text NOT NULL DEFAULT 'preference',
  value text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 0.70,
  source_prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, key),
  CHECK (kind IN ('preference', 'project_fact', 'recent')),
  CHECK (char_length(value) <= 1000),
  CHECK (confidence >= 0 AND confidence <= 1)
);
CREATE INDEX IF NOT EXISTS project_ai_memories_project_seen_idx ON public.project_ai_memories(project_id, last_seen_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_ai_memories TO authenticated;
GRANT ALL ON public.project_ai_memories TO service_role;
ALTER TABLE public.project_ai_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project members read ai memories" ON public.project_ai_memories;
CREATE POLICY "project members read ai memories" ON public.project_ai_memories FOR SELECT TO authenticated USING (public.can_access_project(project_id, auth.uid()));
DROP POLICY IF EXISTS "project members insert ai memories" ON public.project_ai_memories;
CREATE POLICY "project members insert ai memories" ON public.project_ai_memories FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());
DROP POLICY IF EXISTS "project members update ai memories" ON public.project_ai_memories;
CREATE POLICY "project members update ai memories" ON public.project_ai_memories FOR UPDATE TO authenticated USING (public.can_access_project(project_id, auth.uid())) WITH CHECK (public.can_access_project(project_id, auth.uid()));
DROP POLICY IF EXISTS "project owners delete ai memories" ON public.project_ai_memories;
CREATE POLICY "project owners delete ai memories" ON public.project_ai_memories FOR DELETE TO authenticated USING (public.is_project_owner(project_id, auth.uid()));

-- profile media (banner_url + bucket)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-media', 'profile-media', true, 8388608, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Profile media is publicly readable" ON storage.objects;
CREATE POLICY "Profile media is publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'profile-media');
DROP POLICY IF EXISTS "Users can upload own profile media" ON storage.objects;
CREATE POLICY "Users can upload own profile media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can update own profile media" ON storage.objects;
CREATE POLICY "Users can update own profile media" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-media' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'profile-media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can delete own profile media" ON storage.objects;
CREATE POLICY "Users can delete own profile media" ON storage.objects FOR DELETE USING (bucket_id = 'profile-media' AND auth.uid()::text = (storage.foldername(name))[1]);