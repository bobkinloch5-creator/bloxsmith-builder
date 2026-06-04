
-- Attach the project owner/user sync trigger so inserts that only set user_id
-- still populate the NOT NULL owner_id column.
DROP TRIGGER IF EXISTS sync_project_owner_user_columns_trg ON public.projects;
CREATE TRIGGER sync_project_owner_user_columns_trg
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.sync_project_owner_user_columns();

-- Keep updated_at fresh on writes.
DROP TRIGGER IF EXISTS touch_projects_updated_at ON public.projects;
CREATE TRIGGER touch_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_profiles_updated_at ON public.profiles;
CREATE TRIGGER touch_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_project_files_updated_at ON public.project_files;
CREATE TRIGGER touch_project_files_updated_at
BEFORE UPDATE ON public.project_files
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add WITH CHECK to profile UPDATE so updates that touch user_id still verify ownership.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = id);
