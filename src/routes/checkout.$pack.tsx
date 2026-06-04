import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { CREDIT_PACKS } from "@/lib/credits";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LAUNCH_PROMO_CODE,
  LAUNCH_PROMO_END_LABEL,
  LAUNCH_PROMO_PERCENT,
} from "@/lib/launch-promo";

export const Route = createFileRoute("/checkout/$pack")({
  component: Checkout,
  head: () => ({
    meta: [{ title: "Checkout — BloxSmith" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

const PAYPAL_HANDLE = "kinloch930";

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

function Checkout() {
  const { pack } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const p = CREDIT_PACKS.find((x) => x.id === pack);
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

  if (!p)
    return (
      <div className="p-10 text-center">
        Unknown pack.{" "}
        <Link to="/pricing" className="underline">
          Back to pricing
        </Link>
      </div>
    );

  const isDiscount = discount?.valid && discount.promoType === "purchase_discount";
  const isBonus = discount?.valid && discount.promoType === "purchase_bonus";
  const finalPrice = isDiscount ? Number(discount.finalAmount ?? p.price) : p.price;
  const totalCredits = isBonus ? Number(discount.totalCredits ?? p.credits) : p.credits;
  const bonusCredits = isBonus ? Math.max(0, Number(discount.bonusCredits ?? 0)) : 0;
  const paypalUrl = `https://www.paypal.com/paypalme/${PAYPAL_HANDLE}/${finalPrice.toFixed(2)}USD`;

  const applyDiscount = async () => {
    const code = discountCode.trim();
    if (!code) {
      setDiscount(null);
      return toast.error("Enter a discount code first.");
    }
    setCheckingDiscount(true);
    const { data, error } = await (supabase as any).rpc("validate_purchase_discount", {
      _code: code,
      _amount: p.price,
      _pack_id: p.id,
      _credits: p.credits,
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
      _pack_id: p.id,
      _credits: p.credits,
      _amount: p.price,
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
        discount_not_for_pack: "That discount code is not for this pack.",
        discount_minimum_not_met: "That discount code needs a higher purchase amount.",
        promo_code_not_found: "That promo code was not found.",
        promo_code_disabled: "That promo code is disabled.",
        promo_code_expired: "That promo code expired.",
        promo_code_used_up: "That promo code has no uses left.",
        promo_not_for_pack: "That promo code is not for this pack.",
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
        <h1 className="text-3xl font-bold">Checkout</h1>

        <div className="glass rounded-2xl p-6 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium">{p.name}</span>
            <span className="font-semibold">${finalPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Credits</span>
            <span>
              {totalCredits.toLocaleString()}
              {bonusCredits > 0 && (
                <span className="ml-1 text-success">(+{bonusCredits.toLocaleString()})</span>
              )}
            </span>
          </div>
          {isDiscount && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Code {discount.code}: -${Number(discount.discountAmount ?? 0).toFixed(2)} (
              {discount.discountPercent}% off). Original ${p.price.toFixed(2)}.
            </div>
          )}
          {isBonus && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Code {discount.code}: +{bonusCredits.toLocaleString()} bonus credits (
              {discount.bonusPercent}% more). You still pay ${p.price.toFixed(2)}.
            </div>
          )}
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
          <div>
            <h2 className="font-semibold">Step 1 — Send payment</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pay{" "}
              <span className="font-semibold text-foreground">${finalPrice.toFixed(2)} USD</span>{" "}
              via PayPal to:
            </p>
            <a
              href={paypalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block w-full text-center rounded-xl bg-[#ffc439] text-black font-semibold py-3 hover:opacity-90"
            >
              Pay ${finalPrice.toFixed(2)} on paypal.me/{PAYPAL_HANDLE}
            </a>
            <p className="text-xs text-muted-foreground mt-2">
              In the PayPal note, include:{" "}
              <code className="bg-surface-elevated px-1 rounded">
                {user?.email} — {p.id}
              </code>
            </p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Step 2 — Submit for verification</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Paste your PayPal Transaction ID from the receipt email. BloxSmith locks the ID to
              your account and credits are added as soon as the payment is verified.
            </p>
          </div>
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
              <label htmlFor="pack-tx-id" className="sr-only">
                PayPal Transaction ID
              </label>
              <input
                id="pack-tx-id"
                aria-label="PayPal Transaction ID"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                placeholder="PayPal Transaction ID (e.g. 7AB12345CD678901E)"
                className="w-full rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm"
              />
              <label htmlFor="pack-note" className="sr-only">
                Optional note
              </label>
              <textarea
                id="pack-note"
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
    not_for_this_pack: "That discount code is not for this pack.",
    not_a_discount: "That code is not a purchase discount.",
    not_a_purchase_promo: "That code is not valid for checkout purchases.",
  };
  return messages[reason ?? ""] ?? "That discount code could not be applied.";
}
