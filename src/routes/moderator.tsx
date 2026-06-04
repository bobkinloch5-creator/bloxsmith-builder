import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header, Footer } from "@/components/layout";
import {
  getModeratorModelStatus,
  loadModeratorDashboard,
  moderatorCreatePromoCode,
  moderatorGiftCredits,
  requireModerator,
  resendConfirmationForUser,
} from "@/lib/moderator.functions";
import { toast } from "sonner";
import { Gift, Loader2, Mail, ShieldCheck, Sparkles, Ticket, Zap } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/moderator")({
  beforeLoad: async () => {
    try {
      await requireModerator();
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ModeratorPanel,
  head: () => ({
    meta: [
      { title: "Moderator Panel - BloxSmith" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type ModUser = {
  id: string;
  email: string;
  display_name: string | null;
  credits: number;
  banned: boolean;
  roles: string[];
  email_confirmed: boolean;
};

function ModeratorPanel() {
  const load = useServerFn(loadModeratorDashboard);
  const gift = useServerFn(moderatorGiftCredits);
  const createPromo = useServerFn(moderatorCreatePromoCode);
  const resend = useServerFn(resendConfirmationForUser);
  const modelStatus = useServerFn(getModeratorModelStatus);
  const [q, setQ] = useState("");
  const [promo, setPromo] = useState({ code: "", credits: 10, maxRedemptions: 10 });

  const dashboard = useQuery({ queryKey: ["moderator-dashboard"], queryFn: () => load() });
  const models = useQuery({ queryKey: ["moderator-model-status"], queryFn: () => modelStatus() });

  const giftMut = useMutation({
    mutationFn: async (user: ModUser) => {
      const raw = window.prompt(`Gift credits to ${user.email} (1-25)`, "10");
      if (!raw) return null;
      const amount = Number.parseInt(raw, 10);
      const reason =
        window.prompt("Reason for the audit log", "helping user with account issue") ||
        "moderator credit gift";
      return gift({ data: { userId: user.id, amount, reason } });
    },
    onSuccess: (res) => {
      if (!res) return;
      toast.success("Credits gifted and logged.");
      dashboard.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const promoMut = useMutation({
    mutationFn: () =>
      createPromo({
        data: {
          code: promo.code,
          credits: promo.credits,
          maxRedemptions: promo.maxRedemptions,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Promo ${res.code} created.`);
      setPromo({ code: "", credits: 10, maxRedemptions: 10 });
      dashboard.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resendMut = useMutation({
    mutationFn: (user: ModUser) => resend({ data: { userId: user.id, email: user.email } }),
    onSuccess: (res) => {
      toast.success(res.sent ? "Confirmation email resent." : "Email already confirmed.");
      dashboard.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const users = ((dashboard.data?.users ?? []) as ModUser[]).filter((user) => {
    const term = q.toLowerCase();
    return user.email.toLowerCase().includes(term) || (user.display_name ?? "").toLowerCase().includes(term);
  });
  const limits = dashboard.data?.limits;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 space-y-6">
        <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                <ShieldCheck className="h-3.5 w-3.5" /> Basic tools only
              </div>
              <h1 className="text-3xl font-bold">Moderator Panel</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Help users with small account issues, limited credit gifts, promo codes, email
                confirmation, model status, and activity review. Admin and owner controls are locked
                out of this panel.
              </p>
            </div>
            {limits && (
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <LimitBox label="Gifted today" value={`${limits.creditGiftUsed}/${limits.creditGiftLimit}`} />
                <LimitBox label="Promos today" value={`${limits.promoCreated}/${limits.promoLimit}`} />
              </div>
            )}
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
          <div className="glass rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Users</h2>
                <p className="text-xs text-muted-foreground">
                  Moderators can view users, resend unconfirmed signup emails, and gift small
                  logged credit amounts.
                </p>
              </div>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search users"
                className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
              />
            </div>
            {dashboard.isLoading ? (
              <div className="grid place-items-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">User</th>
                      <th>Role</th>
                      <th>Credits</th>
                      <th>Email</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const locked = user.roles.includes("owner") || user.roles.includes("admin");
                      return (
                        <tr key={user.id} className="border-t border-border">
                          <td className="py-2">
                            <div className="font-medium">{user.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {user.display_name ?? "No display name"}
                            </div>
                          </td>
                          <td className="text-xs capitalize">{user.roles.join(", ")}</td>
                          <td>{user.credits}</td>
                          <td>
                            {user.email_confirmed ? (
                              <span className="text-xs text-emerald-300">Confirmed</span>
                            ) : (
                              <span className="text-xs text-amber-300">Needs resend</span>
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            {!user.email_confirmed && (
                              <button
                                onClick={() => resendMut.mutate(user)}
                                disabled={resendMut.isPending}
                                className="mr-1 inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs text-amber-200 disabled:opacity-50"
                              >
                                <Mail className="h-3 w-3" /> Resend email
                              </button>
                            )}
                            <button
                              onClick={() => giftMut.mutate(user)}
                              disabled={giftMut.isPending || locked}
                              title={locked ? "Moderators cannot gift owners or admins." : undefined}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                            >
                              <Gift className="h-3 w-3" /> Gift
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <section className="glass rounded-2xl p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <Ticket className="h-4 w-4 text-primary-glow" /> Create limited promo
              </h2>
              <div className="space-y-2">
                <input
                  value={promo.code}
                  onChange={(event) => setPromo((p) => ({ ...p, code: event.target.value.toUpperCase() }))}
                  placeholder="CODE"
                  className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm uppercase"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={promo.credits}
                    onChange={(event) => setPromo((p) => ({ ...p, credits: Number(event.target.value) }))}
                    className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={promo.maxRedemptions}
                    onChange={(event) => setPromo((p) => ({ ...p, maxRedemptions: Number(event.target.value) }))}
                    className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => promoMut.mutate()}
                  disabled={promoMut.isPending || !promo.code.trim()}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {promoMut.isPending ? "Creating..." : "Create promo"}
                </button>
              </div>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <Zap className="h-4 w-4 text-primary-glow" /> AI model status
              </h2>
              <div className="space-y-2">
                {models.data?.providers.map((provider) => (
                  <div key={provider.provider} className="rounded-lg border border-border bg-background/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold capitalize">{provider.provider}</span>
                      <span className={provider.configured ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>
                        {provider.configured ? "Configured" : "Missing key"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {provider.models.length} model{provider.models.length === 1 ? "" : "s"} listed
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <AuditList title="Recent moderator actions" rows={dashboard.data?.moderatorActions ?? []} />
          <AuditList title="Recent credit activity" rows={dashboard.data?.creditActivity ?? []} />
        </section>
      </main>
      <Footer />
    </div>
  );
}

function LimitBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function AuditList({ title, rows }: { title: string; rows: any[] }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 text-primary-glow" /> {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 8).map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-background/30 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{row.action ?? row.reason ?? "credit activity"}</span>
                <span className={Number(row.amount ?? 0) >= 0 ? "text-emerald-300" : "text-destructive"}>
                  {row.amount ? `${row.amount > 0 ? "+" : ""}${row.amount}` : ""}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground">{new Date(row.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
