import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LAUNCH_PROMO_CODE,
  LAUNCH_PROMO_END_LABEL,
  LAUNCH_PROMO_PERCENT,
} from "@/lib/launch-promo";

export const Route = createFileRoute("/checkout/custom")({
  component: CustomCheckout,
  head: () => ({
    meta: [
      { title: "Custom Credits — BloxSmith" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const PAYPAL_HANDLE = "kinloch930";
export const CUSTOM_RATE = 0.05; // $0.05 per credit
const MIN_CREDITS = 50;
const MAX_CREDITS = 20000;

type DiscountPreview = {
  valid: boolean;
  code?: string;
  promoType?: "purchase_discount" | "purchase_bonus";
  reason?: string;
  discountPercent?: number;
  discountAmount?: number;
  originalAmount?: number;
  finalAmount?: number;
  bonusPercent?: number;
  baseCredits?: number;
  bonusCredits?: number;
  totalCredits?: number;
  remainingUses?: number | null;
};

function CustomCheckout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [credits, setCredits] = useState<number>(200);
  const [txId, setTxId] = useState("");
  const [note, setNote] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discount, setDiscount] = useState<DiscountPreview | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  const safeCredits = Math.max(MIN_CREDITS, Math.min(MAX_CREDITS, Math.floor(credits || 0)));
  const price = useMemo(() => Math.round(safeCredits * CUSTOM_RATE * 100) / 100, [safeCredits]);
  const isDiscount = discount?.valid && discount.promoType === "purchase_discount";
  const isBonus = discount?.valid && discount.promoType === "purchase_bonus";
  const finalPrice = isDiscount ? Number(discount.finalAmount ?? price) : price;
  const totalCredits = isBonus ? Number(discount.totalCredits ?? safeCredits) : safeCredits;
  const bonusCredits = isBonus ? Math.max(0, Number(discount.bonusCredits ?? 0)) : 0;
  const paypalUrl = `https://www.paypal.com/paypalme/${PAYPAL_HANDLE}/${finalPrice.toFixed(2)}USD`;

  useEffect(() => {
    setDiscount(null);
  }, [safeCredits]);

  const applyDiscount = async () => {
    const code = discountCode.trim();
    if (!code) return toast.error("Enter a discount code first.");
    setCheckingDiscount(true);
    const { data, error } = await (supabase as any).rpc("validate_purchase_discount", {
      _code: code,
      _amount: price,
      _pack_id: `custom_${safeCredits}`,
      _credits: safeCredits,
    });
    setCheckingDiscount(false);
    if (error) {
      setDiscount(null);
      toast.error(error.message);
      return;
    }
    const preview = data as DiscountPreview;
    if (!preview?.valid) {
      setDiscount(null);
      toast.error(discountMessage(preview?.reason));
      return;
    }
    setDiscount(preview);
    setDiscountCode(preview.code ?? code.toUpperCase());
    toast.success(
      preview.promoType === "purchase_bonus"
        ? `${preview.bonusPercent}% bonus credits applied.`
        : `${preview.discountPercent}% discount applied.`,
    );
  };

  const submit = async () => {
    if (!user) return;
    if (txId.trim().length < 6) {
      toast.error("Enter a valid PayPal transaction ID");
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).rpc("submit_payment_request", {
      _pack_id: `custom_${safeCredits}`,
      _credits: safeCredits,
      _amount: price,
      _paypal_transaction_id: txId.trim(),
      _paypal_note: note.trim() || null,
      _discount_code: discount?.valid ? (discount.code ?? discountCode.trim()) : null,
    });
    setSubmitting(false);
    if (error) {
      const messages: Record<string, string> = {
        transaction_id_already_submitted: "That PayPal transaction ID has already been submitted.",
        invalid_transaction_id: "Enter the PayPal transaction ID from your receipt.",
        discount_code_not_found: "That discount code was not found.",
        discount_code_disabled: "That discount code is disabled.",
        discount_code_expired: "That discount code expired.",
        discount_code_used_up: "That discount code has no uses left.",
        discount_not_for_pack: "That discount code is not for custom checkout.",
        discount_minimum_not_met: "That discount code needs a higher purchase amount.",
        promo_code_not_found: "That promo code was not found.",
        promo_code_disabled: "That promo code is disabled.",
        promo_code_expired: "That promo code expired.",
        promo_code_used_up: "That promo code has no uses left.",
        promo_not_for_pack: "That promo code is not for custom checkout.",
        promo_minimum_not_met: "That promo code needs a higher purchase amount.",
      };
      toast.error(messages[error.message] ?? error.message);
      return;
    }
    setSubmitted(true);
    toast.success(
      "Transaction ID submitted. Credits are added as soon as the payment is verified.",
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-xl w-full px-4 py-12 space-y-6">
        <h1 className="text-3xl font-bold">Custom credit amount</h1>
        <p className="text-sm text-muted-foreground">
          Pick exactly how many credits you need. Rate:{" "}
          <span className="text-foreground font-semibold">${CUSTOM_RATE.toFixed(2)}</span> per
          credit.
        </p>

        <div className="glass rounded-2xl p-6 space-y-4">
          <label htmlFor="custom-credits-input" className="block text-sm font-medium">
            Credits ({MIN_CREDITS.toLocaleString()}–{MAX_CREDITS.toLocaleString()})
          </label>
          <input
            id="custom-credits-input"
            aria-label={`Number of credits to buy (between ${MIN_CREDITS} and ${MAX_CREDITS})`}
            type="number"
            inputMode="numeric"
            min={MIN_CREDITS}
            max={MAX_CREDITS}
            step={10}
            value={credits}
            onChange={(e) => {
              const raw = e.target.value;
              // Allow the field to be empty mid-edit without snapping to 0/NaN.
              setCredits(raw === "" ? 0 : Number(raw));
            }}
            onBlur={(e) => {
              // On blur, snap into the valid range so the value "saves" cleanly.
              const n = Number(e.target.value);
              setCredits(
                Number.isFinite(n)
                  ? Math.max(MIN_CREDITS, Math.min(MAX_CREDITS, Math.round(n / 10) * 10))
                  : MIN_CREDITS,
              );
            }}
            className="w-full rounded-lg bg-surface-elevated border border-border px-3 py-2 text-base"
          />
          <div className="space-y-1.5">
            <label htmlFor="custom-credits-slider" className="sr-only">
              Adjust credits with slider
            </label>
            <input
              id="custom-credits-slider"
              aria-label="Adjust credits with slider"
              aria-valuemin={MIN_CREDITS}
              aria-valuemax={MAX_CREDITS}
              aria-valuenow={safeCredits}
              type="range"
              min={MIN_CREDITS}
              max={MAX_CREDITS}
              step={10}
              value={safeCredits}
              onChange={(e) => setCredits(Number(e.target.value))}
              className="bs-range"
              style={
                {
                  // Fill percentage for the themed track (0–100).
                  ["--pct"]: String(
                    ((safeCredits - MIN_CREDITS) / (MAX_CREDITS - MIN_CREDITS)) * 100,
                  ),
                } as Record<string, string>
              }
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{MIN_CREDITS.toLocaleString()}</span>
              <span className="font-semibold text-foreground">
                {safeCredits.toLocaleString()} credits
              </span>
              <span>{MAX_CREDITS.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <div className="text-xs text-muted-foreground">You'll receive</div>
              <div className="text-2xl font-bold">{totalCredits.toLocaleString()} credits</div>
              {bonusCredits > 0 && (
                <div className="text-xs font-semibold text-success">
                  +{bonusCredits.toLocaleString()} launch bonus
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">You pay</div>
              <div className="text-2xl font-bold text-primary">${finalPrice.toFixed(2)}</div>
              {isDiscount && (
                <div className="text-xs text-emerald-300 line-through">${price.toFixed(2)}</div>
              )}
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-3">
          <div>
            <h2 className="font-semibold">Promo code</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Launch promo: use{" "}
              <span className="font-mono text-foreground">{LAUNCH_PROMO_CODE}</span> for{" "}
              {LAUNCH_PROMO_PERCENT}% more credits. Good until {LAUNCH_PROMO_END_LABEL}.
            </p>
          </div>
          {isDiscount && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Code {discount.code}: -${Number(discount.discountAmount ?? 0).toFixed(2)} (
              {discount.discountPercent}% off).
            </div>
          )}
          {isBonus && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Code {discount.code}: +{bonusCredits.toLocaleString()} bonus credits (
              {discount.bonusPercent}% more). You still pay ${price.toFixed(2)}.
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value.toUpperCase());
                setDiscount(null);
              }}
              placeholder={LAUNCH_PROMO_CODE}
              className="min-w-0 flex-1 rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm uppercase"
            />
            <button
              type="button"
              onClick={applyDiscount}
              disabled={checkingDiscount || !discountCode.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {checkingDiscount ? "Checking..." : "Apply"}
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Step 1 — Send payment</h2>
          <p className="text-sm text-muted-foreground">
            Pay <span className="font-semibold text-foreground">${finalPrice.toFixed(2)} USD</span>{" "}
            via PayPal. The link below pre-fills the amount.
          </p>
          <a
            href={paypalUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full text-center rounded-xl bg-[#ffc439] text-black font-semibold py-3 hover:opacity-90"
          >
            Pay ${finalPrice.toFixed(2)} on paypal.me/{PAYPAL_HANDLE}
          </a>
          <p className="text-xs text-muted-foreground">
            In the PayPal note, include:{" "}
            <code className="bg-surface-elevated px-1 rounded">
              {user?.email} — {safeCredits} credits
            </code>
          </p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Step 2 — Submit for verification</h2>
          {submitted ? (
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
              Your transaction ID was received. You'll see your credits update on the dashboard as
              soon as the payment is verified and approved.
              <div className="mt-3">
                <Link to="/dashboard" className="underline">
                  Back to dashboard
                </Link>
              </div>
            </div>
          ) : (
            <>
              <label htmlFor="custom-tx-id" className="sr-only">
                PayPal Transaction ID
              </label>
              <input
                id="custom-tx-id"
                aria-label="PayPal Transaction ID"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                placeholder="PayPal Transaction ID (e.g. 7AB12345CD678901E)"
                className="w-full rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm"
              />
              <label htmlFor="custom-note" className="sr-only">
                Optional note
              </label>
              <textarea
                id="custom-note"
                aria-label="Optional note about the payment"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (e.g. PayPal email used)"
                className="w-full rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm min-h-[80px]"
              />
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit for verification"}
              </button>
              <p className="text-xs text-muted-foreground">
                By submitting, you confirm the payment was made and agree to our{" "}
                <Link to="/terms" className="underline">
                  Terms
                </Link>
                . Fraudulent submissions result in account ban.
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function discountMessage(reason?: string) {
  const messages: Record<string, string> = {
    empty_code: "Enter a discount code first.",
    code_not_found: "That discount code was not found.",
    code_disabled: "That discount code is disabled.",
    code_expired: "That discount code expired.",
    code_used_up: "That discount code has no uses left.",
    minimum_not_met: "That discount code needs a higher purchase amount.",
    not_for_this_pack: "That discount code is not for custom checkout.",
    not_a_discount: "That code is not a purchase discount.",
    not_a_purchase_promo: "That code is not valid for checkout purchases.",
  };
  return messages[reason ?? ""] ?? "That discount code could not be applied.";
}
