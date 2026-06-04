REVOKE EXECUTE ON FUNCTION public.on_global_chat_message_reward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_gallery_post_reward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_follow_reward() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.on_global_chat_message_reward() TO service_role;
GRANT EXECUTE ON FUNCTION public.on_gallery_post_reward() TO service_role;
GRANT EXECUTE ON FUNCTION public.on_follow_reward() TO service_role;