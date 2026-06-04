// Full profile customization panel: identity, background, layout, ring effect,
// accent + animated effect, privacy & presence. Saves everything via a single
// authenticated server function so it persists to the database.
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createRobloxStyleAvatar } from "@/lib/generated-avatar";
import { useServerFn } from "@tanstack/react-start";
import { updateProfileCustomization } from "@/lib/profile-customization.functions";
import { moderateProfileBackground, setCustomBackground } from "@/lib/profile-media.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PROFILE_BACKGROUNDS,
  ProfileBackground,
  type ProfileBackgroundId,
} from "./profile/ProfileBackground";
import { PFP_EFFECTS, PfpRing, type PfpEffectId } from "./profile/PfpRing";
import { ProfileEffect, PROFILE_EFFECTS, type ProfileEffectId } from "./chat/ProfileEffect";
import {
  Sparkles,
  Lock,
  Eye,
  Activity,
  Save,
  Loader2,
  Wand2,
  ImagePlus,
  LayoutPanelTop,
  CircleUserRound,
  Upload,
  Trash2,
  Film,
  Award,
  Palette,
  ShieldCheck,
} from "lucide-react";
import {
  PROFILE_BADGES,
  ProfileBadgeIcon,
  ProfileBadgeRow,
  getBadgeDef,
} from "./profile/ProfileBadges";
import { PROFILE_DECORATIONS, AvatarDecoration } from "./profile/ProfileDecoration";
import { ProfileMenuPreview } from "./profile/ProfileMenuPreview";
import {
  PROFILE_CARD_EFFECTS,
  ProfileCardChrome,
  type ProfileCardEffectId,
} from "./profile/ProfileCardEffects";
import {
  roleProfileBadgeIds,
  selectableProfileBadgeIds,
  SELECTABLE_PROFILE_BADGE_IDS,
  normalizeProfileBadgeIds,
  type ProfileBadgeId,
} from "@/lib/profile-badges";
import { normalizeProfileUsername, profileHandle } from "@/lib/profile-username";
import { canUseReservedCosmetics, isReservedProfileDecoration } from "@/lib/profile-cosmetics";

const ACCENTS = [
  "#7c3cff",
  "#00d9ff",
  "#ff4da6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a78bfa",
  "#38bdf8",
];
const CARD_COLORS = [
  "#0f172a",
  "#102a2a",
  "#20133a",
  "#2a1327",
  "#2b1d0e",
  "#111827",
  "#064e3b",
  "#1e1b4b",
];
const LAYOUTS: Array<{
  id: "classic" | "card" | "cinematic" | "compact";
  label: string;
  hint: string;
}> = [
  { id: "classic", label: "Classic", hint: "Banner + avatar overlap" },
  { id: "card", label: "Card", hint: "Centered floating card" },
  { id: "cinematic", label: "Cinematic", hint: "Tall hero banner" },
  { id: "compact", label: "Compact", hint: "Minimal one-row" },
];
const STATUSES = [
  {
    id: "online",
    label: "Online",
    color: "bg-emerald-500",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.7)]",
    icon: "●",
  },
  {
    id: "idle",
    label: "Idle",
    color: "bg-amber-400",
    glow: "shadow-[0_0_10px_rgba(251,191,36,0.6)]",
    icon: "🌙",
  },
  {
    id: "dnd",
    label: "Do not disturb",
    color: "bg-rose-500",
    glow: "shadow-[0_0_12px_rgba(244,63,94,0.7)]",
    icon: "⛔",
  },
  { id: "invisible", label: "Invisible", color: "bg-zinc-500", glow: "", icon: "○" },
] as const;

export function ProfileCustomizationCard() {
  const { user, profile, refresh, roles } = useAuth();
  const p = (profile ?? {}) as any;
  const save = useServerFn(updateProfileCustomization);

  const [state, setState] = useState({
    display_name: p.display_name ?? "",
    username: p.username ?? "",
    bio: p.bio ?? "",
    pronouns: p.pronouns ?? "",
    location: p.location ?? "",
    status_message: p.status_message ?? "",
    profile_accent: (p.profile_accent ?? "#7c3cff") as string,
    profile_card_color: (p.profile_card_color ?? "#0f172a") as string,
    profile_card_effect: (p.profile_card_effect ?? "soft_glow") as ProfileCardEffectId,
    profile_effect: (p.profile_effect ?? "none") as ProfileEffectId,
    profile_background: (p.profile_background ?? "none") as ProfileBackgroundId,
    custom_background_url: (p.custom_background_url ?? null) as string | null,
    profile_layout: (p.profile_layout ?? "classic") as "classic" | "card" | "cinematic" | "compact",
    pfp_effect: (p.pfp_effect ?? "none") as PfpEffectId,
    private_profile: !!p.private_profile,
    hide_email: p.hide_email !== false,
    presence_enabled: p.presence_enabled !== false,
    show_activity: p.show_activity !== false,
    presence_status: (p.presence_status ?? "online") as "online" | "idle" | "dnd" | "invisible",
    profile_badges: selectableProfileBadgeIds(p.profile_badges) as string[],
    profile_decoration: (p.profile_decoration ?? "none") as string,
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [subTab, setSubTab] = useState<"identity" | "style" | "cosmetics" | "privacy">("identity");
  const canUseReserved = canUseReservedCosmetics(roles);

  // Re-sync when profile reloads (e.g., after another device pushes changes).
  useEffect(() => {
    if (!profile) return;
    if (dirty) return;
    const q = profile as any;
    setState((s) => ({
      ...s,
      display_name: q.display_name ?? s.display_name,
      username: q.username ?? s.username,
      bio: q.bio ?? s.bio,
      pronouns: q.pronouns ?? s.pronouns ?? "",
      location: q.location ?? s.location ?? "",
      status_message: q.status_message ?? s.status_message ?? "",
      profile_accent: q.profile_accent ?? s.profile_accent,
      profile_card_color: q.profile_card_color ?? s.profile_card_color,
      profile_card_effect: q.profile_card_effect ?? s.profile_card_effect,
      profile_effect: q.profile_effect ?? s.profile_effect,
      profile_background: q.profile_background ?? s.profile_background,
      custom_background_url: q.custom_background_url ?? s.custom_background_url ?? null,
      profile_layout: q.profile_layout ?? s.profile_layout,
      pfp_effect: q.pfp_effect ?? s.pfp_effect,
      private_profile: !!q.private_profile,
      hide_email: q.hide_email !== false,
      presence_enabled: q.presence_enabled !== false,
      show_activity: q.show_activity !== false,
      presence_status: q.presence_status ?? s.presence_status,
      profile_badges: selectableProfileBadgeIds(q.profile_badges),
      profile_decoration: q.profile_decoration ?? s.profile_decoration,
    }));
  }, [dirty, profile]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const initial = useMemo(
    () => (state.display_name || "U").slice(0, 1).toUpperCase(),
    [state.display_name],
  );
  const earnedRoleBadgeIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...roleProfileBadgeIds(roles),
          ...normalizeProfileBadgeIds((profile as any)?.profile_badges).filter(
            (id) => !state.profile_badges.includes(id),
          ),
        ]),
      ),
    [roles, profile, state.profile_badges],
  );
  const previewBadgeIds = useMemo(
    () => Array.from(new Set([...earnedRoleBadgeIds, ...state.profile_badges])) as ProfileBadgeId[],
    [earnedRoleBadgeIds, state.profile_badges],
  );
  const selectableBadgeLimit = Math.max(0, 12 - earnedRoleBadgeIds.length);
  const previewFallbackAvatar = useMemo(
    () => createRobloxStyleAvatar(user?.id || user?.email),
    [user?.id, user?.email],
  );
  const previewBadgeNames = useMemo(
    () =>
      previewBadgeIds
        .map((id) => getBadgeDef(id)?.label)
        .filter(Boolean)
        .join(", "),
    [previewBadgeIds],
  );
  const previewProfile = useMemo(
    () => ({
      ...(profile as any),
      display_name:
        state.display_name ||
        (profile as any)?.display_name ||
        user?.email?.split("@")[0] ||
        "Builder",
      username:
        state.username ||
        (profile as any)?.username ||
        normalizeProfileUsername(state.display_name || user?.email?.split("@")[0] || ""),
      email: user?.email ?? (profile as any)?.email ?? null,
      hide_email: state.hide_email,
      profile_accent: state.profile_accent,
      profile_card_color: state.profile_card_color,
      profile_card_effect: state.profile_card_effect,
      profile_effect: state.profile_effect,
      profile_background: state.profile_background,
      custom_background_url: state.custom_background_url,
      pfp_effect: state.pfp_effect,
      profile_decoration: state.profile_decoration,
      profile_badges: previewBadgeIds,
    }),
    [profile, previewBadgeIds, state, user?.email],
  );

  async function onSave() {
    if (!user) return;
    setSaving(true);
    try {
      if (isReservedProfileDecoration(state.profile_decoration) && !canUseReserved) {
        throw new Error("That profile decoration is reserved for owners/admins.");
      }
      const result = await save({
        data: {
          display_name: state.display_name?.trim() || null,
          username: normalizeProfileUsername(state.username || state.display_name || user.email),
          bio: state.bio?.trim() || null,
          pronouns: state.pronouns?.trim() || null,
          location: state.location?.trim() || null,
          status_message: state.status_message?.trim() || null,
          profile_accent: state.profile_accent,
          profile_card_color: state.profile_card_color,
          profile_card_effect: state.profile_card_effect,
          profile_effect: state.profile_effect,
          profile_background: state.profile_background,
          custom_background_url: state.custom_background_url,
          profile_layout: state.profile_layout,
          pfp_effect: state.pfp_effect,
          private_profile: state.private_profile,
          hide_email: state.hide_email,
          presence_enabled: state.presence_enabled,
          show_activity: state.show_activity,
          presence_status: state.presence_status,
          profile_badges: state.profile_badges,
          profile_decoration: state.profile_decoration,
        },
      });
      const saved = (result as any)?.profile;
      if (saved) {
        setState((s) => ({
          ...s,
          display_name: saved.display_name ?? s.display_name,
          username: saved.username ?? s.username,
          bio: saved.bio ?? s.bio,
          pronouns: saved.pronouns ?? "",
          location: saved.location ?? "",
          status_message: saved.status_message ?? "",
          profile_accent: saved.profile_accent ?? s.profile_accent,
          profile_card_color: saved.profile_card_color ?? s.profile_card_color,
          profile_card_effect: saved.profile_card_effect ?? s.profile_card_effect,
          profile_effect: saved.profile_effect ?? s.profile_effect,
          profile_background: saved.profile_background ?? s.profile_background,
          custom_background_url: saved.custom_background_url ?? null,
          profile_layout: saved.profile_layout ?? s.profile_layout,
          pfp_effect: saved.pfp_effect ?? s.pfp_effect,
          private_profile: !!saved.private_profile,
          hide_email: saved.hide_email !== false,
          presence_enabled: saved.presence_enabled !== false,
          show_activity: saved.show_activity !== false,
          presence_status: saved.presence_status ?? s.presence_status,
          profile_badges: selectableProfileBadgeIds(saved.profile_badges),
          profile_decoration: saved.profile_decoration ?? s.profile_decoration,
        }));
      }
      await refresh();
      setDirty(false);
      const warning = (result as any)?.warning;
      if (warning) toast.warning(warning);
      else toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save profile");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof typeof state>(k: K, v: (typeof state)[K]) {
    setDirty(true);
    setState((s) => ({ ...s, [k]: v }));
  }

  return (
    <section className="rounded-2xl border border-border/50 bg-surface/20 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Customize Profile
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Make your profile yours. Everything saves to your account and shows up on all devices.
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save profile
        </button>
      </div>

      {/* LIVE PREVIEW */}
      <ProfileCardChrome
        color={state.profile_card_color}
        effect={state.profile_card_effect}
        className="rounded-2xl"
      >
        <div className="relative h-40 w-full overflow-hidden">
          <ProfileBackground
            id={state.profile_background}
            customUrl={state.custom_background_url}
          />
          <ProfileEffect effect={state.profile_effect} accent={state.profile_accent} />
          {state.profile_background === "none" && (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${state.profile_accent}55, ${state.profile_accent}11 60%, transparent)`,
              }}
            />
          )}
        </div>
        <div className="flex items-end gap-3 px-4 -mt-8 pb-4">
          <AvatarDecoration id={state.profile_decoration} size={78}>
            <PfpRing effect={state.pfp_effect} size={72}>
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-muted-foreground">{initial}</span>
              )}
            </PfpRing>
          </AvatarDecoration>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3
                className="text-lg font-bold truncate"
                style={{
                  color: state.profile_accent,
                  textShadow: `0 0 14px ${state.profile_accent}66`,
                }}
              >
                {state.display_name || "Your name"}
              </h3>
              {state.pronouns && (
                <span className="text-xs text-muted-foreground">· {state.pronouns}</span>
              )}
              <span
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium`}
                title={STATUSES.find((s) => s.id === state.presence_status)?.label}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${STATUSES.find((s) => s.id === state.presence_status)?.color}`}
                />
                {STATUSES.find((s) => s.id === state.presence_status)?.label}
              </span>
            </div>
            {state.status_message && (
              <p className="text-xs text-muted-foreground truncate">{state.status_message}</p>
            )}
            {state.bio && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{state.bio}</p>
            )}
            {previewBadgeIds.length > 0 && (
              <ProfileBadgeRow ids={previewBadgeIds} size={22} className="mt-2" />
            )}
          </div>
        </div>
      </ProfileCardChrome>

      <Section icon={<CircleUserRound className="h-4 w-4" />} title="Profile menu preview">
        <div className="max-w-sm">
          <ProfileMenuPreview
            profile={previewProfile}
            roles={roles}
            avatarUrl={p.avatar_url}
            fallbackAvatar={previewFallbackAvatar}
            bannerUrl={p.banner_url}
            badgeIds={previewBadgeIds}
            badgeNames={previewBadgeNames}
          />
        </div>
      </Section>

      {/* SUB TABS SELECTION */}
      <div className="flex border-b border-border/30 gap-1 sm:gap-2 overflow-x-auto scrollbar-none pb-px">
        <button
          type="button"
          onClick={() => setSubTab("identity")}
          className={`inline-flex items-center gap-1.5 pb-3 pt-1 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            subTab === "identity"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CircleUserRound className="h-4 w-4" />
          Identity
        </button>
        <button
          type="button"
          onClick={() => setSubTab("style")}
          className={`inline-flex items-center gap-1.5 pb-3 pt-1 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            subTab === "style"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette className="h-4 w-4" />
          Theme & Colors
        </button>
        <button
          type="button"
          onClick={() => setSubTab("cosmetics")}
          className={`inline-flex items-center gap-1.5 pb-3 pt-1 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            subTab === "cosmetics"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Cosmetics
        </button>
        <button
          type="button"
          onClick={() => setSubTab("privacy")}
          className={`inline-flex items-center gap-1.5 pb-3 pt-1 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            subTab === "privacy"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-4 w-4" />
          Privacy & Status
        </button>
      </div>

      {/* TAB CONTENT */}
      {subTab === "identity" && (
        <div className="grid gap-3 sm:grid-cols-2 animate-in fade-in duration-200">
          <Field label="Display name">
            <input
              value={state.display_name}
              onChange={(e) => set("display_name", e.target.value.slice(0, 64))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="What others see"
            />
          </Field>
          <Field label="Username">
            <div className="flex rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary/35">
              <span className="grid place-items-center border-r border-border px-3 text-sm font-bold text-muted-foreground">
                @
              </span>
              <input
                value={state.username}
                onChange={(e) => set("username", normalizeProfileUsername(e.target.value))}
                className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2 text-sm outline-none"
                placeholder="unique_username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              Unique handle: {profileHandle(state.username) || "pick one"}. Display names can match,
              usernames cannot.
            </div>
          </Field>
          <Field label="Pronouns">
            <input
              value={state.pronouns}
              onChange={(e) => set("pronouns", e.target.value.slice(0, 32))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="they/them, she/her, ..."
            />
          </Field>
          <Field label="Location">
            <input
              value={state.location}
              onChange={(e) => set("location", e.target.value.slice(0, 64))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Earth"
            />
          </Field>
          <Field label="Status">
            <input
              value={state.status_message}
              onChange={(e) => set("status_message", e.target.value.slice(0, 100))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Working on something cool..."
            />
          </Field>
          <Field label="Bio" className="sm:col-span-2">
            <textarea
              value={state.bio}
              onChange={(e) => set("bio", e.target.value.slice(0, 500))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[72px] resize-y"
              placeholder="Tell people about yourself"
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {state.bio?.length ?? 0} / 500
            </div>
          </Field>
        </div>
      )}

      {subTab === "style" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Section icon={<Palette className="h-4 w-4" />} title="Profile card color">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground mr-1">Card</span>
              {CARD_COLORS.map((c) => {
                const active = state.profile_card_color?.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("profile_card_color", c)}
                    className={`h-8 w-8 rounded-lg border border-white/10 ring-offset-2 ring-offset-background transition ${
                      active ? "ring-2 ring-foreground" : "hover:scale-105"
                    }`}
                    style={{ background: `linear-gradient(135deg, ${c}, ${state.profile_accent})` }}
                    title={c}
                  />
                );
              })}
              <input
                type="text"
                value={state.profile_card_color}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set("profile_card_color", v);
                }}
                onBlur={(e) => {
                  if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                    set("profile_card_color", "#0f172a");
                }}
                className="ml-1 w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                placeholder="#0f172a"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {PROFILE_CARD_EFFECTS.map((e) => {
                const active = state.profile_card_effect === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => set("profile_card_effect", e.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section icon={<Wand2 className="h-4 w-4" />} title="Profile accent color">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground mr-1">Accent</span>
              {ACCENTS.map((c) => {
                const active = state.profile_accent?.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("profile_accent", c)}
                    className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition ${
                      active ? "ring-2 ring-foreground" : "hover:scale-110"
                    }`}
                    style={{ background: c }}
                    title={c}
                  />
                );
              })}
              <input
                type="text"
                value={state.profile_accent}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set("profile_accent", v);
                }}
                onBlur={(e) => {
                  if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) set("profile_accent", "#7c3cff");
                }}
                className="ml-1 w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                placeholder="#7c3cff"
              />
            </div>
          </Section>

          <Section icon={<LayoutPanelTop className="h-4 w-4" />} title="Layout template">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LAYOUTS.map((l) => {
                const active = state.profile_layout === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => set("profile_layout", l.id)}
                    className={`rounded-lg border px-3 py-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border/60 bg-background/40 hover:border-border"
                    }`}
                  >
                    <div className="text-sm font-semibold">{l.label}</div>
                    <div className="text-[10px] text-muted-foreground">{l.hint}</div>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>
      )}

      {subTab === "cosmetics" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Section icon={<ImagePlus className="h-4 w-4" />} title="Background theme">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
              {PROFILE_BACKGROUNDS.map((b) => {
                const active = state.profile_background === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => set("profile_background", b.id)}
                    className={`group relative h-16 overflow-hidden rounded-lg border transition ${
                      active
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border/60 hover:border-border"
                    }`}
                    title={b.label}
                  >
                    <ProfileBackground id={b.id} />
                    {b.id === "none" && (
                      <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">
                        None
                      </div>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-center text-[10px] font-medium text-white">
                      {b.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <CustomBackgroundUploader
              userId={user?.id ?? null}
              url={state.custom_background_url}
              active={state.profile_background === "custom"}
              onPick={() => {
                if (state.custom_background_url) set("profile_background", "custom");
              }}
              onChange={(url) => {
                setDirty(true);
                setState((s) => ({
                  ...s,
                  custom_background_url: url,
                  profile_background: url
                    ? "custom"
                    : s.profile_background === "custom"
                      ? "none"
                      : s.profile_background,
                }));
                refresh();
              }}
            />
          </Section>

          <Section icon={<Wand2 className="h-4 w-4" />} title="Animated banner effect">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {PROFILE_EFFECTS.map((e) => {
                const active = state.profile_effect === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => set("profile_effect", e.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section icon={<CircleUserRound className="h-4 w-4" />} title="Avatar ring effect">
            <div className="flex flex-wrap items-center gap-3">
              {PFP_EFFECTS.map((e) => {
                const active = state.pfp_effect === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => set("pfp_effect", e.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 transition ${
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border/60 bg-background/40 hover:border-border"
                    }`}
                    title={e.label}
                  >
                    <PfpRing effect={e.id} size={40}>
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">{initial}</span>
                      )}
                    </PfpRing>
                    <span className="text-[10px] text-muted-foreground">{e.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section icon={<Sparkles className="h-4 w-4" />} title="Avatar decoration">
            <p className="text-[11px] text-muted-foreground -mt-1 mb-2">
              Add premium animated overlays around your avatar. Animated and Pro items move on your
              public profile too.
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {PROFILE_DECORATIONS.map((d) => {
                const active = state.profile_decoration === d.id;
                const locked = isReservedProfileDecoration(d.id) && !canUseReserved;
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={locked}
                    onClick={() => set("profile_decoration", d.id)}
                    className={`relative flex flex-col items-center justify-end gap-1 rounded-xl border px-2 pb-2 pt-5 transition ${
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : locked
                          ? "cursor-not-allowed border-border/40 bg-background/20 opacity-55"
                          : "border-border/60 bg-background/40 hover:border-border"
                    }`}
                    title={locked ? `${d.label} — owner/admin only` : d.label}
                  >
                    {locked ? (
                      <span className="absolute right-1.5 top-1.5 rounded-full border border-border bg-background/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                        Locked
                      </span>
                    ) : (
                      (d.premium || d.animated) && (
                        <span className="absolute right-1.5 top-1.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-glow">
                          {d.animated ? "Anim" : "Pro"}
                        </span>
                      )
                    )}
                    <div className="h-12 grid place-items-center">
                      <AvatarDecoration id={d.id} size={36}>
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 grid place-items-center text-[10px] text-muted-foreground">
                          {initial}
                        </div>
                      </AvatarDecoration>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            icon={<Award className="h-4 w-4" />}
            title={`Display badges (${previewBadgeIds.length}/12)`}
          >
            <p className="text-[11px] text-muted-foreground -mt-1 mb-2">
              Pick display badges for your profile. Special badges unlock from onboarding,
              generation activity, 3D models, Discord, invites, milestones, and account roles.
            </p>
            {earnedRoleBadgeIds.length > 0 && (
              <div className="mb-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary-glow">
                  Earned badges
                </div>
                <ProfileBadgeRow ids={earnedRoleBadgeIds} size={28} />
              </div>
            )}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-9">
              {PROFILE_BADGES.filter((b) => SELECTABLE_PROFILE_BADGE_IDS.includes(b.id)).map(
                (b) => {
                  const active = state.profile_badges.includes(b.id);
                  const atLimit = !active && state.profile_badges.length >= selectableBadgeLimit;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={atLimit}
                      onClick={() => {
                        setDirty(true);
                        setState((s) => ({
                          ...s,
                          profile_badges: active
                            ? s.profile_badges.filter((x) => x !== b.id)
                            : [...s.profile_badges, b.id],
                        }));
                      }}
                      className={`group relative flex flex-col items-center gap-1.5 rounded-xl border px-1 pt-3 pb-2 transition disabled:opacity-40 ${
                        active
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border/60 bg-background/40 hover:border-border hover:bg-background/70"
                      }`}
                      title={`${b.label} — ${b.description}`}
                    >
                      <ProfileBadgeIcon id={b.id} size={30} />
                      <span className="text-[10px] font-medium leading-tight text-center text-foreground/90 line-clamp-1 w-full px-0.5">
                        {b.label}
                      </span>
                      {active && (
                        <span className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>
          </Section>
        </div>
      )}

      {subTab === "privacy" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Section icon={<Lock className="h-4 w-4" />} title="Privacy options">
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow
                checked={state.private_profile}
                onChange={(v) => set("private_profile", v)}
                title="Private profile"
                description="Only friends can see your full profile, achievements, and Roblox info."
              />
              <ToggleRow
                checked={state.hide_email}
                onChange={(v) => set("hide_email", v)}
                title="Hide email"
                description="Don't show your email address on your public profile."
              />
              <ToggleRow
                checked={state.presence_enabled}
                onChange={(v) => set("presence_enabled", v)}
                title="Show online status"
                description="Let others see when you're online or were last active."
              />
              <ToggleRow
                checked={state.show_activity}
                onChange={(v) => set("show_activity", v)}
                title="Show activity"
                description="Display what you're working on (project, chat...)."
              />
            </div>
          </Section>

          <Section icon={<Activity className="h-4 w-4" />} title="Online status indicator">
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const active = state.presence_status === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!state.presence_enabled}
                    onClick={() => set("presence_status", s.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-background/40 hover:border-border"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>
      )}
    </section>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition hover:border-border">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 h-5 w-5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              checked
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-muted/40 text-muted-foreground border border-border/60"
            }`}
          >
            {checked ? (
              <>
                <Eye className="h-3 w-3" /> On
              </>
            ) : (
              <>Off</>
            )}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ACCEPT = "image/png,image/jpeg,image/webp";

function CustomBackgroundUploader({
  userId,
  url,
  active,
  onPick,
  onChange,
}: {
  userId: string | null;
  url: string | null;
  active: boolean;
  onPick: () => void;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const saveUrl = useServerFn(setCustomBackground);
  const moderateBackground = useServerFn(moderateProfileBackground);

  function pathFromPublicUrl(u: string | null): string | null {
    if (!u) return null;
    const signedMatch = u.match(/\/storage\/v1\/object\/sign\/profile-media\/([^?]+)/);
    if (signedMatch?.[1]) return decodeURIComponent(signedMatch[1]);
    const publicMatch = u.match(/\/storage\/v1\/object\/public\/profile-media\/([^?]+)/);
    return publicMatch?.[1] ? decodeURIComponent(publicMatch[1]) : null;
  }

  function handleFile(file: File) {
    if (!userId) {
      toast.error("Sign in to upload");
      return;
    }
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File is too large (max 8MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPending({ file, preview: String(reader.result) });
    reader.onerror = () => toast.error("Could not preview that image.");
    reader.readAsDataURL(file);
  }

  async function savePending() {
    if (!userId || !pending) return;
    setBusy(true);
    try {
      await moderateBackground({ data: { dataUrl: pending.preview } });
      const file = pending.file;
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/bg-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("profile-media")
        .upload(path, file, { contentType: file.type, upsert: true, cacheControl: "31536000" });
      if (upErr) throw upErr;
      const { data, error: signErr } = await supabase.storage
        .from("profile-media")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signErr) throw signErr;
      const publicUrl = data.signedUrl;
      const previousPath = pathFromPublicUrl(url);
      await saveUrl({ data: { url: publicUrl, previousPath } });
      onChange(publicUrl);
      setPending(null);
      toast.success("Custom background checked and saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!url) return;
    setBusy(true);
    try {
      const previousPath = pathFromPublicUrl(url);
      await saveUrl({ data: { url: null, previousPath } });
      onChange(null);
      toast.success("Custom background removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-gradient-to-br from-primary/5 via-background/40 to-fuchsia-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">Custom profile background</div>
            <div className="text-[11px] text-muted-foreground">
              Upload PNG, JPG, or WEBP (max 8MB). Images are previewed and moderated before saving.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {url ? "Choose replacement" : "Choose image"}
          </button>
          {url && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      </div>

      {pending && (
        <div className="mt-3 overflow-hidden rounded-lg border border-primary/35 bg-primary/5">
          <img
            src={pending.preview}
            alt="Pending background preview"
            className="h-32 w-full object-cover"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 p-2">
            <span className="text-[11px] text-muted-foreground">
              Preview before save. Unsafe images are blocked.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={savePending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                Save checked image
              </button>
            </div>
          </div>
        </div>
      )}

      {url && (
        <button
          type="button"
          onClick={onPick}
          className={`group relative mt-3 block h-28 w-full overflow-hidden rounded-lg border transition ${
            active
              ? "border-primary ring-2 ring-primary/40"
              : "border-border/60 hover:border-border"
          }`}
          title="Use this background"
        >
          <img src={url} alt="Custom background" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
            <span>{active ? "Selected" : "Click to use"}</span>
            <span className="rounded bg-white/15 px-1.5 py-0.5">IMAGE</span>
          </div>
        </button>
      )}
    </div>
  );
}
