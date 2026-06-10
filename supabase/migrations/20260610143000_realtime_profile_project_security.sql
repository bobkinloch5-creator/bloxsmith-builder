-- Security hardening:
-- 1) Keep sensitive profile columns out of Realtime CDC entirely.
-- 2) Replace permissive realtime.messages policies with topic-scoped auth.
-- 3) Keep moderator powers out of private project access escalation.

-- Supabase Realtime CDC operates from logical replication and does not honor
-- column-level SELECT grants. Do not publish profiles via Postgres Changes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY DEFAULT;

-- Project-wide escalation is owner/admin only. Moderators are intentionally
-- limited to moderation-scoped functions and policies.
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;

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
        OR public.is_platform_admin(_user_id)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_project(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid, uuid) TO authenticated, service_role;

-- Centralize Realtime channel authorization. Policies are OR-combined in
-- Postgres, so the old USING (true) policies must be removed as well.
CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(_topic text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND CASE
      WHEN _topic LIKE 'project_chat:%'
        OR _topic LIKE 'project_files:%'
        OR _topic LIKE 'plugin_context:%'
        OR _topic LIKE 'ai-indicator-%' THEN
          public.can_access_project(public.extract_uuid_from_topic(_topic), _user_id)

      WHEN _topic LIKE 'agent_messages:%' THEN
        public.can_access_conversation(public.extract_uuid_from_topic(_topic), _user_id)

      WHEN _topic LIKE 'private:user:%' THEN
        substring(_topic FROM '^private:user:([0-9a-f-]{36})(:.*)?$') = _user_id::text

      WHEN _topic LIKE 'user:%' THEN
        substring(_topic FROM '^user:([0-9a-f-]{36})(:.*)?$') = _user_id::text

      WHEN _topic LIKE 'fr\_%' THEN
        split_part(_topic, '_', 2) = _user_id::text

      WHEN _topic LIKE 'dm\_%' THEN
        split_part(_topic, '_', 2) = _user_id::text
        OR split_part(_topic, '_', 3) = _user_id::text

      WHEN _topic LIKE 'achievements-%' THEN
        substring(_topic FROM '^achievements-([0-9a-f-]{36})-.+$') = _user_id::text

      WHEN _topic LIKE 'mcp-status-%' THEN
        substring(_topic FROM '^mcp-status-([0-9a-f-]{36})-.+$') = _user_id::text

      WHEN _topic LIKE 'bloxsmith-chat-%'
        OR _topic LIKE 'bloxsmith-achievements-%' THEN
          true

      ELSE false
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_realtime_topic(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_access_realtime_topic(text, uuid) TO authenticated, service_role;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can broadcast to realtime" ON realtime.messages;
DROP POLICY IF EXISTS "realtime: authenticated read scoped" ON realtime.messages;
DROP POLICY IF EXISTS "realtime: authenticated write scoped" ON realtime.messages;

CREATE POLICY "realtime: authenticated read scoped"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.can_access_realtime_topic(realtime.topic(), (SELECT auth.uid())));

CREATE POLICY "realtime: authenticated write scoped"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_realtime_topic(realtime.topic(), (SELECT auth.uid())));
