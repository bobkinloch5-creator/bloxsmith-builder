-- Update claim_discord_credits to reward 10 credits instead of 5.
CREATE OR REPLACE FUNCTION public.claim_discord_credits()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new int; _amt int := 10; _already boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT discord_claimed INTO _already FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _already THEN RETURN jsonb_build_object('claimed', false, 'reason', 'already_claimed'); END IF;
  UPDATE public.profiles SET credits = credits + _amt, discord_claimed = true, updated_at = now() WHERE id = _uid RETURNING credits INTO _new;
  INSERT INTO public.credit_transactions(user_id, amount, balance, reason) VALUES (_uid, _amt, _new, 'discord_join');
  RETURN jsonb_build_object('claimed', true, 'credits', _new, 'amount', _amt);
END $$;
