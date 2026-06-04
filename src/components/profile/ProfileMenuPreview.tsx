import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RoleBadges } from "@/components/RoleBadge";
import { ProfileBadgeRow } from "@/components/profile/ProfileBadges";
import {
  PROFILE_BACKGROUNDS,
  ProfileBackground,
  type ProfileBackgroundId,
} from "@/components/profile/ProfileBackground";
import { PFP_EFFECTS, PfpRing, type PfpEffectId } from "@/components/profile/PfpRing";
import {
  AvatarDecoration,
  PROFILE_DECORATIONS,
  type DecorationId,
} from "@/components/profile/ProfileDecoration";
import {
  ProfileEffect,
  PROFILE_EFFECTS,
  type ProfileEffectId,
} from "@/components/chat/ProfileEffect";
import {
  PROFILE_CARD_EFFECTS,
  ProfileCardEffect,
  cardChromeStyle,
  type ProfileCardEffectId,
} from "@/components/profile/ProfileCardEffects";
import type { ProfileBadgeId } from "@/lib/profile-badges";
import { profileHandle } from "@/lib/profile-username";

export type ProfileMenuSource = {
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
  hide_email?: boolean | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  profile_accent?: string | null;
  profile_background?: string | null;
  custom_background_url?: string | null;
  profile_effect?: string | null;
  profile_card_color?: string | null;
  profile_card_effect?: string | null;
  pfp_effect?: string | null;
  profile_decoration?: string | null;
};

type ProfileMenuEffects = {
  accent: string;
  background: ProfileBackgroundId;
  customBackgroundUrl: string | null;
  profileEffect: ProfileEffectId;
  cardColor: string;
  cardEffect: ProfileCardEffectId;
  pfpEffect: PfpEffectId;
  decoration: DecorationId;
};

const BACKGROUND_IDS = new Set(PROFILE_BACKGROUNDS.map((item) => item.id));
const PROFILE_EFFECT_IDS = new Set(PROFILE_EFFECTS.map((item) => item.id));
const CARD_EFFECT_IDS = new Set(PROFILE_CARD_EFFECTS.map((item) => item.id));
const PFP_EFFECT_IDS = new Set(PFP_EFFECTS.map((item) => item.id));
const DECORATION_IDS = new Set(PROFILE_DECORATIONS.map((item) => item.id));
const COMPACT_DECORATION_IDS = new Set([
  "halo",
  "neon_ring",
  "plasma_halo",
  "orbit",
  "glitch_frame",
]);

function safeEnum<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function safeHex(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function menuChromeStyle(cardColor: string) {
  return {
    ...cardChromeStyle(cardColor),
    background: `linear-gradient(180deg, ${cardColor}f5, ${cardColor}ee 34%, #02060cfb 100%)`,
  };
}

export function getProfileMenuEffects(profile?: ProfileMenuSource | null): ProfileMenuEffects {
  return {
    accent: safeHex(profile?.profile_accent, "#7c3cff"),
    background: safeEnum<ProfileBackgroundId>(profile?.profile_background, BACKGROUND_IDS, "none"),
    customBackgroundUrl:
      typeof profile?.custom_background_url === "string" ? profile.custom_background_url : null,
    profileEffect: safeEnum<ProfileEffectId>(profile?.profile_effect, PROFILE_EFFECT_IDS, "none"),
    cardColor: safeHex(profile?.profile_card_color, "#0f172a"),
    cardEffect: safeEnum<ProfileCardEffectId>(
      profile?.profile_card_effect,
      CARD_EFFECT_IDS,
      "soft_glow",
    ),
    pfpEffect: safeEnum<PfpEffectId>(profile?.pfp_effect, PFP_EFFECT_IDS, "none"),
    decoration: safeEnum<DecorationId>(profile?.profile_decoration, DECORATION_IDS, "none"),
  };
}

export function hasProfileMenuFlair(profile?: ProfileMenuSource | null) {
  const effects = getProfileMenuEffects(profile);
  return (
    effects.profileEffect !== "none" ||
    effects.cardEffect !== "none" ||
    effects.pfpEffect !== "none" ||
    effects.decoration !== "none" ||
    effects.background !== "none" ||
    !!profile?.banner_url
  );
}

export function ProfileMenuAvatar({
  src,
  fallback,
  profile,
  size,
  compact = false,
  animated,
  className = "",
}: {
  src?: string | null;
  fallback: string;
  profile?: ProfileMenuSource | null;
  size: number;
  compact?: boolean;
  animated?: boolean;
  className?: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(src || fallback);
  const effects = useMemo(() => getProfileMenuEffects(profile), [profile]);
  const renderAnimated = animated ?? !compact;

  useEffect(() => {
    setCurrentSrc(src || fallback);
  }, [src, fallback]);

  const decoration =
    compact && !COMPACT_DECORATION_IDS.has(effects.decoration) ? "none" : effects.decoration;
  const decorationSuppressed = effects.decoration !== "none" && decoration === "none";
  const decorationSize = size + (effects.pfpEffect !== "none" ? 6 : 0);

  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`}>
      <AvatarDecoration
        id={decoration}
        size={decorationSize}
        animated={renderAnimated}
        className={decoration !== "none" ? "overflow-visible" : ""}
      >
        <PfpRing effect={effects.pfpEffect} size={size} animated={renderAnimated}>
          <span
            className="grid place-items-center overflow-hidden rounded-full bg-primary/15 ring-1 ring-primary/20"
            style={{ width: size, height: size }}
          >
            <img
              src={currentSrc}
              alt="Profile avatar"
              className="h-full w-full object-cover"
              onError={() => setCurrentSrc(fallback)}
            />
          </span>
        </PfpRing>
      </AvatarDecoration>
      {decorationSuppressed && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full border border-background bg-primary text-[8px] text-primary-foreground shadow"
        >
          *
        </span>
      )}
    </span>
  );
}

export function ProfileMenuPreview({
  profile,
  roles,
  avatarUrl,
  fallbackAvatar,
  bannerUrl,
  badgeIds,
  badgeNames,
  children,
  lightweight = false,
  className = "",
}: {
  profile?: ProfileMenuSource | null;
  roles: string[];
  avatarUrl?: string | null;
  fallbackAvatar: string;
  bannerUrl?: string | null;
  badgeIds: ProfileBadgeId[];
  badgeNames?: string | null;
  children?: ReactNode;
  lightweight?: boolean;
  className?: string;
}) {
  const effects = getProfileMenuEffects(profile);
  const displayName = profile?.display_name || "Builder";
  const handle = profileHandle(profile?.username);
  const showEmail = profile?.hide_email === false && !!profile?.email;
  const staticCardEffectClass = lightweight ? "profile-effect-static" : "";
  const showFlair = hasProfileMenuFlair({
    ...profile,
    banner_url: bannerUrl ?? profile?.banner_url ?? null,
  });

  return (
    <div
      className={`relative overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl ${className}`}
      style={menuChromeStyle(effects.cardColor)}
    >
      <ProfileCardEffect
        effect={effects.cardEffect}
        color={effects.cardColor}
        className={staticCardEffectClass}
      />
      <div className="relative h-28 overflow-hidden bg-gradient-brand">
        {bannerUrl ? (
          <img src={bannerUrl} alt="Profile banner" className="h-full w-full object-cover" />
        ) : (
          <ProfileBackground id={effects.background} customUrl={effects.customBackgroundUrl} />
        )}
        <ProfileEffect effect={effects.profileEffect} accent={effects.accent} />
        {!bannerUrl && effects.background === "none" && (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${effects.accent}66, ${effects.accent}18 58%, transparent)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-elevated via-surface-elevated/45 to-transparent" />
      </div>

      <div className="relative z-10 -mt-9 border-b border-border/40 bg-[#02060c]/95 px-5 pb-4 backdrop-blur-xl">
        <ProfileMenuAvatar
          src={avatarUrl}
          fallback={fallbackAvatar}
          profile={profile}
          size={64}
          animated
          className="drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
        />
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold">{displayName}</p>
          <RoleBadges roles={roles} size="sm" showLabel />
        </div>
        {handle ? (
          <p className="truncate text-xs font-semibold text-primary-glow/90">{handle}</p>
        ) : null}
        {showEmail ? (
          <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
        ) : null}
        {showFlair && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-glow">
            <Sparkles className="h-3 w-3" />
            Profile flair active
          </span>
        )}
        {badgeIds.length > 0 && (
          <div className="mt-2">
            <ProfileBadgeRow ids={badgeIds} size={24} max={8} />
            {badgeNames && (
              <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{badgeNames}</p>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
