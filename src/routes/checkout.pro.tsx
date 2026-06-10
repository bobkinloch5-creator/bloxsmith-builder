import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Header, Footer } from "@/components/layout";
import { CryptoPaymentPanel } from "@/components/CryptoPaymentPanel";
import { useAuth } from "@/lib/auth-context";
import {
  cancelMyProSubscriptionFn,
  getMySubscriptionFn,
  submitProSubscriptionRequestFn,
} from "@/lib/subscription.functions";
import {
  PRO_BENEFITS,
  PRO_MONTHLY_BONUS_CREDITS,
  PRO_PLAN_ID,
  PRO_PLAN_NAME,
  PRO_PLAN_PRICE_USD,
  proAccessLabel,
  type SubscriptionSummary,
} from "@/lib/subscriptions";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout/pro")({
  component: ProCheckout,
  head: () => ({
    meta: [{ title: "Subscribe to BloxSmith Pro" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

type SubscriptionRequest = {
  id: string;
  status: string;
  payment_reference: string;
  amount: number;
  created_at: string;
  reject_reason: string | null;
};

function ProCheckout() {
  const { user, loading, refresh } = useAuth();
  const nav = useNavigate();
  const loadSubscription = useServerFn(getMySubscriptionFn);
  const submitRequest = useServerFn(submitProSubscriptionRequestFn);
  const cancelSubscription = useServerFn(cancelMyProSubscriptionFn);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [txHash, setTxHash] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    try {
      const data = await loadSubscription();
      setSubscription(data.subscription as SubscriptionSummary);
      setRequests((data.requests ?? []) as SubscriptionRequest[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load subscription.");
    }
  };

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submit = async () => {
    if (txHash.trim().length < 6) {
      toast.error("Paste the Litecoin transaction hash before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await submitRequest({
        data: {
          paymentReference: txHash.trim(),
          paymentNote: note.trim() || null,
        },
      });
      toast.success("Pro payment submitted for verification.");
      setTxHash("");
      setNote("");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit Pro payment.";
      const map: Record<string, string> = {
        payment_reference_already_submitted: "That Litecoin transaction hash was already submitted.",
        invalid_payment_reference: "Enter a valid Litecoin transaction hash.",
        invalid_amount: "The Pro plan amount must be $25 USD.",
        invalid_plan: "That subscription plan is not available.",
      };
      toast.error(map[message] ?? message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel Pro renewal? Your access will stay active until the paid month ends.")) {
      return;
    }
    setCancelling(true);
    try {
      await cancelSubscription({});
      toast.success("Pro renewal canceled. Access stays active until the period ends.");
      await Promise.all([load(), refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel Pro.");
    } finally {
      setCancelling(false);
    }
  };

  const pending = requests.find((request) => request.status === "pending");
  const isPro = Boolean(subscription?.isPro);
  const cancelled = subscription?.cancelAtPeriodEnd || subscription?.status === "canceled";

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 space-y-6">
        <div>
          <Link to="/pricing" className="text-sm text-muted-foreground underline">
            Back to pricing
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Subscribe to {PRO_PLAN_NAME}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pay with Litecoin, submit your transaction hash, and Pro unlocks after owner
            verification.
          </p>
        </div>

        <section className="rounded-2xl border border-primary/35 bg-primary/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                {PRO_PLAN_NAME}
              </div>
              <div className="mt-2 text-4xl font-black">${PRO_PLAN_PRICE_USD}</div>
              <div className="text-sm text-muted-foreground">USD per month</div>
            </div>
            <div className="rounded-xl border border-primary/25 bg-background/40 px-3 py-2 text-sm">
              +{PRO_MONTHLY_BONUS_CREDITS.toLocaleString()} credits on approval
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {PRO_BENEFITS.map((benefit) => (
              <div key={benefit} className="rounded-xl border border-border/50 bg-background/35 p-3 text-sm">
                {benefit}
              </div>
            ))}
          </div>
        </section>

        {subscription?.planId && (
          <section className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Current subscription</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isPro ? proAccessLabel(subscription) : "No active Pro access."}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  isPro ? "bg-success/15 text-success" : "bg-surface-elevated text-muted-foreground"
                }`}
              >
                {subscription.status ?? "inactive"}
              </span>
            </div>
            {isPro && !cancelled && (
              <button
                type="button"
                onClick={cancel}
                disabled={cancelling}
                className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-elevated disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Cancel renewal"}
              </button>
            )}
          </section>
        )}

        <CryptoPaymentPanel
          amountUsd={PRO_PLAN_PRICE_USD}
          credits={PRO_MONTHLY_BONUS_CREDITS}
          packId={PRO_PLAN_ID}
          userEmail={user.email}
          description="Send Litecoin only for one month of BloxSmith Pro. Pro access and monthly bonus credits are added after owner verification."
        />

        <section className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Submit payment hash</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste the Litecoin transaction hash after sending the $25 USD equivalent. Do not send
              private wallet keys or seed phrases.
            </p>
          </div>

          {pending && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
              Your Pro payment is waiting for verification. Submitted{" "}
              {new Date(pending.created_at).toLocaleString()}.
            </div>
          )}

          <input
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            placeholder="Litecoin transaction hash"
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note: exact LTC sent, wallet label, or explorer link"
            className="min-h-[90px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !txHash.trim()}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Pro payment"}
          </button>
          <p className="text-xs text-muted-foreground">
            Cancel anytime after approval. Access remains until the current paid month ends.
          </p>
        </section>

        {requests.length > 0 && (
          <section className="glass rounded-2xl p-5">
            <h2 className="font-semibold">Recent Pro requests</h2>
            <div className="mt-3 space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-surface/30 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate">{request.payment_reference}</div>
                    <div className="text-[11px] text-muted-foreground">
                      ${Number(request.amount).toFixed(2)} ·{" "}
                      {new Date(request.created_at).toLocaleDateString()}
                    </div>
                    {request.reject_reason && (
                      <div className="text-[11px] text-destructive">{request.reject_reason}</div>
                    )}
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold capitalize">
                    {request.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
