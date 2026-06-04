-- studio_errors: errors reported by the Studio plugin
CREATE TABLE IF NOT EXISTS public.studio_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_path text,
  error_message text NOT NULL,
  stack text,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_errors_project_created_idx
  ON public.studio_errors (project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_errors TO authenticated;
GRANT ALL ON public.studio_errors TO service_role;

ALTER TABLE public.studio_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members read studio errors"
  ON public.studio_errors FOR SELECT TO authenticated
  USING (public.can_access_project(project_id, auth.uid()));

CREATE POLICY "project members insert studio errors"
  ON public.studio_errors FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "project owners delete studio errors"
  ON public.studio_errors FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()));

-- playtest_runs: Playtest AI scan/plan/apply/verify history
CREATE TABLE IF NOT EXISTS public.playtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  request text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planned',
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  rollback_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification jsonb,
  summary text,
  credits_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playtest_runs_project_created_idx
  ON public.playtest_runs (project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playtest_runs TO authenticated;
GRANT ALL ON public.playtest_runs TO service_role;

ALTER TABLE public.playtest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members read playtest runs"
  ON public.playtest_runs FOR SELECT TO authenticated
  USING (public.can_access_project(project_id, auth.uid()));

CREATE POLICY "project members insert playtest runs"
  ON public.playtest_runs FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project(project_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "project members update playtest runs"
  ON public.playtest_runs FOR UPDATE TO authenticated
  USING (public.can_access_project(project_id, auth.uid()))
  WITH CHECK (public.can_access_project(project_id, auth.uid()));

CREATE POLICY "project owners delete playtest runs"
  ON public.playtest_runs FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()));

CREATE TRIGGER trg_playtest_runs_updated_at
  BEFORE UPDATE ON public.playtest_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();