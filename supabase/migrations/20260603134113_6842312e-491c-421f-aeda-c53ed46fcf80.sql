ALTER TABLE public.project_ai_memories
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS confidence numeric(4,3) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS source_prompt text;

UPDATE public.project_ai_memories
SET key = 'legacy_' || substr(id::text, 1, 8)
WHERE key IS NULL;

ALTER TABLE public.project_ai_memories
  ALTER COLUMN key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_ai_memories_project_key_uidx
  ON public.project_ai_memories (project_id, key);