export const LITECOIN_PAYMENT_ADDRESS = "ltc1qa8vvm6kxpp86r3jnw3t0jke2hsxw5kg4gmgqjm";

export const LITECOIN_FALLBACK_USD_RATE = 85;

export const LITECOIN_RATE_SOURCE = "CoinGecko";

export function formatLtcAmount(amountUsd: number, ltcUsdRate: number) {
  const usd = Math.max(0, Number(amountUsd) || 0);
  const rate = Math.max(0.01, Number(ltcUsdRate) || LITECOIN_FALLBACK_USD_RATE);
  return (usd / rate).toFixed(8);
}

export function cryptoPaymentMemo(opts: {
  email?: string | null;
  packId: string;
  credits: number;
  amountUsd: number;
}) {
  const email = opts.email || "account email";
  return `BloxSmith ${opts.packId} — ${opts.credits} credits — $${opts.amountUsd.toFixed(2)} USD — ${email}`;
}
