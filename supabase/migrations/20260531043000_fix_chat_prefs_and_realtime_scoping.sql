-- Security hardening: fixes two findings that earlier migrations missed.
--
-- FINDING 6 — "All users' chat preferences readable by any authenticated user"
-- The earlier fix dropped a policy named "prefs read", but the actual permissive
-- policy created at table setup is named "prefs public read" (USING true, granted
-- to anon + authenticated). Because that DROP did not match, the insecure policy
-- survived, and since RLS policies are OR-combined, it still wins over the
-- stricter "prefs read own". This drops the real permissive policy by its correct
-- name, removes the anon SELECT grant, and ensures the own-row policy exists.
--
-- FINDING 1 — "No RLS scoping on realtime.messages for app channels"
-- The scoped realtime policies fell back to ELSE true, which let any
-- authenticated user subscribe to (and broadcast on) per-user app topics such
-- as dm_<a>_<b> and fr_<uid>. We now require the requesting user to be a
-- participant of those topics. DM/friend message CONTENT is independently
-- protected by table RLS on direct_messages / friend_requests; this adds the
-- missing broadcast/presence scoping as defense-in-depth. Non-participant
-- system topics (e.g. the random-id postgres_changes channels) still fall to
-- ELSE true because their row delivery is already table-RLS gated.

-- ---- Finding 6 ----------------------------------------------------------------
DROP POLICY IF EXISTS "prefs public read"  ON public.global_chat_user_prefs;
DROP POLICY IF EXISTS "prefs read"         ON public.global_chat_user_prefs;
DROP POLICY IF EXISTS "prefs read own"     ON public.global_chat_user_prefs;

REVOKE SELECT ON public.global_chat_user_prefs FROM anon;

CREATE POLICY "prefs read own"
ON public.global_chat_user_prefs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ---- Finding 1 ----------------------------------------------------------------
DROP POLICY IF EXISTS "realtime: authenticated read scoped"  ON realtime.messages;
CREATE POLICY "realtime: authenticated read scoped"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'project_chat:%'
      OR realtime.topic() LIKE 'project_files:%'
      OR realtime.topic() LIKE 'plugin_context:%'
      OR realtime.topic() LIKE 'ai-indicator-%' THEN
        public.can_access_project(public.extract_uuid_from_topic(realtime.topic()), (SELECT auth.uid()))
    WHEN realtime.topic() LIKE 'agent_messages:%' THEN
      public.can_access_conversation(public.extract_uuid_from_topic(realtime.topic()), (SELECT auth.uid()))
    WHEN realtime.topic() LIKE 'private:user:%' THEN
      substring(realtime.topic() FROM '^private:user:(.+)$') = (SELECT auth.uid())::text
    -- Per-user app channels must belong to the requesting user.
    WHEN realtime.topic() LIKE 'fr\_%' THEN
      split_part(realtime.topic(), '_', 2) = (SELECT auth.uid())::text
    WHEN realtime.topic() LIKE 'dm\_%' THEN
      split_part(realtime.topic(), '_', 2) = (SELECT auth.uid())::text
      OR split_part(realtime.topic(), '_', 3) = (SELECT auth.uid())::text
    ELSE true
  END
);

DROP POLICY IF EXISTS "realtime: authenticated write scoped" ON realtime.messages;
CREATE POLICY "realtime: authenticated write scoped"
ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'project_chat:%'
      OR realtime.topic() LIKE 'project_files:%'
      OR realtime.topic() LIKE 'plugin_context:%'
      OR realtime.topic() LIKE 'ai-indicator-%' THEN
        public.can_access_project(public.extract_uuid_from_topic(realtime.topic()), (SELECT auth.uid()))
    WHEN realtime.topic() LIKE 'agent_messages:%' THEN
      public.can_access_conversation(public.extract_uuid_from_topic(realtime.topic()), (SELECT auth.uid()))
    WHEN realtime.topic() LIKE 'private:user:%' THEN
      substring(realtime.topic() FROM '^private:user:(.+)$') = (SELECT auth.uid())::text
    WHEN realtime.topic() LIKE 'fr\_%' THEN
      split_part(realtime.topic(), '_', 2) = (SELECT auth.uid())::text
    WHEN realtime.topic() LIKE 'dm\_%' THEN
      split_part(realtime.topic(), '_', 2) = (SELECT auth.uid())::text
      OR split_part(realtime.topic(), '_', 3) = (SELECT auth.uid())::text
    ELSE true
  END
);
