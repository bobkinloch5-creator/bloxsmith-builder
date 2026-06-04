INSERT INTO public.achievements (key, name, description, icon, category, xp_reward, credit_reward, sort_order) VALUES
  ('template_first_build', 'Template Builder', 'Build your first Roblox game template', 'Library', 'building', 40, 4, 40),
  ('template_premium_build', 'Premium Starter', 'Build a premium credit template', 'Sparkles', 'building', 75, 6, 41),
  ('simulator_maker', 'Simulator Maker', 'Start a simulator project', 'Gamepad2', 'building', 50, 4, 42),
  ('obby_architect', 'Obby Architect', 'Start an obby project', 'Flag', 'building', 50, 4, 43),
  ('tycoon_founder', 'Tycoon Founder', 'Start a tycoon project', 'Factory', 'building', 50, 4, 44),
  ('pet_engineer', 'Pet Engineer', 'Start a pet game project', 'PawPrint', 'building', 50, 4, 45),
  ('studio_linked', 'Studio Connected', 'Connect the Roblox Studio plugin', 'Plug', 'plugin', 60, 5, 50),
  ('email_verified', 'Verified Builder', 'Confirm your signup email', 'BadgeCheck', 'account', 35, 3, 60),
  ('mod_helper', 'Community Helper', 'Help the community as a moderator', 'ShieldCheck', 'community', 100, 0, 70),
  ('credit_guardian', 'Credit Guardian', 'Use credits safely across BloxSmith tools', 'CreditCard', 'account', 60, 5, 80)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  xp_reward = EXCLUDED.xp_reward,
  credit_reward = EXCLUDED.credit_reward,
  sort_order = EXCLUDED.sort_order;
