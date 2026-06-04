
-- Add 'moderator' to app_role enum (previously missing)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';
