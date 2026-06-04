ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chat_name_gradient text[],
  ADD COLUMN IF NOT EXISTS chat_text_gradient text[],
  ADD COLUMN IF NOT EXISTS chat_icon text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_chat_name_gradient_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_chat_name_gradient_valid CHECK (
    chat_name_gradient IS NULL OR (
      array_length(chat_name_gradient, 1) BETWEEN 1 AND 4
      AND array_to_string(chat_name_gradient, ',') ~ '^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?(,#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?){0,3}$'
    )
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_chat_text_gradient_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_chat_text_gradient_valid CHECK (
    chat_text_gradient IS NULL OR (
      array_length(chat_text_gradient, 1) BETWEEN 1 AND 4
      AND array_to_string(chat_text_gradient, ',') ~ '^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?(,#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?){0,3}$'
    )
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_chat_icon_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_chat_icon_valid CHECK (
    chat_icon IS NULL OR chat_icon ~ '^[a-z0-9_-]{1,32}$'
  );
