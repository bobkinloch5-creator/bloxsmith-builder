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
      AND (
        COALESCE(p.user_id, p.owner_id) = _user_id
        OR EXISTS (
          SELECT 1
          FROM public.project_collaborators c
          WHERE c.project_id = p.id
            AND c.user_id = _user_id
        )
        OR public.is_admin(_user_id)
      )
  );
$$;