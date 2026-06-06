import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { Award, Sparkles, Gift, MessageSquare, Coins, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/achievements")({
  component: AchievementsPage,
  head: () => ({
    meta: [
      { title: "Achievements & Perks — BloxSmith" },
      {
        name: "description",
        content:
          "Earn badges, level up, and unlock free credits on BloxSmith. Get +2 credits for every 10 chat messages you send.",
      },
    ],
  }),
});

type Achievement = {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xp_reward: number;
  credit_reward: number;
  sort_order: number;
};

type UserLevel = {
  xp: number;
  level: number;
  messages_sent: number;
  chat_credits_earned: number;
};

type UserAchievementRow = {
  achievement_key: string;
};

type AchievementReward = Pick<Achievement, "name" | "credit_reward" | "xp_reward">;

const achievementIcons = Icons as unknown as Record<string, LucideIcon>;

/** Client-side fallback so the page is never blank before the SQL migration is applied. */
const FALLBACK_ACHIEVEMENTS: Achievement[] = [
  { key: "chatty_10", name: "Chatty", description: "Send 10 chat messages", icon: "MessageSquare", category: "chat", xp_reward: 15, credit_reward: 2, sort_order: 1 },
  { key: "chatty_25", name: "Conversation Starter", description: "Send 25 chat messages", icon: "MessagesSquare", category: "chat", xp_reward: 30, credit_reward: 2, sort_order: 3 },
  { key: "chatty_50", name: "Community Regular", description: "Send 50 chat messages", icon: "MessageCircleMore", category: "chat", xp_reward: 40, credit_reward: 3, sort_order: 4 },
  { key: "chatty_100", name: "Community Pillar", description: "Send 100 chat messages", icon: "MessagesSquare", category: "chat", xp_reward: 60, credit_reward: 5, sort_order: 5 },
  { key: "chatty_250", name: "Known Voice", description: "Send 250 chat messages", icon: "Radio", category: "chat", xp_reward: 100, credit_reward: 8, sort_order: 6 },
  { key: "chatty_500", name: "Community Star", description: "Send 500 chat messages", icon: "Star", category: "chat", xp_reward: 150, credit_reward: 10, sort_order: 7 },
  { key: "chatty_1000", name: "Legendary Chatter", description: "Send 1,000 chat messages", icon: "Trophy", category: "chat", xp_reward: 300, credit_reward: 15, sort_order: 8 },
  { key: "chatty_2500", name: "Community Icon", description: "Send 2,500 chat messages", icon: "Medal", category: "chat", xp_reward: 700, credit_reward: 25, sort_order: 9 },
  { key: "chatty_5000", name: "BloxSmith Broadcaster", description: "Send 5,000 chat messages", icon: "Crown", category: "chat", xp_reward: 1200, credit_reward: 50, sort_order: 10 },
  { key: "level_2", name: "First Level Up", description: "Reach level 2", icon: "TrendingUp", category: "level", xp_reward: 15, credit_reward: 1, sort_order: 11 },
  { key: "level_3", name: "On a Roll", description: "Reach level 3", icon: "Zap", category: "level", xp_reward: 20, credit_reward: 2, sort_order: 12 },
  { key: "level_5", name: "Dedicated Builder", description: "Reach level 5", icon: "Hammer", category: "level", xp_reward: 40, credit_reward: 4, sort_order: 13 },
  { key: "level_10", name: "Rising Star", description: "Reach level 10", icon: "Star", category: "level", xp_reward: 80, credit_reward: 8, sort_order: 15 },
  { key: "level_15", name: "Expert Builder", description: "Reach level 15", icon: "BadgeCheck", category: "level", xp_reward: 120, credit_reward: 12, sort_order: 16 },
  { key: "level_25", name: "Master Architect", description: "Reach level 25", icon: "Castle", category: "level", xp_reward: 250, credit_reward: 25, sort_order: 17 },
  { key: "level_50", name: "BloxSmith Legend", description: "Reach level 50", icon: "Crown", category: "level", xp_reward: 600, credit_reward: 50, sort_order: 18 },
  { key: "gallery_1", name: "First Showcase", description: "Share your first gallery post", icon: "Image", category: "gallery", xp_reward: 15, credit_reward: 1, sort_order: 20 },
  { key: "gallery_3", name: "Gallery Regular", description: "Share 3 gallery posts", icon: "Images", category: "gallery", xp_reward: 30, credit_reward: 3, sort_order: 21 },
  { key: "gallery_10", name: "Showcase Creator", description: "Share 10 gallery posts", icon: "GalleryHorizontalEnd", category: "gallery", xp_reward: 80, credit_reward: 8, sort_order: 22 },
  { key: "gallery_25", name: "Featured Artist", description: "Share 25 gallery posts", icon: "Palette", category: "gallery", xp_reward: 200, credit_reward: 20, sort_order: 23 },
  { key: "followers_1", name: "First Follower", description: "Get your first follower", icon: "UserPlus", category: "social", xp_reward: 10, credit_reward: 1, sort_order: 30 },
  { key: "followers_5", name: "Growing Audience", description: "Reach 5 followers", icon: "UserRoundPlus", category: "social", xp_reward: 40, credit_reward: 4, sort_order: 31 },
  { key: "followers_25", name: "Community Creator", description: "Reach 25 followers", icon: "UsersRound", category: "social", xp_reward: 120, credit_reward: 12, sort_order: 32 },
  { key: "followers_100", name: "BloxSmith Influencer", description: "Reach 100 followers", icon: "BadgeCheck", category: "social", xp_reward: 300, credit_reward: 30, sort_order: 33 },
  { key: "first_3d_model", name: "3D Model Maker", description: "Generate your first successful 3D model", icon: "Box", category: "3d studio", xp_reward: 50, credit_reward: 5, sort_order: 90 },
  { key: "first_rigged_model", name: "Skeleton Crew", description: "Generate your first model with a real skeleton", icon: "Bone", category: "3d studio", xp_reward: 80, credit_reward: 8, sort_order: 91 },
  { key: "first_animated_model", name: "Model in Motion", description: "Generate your first model with a baked animation", icon: "PersonStanding", category: "3d studio", xp_reward: 100, credit_reward: 10, sort_order: 92 },
  { key: "mod_helper", name: "Mod Helper", description: "Help moderate the community", icon: "ShieldCheck", category: "community", xp_reward: 50, credit_reward: 10, sort_order: 100 },
];

function uniqueAchievementChannel(userId: string) {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `achievements-${userId}-${id}`;
}

function AchievementsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Achievement[]>(FALLBACK_ACHIEVEMENTS);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<UserLevel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: ach } = await supabase
          .from("achievements")
          .select("*")
          .order("sort_order", { ascending: true });
        if (cancelled) return;
        const rows = (ach ?? []) as Achievement[];
        setItems(rows.length > 0 ? rows : FALLBACK_ACHIEVEMENTS);

        if (user) {
          const [{ data: ua }, { data: lv }] = await Promise.all([
            supabase.from("user_achievements").select("achievement_key").eq("user_id", user.id),
            supabase.from("user_levels").select("*").eq("user_id", user.id).maybeSingle(),
          ]);
          if (cancelled) return;
          setUnlocked(
            new Set(((ua ?? []) as UserAchievementRow[]).map((row) => row.achievement_key)),
          );
          setStats(
            (lv as UserLevel) ?? { xp: 0, level: 1, messages_sent: 0, chat_credits_earned: 0 },
          );
        }
      } catch {
        // DB query failed — keep showing fallback achievements
        if (!cancelled) setItems(FALLBACK_ACHIEVEMENTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    if (!user)
      return () => {
        cancelled = true;
      };

    // Realtime: refresh on unlocks / XP changes for this user
    const channel = supabase
      .channel(uniqueAchievementChannel(user.id))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_achievements",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const key = String(
              (payload.new as { achievement_key?: string })?.achievement_key ?? "",
            );
            if (key) {
              const { data: achievement } = await supabase
                .from("achievements")
                .select("name,credit_reward,xp_reward")
                .eq("key", key)
                .maybeSingle();
              if (achievement) {
                const reward = achievement as AchievementReward;
                const credits = Number(reward.credit_reward ?? 0);
                const xpReward = Number(reward.xp_reward ?? 0);
                const rewards = [
                  credits > 0 ? `+${credits} credits` : null,
                  xpReward > 0 ? `+${xpReward} XP` : null,
                ]
                  .filter(Boolean)
                  .join(" and ");
                toast.success(`Achievement unlocked: ${reward.name}`, {
                  description: rewards
                    ? `${rewards} added automatically.`
                    : "Reward added automatically.",
                });
              }
            }
          }
          load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_levels", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const lv = payload.new as UserLevel | undefined;
          if (lv) setStats(lv);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const xp = stats?.xp ?? 0;
  const level = stats?.level ?? 1;
  const xpForNext = 50 * level * level;
  const xpForCurrent = 50 * (level - 1) * (level - 1);
  const pct = Math.min(100, Math.max(0, ((xp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100));

  const grouped = items.reduce<Record<string, Achievement[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] ?? []).push(a);
    return acc;
  }, {});
  const unlockedItems = items.filter((achievement) => unlocked.has(achievement.key));
  const achievementCreditsEarned = unlockedItems.reduce(
    (total, achievement) => total + Math.max(0, achievement.credit_reward),
    0,
  );
  const availableAchievementCredits = items.reduce(
    (total, achievement) => total + Math.max(0, achievement.credit_reward),
    0,
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary-glow mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Perks & rewards
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Achievements</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Level up by chatting, sharing, and building. Unlock badges to earn free credits and show
            them off on your profile.
          </p>
        </div>

        {/* Perks callout */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass rounded-2xl p-5 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center shrink-0">
              <MessageSquare className="h-5 w-5 text-primary-glow" />
            </div>
            <div>
              <div className="font-semibold">+2 credits every 10 chat messages</div>
              <p className="text-sm text-muted-foreground mt-1">
                Stay active in the community chat. Every 10 messages you send, BloxSmith
                automatically drops 2 free credits into your balance.
              </p>
            </div>
          </div>
          <div className="glass rounded-2xl p-5 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center shrink-0">
              <Gift className="h-5 w-5 text-primary-glow" />
            </div>
            <div>
              <div className="font-semibold">Badges grant bonus credits & XP</div>
              <p className="text-sm text-muted-foreground mt-1">
                Each badge you unlock instantly tops up your credits and pushes you toward the next
                level.
              </p>
            </div>
          </div>
        </div>

        {/* Level card */}
        {user && (
          <div className="glass rounded-2xl p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Your level
                </div>
                <div className="text-3xl font-bold mt-1">Level {level}</div>
              </div>
              <div className="text-right">
                <div className="text-sm">
                  <span className="font-semibold">{xp.toLocaleString()}</span>{" "}
                  <span className="text-muted-foreground">/ {xpForNext.toLocaleString()} XP</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats?.messages_sent ?? 0} msgs · {stats?.chat_credits_earned ?? 0} credits from
                  chat
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-surface-elevated/60 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" /> Achievements
                </div>
                <div className="mt-1 text-lg font-bold">
                  {unlockedItems.length} / {items.length}
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                <div className="flex items-center gap-2 text-xs text-primary-glow">
                  <Coins className="h-3.5 w-3.5" /> Credits earned
                </div>
                <div className="mt-1 text-lg font-bold text-primary-glow">
                  +{achievementCreditsEarned}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-elevated/60 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Gift className="h-3.5 w-3.5" /> Total available
                </div>
                <div className="mt-1 text-lg font-bold">{availableAchievementCredits} credits</div>
              </div>
            </div>
          </div>
        )}

        {/* Badges by category */}
        {Object.entries(grouped).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="text-xl font-bold mb-3 capitalize">{cat}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a) => {
                const Icon = achievementIcons[a.icon] ?? Award;
                const got = unlocked.has(a.key);
                return (
                  <div
                    key={a.key}
                    className={`glass rounded-2xl p-4 flex gap-3 transition ${
                      got ? "ring-1 ring-primary/40" : "opacity-60"
                    }`}
                  >
                    <div
                      className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 ${
                        got
                          ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground"
                          : "bg-surface-elevated text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold truncate">{a.name}</div>
                        {got && (
                          <span className="text-[10px] uppercase tracking-wide text-primary-glow">
                            Rewarded
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        {a.credit_reward > 0 && (
                          <span className="rounded-full bg-primary/15 text-primary-glow px-2 py-0.5">
                            +{a.credit_reward} credits
                          </span>
                        )}
                        {a.xp_reward > 0 && (
                          <span className="rounded-full bg-surface-elevated px-2 py-0.5">
                            +{a.xp_reward} XP
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
