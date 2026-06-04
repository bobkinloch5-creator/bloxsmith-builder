-- Keep this migration enum-only so PostgreSQL commits the new value before later
-- functions and policies compare against 'moderator'::app_role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype
      AND enumlabel = 'moderator'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'moderator';
  END IF;
END
$$;
