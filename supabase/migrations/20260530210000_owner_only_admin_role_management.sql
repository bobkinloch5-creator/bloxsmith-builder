-- Only owners may grant or revoke app roles.
-- Admins can moderate the site, but they cannot promote other users to admin
-- or edit role rows directly.

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "owners manage roles" ON public.user_roles;

CREATE POLICY "owners manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'only owners can manage roles';
  END IF;

  IF _role = 'owner' THEN
    RAISE EXCEPTION 'owner role cannot be changed here';
  END IF;

  IF public.has_role(_user_id, 'owner') AND NOT _grant THEN
    RAISE EXCEPTION 'cannot demote owner';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (_user_id, _role)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role;
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) TO authenticated, service_role;
