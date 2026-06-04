ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_badges text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles ADD CONSTRAINT profiles_badges_valid CHECK (
  array_length(profile_badges, 1) IS NULL OR (
    array_length(profile_badges, 1) <= 12 AND
    array_to_string(profile_badges, ',') ~ '^[a-z0-9_-]+(,[a-z0-9_-]+)*$'
  )
);