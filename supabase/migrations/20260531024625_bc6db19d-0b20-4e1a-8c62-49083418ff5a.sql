-- 1. Realtime channel authorization ------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_conversation(_convo_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = _convo_id
      AND public.can_access_project(c.project_id, _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.extract_uuid_from_topic(_topic text)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(substring(_topic FROM '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'), '')::uuid;
$$;

DROP POLICY IF EXISTS "realtime: authenticated read scoped" ON realtime.messages;
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
    ELSE true
  END
);

-- 2. Vault-backed encryption -------------------------------------------------

ALTER TABLE public.user_mcp_servers ADD COLUMN IF NOT EXISTS auth_header_secret_id uuid;
ALTER TABLE public.user_provider_keys ADD COLUMN IF NOT EXISTS api_key_secret_id uuid;

DO $$
DECLARE r record; sid uuid;
BEGIN
  FOR r IN SELECT id, auth_header FROM public.user_mcp_servers
           WHERE auth_header IS NOT NULL AND auth_header <> '' AND auth_header_secret_id IS NULL LOOP
    sid := vault.create_secret(r.auth_header, 'mcp_auth:' || r.id::text, 'MCP auth header');
    UPDATE public.user_mcp_servers SET auth_header_secret_id = sid WHERE id = r.id;
  END LOOP;
  FOR r IN SELECT user_id, provider, api_key FROM public.user_provider_keys
           WHERE api_key IS NOT NULL AND api_key <> '' AND api_key_secret_id IS NULL LOOP
    sid := vault.create_secret(r.api_key, 'provider_key:' || r.user_id::text || ':' || r.provider, 'AI provider key');
    UPDATE public.user_provider_keys SET api_key_secret_id = sid
      WHERE user_id = r.user_id AND provider = r.provider;
  END LOOP;
END $$;

ALTER TABLE public.user_mcp_servers DROP COLUMN auth_header;
ALTER TABLE public.user_provider_keys DROP COLUMN api_key;

ALTER TABLE public.user_mcp_servers
  ADD COLUMN auth_header_set boolean GENERATED ALWAYS AS (auth_header_secret_id IS NOT NULL) STORED;

CREATE OR REPLACE FUNCTION public.set_mcp_auth_header(_server_id uuid, _value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _existing uuid; _sid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT auth_header_secret_id INTO _existing FROM public.user_mcp_servers
    WHERE id = _server_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _value IS NULL OR _value = '' THEN
    UPDATE public.user_mcp_servers SET auth_header_secret_id = NULL, updated_at = now() WHERE id = _server_id;
    RETURN;
  END IF;
  IF _existing IS NOT NULL THEN
    PERFORM vault.update_secret(_existing, _value);
  ELSE
    _sid := vault.create_secret(_value, 'mcp_auth:' || _server_id::text || ':' || extract(epoch from now())::text, 'MCP auth header');
    UPDATE public.user_mcp_servers SET auth_header_secret_id = _sid, updated_at = now() WHERE id = _server_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_mcp_auth_header(_server_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid; _val text;
BEGIN
  SELECT auth_header_secret_id INTO _sid FROM public.user_mcp_servers
   WHERE id = _server_id AND (auth.uid() = user_id OR auth.role() = 'service_role');
  IF _sid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO _val FROM vault.decrypted_secrets WHERE id = _sid;
  RETURN _val;
END $$;

CREATE OR REPLACE FUNCTION public.set_provider_api_key(_provider text, _api_key text, _label text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _existing uuid; _sid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _provider NOT IN ('openai','anthropic','google','groq') THEN RAISE EXCEPTION 'invalid_provider'; END IF;
  IF _api_key IS NULL OR _api_key = '' THEN RAISE EXCEPTION 'invalid_key'; END IF;
  SELECT api_key_secret_id INTO _existing FROM public.user_provider_keys WHERE user_id = _uid AND provider = _provider;
  IF _existing IS NOT NULL THEN
    PERFORM vault.update_secret(_existing, _api_key);
    UPDATE public.user_provider_keys SET label = COALESCE(_label, label), updated_at = now()
      WHERE user_id = _uid AND provider = _provider;
  ELSE
    _sid := vault.create_secret(_api_key, 'provider_key:' || _uid::text || ':' || _provider || ':' || extract(epoch from now())::text, 'AI provider key');
    INSERT INTO public.user_provider_keys(user_id, provider, api_key_secret_id, label)
    VALUES (_uid, _provider, _sid, _label);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_provider_api_key(_user_id uuid, _provider text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid; _val text;
BEGIN
  IF auth.uid() <> _user_id AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT api_key_secret_id INTO _sid FROM public.user_provider_keys WHERE user_id = _user_id AND provider = _provider;
  IF _sid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO _val FROM vault.decrypted_secrets WHERE id = _sid;
  RETURN _val;
END $$;

CREATE OR REPLACE FUNCTION public.delete_provider_api_key(_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.user_provider_keys WHERE user_id = _uid AND provider = _provider;
END $$;

GRANT EXECUTE ON FUNCTION public.set_mcp_auth_header(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mcp_auth_header(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_provider_api_key(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_api_key(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_provider_api_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extract_uuid_from_topic(text) TO authenticated, service_role;