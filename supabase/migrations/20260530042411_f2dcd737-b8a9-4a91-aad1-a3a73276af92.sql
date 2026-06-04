
CREATE TABLE IF NOT EXISTS public.account_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint_hash text NOT NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS account_fingerprints_user_fp_idx
  ON public.account_fingerprints (user_id, fingerprint_hash);
CREATE INDEX IF NOT EXISTS account_fingerprints_fp_idx
  ON public.account_fingerprints (fingerprint_hash);
CREATE INDEX IF NOT EXISTS account_fingerprints_ip_idx
  ON public.account_fingerprints (ip_hash);

GRANT SELECT ON public.account_fingerprints TO authenticated;
GRANT ALL ON public.account_fingerprints TO service_role;

ALTER TABLE public.account_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own fingerprints"
ON public.account_fingerprints
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
