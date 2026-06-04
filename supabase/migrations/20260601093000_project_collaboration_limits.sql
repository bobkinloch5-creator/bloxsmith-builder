-- Keep project collaboration private and bounded: 1 owner + up to 4 collaborators.
CREATE OR REPLACE FUNCTION public.enforce_project_collaborator_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _count integer;
BEGIN
  SELECT user_id INTO _owner
  FROM public.projects
  WHERE id = NEW.project_id;

  IF _owner IS NULL THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  IF NEW.user_id = _owner THEN
    RAISE EXCEPTION 'owner_cannot_be_collaborator';
  END IF;

  IF NEW.role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'invalid_collaborator_role';
  END IF;

  SELECT count(*) INTO _count
  FROM public.project_collaborators
  WHERE project_id = NEW.project_id
    AND id IS DISTINCT FROM NEW.id;

  IF _count >= 4 THEN
    RAISE EXCEPTION 'collaborator_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_collaborator_limit ON public.project_collaborators;
CREATE TRIGGER trg_project_collaborator_limit
BEFORE INSERT OR UPDATE ON public.project_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.enforce_project_collaborator_limit();

COMMENT ON FUNCTION public.enforce_project_collaborator_limit()
IS 'Enforces private project teams: one owner plus up to four collaborators, with per-user credits remaining separate.';
