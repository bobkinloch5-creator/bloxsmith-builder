-- Add a public bug-report channel to Global Chat.

INSERT INTO public.chat_channels (slug, name, description, view_role, post_role, position, icon)
VALUES ('bugs', 'bugs', 'Report BloxSmith bugs and broken features', 'user', 'user', 25, 'bug')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    view_role = EXCLUDED.view_role,
    post_role = EXCLUDED.post_role,
    position = EXCLUDED.position,
    icon = EXCLUDED.icon;

NOTIFY pgrst, 'reload schema';
