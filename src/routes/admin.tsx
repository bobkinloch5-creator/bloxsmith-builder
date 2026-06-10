import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  requireAdmin,
  adminAdjustCreditsFn,
  adminCreatePromoFn,
  adminDeletePromoFn,
  adminResetAiUsageFn,
  adminReviewPaymentFn,
  adminReviewPromotionFn,
  adminSetBanFn,
  adminSetCreditBalanceFn,
  adminSetRoleFn,
  adminUpdatePromoFn,
  loadAdminDashboardFn,
} from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Loader2, PlayCircle, RefreshCw } from "lucide-react";
import { testAllSiteModels, type ModelTestResult } from "@/lib/model-test.functions";
import { RobloxDocsPanel } from "@/components/RobloxDocsPanel";
import { resendConfirmationForUser } from "@/lib/moderator.functions";
import { copyText } from "@/lib/copy";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    try {
      await requireAdmin();
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Admin,
  head: () => ({
    meta: [{ title: "Admin — BloxSmith" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

type Row = {
  id: string;
  email: string;
  display_name: string | null;
  credits: number;
  banned: boolean;
  ban_reason: string | null;
  roles: string[];
  projects: number;
  generations: number;
};
type PR = {
  id: string;
  user_id: string;
  pack_id: string;
  credits: number;
  amount: number;
  original_amount: number | null;
  discounted_amount: number | null;
  discount_code: string | null;
  discount_percent: number | null;
  promo_type: string | null;
  bonus_percent: number | null;
  bonus_credits: number | null;
  paypal_transaction_id: string;
  paypal_note: string | null;
  status: string;
  created_at: string;
};
type Promo = {
  id: string;
  code: string;
  promo_type: string;
  credits: number;
  discount_percent: number | null;
  minimum_amount: number;
  applies_to: string;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};
type PromoSub = {
  id: string;
  user_id: string;
  platform: string;
  url: string;
  note: string | null;
  status: string;
  created_at: string;
};
type Activity = {
  id: string;
  user_id: string;
  amount: number;
  tx_type: string | null;
  description: string | null;
  created_at: string;
};
type ModeratorAction = {
  id: string;
  actor_id: string;
  target_user_id: string | null;
  action: string;
  amount: number | null;
  created_at: string;
};

function Admin() {
  const { user, isAdmin, isOwner, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<{
    users: number;
    projects: number;
    generations: number;
    banned: number;
    pendingPayments: number;
    pendingPromotions: number;
  } | null>(null);
  const [requests, setRequests] = useState<PR[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [promos, setPromos] = useState<Promo[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newPromoType, setNewPromoType] = useState<
    "credits" | "purchase_discount" | "purchase_bonus"
  >("credits");
  const [newCredits, setNewCredits] = useState(50);
  const [newDiscountPercent, setNewDiscountPercent] = useState(20);
  const [newMinimumAmount, setNewMinimumAmount] = useState(0);
  const [newAppliesTo, setNewAppliesTo] = useState("all");
  const [newMax, setNewMax] = useState<string>("");
  const [newExpires, setNewExpires] = useState<string>("");
  const [promoSubs, setPromoSubs] = useState<PromoSub[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [showBanned, setShowBanned] = useState(false);
  const [moderatorActions, setModeratorActions] = useState<ModeratorAction[]>([]);
  const [emailConfirmed, setEmailConfirmed] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const resendConfirm = useServerFn(resendConfirmationForUser);
  const adjustCreditsServer = useServerFn(adminAdjustCreditsFn);
  const loadAdminDashboard = useServerFn(loadAdminDashboardFn);
  const setBanServer = useServerFn(adminSetBanFn);
  const setRoleServer = useServerFn(adminSetRoleFn);
  const setCreditBalanceServer = useServerFn(adminSetCreditBalanceFn);
  const resetAiUsageServer = useServerFn(adminResetAiUsageFn);
  const createPromoServer = useServerFn(adminCreatePromoFn);
  const updatePromoServer = useServerFn(adminUpdatePromoFn);
  const deletePromoServer = useServerFn(adminDeletePromoFn);
  const reviewPaymentServer = useServerFn(adminReviewPaymentFn);
  const reviewPromotionServer = useServerFn(adminReviewPromotionFn);

  const loadUsers = async () => {
    try {
      setRefreshing(true);
      setLoadError(null);
      const data = await loadAdminDashboard();
      const users = (data.users ?? []) as Array<
        Row & { email_confirmed: boolean; created_at: string }
      >;
      setRows(users);
      setStats(data.stats);
      setRequests((data.paymentRequests ?? []) as PR[]);
      setPromos((data.promos ?? []) as Promo[]);
      setPromoSubs((data.promotionSubmissions ?? []) as PromoSub[]);
      setActivity((data.creditActivity ?? []) as Activity[]);
      setModeratorActions((data.moderatorActions ?? []) as ModeratorAction[]);
      const confirmedMap: Record<string, boolean> = {};
      const emailMap: Record<string, string> = {};
      users.forEach((adminUser) => {
        confirmedMap[adminUser.id] = adminUser.email_confirmed;
        if (adminUser.email) emailMap[adminUser.id] = adminUser.email;
      });
      setEmailConfirmed(confirmedMap);
      setEmails(emailMap);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load the admin dashboard.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  };

  const loadActivity = async () => {
    await loadUsers();
  };

  const toggleBan = async (r: Row) => {
    const reason = r.banned
      ? ""
      : window.prompt(`Ban ${r.email || r.display_name}? Enter reason:`, "Violated terms");
    if (!r.banned && !reason) return;
    if (r.banned && !confirm(`Unban ${r.email || r.display_name}?`)) return;
    try {
      setBusyUserId(r.id);
      await setBanServer({ data: { userId: r.id, banned: !r.banned, reason: reason || "" } });
      toast.success(r.banned ? "User unbanned" : "User banned");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update ban.");
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleAdmin = async (r: Row) => {
    if (!isOwner) {
      toast.error("Only the owner can manage admin roles.");
      return;
    }
    const isAdminRow = r.roles.includes("admin");
    if (!confirm(`${isAdminRow ? "Remove admin from" : "Make admin"} ${r.email}?`)) return;
    try {
      setBusyUserId(r.id);
      await setRoleServer({ data: { userId: r.id, role: "admin", grant: !isAdminRow } });
      toast.success(isAdminRow ? "Admin removed" : "Admin granted");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update role.");
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleModerator = async (r: Row) => {
    if (!isOwner) {
      toast.error("Only the owner can manage moderator roles.");
      return;
    }
    const isModeratorRow = r.roles.includes("moderator");
    if (!confirm(`${isModeratorRow ? "Remove moderator from" : "Make moderator"} ${r.email}?`))
      return;
    try {
      setBusyUserId(r.id);
      await setRoleServer({
        data: { userId: r.id, role: "moderator", grant: !isModeratorRow },
      });
      toast.success(isModeratorRow ? "Moderator removed" : "Moderator granted");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update role.");
    } finally {
      setBusyUserId(null);
    }
  };

  const resetCredits = async (r: Row) => {
    if (!isOwner) {
      toast.error("Only the owner can reset credits.");
      return;
    }
    if (r.credits === 0) return toast.message("This user already has 0 credits.");
    if (!confirm(`Reset credits to 0 for ${r.email}? (current: ${r.credits})`)) return;
    await setExactCredits(r, 0, "admin reset to 0");
  };

  const loadPromoSubs = async () => {
    await loadUsers();
  };

  const reviewPromo = async (s: PromoSub, approve: boolean) => {
    if (approve) {
      const raw = window.prompt(
        `Credits to award for ${s.platform} (max 500)?`,
        s.platform === "youtube" ? "100" : "30",
      );
      if (!raw) return;
      const amt = parseInt(raw, 10);
      if (!Number.isFinite(amt) || amt <= 0 || amt > 500) {
        return toast.error("Credits must be between 1 and 500.");
      }
      try {
        await reviewPromotionServer({
          data: {
            submissionId: s.id,
            approve: true,
            credits: amt,
            reason: "Approved by owner",
          },
        });
        toast.success(`Awarded ${amt} credits`);
      } catch (error) {
        return toast.error(error instanceof Error ? error.message : "Approval failed.");
      }
    } else {
      const reason = window.prompt("Reason?", "Does not meet promo guidelines");
      if (!reason) return;
      try {
        await reviewPromotionServer({
          data: { submissionId: s.id, approve: false, credits: null, reason },
        });
        toast.success("Rejected");
      } catch (error) {
        return toast.error(error instanceof Error ? error.message : "Rejection failed.");
      }
    }
    loadPromoSubs();
  };

  const loadPromos = async () => {
    await loadUsers();
  };

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isAdmin) nav({ to: "/dashboard" });
  }, [user, isAdmin, loading, nav]);

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const createPromo = async () => {
    const code = newCode.trim().toUpperCase();
    if (!code) return toast.error("Code required");
    if (newPromoType === "credits" && (!Number.isFinite(newCredits) || newCredits <= 0)) {
      return toast.error("Credits must be > 0");
    }
    if (
      (newPromoType === "purchase_discount" || newPromoType === "purchase_bonus") &&
      (!Number.isFinite(newDiscountPercent) || newDiscountPercent <= 0 || newDiscountPercent > 95)
    ) {
      return toast.error("Percent must be between 1% and 95%.");
    }
    const parsedMax = newMax ? Number.parseInt(newMax, 10) : null;
    if (parsedMax != null && (!Number.isFinite(parsedMax) || parsedMax <= 0)) {
      return toast.error("Max uses must be a positive whole number.");
    }
    const payload: {
      code: string;
      promo_type: "credits" | "purchase_discount" | "purchase_bonus";
      credits: number;
      discount_percent: number | null;
      minimum_amount: number;
      applies_to: string;
      max_redemptions: number | null;
      expires_at: string | null;
      created_by: string | undefined;
    } = {
      code,
      promo_type: newPromoType,
      credits: newPromoType === "credits" ? newCredits : 1,
      discount_percent:
        newPromoType === "purchase_discount" || newPromoType === "purchase_bonus"
          ? newDiscountPercent
          : null,
      minimum_amount: Math.max(0, Number(newMinimumAmount) || 0),
      applies_to: newAppliesTo.trim() || "all",
      max_redemptions: parsedMax,
      expires_at: newExpires ? new Date(newExpires).toISOString() : null,
      created_by: user?.id,
    };
    try {
      await createPromoServer({
        data: {
          code: payload.code,
          promoType: payload.promo_type,
          credits: payload.credits,
          discountPercent: payload.discount_percent,
          minimumAmount: payload.minimum_amount,
          appliesTo: payload.applies_to,
          maxRedemptions: payload.max_redemptions,
          expiresAt: payload.expires_at,
        },
      });
      toast.success(`Promo ${code} created`);
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Could not create promo.");
    }
    setNewCode("");
    setNewPromoType("credits");
    setNewCredits(50);
    setNewDiscountPercent(20);
    setNewMinimumAmount(0);
    setNewAppliesTo("all");
    setNewMax("");
    setNewExpires("");
    loadPromos();
  };

  const togglePromo = async (p: Promo) => {
    try {
      await updatePromoServer({ data: { promoId: p.id, active: !p.active } });
      await loadPromos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update promo.");
    }
  };

  const deletePromo = async (p: Promo) => {
    if (!confirm(`Delete promo ${p.code}?`)) return;
    try {
      await deletePromoServer({ data: { promoId: p.id } });
      await loadPromos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete promo.");
    }
  };

  const reviewPayment = async (pr: PR, approve: boolean) => {
    if (!user) return;
    const reason = approve
      ? "Approved by owner"
      : window.prompt("Reason for rejecting this payment?", "Payment could not be verified");
    if (!approve && !reason) return;
    try {
      await reviewPaymentServer({
        data: { requestId: pr.id, approve, reason: reason || "" },
      });
      toast.success(approve ? `Approved — +${pr.credits} credits` : "Rejected");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review payment.");
    }
  };

  const adjustCredits = async (id: string, delta: number, reason = "admin adjust") => {
    if (!isOwner) {
      toast.error("Only the owner can adjust credits.");
      return;
    }
    // Routes through the service-role server function so it works regardless of
    // the admin_adjust_credits SQL RPC (which 409s on the drifted ledger schema).
    try {
      setBusyUserId(id);
      const res = (await adjustCreditsServer({
        data: { userId: id, amount: delta, reason },
      })) as { ok: true; credits: number } | { ok: false; error: string };
      if (!res.ok) return toast.error(res.error);
      setRows((p) => p.map((x) => (x.id === id ? { ...x, credits: res.credits } : x)));
      toast.success(`${delta >= 0 ? "Gifted" : "Removed"} ${Math.abs(delta)} credits`);
      await loadUsers();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not adjust credits.");
    } finally {
      setBusyUserId(null);
    }
  };

  const giftCustom = async (row: Row) => {
    if (!isOwner) {
      toast.error("Only the owner can gift credits.");
      return;
    }
    const amtStr = window.prompt(
      `Gift credits to ${row.email}\nPositive to add, negative to remove. Current: ${row.credits}`,
      "100",
    );
    if (!amtStr) return;
    const amt = parseInt(amtStr, 10);
    if (!Number.isFinite(amt) || amt === 0) return toast.error("Enter a non-zero integer");
    const reason =
      window.prompt("Reason (logged in credit history)", "gift from admin") || "gift from admin";
    await adjustCredits(row.id, amt, reason);
  };

  const setExactCredits = async (row: Row, preset?: number, presetReason?: string) => {
    if (!isOwner) {
      toast.error("Only the owner can set credit balances.");
      return;
    }
    const raw =
      preset == null
        ? window.prompt(
            `Set the exact credit balance for ${row.email || row.display_name}\nCurrent: ${row.credits}`,
            String(row.credits),
          )
        : String(preset);
    if (raw == null) return;
    const balance = Number.parseInt(raw, 10);
    if (!Number.isFinite(balance) || balance < 0) {
      return toast.error("Enter a whole-number balance of 0 or more.");
    }
    const reason =
      presetReason ||
      window.prompt("Reason for the audit log", "manual balance correction") ||
      "manual balance correction";
    try {
      setBusyUserId(row.id);
      const result = await setCreditBalanceServer({
        data: { userId: row.id, balance, reason },
      });
      setRows((current) =>
        current.map((item) => (item.id === row.id ? { ...item, credits: result.credits } : item)),
      );
      toast.success(`Credit balance set to ${result.credits}.`);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set credit balance.");
    } finally {
      setBusyUserId(null);
    }
  };

  const resetAiUsage = async (row: Row) => {
    if (!confirm(`Reset AI usage timers for ${row.email || row.display_name}?`)) return;
    const reason =
      window.prompt("Reason for the audit log", "support reset of AI usage limit") ||
      "support reset of AI usage limit";
    try {
      setBusyUserId(row.id);
      const result = await resetAiUsageServer({ data: { userId: row.id, reason } });
      toast.success(`AI usage reset (${result.deleted} event${result.deleted === 1 ? "" : "s"}).`);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset AI usage.");
    } finally {
      setBusyUserId(null);
    }
  };

  const resendSignupEmail = async (row: Row) => {
    const email = (row.email || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("No valid email on file for this user — can't resend a confirmation.");
      return;
    }
    try {
      const res = await resendConfirm({ data: { userId: row.id, email } });
      toast.success(res.sent ? "Confirmation email resent." : "Email already confirmed.");
      if (!res.sent) setEmailConfirmed((prev) => ({ ...prev, [row.id]: true }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend email.");
    }
  };

  const filtered = rows.filter((r) => {
    if (!showBanned && r.banned) return false;
    const term = q.toLowerCase();
    return (
      r.email.toLowerCase().includes(term) || (r.display_name ?? "").toLowerCase().includes(term)
    );
  });
  const bannedCount = rows.filter((r) => r.banned).length;

  if (loading || !isAdmin) return null;
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Secure account operations, payments, promotions, AI diagnostics, and audit history.
            </p>
          </div>
          <button
            onClick={loadUsers}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh dashboard"}
          </button>
        </div>

        {loadError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="font-semibold">Dashboard load failed</div>
            <div className="mt-1">{loadError}</div>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Users", stats.users],
              ["Projects", stats.projects],
              ["Generations", stats.generations],
              ["Banned", stats.banned],
              ["Payments", stats.pendingPayments],
              ["Promotions", stats.pendingPromotions],
            ].map(([l, v]) => (
              <div key={l as string} className="glass rounded-2xl p-5">
                <div className="text-xs uppercase text-muted-foreground">{l}</div>
                <div className="mt-2 text-3xl font-bold">{v}</div>
              </div>
            ))}
          </div>
        )}

        {refreshing && !stats && (
          <div className="glass grid place-items-center rounded-2xl py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading secure admin data...</p>
          </div>
        )}

        <ModelDiagnosticsSection />

        <RobloxDocsPanel />

        {isOwner && (
          <section className="glass rounded-2xl p-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Pending payment verifications ({requests.length})</h2>
              <a
                href="https://www.paypal.com/myaccount/activity"
                target="_blank"
                rel="noreferrer"
                className="text-xs underline text-muted-foreground"
              >
                Open PayPal activity
              </a>
            </div>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending payments.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border p-4 flex flex-wrap gap-3 justify-between items-center"
                  >
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">User:</span>{" "}
                        <span className="font-medium">{emails[r.user_id] ?? r.user_id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pack:</span> {r.pack_id} —{" "}
                        <span className="font-semibold">${r.amount}</span> for{" "}
                        <span className="font-semibold">{r.credits} credits</span>
                      </div>
                      {r.discount_code && (
                        <div className="text-xs text-emerald-300">
                          {r.promo_type === "purchase_bonus" ? (
                            <>
                              Bonus {r.discount_code}: +{Number(r.bonus_credits ?? 0)} credits (
                              {r.bonus_percent}%)
                            </>
                          ) : (
                            <>
                              Discount {r.discount_code} ({r.discount_percent}%):{" "}
                              <span className="line-through text-muted-foreground">
                                ${Number(r.original_amount ?? r.amount).toFixed(2)}
                              </span>{" "}
                              {"->"} ${Number(r.discounted_amount ?? r.amount).toFixed(2)}
                            </>
                          )}
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">PayPal Tx:</span>{" "}
                        <code className="bg-surface-elevated px-1 rounded">
                          {r.paypal_transaction_id}
                        </code>
                      </div>
                      {r.paypal_note && (
                        <div className="text-xs text-muted-foreground">Note: {r.paypal_note}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewPayment(r, true)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                      >
                        Approve & credit
                      </button>
                      <button
                        onClick={() => reviewPayment(r, false)}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isOwner && (
          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-3">
              Pending promotion submissions ({promoSubs.length})
            </h2>
            {promoSubs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending promotion submissions.</p>
            ) : (
              <div className="space-y-3">
                {promoSubs.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-border p-4 flex flex-wrap gap-3 justify-between items-center"
                  >
                    <div className="text-sm space-y-1 min-w-0">
                      <div>
                        <span className="text-muted-foreground">User:</span>{" "}
                        <span className="font-medium">{emails[s.user_id] ?? s.user_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase rounded bg-surface-elevated px-1.5 py-0.5">
                          {s.platform}
                        </span>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-primary truncate max-w-[480px]"
                        >
                          {s.url}
                        </a>
                      </div>
                      {s.note && (
                        <div className="text-xs text-muted-foreground">Note: {s.note}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewPromo(s, true)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                      >
                        Approve & credit
                      </button>
                      <button
                        onClick={() => reviewPromo(s, false)}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="glass rounded-2xl p-6">
          <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold">Users ({rows.length})</h2>
              {bannedCount > 0 && (
                <span className="text-xs rounded-full bg-destructive/15 text-destructive px-2 py-0.5">
                  {bannedCount} banned
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs flex items-center gap-1 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showBanned}
                  onChange={(e) => setShowBanned(e.target.checked)}
                />{" "}
                Show banned
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search email or name..."
                className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">User</th>
                  <th>Role</th>
                  <th>Credits</th>
                  <th>Projects</th>
                  <th>Gens</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="border-t border-border py-10 text-center text-sm text-muted-foreground"
                    >
                      No users match the current filters.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const isOwnerRow = r.roles.includes("owner");
                  const isAdminRow = r.roles.includes("admin");
                  const isModeratorRow = r.roles.includes("moderator");
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-border ${r.banned ? "opacity-60" : ""}`}
                    >
                      <td className="py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div>
                            <div className="font-medium">{r.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.display_name ?? "—"}
                            </div>
                            <button
                              type="button"
                              onClick={() => void copyText(r.id, "User ID copied")}
                              className="text-[10px] text-muted-foreground underline"
                            >
                              Copy ID
                            </button>
                          </div>
                          {r.banned && (
                            <span
                              className="text-[10px] uppercase rounded bg-destructive/20 text-destructive px-1.5 py-0.5"
                              title={r.ban_reason ?? ""}
                            >
                              Banned
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {isOwnerRow ? (
                          <span className="text-[10px] uppercase rounded bg-primary/20 text-primary px-1.5 py-0.5">
                            Owner
                          </span>
                        ) : isAdminRow ? (
                          <span className="text-[10px] uppercase rounded bg-primary/15 text-primary px-1.5 py-0.5">
                            Admin
                          </span>
                        ) : isModeratorRow ? (
                          <span className="text-[10px] uppercase rounded bg-sky-500/15 text-sky-300 px-1.5 py-0.5">
                            Mod
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">user</span>
                        )}
                      </td>
                      <td>{r.credits}</td>
                      <td className="text-muted-foreground">{r.projects}</td>
                      <td className="text-muted-foreground">{r.generations}</td>
                      <td className="text-right whitespace-nowrap">
                        {emailConfirmed[r.id] === false && (
                          <button
                            onClick={() => resendSignupEmail(r)}
                            disabled={busyUserId === r.id}
                            className="text-xs rounded-md border border-amber-400/40 bg-amber-400/10 text-amber-200 px-2 py-1 mr-1"
                          >
                            Resend email
                          </button>
                        )}
                        {isOwner && (
                          <>
                            <button
                              onClick={() => giftCustom(r)}
                              disabled={busyUserId === r.id || isOwnerRow}
                              className="text-xs rounded-md bg-primary px-2 py-1 mr-1 font-semibold text-primary-foreground"
                            >
                              Gift
                            </button>
                            <button
                              onClick={() => adjustCredits(r.id, 100, "quick +100")}
                              disabled={busyUserId === r.id || isOwnerRow}
                              className="text-xs rounded-md bg-primary/20 px-2 py-1 mr-1"
                            >
                              +100
                            </button>
                            <button
                              onClick={() => adjustCredits(r.id, -100, "quick -100")}
                              disabled={busyUserId === r.id || isOwnerRow}
                              className="text-xs rounded-md border border-border px-2 py-1 mr-1"
                            >
                              -100
                            </button>
                            <button
                              onClick={() => resetCredits(r)}
                              className="text-xs rounded-md border border-border px-2 py-1 mr-1"
                              disabled={busyUserId === r.id || isOwnerRow}
                            >
                              Reset
                            </button>
                            <button
                              onClick={() => setExactCredits(r)}
                              disabled={busyUserId === r.id || isOwnerRow}
                              className="text-xs rounded-md border border-border px-2 py-1 mr-1"
                            >
                              Set balance
                            </button>
                          </>
                        )}
                        {!isOwnerRow && (
                          <button
                            onClick={() => resetAiUsage(r)}
                            disabled={busyUserId === r.id}
                            className="text-xs rounded-md border border-violet-400/40 bg-violet-500/10 text-violet-200 px-2 py-1 mr-1"
                          >
                            Reset AI limit
                          </button>
                        )}
                        {isOwner && !isOwnerRow && (
                          <button
                            onClick={() => toggleAdmin(r)}
                            disabled={busyUserId === r.id}
                            className="text-xs rounded-md border border-border px-2 py-1 mr-1"
                          >
                            {isAdminRow ? "Demote" : "Make admin"}
                          </button>
                        )}
                        {isOwner && !isOwnerRow && !isAdminRow && (
                          <button
                            onClick={() => toggleModerator(r)}
                            disabled={busyUserId === r.id}
                            className="text-xs rounded-md border border-sky-400/40 bg-sky-500/10 text-sky-200 px-2 py-1 mr-1"
                          >
                            {isModeratorRow ? "Remove mod" : "Make mod"}
                          </button>
                        )}
                        {!isOwnerRow && (
                          <button
                            onClick={() => toggleBan(r)}
                            disabled={busyUserId === r.id}
                            className={`text-xs rounded-md px-2 py-1 ${r.banned ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
                          >
                            {r.banned ? "Unban" : "Ban"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Recent credit activity</h2>
            <button onClick={loadActivity} className="text-xs underline text-muted-foreground">
              Refresh
            </button>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">When</th>
                    <th>User</th>
                    <th>Δ</th>
                    <th>Type</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="text-xs">{emails[a.user_id] ?? a.user_id.slice(0, 8)}</td>
                      <td className={a.amount >= 0 ? "text-success" : "text-destructive"}>
                        {a.amount >= 0 ? `+${a.amount}` : a.amount}
                      </td>
                      <td>{a.tx_type ?? "—"}</td>
                      <td className="text-xs text-muted-foreground">{a.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isOwner && (
          <section className="glass rounded-2xl p-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Moderator action log</h2>
              <button onClick={loadUsers} className="text-xs underline text-muted-foreground">
                Refresh
              </button>
            </div>
            {moderatorActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No moderator actions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">When</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Target</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moderatorActions.slice(0, 25).map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString()}
                        </td>
                        <td className="font-medium">{a.action}</td>
                        <td className="text-xs">{emails[a.actor_id] ?? a.actor_id.slice(0, 8)}</td>
                        <td className="text-xs">
                          {a.target_user_id
                            ? (emails[a.target_user_id] ?? a.target_user_id.slice(0, 8))
                            : "—"}
                        </td>
                        <td>{a.amount ? (a.amount > 0 ? `+${a.amount}` : a.amount) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {isOwner && (
          <section className="glass rounded-2xl p-6">
            <div className="mb-3">
              <h2 className="font-semibold">Promo and discount codes</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Credit promos grant free credits. Purchase discounts reduce PayPal totals. Purchase
                bonuses keep the same price and add extra credits on approval.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 mb-4 sm:grid-cols-6">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="CODE"
                className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm uppercase"
              />
              <select
                value={newPromoType}
                onChange={(e) =>
                  setNewPromoType(
                    e.target.value as "credits" | "purchase_discount" | "purchase_bonus",
                  )
                }
                className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm"
              >
                <option value="credits">Free credits</option>
                <option value="purchase_discount">Purchase discount</option>
                <option value="purchase_bonus">Purchase bonus credits</option>
              </select>
              {newPromoType === "credits" ? (
                <input
                  type="number"
                  value={newCredits}
                  onChange={(e) => setNewCredits(parseInt(e.target.value || "0", 10))}
                  placeholder="Credits"
                  className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm"
                />
              ) : (
                <input
                  type="number"
                  min={1}
                  max={95}
                  value={newDiscountPercent}
                  onChange={(e) => setNewDiscountPercent(parseInt(e.target.value || "0", 10))}
                  placeholder={newPromoType === "purchase_bonus" ? "Bonus %" : "Discount %"}
                  className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm"
                />
              )}
              {(newPromoType === "purchase_discount" || newPromoType === "purchase_bonus") && (
                <>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={newMinimumAmount}
                    onChange={(e) => setNewMinimumAmount(Number(e.target.value || "0"))}
                    placeholder="Min $"
                    className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm"
                  />
                  <select
                    value={newAppliesTo}
                    onChange={(e) => setNewAppliesTo(e.target.value)}
                    className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm"
                  >
                    <option value="all">All packs</option>
                    <option value="starter">Starter only</option>
                    <option value="builder">Builder only</option>
                    <option value="pro">Pro only</option>
                    <option value="studio">Studio only</option>
                    <option value="custom">Custom checkout</option>
                  </select>
                </>
              )}
              <input
                type="number"
                value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                placeholder="Max uses (blank=∞)"
                className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm"
              />
              <input
                type="datetime-local"
                value={newExpires}
                onChange={(e) => setNewExpires(e.target.value)}
                className="rounded-lg bg-surface-elevated border border-border px-3 py-1.5 text-sm"
              />
              <button
                onClick={createPromo}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
              >
                Create
              </button>
            </div>
            {promos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No promo codes yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Code</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Uses</th>
                      <th>Expires</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {promos.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="py-2 font-mono">{p.code}</td>
                        <td className="capitalize">
                          {p.promo_type === "purchase_bonus"
                            ? "bonus"
                            : p.promo_type === "purchase_discount"
                              ? "discount"
                              : "credits"}
                        </td>
                        <td>
                          {p.promo_type === "purchase_bonus"
                            ? `${p.discount_percent ?? 0}% more credits${p.minimum_amount ? `, min $${Number(p.minimum_amount).toFixed(2)}` : ""}`
                            : p.promo_type === "purchase_discount"
                              ? `${p.discount_percent ?? 0}% off${p.minimum_amount ? `, min $${Number(p.minimum_amount).toFixed(2)}` : ""}`
                              : `${p.credits} credits`}
                          {(p.promo_type === "purchase_discount" ||
                            p.promo_type === "purchase_bonus") &&
                            p.applies_to !== "all" && (
                              <div className="text-[10px] text-muted-foreground">
                                Applies: {p.applies_to}
                              </div>
                            )}
                        </td>
                        <td>
                          {p.redemption_count}
                          {p.max_redemptions ? ` / ${p.max_redemptions}` : ""}
                        </td>
                        <td>{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "—"}</td>
                        <td>
                          {p.active ? (
                            <span className="text-success">Active</span>
                          ) : (
                            <span className="text-muted-foreground">Disabled</span>
                          )}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            onClick={() => togglePromo(p)}
                            className="text-xs rounded-md border border-border px-2 py-1 mr-1"
                          >
                            {p.active ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => deletePromo(p)}
                            className="text-xs rounded-md border border-border px-2 py-1"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

const DIAG_ERROR_LABELS: Record<NonNullable<ModelTestResult["errorKind"]>, string> = {
  not_configured: "Not configured",
  model_not_found: "Model not found",
  auth: "Auth failed",
  rate_limit: "Rate limited",
  timeout: "Timeout",
  provider: "Provider error",
  unknown: "Unknown error",
};

type ModelDiagnosticsRun = {
  ranAt: string;
  totalModels: number;
  okCount: number;
  failCount: number;
  results: ModelTestResult[];
};

function ModelDiagnosticsSection() {
  const runTest = useServerFn(testAllSiteModels);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<ModelDiagnosticsRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await runTest({});
      setRun(result as ModelDiagnosticsRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h2 className="font-semibold">Model diagnostics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pings every site-available AI model with a one-word prompt to verify it responds. ~15s
            per model, all in parallel.
          </p>
        </div>
        <button
          type="button"
          onClick={go}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
        >
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing…
            </>
          ) : run ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" /> Run again
            </>
          ) : (
            <>
              <PlayCircle className="h-3.5 w-3.5" /> Run test
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive mb-3">
          {error}
        </div>
      )}

      {run && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <DiagSummary label="Total" value={run.totalModels} tone="neutral" />
            <DiagSummary label="Working" value={run.okCount} tone="ok" />
            <DiagSummary
              label="Failing"
              value={run.failCount}
              tone={run.failCount > 0 ? "fail" : "neutral"}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mb-2">
            Ran at {new Date(run.ranAt).toLocaleString()}
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-elevated/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold w-8"></th>
                  <th className="text-left px-2 py-1.5 font-semibold">Provider</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Model</th>
                  <th className="text-right px-2 py-1.5 font-semibold">Time</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {run.results.map((r) => (
                  <DiagRow key={`${r.provider}:${r.modelId}`} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!run && !running && !error && (
        <p className="text-xs text-muted-foreground">
          Click <strong>Run test</strong> to verify every model. Useful after adding new models or
          changing provider keys.
        </p>
      )}
    </section>
  );
}

function DiagSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "fail" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : tone === "fail"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-surface-elevated/40 text-foreground";
  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function DiagRow({ r }: { r: ModelTestResult }) {
  return (
    <tr className="border-t border-border">
      <td className="px-2 py-1.5">
        {r.ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        )}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-muted-foreground">{r.provider}</td>
      <td className="px-2 py-1.5 font-mono text-[11px]">
        <div>{r.modelId}</div>
        {r.realModel !== r.modelId && (
          <div className="text-[9px] text-muted-foreground mt-0.5">→ {r.realModel}</div>
        )}
      </td>
      <td className="px-2 py-1.5 text-right text-[11px] text-muted-foreground tabular-nums">
        {r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
      </td>
      <td className="px-2 py-1.5 text-[11px]">
        {r.ok ? (
          <span className="text-muted-foreground">
            <span className="text-emerald-400">replied:</span>{" "}
            <span className="font-mono">{r.sample}</span>
          </span>
        ) : (
          <div>
            <span className="font-semibold text-destructive">
              {r.errorKind ? DIAG_ERROR_LABELS[r.errorKind] : "Failed"}
            </span>
            {r.errorMessage && (
              <div className="text-[9px] text-muted-foreground mt-0.5 break-all line-clamp-3">
                {r.errorMessage}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
