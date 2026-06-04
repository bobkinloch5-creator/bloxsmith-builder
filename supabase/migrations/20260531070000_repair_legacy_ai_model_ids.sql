-- Repair legacy/experimental AI model ids that providers may reject or stall on.
-- Runtime also maps these aliases, but cleaning saved settings prevents blank
-- picker states and future 400s from old project records.

UPDATE public.project_ai_settings
SET model = 'gpt-5.2'
WHERE provider = 'neokens'
  AND model IN ('gpt-5.5', 'gpt-5.4');

UPDATE public.project_ai_settings
SET model = 'gpt-5.2-codex'
WHERE provider = 'neokens'
  AND model = 'gpt-5.3-codex';
