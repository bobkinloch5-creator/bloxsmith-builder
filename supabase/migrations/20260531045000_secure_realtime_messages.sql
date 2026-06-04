-- Secure realtime.messages RLS policies to restrict channel subscriptions based on topic and authentication

DROP POLICY IF EXISTS "realtime: authenticated read scoped" ON realtime.messages;
CREATE POLICY "realtime: authenticated read scoped"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  CASE
    -- 1. Project-level channels
    WHEN realtime.topic() LIKE 'project_chat:%'
      OR realtime.topic() LIKE 'project_files:%'
      OR realtime.topic() LIKE 'plugin_context:%'
      OR realtime.topic() LIKE 'ai-indicator-%' THEN
        public.can_access_project(public.extract_uuid_from_topic(realtime.topic()), (SELECT auth.uid()))
    
    -- 2. Conversation-level channels
    WHEN realtime.topic() LIKE 'agent_messages:%' THEN
      public.can_access_conversation(public.extract_uuid_from_topic(realtime.topic()), (SELECT auth.uid()))
    
    -- 3. Private user notifications/status channels
    WHEN realtime.topic() LIKE 'private:user:%' THEN
      substring(realtime.topic() FROM '^private:user:(.+)$') = (SELECT auth.uid())::text
    
    -- 4. Friend requests/notifications
    WHEN realtime.topic() LIKE 'fr_%' THEN
      substring(realtime.topic() FROM '^fr_(.+)$') = (SELECT auth.uid())::text
    
    -- 5. Direct Message (DM) channels (only participants)
    WHEN realtime.topic() LIKE 'dm_%' THEN
      substring(realtime.topic() FROM '^dm_([0-9a-f\-]+)_[0-9a-f\-]+$') = (SELECT auth.uid())::text
      OR substring(realtime.topic() FROM '^dm_[0-9a-f\-]+_([0-9a-f\-]+)$') = (SELECT auth.uid())::text
    
    -- 6. User-specific achievements & levels status updates
    WHEN realtime.topic() LIKE 'achievements-%' THEN
      substring(realtime.topic() FROM '^achievements-([0-9a-f\-]+)-.+$') = (SELECT auth.uid())::text
      
    -- 7. User MCP status updates
    WHEN realtime.topic() LIKE 'mcp-status-%' THEN
      substring(realtime.topic() FROM '^mcp-status-([0-9a-f\-]+)-.+$') = (SELECT auth.uid())::text
    
    -- 8. Global community channels
    WHEN realtime.topic() LIKE 'bloxsmith-chat-%'
      OR realtime.topic() LIKE 'bloxsmith-achievements-%'
      OR realtime.topic() LIKE 'bloxsmith-levels-%'
      OR realtime.topic() LIKE 'bloxsmith-dms-%' THEN
        true
        
    ELSE false
  END
);

DROP POLICY IF EXISTS "realtime: authenticated write scoped" ON realtime.messages;
CREATE POLICY "realtime: authenticated write scoped"
ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  CASE
    -- 1. Project-level channels
    WHEN realtime.topic() LIKE 'project_chat:%'
      OR realtime.topic() LIKE 'project_files:%'
      OR realtime.topic() LIKE 'plugin_context:%'
      OR realtime.topic() LIKE 'ai-indicator-%' THEN
        public.can_access_project(public.extract_uuid_from_topic(realtime.topic()), (SELECT auth.uid()))
    
    -- 2. Conversation-level channels
    WHEN realtime.topic() LIKE 'agent_messages:%' THEN
      public.can_access_conversation(public.extract_uuid_from_topic(realtime.topic()), (SELECT auth.uid()))
    
    -- 3. Private user notifications/status channels
    WHEN realtime.topic() LIKE 'private:user:%' THEN
      substring(realtime.topic() FROM '^private:user:(.+)$') = (SELECT auth.uid())::text
    
    -- 4. Friend requests/notifications
    WHEN realtime.topic() LIKE 'fr_%' THEN
      substring(realtime.topic() FROM '^fr_(.+)$') = (SELECT auth.uid())::text
    
    -- 5. Direct Message (DM) channels (only participants)
    WHEN realtime.topic() LIKE 'dm_%' THEN
      substring(realtime.topic() FROM '^dm_([0-9a-f\-]+)_[0-9a-f\-]+$') = (SELECT auth.uid())::text
      OR substring(realtime.topic() FROM '^dm_[0-9a-f\-]+_([0-9a-f\-]+)$') = (SELECT auth.uid())::text
    
    -- 6. User-specific achievements & levels status updates
    WHEN realtime.topic() LIKE 'achievements-%' THEN
      substring(realtime.topic() FROM '^achievements-([0-9a-f\-]+)-.+$') = (SELECT auth.uid())::text
      
    -- 7. User MCP status updates
    WHEN realtime.topic() LIKE 'mcp-status-%' THEN
      substring(realtime.topic() FROM '^mcp-status-([0-9a-f\-]+)-.+$') = (SELECT auth.uid())::text
    
    -- 8. Global community channels
    WHEN realtime.topic() LIKE 'bloxsmith-chat-%'
      OR realtime.topic() LIKE 'bloxsmith-achievements-%'
      OR realtime.topic() LIKE 'bloxsmith-levels-%'
      OR realtime.topic() LIKE 'bloxsmith-dms-%' THEN
        true
        
    ELSE false
  END
);
