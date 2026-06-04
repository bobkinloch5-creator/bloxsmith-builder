import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { getRobloxPresence } from "@/lib/roblox-presence.functions";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { X, UserPlus, UserCheck, UserMinus, MessageCircle, Gamepad2, Hammer, ExternalLink, Loader2, Crown, Heart, HeartOff, Flag, Trophy, Award } from "lucide-react";
import { ProfileEffect } from "./ProfileEffect";
import { ProfileBackground } from "@/components/profile/ProfileBackground";
import { PfpRing } from "@/components/profile/PfpRing";
import { presenceFromProfile } from "@/lib/presence";
import { ProfileBadgeRow } from "@/components/profile/ProfileBadges";
import { AvatarDecoration } from "@/components/profile/ProfileDecoration";
import { ProfileCardEffect, cardChromeStyle } from "@/components/profile/ProfileCardEffects";
import { RoleBadges, type Role } from "@/components/RoleBadge";
import { MarkdownText } from "@/components/MarkdownText";
import {
  mergeProfileBadgeIds,
  normalizeProfileBadgeIds,
  roleProfileBadgeIds,
} from "@/lib/profile-badges";
import { profileHandle } from "@/lib/profile-username";


type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  chat_nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  roblox_user_id: number | null;
  roblox_username: string | null;
  roblox_avatar_url: string | null;
  banner_url: string | null;
  private_profile: boolean | null;
  profile_accent: string | null;
  profile_card_color: string | null;
  profile_card_effect: string | null;
  profile_effect: string | null;
  profile_background: string | null;
  pfp_effect: string | null;
  status_message: string | null;
  pronouns: string | null;
  location: string | null;
  presence_enabled: boolean | null;
  presence_status: string | null;
  last_seen_at: string | null;
  show_activity: boolean | null;
  current_activity: any;
  profile_badges: string[] | null;
  profile_decoration: string | null;
};


type FriendStatus = "none" | "pending_out" | "pending_in" | "friends";

export function UserProfilePopover({
  userId,
  onClose,
  onOpenDm,
}: {
  userId: string;
  onClose: () => void;
  onOpenDm?: (userId: string) => void;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [friend, setFriend] = useState<{ status: FriendStatus; requestId: string | null }>({ status: "none", requestId: null });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [presence, setPresence] = useState<Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getRobloxPresence>>>> | null>(null);
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [achievements, setAchievements] = useState<Array<{ key: string; name: string; icon: string | null; xp_reward: number | null; unlocked_at: string }>>([]);
  const [level, setLevel] = useState<{ level: number; xp: number } | null>(null);
  const isSelf = user?.id === userId;
  const fetchPresence = useServerFn(getRobloxPresence);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: fr }, { data: roleRows }] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("id,display_name,username,chat_nickname,avatar_url,bio,roblox_user_id,roblox_username,roblox_avatar_url,banner_url,private_profile,profile_accent,profile_card_color,profile_card_effect,profile_effect,profile_background,custom_background_url,pfp_effect,status_message,pronouns,location,presence_enabled,presence_status,last_seen_at,show_activity,current_activity,profile_badges,profile_decoration")
          .eq("id", userId)
          .maybeSingle(),

        user
          ? (supabase as any)
              .from("friend_requests")
              .select("id,requester_id,addressee_id,status")
              .or(
                `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`,
              )
              .maybeSingle()
          : Promise.resolve({ data: null }),
        (supabase as any).from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (cancel) return;
      setProfile(p as Profile | null);
      setRoles(((roleRows ?? []) as { role: Role }[]).map((row) => row.role));
      if (fr) {
        const status: FriendStatus =
          fr.status === "accepted"
            ? "friends"
            : fr.requester_id === user?.id
              ? "pending_out"
              : "pending_in";
        setFriend({ status, requestId: fr.id });
      } else {
        setFriend({ status: "none", requestId: null });
      }
      // Load follow stats
      const [{ count: fc }, { data: myFollow }] = await Promise.all([
        (supabase as any).from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
        user
          ? (supabase as any).from("user_follows").select("follower_id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!cancel) {
        setFollowerCount(fc ?? 0);
        setIsFollowing(!!myFollow);
      }
      // Load achievements + level (no FK between user_achievements.achievement_key
      // and achievements.key, so do two queries and merge by key)
      const [{ data: ua }, { data: lv }, { data: defs }] = await Promise.all([
        (supabase as any)
          .from("user_achievements")
          .select("achievement_key, unlocked_at")
          .eq("user_id", userId)
          .order("unlocked_at", { ascending: false })
          .limit(50),
        (supabase as any).from("user_levels").select("level,xp").eq("user_id", userId).maybeSingle(),
        (supabase as any).from("achievements").select("key,name,icon,xp_reward"),
      ]);
      if (!cancel) {
        const defMap = new Map<string, { name: string; icon: string | null; xp_reward: number | null }>();
        ((defs ?? []) as any[]).forEach((d) =>
          defMap.set(d.key, { name: d.name, icon: d.icon, xp_reward: d.xp_reward }),
        );
        const list = ((ua ?? []) as any[]).map((r) => {
          const def = defMap.get(r.achievement_key);
          return {
            key: r.achievement_key as string,
            name: def?.name ?? r.achievement_key,
            icon: def?.icon ?? null,
            xp_reward: def?.xp_reward ?? null,
            unlocked_at: r.unlocked_at as string,
          };
        });
        setAchievements(list);
        setLevel(lv ? { level: (lv as any).level ?? 1, xp: (lv as any).xp ?? 0 } : null);
      }

      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [userId, user?.id]);

  useEffect(() => {
    if (!profile?.roblox_user_id) return;
    let cancel = false;
    setPresenceLoading(true);
    fetchPresence({ data: { userId: Number(profile.roblox_user_id) } })
      .then((p) => {
        if (!cancel) setPresence(p);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setPresenceLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [profile?.roblox_user_id, fetchPresence]);

  const displayName = profile?.chat_nickname || profile?.display_name || "User";
  const handle = profileHandle(profile?.username);
  const visibleBadgeIds = useMemo(
    () =>
      mergeProfileBadgeIds([
        ...roleProfileBadgeIds(roles),
        ...normalizeProfileBadgeIds(profile?.profile_badges),
      ]),
    [profile?.profile_badges, roles],
  );

  async function addFriend() {
    const { error } = await (supabase as any).rpc("send_friend_request", { _target: userId });
    if (error) return toast.error(error.message);
    toast.success("Friend request sent");
    setFriend((f) => ({ ...f, status: "pending_out" }));
  }
  async function respond(accept: boolean) {
    if (!friend.requestId) return;
    const { error } = await (supabase as any).rpc("respond_friend_request", {
      _id: friend.requestId,
      _accept: accept,
    });
    if (error) return toast.error(error.message);
    setFriend((f) => ({ ...f, status: accept ? "friends" : "none" }));
    toast.success(accept ? "Friend added" : "Request declined");
  }
  async function unfriend() {
    const { error } = await (supabase as any).rpc("remove_friend", { _other: userId });
    if (error) return toast.error(error.message);
    setFriend({ status: "none", requestId: null });
    toast.success("Friend removed");
  }
  async function toggleFollow() {
    if (!user || followBusy) return;
    setFollowBusy(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1));
    const { error } = await (supabase as any).rpc(wasFollowing ? "unfollow_user" : "follow_user", { _target: userId });
    setFollowBusy(false);
    if (error) {
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
      return toast.error(error.message);
    }
    toast.success(wasFollowing ? "Unfollowed" : "Following");
  }
  async function submitReport() {
    const reason = reportReason.trim();
    if (!reason) return toast.error("Please describe what's wrong");
    const { error } = await (supabase as any).rpc("report_user", { _target: userId, _reason: reason, _context: null });
    if (error) return toast.error(error.message);
    toast.success("Report sent to moderators. Thank you.");
    setReporting(false);
    setReportReason("");
  }

  const presenceLabel = useMemo(() => {
    const p = presence?.presence;
    if (!p?.type || p.type === "offline" || p.type === "invisible") return "Offline";
    if (p.type === "online") return "Online on Roblox";
    if (p.type === "in-game") return `Playing ${p.lastLocation ?? "a game"}`;
    if (p.type === "in-studio") return `Building ${p.lastLocation ?? "a project"} in Studio`;
    return p.lastLocation ?? "Online";
  }, [presence]);

  const presenceColor =
    presence?.presence.type === "in-game"
      ? "bg-emerald-400"
      : presence?.presence.type === "in-studio"
        ? "bg-indigo-400"
        : presence?.presence.type === "online"
          ? "bg-sky-400"
          : "bg-zinc-500";

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col overflow-hidden border border-border/70 bg-surface-elevated/98 backdrop-blur-xl"
      style={cardChromeStyle(profile?.profile_card_color)}
    >
      <ProfileCardEffect effect={profile?.profile_card_effect} color={profile?.profile_card_color} />
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-bold">Profile</h2>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !profile ? (
          <div className="p-4 text-sm text-muted-foreground">User not found.</div>
        ) : profile.private_profile && !isSelf && friend.status !== "friends" ? (
          <>
            <div className="relative">
              <div className="h-24 w-full bg-gradient-to-br from-primary/30 via-primary/15 to-transparent" />
              <div className="absolute -bottom-8 left-3">
                <div className="grid h-16 w-16 place-items-center rounded-full border-4 border-surface-elevated bg-surface">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">{displayName.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-3 px-3 pb-3 pt-10">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold">{displayName}</h3>
                <RoleBadges roles={roles} size="sm" />
              </div>
              {handle ? <p className="text-xs font-semibold text-primary-glow/90">{handle}</p> : null}
              <div className="rounded-xl border border-border bg-background/40 p-4 text-center space-y-2">
                <div className="text-2xl">🔒</div>
                <p className="text-sm font-semibold">This profile is private</p>
                <p className="text-xs text-muted-foreground">Only friends can see {displayName}'s full profile, achievements, and Roblox info.</p>
                {friend.status === "none" && (
                  <button onClick={addFriend} className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                    <UserPlus className="h-3.5 w-3.5" /> Add friend
                  </button>
                )}
                {friend.status === "pending_out" && (
                  <p className="text-[11px] text-muted-foreground">Friend request sent</p>
                )}
                {friend.status === "pending_in" && (
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => respond(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                      <UserCheck className="h-3.5 w-3.5" /> Accept
                    </button>
                    <button onClick={() => respond(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-elevated">
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Banner + avatar */}
            <div className="relative">
              <div
                className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-primary/30 via-primary/15 to-transparent"
                style={
                  profile.banner_url
                    ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : profile.profile_accent
                      ? { background: `linear-gradient(135deg, ${profile.profile_accent}55, ${profile.profile_accent}11 60%, transparent)` }
                      : undefined
                }
              >
                {!profile.banner_url && <ProfileBackground id={profile.profile_background ?? "none"} customUrl={(profile as any).custom_background_url ?? null} />}
                <ProfileEffect effect={profile.profile_effect} accent={profile.profile_accent} />
              </div>
              <div className="absolute -bottom-8 left-3">
                <div className="relative">
                  <AvatarDecoration id={profile.profile_decoration} size={70}>
                    <PfpRing effect={profile.pfp_effect ?? "none"} size={64}>
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">{displayName.slice(0, 1).toUpperCase()}</span>
                      )}
                    </PfpRing>
                  </AvatarDecoration>
                  {(() => {
                    const pr = presenceFromProfile({
                      presence_enabled: profile.presence_enabled,
                      presence_status: profile.presence_status,
                      last_seen_at: profile.last_seen_at,
                    });
                    return (
                      <span
                        title={pr.label}
                        className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-surface-elevated ${pr.dot}`}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="space-y-3 px-3 pb-3 pt-10">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold" style={profile.profile_accent ? { color: profile.profile_accent, textShadow: `0 0 14px ${profile.profile_accent}66` } : undefined}>{displayName}</h3>
                  {profile.pronouns && <span className="text-xs text-muted-foreground">· {profile.pronouns}</span>}
                  {profile.chat_nickname && profile.display_name && (
                    <span className="text-xs text-muted-foreground">aka {profile.display_name}</span>
                  )}
                  <RoleBadges roles={roles} size="sm" />
                </div>
                {handle ? <p className="mt-0.5 text-xs font-semibold text-primary-glow/90">{handle}</p> : null}
                {profile.status_message && (
                  <p className="mt-0.5 text-xs text-foreground/80 italic">
                    <MarkdownText text={profile.status_message} />
                  </p>
                )}
                {visibleBadgeIds.length > 0 && (
                  <ProfileBadgeRow ids={visibleBadgeIds} size={24} className="mt-2" />
                )}

                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span><span className="font-semibold text-foreground">{followerCount}</span> follower{followerCount === 1 ? "" : "s"}</span>
                  {level && (
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="h-3 w-3 text-amber-400" />
                      <span className="font-semibold text-foreground">Lv {level.level}</span>
                      <span className="text-muted-foreground">· {level.xp.toLocaleString()} XP</span>
                    </span>
                  )}
                  <span><span className="font-semibold text-foreground">{achievements.length}</span> achievement{achievements.length === 1 ? "" : "s"}</span>
                </div>
                {profile.bio && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <MarkdownText text={profile.bio} />
                  </p>
                )}
              </div>

              {!isSelf && (
                <div className="flex flex-wrap gap-1.5">
                  {friend.status === "none" && (
                    <button onClick={addFriend} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                      <UserPlus className="h-3.5 w-3.5" /> Add friend
                    </button>
                  )}
                  {friend.status === "pending_out" && (
                    <button disabled className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                      <UserCheck className="h-3.5 w-3.5" /> Request sent
                    </button>
                  )}
                  {friend.status === "pending_in" && (
                    <>
                      <button onClick={() => respond(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                        <UserCheck className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button onClick={() => respond(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-elevated">
                        Decline
                      </button>
                    </>
                  )}
                  {friend.status === "friends" && (
                    <>
                      <button onClick={() => onOpenDm?.(userId)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                        <MessageCircle className="h-3.5 w-3.5" /> Message
                      </button>
                      <button onClick={unfriend} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-destructive/10 hover:text-destructive">
                        <UserMinus className="h-3.5 w-3.5" /> Unfriend
                      </button>
                    </>
                  )}
                  <button
                    onClick={toggleFollow}
                    disabled={followBusy}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${isFollowing ? "border border-border bg-surface hover:bg-surface-elevated" : "bg-pink-600 text-white hover:opacity-90"}`}
                  >
                    {isFollowing ? <><HeartOff className="h-3.5 w-3.5" /> Unfollow</> : <><Heart className="h-3.5 w-3.5" /> Follow</>}
                  </button>
                  <button
                    onClick={() => setReporting(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Flag className="h-3.5 w-3.5" /> Report
                  </button>
                </div>
              )}

              {reporting && !isSelf && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <div className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5" /> Report {displayName}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Tell us what's wrong. Moderators will review.</p>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value.slice(0, 200))}
                    placeholder="Spam, harassment, inappropriate content…"
                    rows={3}
                    className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => { setReporting(false); setReportReason(""); }} className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] hover:bg-surface-elevated">Cancel</button>
                    <button onClick={submitReport} className="rounded-md bg-destructive px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90">Send report</button>
                  </div>
                </div>
              )}

              {/* Roblox card */}
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Crown className="h-3 w-3 text-amber-400" /> Roblox
                </div>
                {!profile.roblox_user_id ? (
                  <p className="text-xs text-muted-foreground">No Roblox account linked.</p>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={presence?.headshotUrl ?? profile.roblox_avatar_url ?? ""}
                        alt=""
                        className="h-12 w-12 rounded-lg border border-border bg-surface object-cover"
                      />
                      <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-surface-elevated ${presenceColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">
                          {presence?.displayName ?? profile.roblox_username}
                        </span>
                        <a
                          href={`https://www.roblox.com/users/${profile.roblox_user_id}/profile`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-[11px] text-muted-foreground">@{profile.roblox_username}</div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                        {presenceLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : presence?.presence.type === "in-game" ? (
                          <Gamepad2 className="h-3 w-3 text-emerald-400" />
                        ) : presence?.presence.type === "in-studio" ? (
                          <Hammer className="h-3 w-3 text-indigo-400" />
                        ) : null}
                        <span className={presence?.presence.type === "offline" ? "text-muted-foreground" : "text-foreground"}>
                          {presenceLoading ? "Checking…" : presenceLabel}
                        </span>
                      </div>
                      {presence?.thumbnail.gameThumbnailUrl && (
                        <a
                          href={presence.presence.rootPlaceId ? `https://www.roblox.com/games/${presence.presence.rootPlaceId}` : "#"}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-2 block overflow-hidden rounded-md border border-border"
                        >
                          <img src={presence.thumbnail.gameThumbnailUrl} alt="" className="h-20 w-full object-cover" />
                        </a>
                      )}
                      {presence?.error === "presence_unavailable" && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Live presence requires the site owner to add a Roblox cookie. Showing static profile only.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Achievements */}
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="h-3 w-3 text-amber-400" /> Achievements ({achievements.length})
                  </span>
                </div>
                {achievements.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No achievements unlocked yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {achievements.slice(0, 12).map((a) => {
                      const Ico = (a.icon && (Icons as any)[a.icon]) || Award;
                      return (
                        <div
                          key={a.key}
                          title={`${a.name}${a.xp_reward ? ` · +${a.xp_reward} XP` : ""} · ${new Date(a.unlocked_at).toLocaleDateString()}`}
                          className="flex items-center gap-1.5 rounded-md border border-border/60 bg-surface/60 px-2 py-1.5"
                        >
                          <Ico className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{a.name}</span>
                        </div>
                      );
                    })}

                    {achievements.length > 12 && (
                      <div className="col-span-2 text-center text-[10px] text-muted-foreground">
                        +{achievements.length - 12} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
