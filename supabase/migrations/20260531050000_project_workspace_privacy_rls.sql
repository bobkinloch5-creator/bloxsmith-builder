-- Workspace privacy hardening.
-- Users may only see projects they own or projects where they are an explicit collaborator.

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_collaborators c
    WHERE c.project_id = _project_id
      AND c.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_collaborators c
    WHERE c.project_id = _project_id
      AND c.user_id = _user_id
      AND c.role = 'editor'
  );
$$;

DROP POLICY IF EXISTS "projects_owner_all" ON public.projects;
DROP POLICY IF EXISTS "projects_collab_read" ON public.projects;
DROP POLICY IF EXISTS "owners and collabs read projects" ON public.projects;
DROP POLICY IF EXISTS "owners update projects" ON public.projects;
DROP POLICY IF EXISTS "owners delete projects" ON public.projects;
DROP POLICY IF EXISTS "project_select_owner_or_collab" ON public.projects;
DROP POLICY IF EXISTS "project_insert_owner" ON public.projects;
DROP POLICY IF EXISTS "project_update_owner" ON public.projects;
DROP POLICY IF EXISTS "project_delete_owner" ON public.projects;

CREATE POLICY "project_select_owner_or_collab"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (public.can_access_project(id, auth.uid()));

CREATE POLICY "project_insert_owner"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_update_owner"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_delete_owner"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "files_access" ON public.project_files;
DROP POLICY IF EXISTS "members read files" ON public.project_files;
DROP POLICY IF EXISTS "members write files" ON public.project_files;
DROP POLICY IF EXISTS "project owners read files" ON public.project_files;
DROP POLICY IF EXISTS "project owners write files" ON public.project_files;
DROP POLICY IF EXISTS "project_files_select_member" ON public.project_files;
DROP POLICY IF EXISTS "project_files_write_editor" ON public.project_files;

CREATE POLICY "project_files_select_member"
  ON public.project_files
  FOR SELECT
  TO authenticated
  USING (public.can_access_project(project_id, auth.uid()));

CREATE POLICY "project_files_write_editor"
  ON public.project_files
  FOR ALL
  TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "collab_read_self_or_owner" ON public.project_collaborators;
DROP POLICY IF EXISTS "collab_owner_manage" ON public.project_collaborators;
DROP POLICY IF EXISTS "members read collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "owners manage collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "collab_select_self_or_owner" ON public.project_collaborators;
DROP POLICY IF EXISTS "collab_owner_insert" ON public.project_collaborators;
DROP POLICY IF EXISTS "collab_owner_update" ON public.project_collaborators;
DROP POLICY IF EXISTS "collab_owner_delete" ON public.project_collaborators;

CREATE POLICY "collab_select_self_or_owner"
  ON public.project_collaborators
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "collab_owner_insert"
  ON public.project_collaborators
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "collab_owner_update"
  ON public.project_collaborators
  FOR UPDATE
  TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()))
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "collab_owner_delete"
  ON public.project_collaborators
  FOR DELETE
  TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()));
