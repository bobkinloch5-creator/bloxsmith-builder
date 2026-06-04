-- Premium credit-costing templates plus richer AI usage tracking.

ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai';
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS credits_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_source ON public.ai_usage_events(user_id, source, created_at DESC);

INSERT INTO public.templates (
  slug,
  name,
  category,
  description,
  thumbnail_url,
  credits_cost,
  difficulty,
  features,
  build_spec,
  active
) VALUES
(
  'premium-anime-rpg-hub',
  'Premium Anime RPG Hub',
  'RPG',
  'A polished anime lobby with quest boards, aura shop, teleport gates, daily rewards, UI shell, and starter combat wiring.',
  null,
  18,
  'advanced',
  '["Cinematic lobby spawn","Quest board and reward loop","Aura shop with premium UI","Teleport gates","Daily reward claim flow","Server-side currency validation"]'::jsonb,
  '{"prompt":"Build a premium anime RPG hub: lobby spawn, quest board, aura shop, teleport gates, daily rewards, server validated currency, and polished neon anime UI."}'::jsonb,
  true
),
(
  'premium-pet-simulator-hatchery',
  'Luxury Pet Simulator Hatchery',
  'Simulator',
  'A full pet game starter with egg hatching, inventory, rarity tiers, coin loops, boost shop, and animated reward UI.',
  null,
  22,
  'advanced',
  '["Egg hatching system","Pet inventory and equip slots","Rarity tiers","Coin collection loop","Boost shop","Server DataStore save plan"]'::jsonb,
  '{"prompt":"Build a premium pet simulator hatchery with egg machines, rarity rolls, pet inventory, equip slots, coin collection, boost shop, save data, and polished UI."}'::jsonb,
  true
),
(
  'premium-tycoon-mega-mall',
  'Mega Mall Tycoon Pro',
  'Tycoon',
  'A high-end tycoon starter with plot claiming, purchase pads, droppers, conveyors, rebirths, shop UI, and anti-exploit server checks.',
  null,
  20,
  'advanced',
  '["Plot claiming","Purchase pad chain","Dropper and conveyor loop","Collector and leaderstats","Rebirth upgrades","Server-only templates"]'::jsonb,
  '{"prompt":"Build a premium mall tycoon core: plot claiming, purchase buttons, droppers, conveyors, collector, rebirth upgrades, shop UI, and server-side validation."}'::jsonb,
  true
),
(
  'premium-battle-pass-season',
  'Season Battle Pass Kit',
  'Monetization',
  'A fancy season pass system with free/premium tracks, XP quests, claim buttons, rewards, and developer product hooks.',
  null,
  16,
  'intermediate',
  '["Free and premium reward tracks","Season XP quests","Claim validation","Developer product hooks","Premium UI panels","Reward notification flow"]'::jsonb,
  '{"prompt":"Build a Roblox season battle pass with free and premium tracks, XP quests, server-validated claims, developer product hooks, and polished premium UI."}'::jsonb,
  true
),
(
  'premium-trading-plaza',
  'Trading Plaza Deluxe',
  'Social',
  'A deluxe trading hub with trade requests, item offer grids, accept countdowns, scam-safe validation, and profile cards.',
  null,
  17,
  'advanced',
  '["Trade request flow","Two-player offer window","Accept countdown","Server item validation","Profile cards","Chat-friendly plaza layout"]'::jsonb,
  '{"prompt":"Build a premium Roblox trading plaza: trade requests, item offer grids, accept countdown, server validation, profile cards, and a social hub layout."}'::jsonb,
  true
),
(
  'premium-admin-moderation-suite',
  'Admin Moderation Suite',
  'Admin',
  'A professional moderator dashboard with reports, kick/ban/mute actions, audit logs, role checks, and safe command UI.',
  null,
  14,
  'intermediate',
  '["Report queue","Kick ban mute actions","Audit log module","Role checks","Command palette UI","Server-only permission validation"]'::jsonb,
  '{"prompt":"Build a Roblox admin moderation suite with report queue, kick/ban/mute actions, audit logs, role checks, command palette UI, and secure server validation."}'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  thumbnail_url = EXCLUDED.thumbnail_url,
  credits_cost = EXCLUDED.credits_cost,
  difficulty = EXCLUDED.difficulty,
  features = EXCLUDED.features,
  build_spec = EXCLUDED.build_spec,
  active = EXCLUDED.active,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.spend_credits_atomic(_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 10000 THEN RAISE EXCEPTION 'invalid_credit_amount'; END IF;

  IF public.has_role(_uid, 'owner') THEN
    RETURN 999999;
  END IF;

  UPDATE public.profiles
    SET credits = credits - _amount, updated_at = now()
    WHERE id = _uid AND credits >= _amount
    RETURNING credits INTO _new;

  IF _new IS NULL THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
  VALUES (_uid, -_amount, _new, 'ai_spend');

  INSERT INTO public.ai_usage_events(user_id, source, credits_used, metadata)
  VALUES (_uid, 'credit_spend', _amount, jsonb_build_object('reason', 'ai_spend'))
  ON CONFLICT DO NOTHING;

  RETURN _new;
END
$$;
