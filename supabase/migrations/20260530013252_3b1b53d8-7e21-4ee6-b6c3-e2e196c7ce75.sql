ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chat_nickname text,
  ADD COLUMN IF NOT EXISTS chat_font text;

-- Length / charset guardrail for nickname
CREATE OR REPLACE FUNCTION public.validate_chat_nickname()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_nickname IS NOT NULL THEN
    NEW.chat_nickname := btrim(NEW.chat_nickname);
    IF NEW.chat_nickname = '' THEN
      NEW.chat_nickname := NULL;
    ELSIF char_length(NEW.chat_nickname) > 24 THEN
      RAISE EXCEPTION 'chat_nickname must be 24 characters or fewer';
    ELSIF NEW.chat_nickname !~ '^[A-Za-z0-9 _.\-]+$' THEN
      RAISE EXCEPTION 'chat_nickname contains invalid characters';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_chat_nickname_trg ON public.profiles;
CREATE TRIGGER validate_chat_nickname_trg
BEFORE INSERT OR UPDATE OF chat_nickname ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_nickname();