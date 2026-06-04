-- =====================================================================
-- BloxSmith — Roblox Docs Knowledge base (idempotent, paste-in-SQL-Editor)
-- ---------------------------------------------------------------------
-- Creates everything the "Roblox Docs Knowledge" panel and the AI's
-- roblox_docs_search tool need: pgvector, the roblox_docs table + HNSW
-- index, the roblox_docs_sync run-log, RLS, and the match_roblox_docs RPC.
-- Safe to run repeatedly — it only creates what's missing and re-applies
-- policies/function cleanly. Run this in Supabase → SQL Editor if the
-- panel shows "never run / 0 chunks" (that means the schema never reached
-- production).
-- =====================================================================

-- 1) pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Knowledge base table (chunked docs + 1536-dim embeddings)
CREATE TABLE IF NOT EXISTS public.roblox_docs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL DEFAULT 'github',
  source_url  TEXT NOT NULL,
  repo_path   TEXT,
  title       TEXT NOT NULL,
  section     TEXT,
  content     TEXT NOT NULL,
  sha         TEXT,
  model       TEXT NOT NULL,
  embedding   vector(1536) NOT NULL,
  token_count INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.roblox_docs TO authenticated;
GRANT ALL    ON public.roblox_docs TO service_role;
ALTER TABLE public.roblox_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Roblox docs readable by authenticated" ON public.roblox_docs;
DROP POLICY IF EXISTS "auth read docs"                        ON public.roblox_docs;
CREATE POLICY "Roblox docs readable by authenticated"
  ON public.roblox_docs FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS roblox_docs_repo_path_idx ON public.roblox_docs (repo_path);
CREATE INDEX IF NOT EXISTS roblox_docs_source_idx    ON public.roblox_docs (source);
CREATE INDEX IF NOT EXISTS roblox_docs_embedding_idx
  ON public.roblox_docs USING hnsw (embedding vector_cosine_ops);

-- 3) Sync run log
CREATE TABLE IF NOT EXISTS public.roblox_docs_sync (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL DEFAULT 'github',
  status      TEXT NOT NULL DEFAULT 'running',
  processed   INT  NOT NULL DEFAULT 0,
  total       INT  NOT NULL DEFAULT 0,
  skipped     INT  NOT NULL DEFAULT 0,
  error       TEXT,
  started_by  UUID,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

GRANT SELECT ON public.roblox_docs_sync TO authenticated;
GRANT ALL    ON public.roblox_docs_sync TO service_role;
ALTER TABLE public.roblox_docs_sync ENABLE ROW LEVEL SECURITY;

-- Sync log readable by admins/owners only (matches the latest migration).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.roblox_docs_sync'::regclass AND polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.roblox_docs_sync', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Admins read roblox_docs_sync"
  ON public.roblox_docs_sync FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner')
    )
  );

-- 4) Semantic search RPC used by searchRobloxDocs()
CREATE OR REPLACE FUNCTION public.match_roblox_docs(
  query_embedding vector(1536),
  match_count INT DEFAULT 6,
  min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  section TEXT,
  source TEXT,
  source_url TEXT,
  repo_path TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
SET search_path = public
AS $$
  SELECT
    d.id, d.title, d.section, d.source, d.source_url, d.repo_path, d.content,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.roblox_docs d
  WHERE 1 - (d.embedding <=> query_embedding) >= min_similarity
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_roblox_docs(vector, INT, FLOAT)
  TO authenticated, service_role;

-- 5) Quick checks (optional — run separately to confirm)
-- SELECT count(*) AS chunks FROM public.roblox_docs;          -- 0 until you sync
-- SELECT * FROM public.roblox_docs_sync ORDER BY started_at DESC LIMIT 1;
