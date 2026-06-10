import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Wallet } from "lucide-react";
import { copyText } from "@/lib/copy";
import {
  cryptoPaymentMemo,
  formatLtcAmount,
  LITECOIN_FALLBACK_USD_RATE,
  LITECOIN_PAYMENT_ADDRESS,
  LITECOIN_RATE_SOURCE,
} from "@/lib/crypto-payments";

type CryptoPaymentPanelProps = {
  amountUsd: number;
  credits: number;
  packId: string;
  userEmail?: string | null;
};

export function CryptoPaymentPanel({
  amountUsd,
  credits,
  packId,
  userEmail,
}: CryptoPaymentPanelProps) {
  const [ltcUsdRate, setLtcUsdRate] = useState(LITECOIN_FALLBACK_USD_RATE);
  const [rateSource, setRateSource] = useState<"live" | "fallback">("fallback");
  const [loadingRate, setLoadingRate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingRate(true);
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("rate unavailable"))))
      .then((data) => {
        const rate = Number(data?.litecoin?.usd);
        if (!cancelled && Number.isFinite(rate) && rate > 0) {
          setLtcUsdRate(rate);
          setRateSource("live");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLtcUsdRate(LITECOIN_FALLBACK_USD_RATE);
          setRateSource("fallback");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRate(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ltcAmount = useMemo(() => formatLtcAmount(amountUsd, ltcUsdRate), [amountUsd, ltcUsdRate]);
  const memo = useMemo(
    () => cryptoPaymentMemo({ email: userEmail, packId, credits, amountUsd }),
    [amountUsd, credits, packId, userEmail],
  );

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <Wallet className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">Crypto payment accepted</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Send Litecoin only. Credits are added after the payment is verified, the same as manual
            PayPal verification.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <CopyBox
          label="Amount to send"
          value={`${ltcAmount} LTC`}
          onCopy={() => copyText(ltcAmount, "LTC amount copied")}
          highlight
        />
        <CopyBox
          label="USD total"
          value={`$${amountUsd.toFixed(2)} USD`}
          onCopy={() => copyText(amountUsd.toFixed(2), "USD amount copied")}
        />
      </div>

      <CopyBox
        label="Litecoin address"
        value={LITECOIN_PAYMENT_ADDRESS}
        onCopy={() => copyText(LITECOIN_PAYMENT_ADDRESS, "Litecoin address copied")}
        mono
      />
      <CopyBox label="Payment memo" value={memo} onCopy={() => copyText(memo, "Memo copied")} />

      <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {loadingRate ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading live LTC quote...
          </span>
        ) : rateSource === "live" ? (
          <>
            Estimated with live {LITECOIN_RATE_SOURCE} quote: 1 LTC ~= $
            {ltcUsdRate.toFixed(2)} USD. If the quote changes, use the latest amount shown before
            sending.
          </>
        ) : (
          <>
            Estimated with fallback quote: 1 LTC ~= ${LITECOIN_FALLBACK_USD_RATE.toFixed(2)} USD.
            Check your wallet quote before sending.
          </>
        )}
      </div>
    </div>
  );
}

function CopyBox({
  label,
  value,
  onCopy,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        highlight ? "border-primary/35 bg-primary/10" : "border-border/60 bg-background/45"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
          title={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className={`break-all text-sm font-semibold text-foreground ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
