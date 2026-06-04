-- Expand global chat automod seed terms across languages and bypass spellings.
-- This is a seed list, not the only protection: admins can add more terms in bulk.

INSERT INTO public.global_chat_blocked_words(word, severity, match_mode, reason)
VALUES
  -- English NSFW/profanity and bypass-style terms
  ('fuck', 'block', 'normalized', 'profanity'),
  ('fucking', 'block', 'normalized', 'profanity'),
  ('shit', 'block', 'normalized', 'profanity'),
  ('bitch', 'block', 'normalized', 'harassment/profanity'),
  ('asshole', 'block', 'normalized', 'harassment/profanity'),
  ('cunt', 'block', 'normalized', 'sexual profanity'),
  ('dick', 'block', 'normalized', 'sexual profanity'),
  ('pussy', 'block', 'normalized', 'sexual profanity'),
  ('whore', 'block', 'normalized', 'sexual harassment'),
  ('slut', 'block', 'normalized', 'sexual harassment'),
  ('f u c k', 'block', 'normalized', 'bypass profanity'),
  ('s h i t', 'block', 'normalized', 'bypass profanity'),

  -- Spanish
  ('puta', 'block', 'normalized', 'Spanish profanity'),
  ('puto', 'block', 'normalized', 'Spanish profanity'),
  ('mierda', 'block', 'normalized', 'Spanish profanity'),
  ('cabron', 'block', 'normalized', 'Spanish profanity'),
  ('cabrón', 'block', 'partial', 'Spanish profanity'),
  ('pendejo', 'block', 'normalized', 'Spanish harassment'),
  ('coño', 'block', 'partial', 'Spanish sexual profanity'),
  ('joder', 'block', 'normalized', 'Spanish profanity'),

  -- French
  ('merde', 'block', 'normalized', 'French profanity'),
  ('putain', 'block', 'normalized', 'French profanity'),
  ('salope', 'block', 'normalized', 'French harassment'),
  ('connard', 'block', 'normalized', 'French harassment'),
  ('enculé', 'block', 'partial', 'French profanity'),
  ('encule', 'block', 'normalized', 'French profanity'),

  -- German
  ('scheisse', 'block', 'normalized', 'German profanity'),
  ('scheiße', 'block', 'partial', 'German profanity'),
  ('arschloch', 'block', 'normalized', 'German harassment'),
  ('fotze', 'block', 'normalized', 'German sexual profanity'),
  ('hure', 'block', 'normalized', 'German sexual harassment'),

  -- Portuguese
  ('merda', 'block', 'normalized', 'Portuguese profanity'),
  ('porra', 'block', 'normalized', 'Portuguese profanity'),
  ('caralho', 'block', 'normalized', 'Portuguese profanity'),
  ('fdp', 'block', 'normalized', 'Portuguese harassment'),
  ('vagabunda', 'block', 'normalized', 'Portuguese sexual harassment'),

  -- Italian
  ('cazzo', 'block', 'normalized', 'Italian profanity'),
  ('stronzo', 'block', 'normalized', 'Italian harassment'),
  ('troia', 'block', 'normalized', 'Italian sexual harassment'),
  ('vaffanculo', 'block', 'normalized', 'Italian profanity'),

  -- Dutch / Polish / Turkish / Hindi romanized
  ('klootzak', 'block', 'normalized', 'Dutch harassment'),
  ('kurwa', 'block', 'normalized', 'Polish profanity'),
  ('chuj', 'block', 'normalized', 'Polish sexual profanity'),
  ('siktir', 'block', 'normalized', 'Turkish profanity'),
  ('orospu', 'block', 'normalized', 'Turkish sexual harassment'),
  ('amk', 'block', 'normalized', 'Turkish profanity abbreviation'),
  ('bhenchod', 'block', 'normalized', 'Hindi abuse'),
  ('madarchod', 'block', 'normalized', 'Hindi abuse'),
  ('chutiya', 'block', 'normalized', 'Hindi harassment'),

  -- Cyrillic / Arabic / CJK / Korean / Japanese partial matching
  ('блядь', 'block', 'partial', 'Russian profanity'),
  ('сука', 'block', 'partial', 'Russian harassment/profanity'),
  ('пизда', 'block', 'partial', 'Russian sexual profanity'),
  ('ебать', 'block', 'partial', 'Russian profanity'),
  ('хуй', 'block', 'partial', 'Russian sexual profanity'),
  ('قحبة', 'block', 'partial', 'Arabic sexual harassment'),
  ('شرموطة', 'block', 'partial', 'Arabic sexual harassment'),
  ('كس', 'block', 'partial', 'Arabic sexual profanity'),
  ('操你妈', 'block', 'partial', 'Chinese profanity'),
  ('傻逼', 'block', 'partial', 'Chinese harassment/profanity'),
  ('씨발', 'block', 'partial', 'Korean profanity'),
  ('개새끼', 'block', 'partial', 'Korean harassment/profanity'),
  ('くそ', 'block', 'partial', 'Japanese profanity'),
  ('死ね', 'block', 'partial', 'Japanese harmful phrase')
ON CONFLICT (word) DO UPDATE
  SET severity = excluded.severity,
      match_mode = excluded.match_mode,
      reason = excluded.reason;
