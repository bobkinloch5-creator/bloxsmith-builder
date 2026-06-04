import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generatePluginToken } from "@/lib/projects.functions";
import { deleteOwnAccount } from "@/lib/account.functions";
import {
  Copy,
  KeyRound,
  AlertTriangle,
  User,
  CreditCard,
  Folder,
  Sparkles,
  Clock,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Ticket,
  Gift,
  Eye,
  EyeOff,
  Coins,
  DollarSign,
  Zap,
  TrendingUp,
  Award,
} from "lucide-react";

import { toast } from "sonner";
import { useDailyClaimCooldown } from "@/hooks/useDailyClaimCooldown";
import { DiscordRewards } from "@/components/DiscordRewards";
import { PromoteAndEarn } from "@/components/PromoteAndEarn";
import { AccountSecurity } from "@/components/AccountSecurity";
import { ProfileMediaSettings } from "@/components/ProfileMediaSettings";
import { RobloxAccountLink } from "@/components/RobloxAccountLink";
import { ChatStyleCard } from "@/components/ChatStyleCard";
import { ProfileCustomizationCard } from "@/components/ProfileCustomizationCard";
import { RoleBadges } from "@/components/RoleBadge";
import { ProfileBadgeRow, getBadgeDef } from "@/components/profile/ProfileBadges";
import { formatCreditBalance } from "@/lib/credit-display";
import {
  activityProfileBadgeIds,
  mergeProfileBadgeIds,
  roleProfileBadgeIds,
  selectableProfileBadgeIds,
} from "@/lib/profile-badges";
import { resolveNeokensModel } from "@/lib/ai-models";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/account")({
  component: Account,
  head: () => ({
    meta: [{ title: "Profile — BloxSmith" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function actualUsageModelName(
  model: string | null | undefined,
  source?: string | null,
  creditsUsed?: number | null,
) {
  const raw = String(model ?? "").trim();
  const sourceText = String(source ?? "").toLowerCase();
  const inferred =
    raw && !/^bloxsmith ai$/i.test(raw) && !/^ai usage$/i.test(raw)
      ? raw
      : sourceText.includes("ui")
        ? "gemini-2.5-flash"
        : sourceText.includes("template")
          ? "template-system"
          : (creditsUsed ?? 0) >= 10
            ? "gpt-5.2"
            : (creditsUsed ?? 0) >= 3
              ? "claude-sonnet-4-6-thinking"
              : "gemini-3-flash";

  if (inferred === "template-system") return "Template System";
  if (/^claude-|^gpt-|^gemini-/i.test(inferred)) {
    const resolved = resolveNeokensModel(inferred);
    return resolved.thinking ? `${resolved.model} (thinking)` : resolved.model;
  }
  return inferred;
}

type Tx = {
  id: string;
  amount: number;
  tx_type?: string | null;
  description: string | null;
  created_at: string;
};
type UsageEvent = {
  id: number | string;
  created_at: string;
  source?: string | null;
  model?: string | null;
  credits_used?: number | null;
  metadata?: Record<string, unknown> | null;
};
type PR = {
  id: string;
  pack_id: string;
  credits: number;
  amount: number;
  status: string;
  paypal_transaction_id: string;
  created_at: string;
};

function ProfileRolesRow() {
  const { roles, profile } = useAuth();
  const list = (roles ?? []).filter((r) => r && r !== "user");
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Roles</span>
      <RoleBadges roles={list as string[]} size="md" />
      {profile?.specialization ? (
        <span className="rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-xs text-muted-foreground">
          {profile.specialization}
        </span>
      ) : null}
    </div>
  );
}

function Account() {
  const { user, profile, loading, refresh, isOwner, roles } = useAuth();
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "profile" | "billing" | "workspaces" | "analytics" | "security"
  >("profile");
  const [token, setToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [model3dCount, setModel3dCount] = useState(0);
  const runToken = useServerFn(generatePluginToken);
  const runDelete = useServerFn(deleteOwnAccount);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [redeeming, setRedeeming] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const dailyCd = useDailyClaimCooldown(user?.id);
  const [redemptions, setRedemptions] = useState<
    { id: string; credits: number; redeemed_at: string; promo_codes: { code: string } | null }[]
  >([]);

  const loadRedemptions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("promo_redemptions")
      .select("id,credits,redeemed_at,promo_codes(code)")
      .eq("user_id", user.id)
      .order("redeemed_at", { ascending: false })
      .limit(10);
    setRedemptions((data ?? []) as any);
  };

  const redeemPromo = async () => {
    const code = promoCode.trim();
    if (!code) return toast.error("Enter a promo code");
    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_promo_code", { _code: code });
    setRedeeming(false);
    if (error) {
      const map: Record<string, string> = {
        invalid_code: "Invalid promo code",
        inactive_code: "This code is no longer active",
        expired_code: "This code has expired",
        limit_reached: "This code has reached its redemption limit",
        already_redeemed: "You already redeemed this code",
        not_authenticated: "Please sign in to redeem",
      };
      const key = Object.keys(map).find((k) => error.message.includes(k));
      return toast.error(key ? map[key] : error.message);
    }
    toast.success(`Redeemed! New balance: ${data} credits`);
    setPromoCode("");
    await refresh();
    await loadRedemptions();
  };

  const claimDaily = async () => {
    if (dailyCd.onCooldown) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_daily_credits");
    setClaiming(false);
    if (error) {
      if (error.message.includes("email_not_confirmed"))
        return toast.error("Please confirm your email before claiming daily credits.");
      if (error.message.includes("account_too_new"))
        return toast.error("Account is too new — try again in a few minutes.");
      return toast.error(error.message);
    }
    const res = data as { claimed: boolean; reason?: string; amount?: number; credits?: number };
    if (!res.claimed) {
      dailyCd.start();
      return toast.info("Already claimed today — come back tomorrow!");
    }
    dailyCd.start();
    toast.success(`+${res.amount} daily credits! Balance: ${res.credits}`);
    await refresh();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETE") return toast.error("Type DELETE to confirm");
    setDeleting(true);
    try {
      await runDelete({});
      await supabase.auth.signOut();
      toast.success("Account deleted");
      nav({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete account");
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);
  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setBio(profile.bio ?? user?.user_metadata?.bio ?? "");
      setSpecialization(
        profile.specialization ?? user?.user_metadata?.specialization ?? "General Builder",
      );
    }
  }, [profile, user?.user_metadata?.bio, user?.user_metadata?.specialization]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("credit_transactions")
      .select("id,user_id,amount,tx_type,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setTxs((data ?? []) as Tx[]));
    supabase
      .from("ai_usage_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setUsageEvents((data ?? []) as UsageEvent[]));
    supabase
      .from("payment_requests")
      .select("id,pack_id,credits,amount,status,paypal_transaction_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setPrs((data ?? []) as PR[]));
    supabase
      .from("projects")
      .select("id,name,game_type,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setProjects(data ?? []);
        setProjectCount(data?.length ?? 0);
      });
    (supabase as any)
      .from("model_generations_3d")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }: { count: number | null }) => setModel3dCount(count ?? 0));
    loadRedemptions();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    const displayName = name.trim() || user.email?.split("@")[0] || "Roblox Creator";
    const metadata = {
      ...(user.user_metadata ?? {}),
      display_name: displayName,
      bio: bio.trim(),
      specialization,
    };

    const profileUpdate = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio: bio.trim(),
        specialization,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    const metadataUpdate = await supabase.auth.updateUser({ data: metadata });

    if (profileUpdate.error && metadataUpdate.error) {
      return toast.error(profileUpdate.error.message || metadataUpdate.error.message);
    }

    await refresh();
    toast.success("Profile saved successfully");
  };

  const newToken = async () => {
    try {
      const { token } = await runToken({});
      setToken(token);
      setShowToken(false);

      toast.success("Token generated. Save it — it won't be shown again.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading || !user) return null;

  // Process credit transactions to extract model usage stats
  const spendTxs = txs.filter((t) => t.amount < 0);
  const trackedUsageEvents = usageEvents.filter(
    (e) => String(e.source ?? "") !== "credit_spend" || spendTxs.length === 0,
  );
  const txCreditsUsed = spendTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const eventCreditsUsed = trackedUsageEvents.reduce(
    (sum, e) => sum + Math.max(0, Number(e.credits_used ?? 0)),
    0,
  );
  const totalCreditsUsed = Math.max(txCreditsUsed, eventCreditsUsed);
  const totalSpendUsd = totalCreditsUsed * 0.05; // $0.05 per credit (from PayPal packs: $5 for 100 credits)

  // Map transactions to models based on amount
  const enrichedTxs = spendTxs.map((t) => {
    let modelName = "gemini-3-flash";
    let actionType = "AI Action";

    const absAmt = Math.abs(t.amount);
    if (absAmt === 15) {
      modelName = "gpt-5.2";
      actionType = "AI Generation";
    } else if (absAmt === 5) {
      modelName = "claude-sonnet-4-6-thinking";
      actionType = "Workspace Plan";
    } else if (absAmt === 1) {
      modelName = "gemini-3-flash";
      actionType = "Help Chat Support";
    } else if (absAmt === 3) {
      modelName = "gemini-3-flash";
      actionType = "Code Fix / Chat";
    }

    // Try to parse model name if it was somehow appended in reason
    if (t.description) {
      const lowerReason = t.description.toLowerCase();
      if (lowerReason.includes("gemini-3-flash") || lowerReason.includes("flash")) {
        modelName = "gemini-3-flash";
      } else if (lowerReason.includes("gemini-3.1-pro") || lowerReason.includes("gemini-pro")) {
        modelName = "gemini-3.1-pro";
      } else if (lowerReason.includes("sonnet")) {
        modelName = "claude-sonnet-4-6-thinking";
      } else if (lowerReason.includes("gpt-5")) {
        modelName = "gpt-5.2";
      } else if (lowerReason.includes("haiku")) {
        modelName = "claude-haiku-4-5-20251001";
      }
    }

    return {
      ...t,
      modelName: actualUsageModelName(modelName, t.description, absAmt),
      actionType,
      costUsd: absAmt * 0.05,
    };
  });
  const eventOnlyLogs = trackedUsageEvents.map((e) => ({
    id: `usage-${e.id}`,
    amount: -Math.max(1, Number(e.credits_used ?? 1)),
    created_at: e.created_at,
    description: String(e.source ?? "AI usage"),
    modelName: actualUsageModelName(e.model, e.source, Number(e.credits_used ?? 1)),
    actionType: String(e.source ?? "AI usage").replace(/_/g, " "),
    costUsd: Math.max(0, Number(e.credits_used ?? 0)) * 0.05,
  }));
  const usageLogs = enrichedTxs.length > 0 ? enrichedTxs : eventOnlyLogs;

  // Calculate top/most active model
  const modelCounts: Record<string, number> = {};
  usageLogs.forEach((t) => {
    modelCounts[t.modelName] = (modelCounts[t.modelName] || 0) + 1;
  });
  let mostActiveModel = "None";
  let maxCount = 0;
  Object.entries(modelCounts).forEach(([model, count]) => {
    if (count > maxCount) {
      mostActiveModel = model;
      maxCount = count;
    }
  });

  // Daily spend grouping for the line/bar chart (last 7 days with activity or chronologically)
  const dailySpendMap: Record<string, number> = {};
  // Initialize last 7 days to ensure they exist on the chart
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailySpendMap[dateStr] = 0;
  }

  // Populate daily spend
  const chartEvents = usageLogs.length > 0 ? usageLogs : enrichedTxs;
  chartEvents.forEach((t) => {
    const dateStr = new Date(t.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (dateStr in dailySpendMap) {
      dailySpendMap[dateStr] += Math.abs(t.amount);
    } else {
      dailySpendMap[dateStr] = Math.abs(t.amount);
    }
  });

  const dailySpendData = Object.entries(dailySpendMap).map(([date, credits]) => ({
    date,
    Credits: credits,
    Spend: Number((credits * 0.05).toFixed(2)),
  }));

  // Model spend distribution data for pie chart
  const modelSpendMap: Record<string, number> = {};
  usageLogs.forEach((t) => {
    modelSpendMap[t.modelName] = (modelSpendMap[t.modelName] || 0) + Math.abs(t.amount);
  });
  const COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];
  const modelDistributionData = Object.entries(modelSpendMap).map(([name, value], idx) => ({
    name,
    value,
    color: COLORS[idx % COLORS.length],
  }));
  const selectedBadgeIds = selectableProfileBadgeIds((profile as any)?.profile_badges);
  const earnedBadgeIds = mergeProfileBadgeIds([
    ...roleProfileBadgeIds(roles),
    ...selectedBadgeIds,
    ...activityProfileBadgeIds({
      projectCount,
      creditsUsed: totalCreditsUsed,
      usageSources: usageEvents.map((e) => e.source ?? ""),
      model3dCount,
      discordClaimed: (profile as any)?.discord_claimed,
      referredBy: (profile as any)?.referred_by,
      onboardingCompleted: !!(profile as any)?.onboarding_completed_at,
      credits: (profile as any)?.credits,
    }),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 space-y-6">
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-border/60 pb-px overflow-x-auto scrollbar-none gap-6 text-sm">
          {[
            { id: "profile", label: "Profile", icon: User },
            { id: "billing", label: "Billing & Credits", icon: CreditCard },
            { id: "workspaces", label: "Developer & API", icon: Folder },
            { id: "analytics", label: "Usage Analytics", icon: TrendingUp },
            { id: "security", label: "Security & Danger", icon: KeyRound },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 font-semibold transition border-b-2 focus:outline-none whitespace-nowrap ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {activeTab === "profile" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <ProfileMediaSettings />
            <ProfileRolesRow />

            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-6">
                <section className="rounded-2xl border border-border/50 bg-surface/20 p-6 space-y-5">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> Creator Identity
                  </h2>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Display Name
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="Enter display name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Studio Specialty
                      </label>
                      <select
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        className="w-full rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                      >
                        <option value="General Builder">General Builder</option>
                        <option value="Luau Programmer">Luau Programmer</option>
                        <option value="3D Level Modeler">3D Level Modeler</option>
                        <option value="UI & UX Designer">UI & UX Designer</option>
                        <option value="Systems Architect">Systems Architect</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Profile Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                      placeholder="Share a short bio about what you specialize in or the projects you're building..."
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold text-muted-foreground block">
                        Email Address
                      </label>
                      <span className="text-xs text-muted-foreground/80">
                        {profile?.hide_email
                          ? profile?.email?.replace(/(.).+(@.+)/, "$1•••••$2")
                          : profile?.email}
                      </span>
                    </div>
                    <button
                      onClick={saveProfile}
                      className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-semibold transition shadow-sm"
                    >
                      Save Profile Details
                    </button>
                  </div>
                </section>

                <ChatStyleCard />
              </div>

              <div className="lg:col-span-5">
                <ProfileCustomizationCard />
              </div>
            </div>

            {earnedBadgeIds.length > 0 && (
              <section className="rounded-2xl border border-border/50 bg-surface/20 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" /> Earned Profile Badges
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Badges unlock from activity, credits, Discord perks, projects, and owner/staff
                      status.
                    </p>
                  </div>
                  <ProfileBadgeRow ids={earnedBadgeIds} size={30} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {earnedBadgeIds.slice(0, 6).map((id) => {
                    const badge = getBadgeDef(id);
                    if (!badge) return null;
                    return (
                      <div
                        key={id}
                        className="rounded-xl border border-border/50 bg-background/35 p-3"
                      >
                        <div className="text-sm font-semibold">{badge.label}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {badge.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Stats Showcase */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: CreditCard,
                  label: "Credit Balance",
                  value: formatCreditBalance(profile?.credits, isOwner),
                  color: "text-primary-glow",
                  desc: isOwner ? "Owner account: no spending cap" : "Available to run generations",
                },
                {
                  icon: Folder,
                  label: "Active Workspaces",
                  value: String(projectCount),
                  color: "text-success",
                  desc: "Roblox game structures",
                },
                {
                  icon: Sparkles,
                  label: "AI Builds",
                  value: String(Math.max(spendTxs.length, trackedUsageEvents.length)),
                  color: "text-accent",
                  desc: "Tracked AI runs",
                },
                {
                  icon: Clock,
                  label: "Activity Tier",
                  value: projectCount > 5 ? "Pro Builder" : "Starter Creator",
                  color: "text-muted-foreground",
                  desc: "Based on workspace count",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="relative overflow-hidden rounded-xl border border-border/50 bg-surface/30 p-4 transition-all duration-300 hover:border-border hover:-translate-y-0.5 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-surface-elevated border border-border/40 grid place-items-center">
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                      <div className="text-lg font-bold tracking-tight">{s.value}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2">{s.desc}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-6">
                {/* Promo Codes & Daily Credits */}
                <section className="rounded-2xl border border-border/50 bg-surface/20 p-6 space-y-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" /> Promo Codes &amp; Free Credits
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enter a promo code to add credits to your account, or claim your free daily
                    refill (+10 credits per day).
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Promo code
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") redeemPromo();
                        }}
                        placeholder="ENTER CODE"
                        className="flex-1 rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <button
                        onClick={redeemPromo}
                        disabled={redeeming || !promoCode.trim()}
                        className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                      >
                        {redeeming ? "…" : "Redeem"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-surface-elevated/40 border border-border/40 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Gift className="h-4 w-4 text-primary-glow" />
                      <span>Daily free credits (+10/day)</span>
                    </div>
                    <button
                      onClick={claimDaily}
                      disabled={claiming || dailyCd.onCooldown}
                      title={dailyCd.onCooldown ? `Next claim in ${dailyCd.label}` : undefined}
                      className="rounded-lg bg-primary/10 border border-primary/20 text-primary-glow hover:bg-primary/15 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                    >
                      {claiming
                        ? "…"
                        : dailyCd.onCooldown
                          ? `Next in ${dailyCd.label}`
                          : "Claim +10"}
                    </button>
                  </div>

                  {redemptions.length > 0 && (
                    <div className="pt-2 border-t border-border/40">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">
                        Recent redemptions
                      </div>
                      <ul className="space-y-1.5 text-xs">
                        {redemptions.map((r) => (
                          <li key={r.id} className="flex justify-between text-muted-foreground">
                            <span className="font-mono text-foreground">
                              {r.promo_codes?.code ?? "—"}
                            </span>
                            <span className="text-success">+{r.credits} credits</span>
                            <span>{new Date(r.redeemed_at).toLocaleDateString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>

                <DiscordRewards />
                <PromoteAndEarn />
              </div>

              <div className="lg:col-span-5 space-y-6">
                {/* Credit Transaction Ledgers */}
                <section className="rounded-2xl border border-border/50 bg-surface/20 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" /> Credit History
                    </h2>
                    <Link
                      to="/pricing"
                      className="text-xs text-primary-glow hover:underline flex items-center gap-0.5"
                    >
                      Buy Credits <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {txs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No balance updates recorded.</p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 text-sm divide-y divide-border/40">
                      {txs.slice(0, 15).map((t) => (
                        <div
                          key={t.id}
                          className="pt-2 flex justify-between items-center first:pt-0"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-xs truncate max-w-[200px]">
                              {t.description ?? t.tx_type}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(t.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <span
                            className={`font-bold text-xs shrink-0 ${t.amount > 0 ? "text-success" : "text-muted-foreground/80"}`}
                          >
                            {t.amount > 0 ? `+${t.amount}` : t.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Purchase Order History */}
                <section className="rounded-2xl border border-border/50 bg-surface/20 p-6 space-y-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" /> Orders &amp; Packs
                  </h2>

                  {prs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No purchases submitted yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 text-xs">
                      {prs.map((r) => (
                        <div
                          key={r.id}
                          className="p-2 rounded-lg bg-surface-elevated/40 border border-border/30 flex justify-between items-center"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate uppercase">{r.pack_id}</div>
                            <div className="text-muted-foreground text-[10px]">
                              ${r.amount} · {new Date(r.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold text-[10px] shrink-0 capitalize ${r.status === "approved" ? "bg-success/15 text-success" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-surface-elevated border border-border text-muted-foreground"}`}
                          >
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === "workspaces" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <RobloxAccountLink />

            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-6">
                {/* Plugin token manager */}
                <section className="rounded-2xl border border-border/50 bg-surface/20 p-6 space-y-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" /> Studio Plugin Sync Token
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Connect your Roblox Studio plugin to your web account. Paste this token into the
                    widget to link the project files. Generating a new token will invalidate
                    previous session authorizations.
                  </p>

                  {token ? (
                    <div className="flex gap-2">
                      <code className="flex-1 rounded-lg bg-surface-elevated border border-border px-3 py-2 text-xs font-mono break-all select-all text-primary-glow">
                        {showToken ? token : "•".repeat(Math.min(token.length, 48))}
                      </code>
                      <button
                        onClick={() => setShowToken((v) => !v)}
                        className="rounded-lg border border-border px-3 py-2 hover:bg-surface-elevated transition"
                        title={showToken ? "Hide token" : "Show token"}
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(token);
                          toast.success("Token copied to clipboard");
                        }}
                        className="rounded-lg border border-border px-3 py-2 hover:bg-surface-elevated transition"
                        title="Copy token"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-surface-elevated/40 border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Security Token hidden. Click below to retrieve or generate a token.
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={newToken}
                      className="rounded-lg bg-primary/10 border border-primary/20 text-primary-glow hover:bg-primary/15 px-4 py-2 text-sm font-semibold transition"
                    >
                      {token ? "Regenerate Token" : "Generate Link Token"}
                    </button>
                    <Link
                      to="/plugin"
                      className="rounded-lg border border-border hover:bg-surface-elevated px-4 py-2 text-sm font-semibold transition inline-flex items-center gap-1.5"
                    >
                      Download Plugin <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </section>
              </div>

              <div className="lg:col-span-5 space-y-6">
                {/* Active Projects Directory */}
                <section className="rounded-2xl border border-border/50 bg-surface/20 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Folder className="h-5 w-5 text-primary" /> Active Workspaces
                    </h2>
                    <Link
                      to="/dashboard"
                      className="text-xs text-primary-glow hover:underline flex items-center gap-0.5"
                    >
                      View All <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {projects.length === 0 ? (
                    <div className="rounded-lg bg-surface-elevated/30 border border-dashed border-border/60 p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        No active workspaces detected.
                      </p>
                      <Link
                        to="/dashboard"
                        className="text-xs text-primary-glow font-semibold hover:underline mt-2 inline-block"
                      >
                        Create a new game project
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {projects.map((p) => (
                        <Link
                          key={p.id}
                          to="/project/$projectId"
                          params={{ projectId: p.id }}
                          className="block p-3 rounded-lg bg-surface-elevated/40 border border-border/40 hover:border-border hover:bg-surface-elevated/70 transition"
                        >
                          <div className="flex justify-between items-center">
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{p.name}</div>
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                {p.game_type || "Empty Template"}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Usage Analytics Dashboard */}
            <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-surface/40 via-surface/20 to-surface/10 p-6 space-y-6">
              <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary-glow ring-1 ring-primary/20">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">AI Usage &amp; Spend</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      Track credits, models, and spend in real time.
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-[11px] font-semibold text-primary-glow">
                  <Sparkles className="h-3 w-3" /> $0.05 / credit
                </span>
              </div>

              {/* Metric Sub-cards */}
              <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    icon: <Coins className="h-4 w-4" />,
                    label: "Credits used",
                    value: totalCreditsUsed.toLocaleString(),
                    suffix: "cr",
                    hint: "Code tasks + chat runs",
                    tint: "from-violet-500/20 to-violet-500/0 text-violet-300",
                  },
                  {
                    icon: <DollarSign className="h-4 w-4" />,
                    label: "Total spend",
                    value: `$${totalSpendUsd.toFixed(2)}`,
                    suffix: "USD",
                    hint: "Based on credit value",
                    tint: "from-emerald-500/20 to-emerald-500/0 text-emerald-300",
                  },
                  {
                    icon: <Zap className="h-4 w-4" />,
                    label: "Top model",
                    value: mostActiveModel === "None" ? "—" : mostActiveModel,
                    suffix: "",
                    hint: "Highest execution count",
                    tint: "from-amber-500/20 to-amber-500/0 text-amber-300",
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className={`relative overflow-hidden rounded-xl border border-border/40 bg-surface-elevated/30 p-4 group hover:border-border/70 transition`}
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${m.tint} opacity-60 pointer-events-none`}
                    />
                    <div className="relative flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-background/40">
                        {m.icon}
                      </span>
                      {m.label}
                    </div>
                    <div className="relative mt-3 flex items-baseline gap-1.5">
                      <span
                        className="text-2xl font-black text-foreground truncate"
                        title={m.value}
                      >
                        {m.value}
                      </span>
                      {m.suffix && (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {m.suffix}
                        </span>
                      )}
                    </div>
                    <div className="relative text-[10px] text-muted-foreground mt-1">{m.hint}</div>
                  </div>
                ))}
              </div>

              {/* Interactive Chart Panel */}
              {mounted ? (
                <div className="grid lg:grid-cols-12 gap-6">
                  {/* Daily Spend Area Chart */}
                  <div className="lg:col-span-8 rounded-xl border border-border/40 bg-surface-elevated/10 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Daily Credit Spend (7 Days)
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={dailySpendData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            stroke="#94A3B8"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(15, 23, 42, 0.95)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: "8px",
                              color: "#f8fafc",
                              fontSize: "11px",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Credits"
                            stroke="#8B5CF6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorCredits)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Model Distribution Pie Chart */}
                  <div className="lg:col-span-4 rounded-xl border border-border/40 bg-surface-elevated/10 p-4 flex flex-col justify-between space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Spend by AI Model
                    </h3>
                    {modelDistributionData.length > 0 ? (
                      <>
                        <div className="h-44 w-full relative grid place-items-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={modelDistributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={65}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {modelDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                                  border: "1px solid rgba(255, 255, 255, 0.1)",
                                  borderRadius: "8px",
                                  color: "#f8fafc",
                                  fontSize: "11px",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
                              Total
                            </span>
                            <span className="text-base font-bold text-foreground">
                              {totalCreditsUsed} cr
                            </span>
                          </div>
                        </div>
                        {/* Legend */}
                        <div className="space-y-1">
                          {modelDistributionData.map((item) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-muted-foreground truncate max-w-[120px]">
                                  {item.name}
                                </span>
                              </div>
                              <span className="font-semibold text-foreground">{item.value} cr</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No model distribution data yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-surface-elevated/5 p-8 text-center text-sm text-muted-foreground">
                  {usageLogs.length === 0
                    ? "No AI usage history yet. The graph is ready and will fill as soon as you run a generation."
                    : "Loading analytics dashboard..."}
                </div>
              )}

              {/* Model Usage Logs List */}
              {usageLogs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Detailed AI Operation Logs
                  </h3>
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-surface-elevated/5">
                    <div className="max-h-60 overflow-y-auto pr-1">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/40 bg-surface-elevated/20 text-muted-foreground font-semibold">
                            <th className="p-3">Date &amp; Time</th>
                            <th className="p-3">Operation</th>
                            <th className="p-3">AI Model</th>
                            <th className="p-3 text-right">Cost</th>
                            <th className="p-3 text-right">USD Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {usageLogs.map((t) => (
                            <tr key={t.id} className="hover:bg-surface-elevated/10 transition">
                              <td className="p-3 text-muted-foreground">
                                {new Date(t.created_at).toLocaleString()}
                              </td>
                              <td className="p-3 font-semibold text-foreground">{t.actionType}</td>
                              <td className="p-3">
                                <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-mono text-primary-glow">
                                  {t.modelName}
                                </span>
                              </td>
                              <td className="p-3 text-right text-destructive font-semibold">
                                -{Math.abs(t.amount)} credits
                              </td>
                              <td className="p-3 text-right text-muted-foreground">
                                ${t.costUsd.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <AccountSecurity />

            <div className="grid md:grid-cols-2 gap-6">
              {/* Session Security */}
              <section className="rounded-2xl border border-border/50 bg-surface/10 p-6 space-y-4">
                <h2 className="text-lg font-bold">Session Security</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If you are logging in from a shared system, make sure to terminate the session
                  context when you are finished.
                </p>
                <button
                  onClick={signOut}
                  className="rounded-lg border border-border hover:bg-surface-elevated text-sm px-4 py-2 font-semibold transition"
                >
                  Sign out of account
                </button>
              </section>

              {/* Danger Zone */}
              <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Danger Zone
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Deleting your account is permanent. This removes credits, payments, and generated
                  project workspaces.
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Type{" "}
                    <code className="bg-surface-elevated border border-border px-1.5 py-0.5 rounded font-mono text-destructive">
                      DELETE
                    </code>{" "}
                    to confirm
                  </label>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full sm:w-64 rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/40"
                  />
                </div>

                <div>
                  <button
                    onClick={deleteAccount}
                    disabled={deleting || confirmText !== "DELETE"}
                    className="rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold transition shadow-sm"
                  >
                    {deleting ? "Deleting Account…" : "Delete Account"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
