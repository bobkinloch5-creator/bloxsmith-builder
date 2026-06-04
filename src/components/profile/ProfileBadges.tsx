// Discord-style decorative profile badges. Pure CSS/SVG, no external icons,
// each badge has a gradient face + glow ring + subtle animation.
import { useMemo } from "react";
import type { ProfileBadgeId } from "@/lib/profile-badges";

export type BadgeId = ProfileBadgeId;

type BadgeDef = {
  id: BadgeId;
  label: string;
  description: string;
  /** gradient stops */
  from: string;
  to: string;
  /** glow color */
  glow: string;
  /** symbol/glyph rendered inside */
  glyph: string;
  /** subtle animation */
  pulse?: boolean;
};

export const PROFILE_BADGES: BadgeDef[] = [
  { id: "founder",    label: "Founder",      description: "Created and shaped the community from day one.", from: "#FFD36E", to: "#FF7A18", glow: "#FFB347", glyph: "♛", pulse: true },
  { id: "og",         label: "OG",           description: "One of the original members.",                    from: "#A78BFA", to: "#6D28D9", glow: "#8B5CF6", glyph: "★" },
  { id: "early",      label: "Early Supporter", description: "Joined Bloxsmith in its earliest days.",       from: "#7DD3FC", to: "#1D4ED8", glow: "#38BDF8", glyph: "✦", pulse: true },
  { id: "developer",  label: "Developer",    description: "Builds with the Bloxsmith API.",                  from: "#34D399", to: "#0F766E", glow: "#10B981", glyph: "</>" },
  { id: "verified",   label: "Verified",     description: "Identity verified by Bloxsmith.",                 from: "#60A5FA", to: "#2563EB", glow: "#3B82F6", glyph: "✓" },
  { id: "supporter",  label: "Supporter",    description: "Supports Bloxsmith with a paid plan.",            from: "#FB7185", to: "#BE123C", glow: "#F43F5E", glyph: "♥", pulse: true },
  { id: "booster",    label: "Booster",      description: "Boosted the community server.",                   from: "#F0ABFC", to: "#A21CAF", glow: "#E879F9", glyph: "⬢", pulse: true },
  { id: "legend",     label: "Legend",       description: "Reached legendary status.",                       from: "#FDE68A", to: "#B45309", glow: "#FBBF24", glyph: "✪", pulse: true },
  { id: "creator",    label: "Creator",      description: "Verified content creator.",                       from: "#F472B6", to: "#9D174D", glow: "#EC4899", glyph: "✎" },
  { id: "translator", label: "Translator",   description: "Helps translate Bloxsmith.",                      from: "#86EFAC", to: "#15803D", glow: "#22C55E", glyph: "文" },
  { id: "bug_hunter", label: "Bug Hunter",   description: "Reported impactful bugs.",                        from: "#FCA5A5", to: "#991B1B", glow: "#EF4444", glyph: "✖" },
  { id: "staff",      label: "Staff",        description: "Member of the Bloxsmith team.",                   from: "#22D3EE", to: "#0E7490", glow: "#06B6D4", glyph: "⚙" },
  { id: "moderator",  label: "Moderator",    description: "Keeps the community safe.",                       from: "#93C5FD", to: "#1E40AF", glow: "#3B82F6", glyph: "⚔" },
  { id: "nitro",      label: "Premium",      description: "Premium member with extra perks.",                from: "#C4B5FD", to: "#6D28D9", glow: "#A78BFA", glyph: "◆", pulse: true },
  { id: "active",     label: "Active",       description: "Active chatter this season.",                     from: "#FDBA74", to: "#9A3412", glow: "#FB923C", glyph: "⚡", pulse: true },
  { id: "explorer",   label: "Explorer",     description: "Tried every section of the app.",                 from: "#67E8F9", to: "#155E75", glow: "#22D3EE", glyph: "✈" },
  { id: "artist",     label: "Artist",       description: "Shares amazing creations.",                       from: "#FDA4AF", to: "#9F1239", glow: "#FB7185", glyph: "✿" },
  { id: "scripter",   label: "Scripter",     description: "Master of Luau wizardry.",                        from: "#FCD34D", to: "#92400E", glow: "#F59E0B", glyph: "⌘" },
  { id: "onboarding", label: "BloxSmith Ready", description: "Completed the BloxSmith onboarding tour.",       from: "#5EEAD4", to: "#0F766E", glow: "#14B8A6", glyph: "✓", pulse: true },
  { id: "asset_smith", label: "Asset Smith",  description: "Generated assets with BloxSmith tools.",          from: "#FDBA74", to: "#C2410C", glow: "#F97316", glyph: "◆" },
  { id: "model_maker", label: "3D Model Maker", description: "Generated a Roblox-ready 3D model.",            from: "#93C5FD", to: "#1D4ED8", glow: "#3B82F6", glyph: "3D", pulse: true },
  { id: "ui_architect", label: "UI Architect", description: "Built Roblox UI with the UI generator.",          from: "#C4B5FD", to: "#7C3AED", glow: "#8B5CF6", glyph: "UI" },
  { id: "image_artist", label: "Image Artist", description: "Generated image assets for Roblox.",             from: "#F9A8D4", to: "#BE185D", glow: "#EC4899", glyph: "IMG" },
  { id: "clothier",   label: "Clothier",     description: "Created Roblox clothing or avatar wearables.",     from: "#A7F3D0", to: "#047857", glow: "#10B981", glyph: "T" },
  { id: "inviter",    label: "Inviter",      description: "Invited friends into BloxSmith.",                  from: "#FDE68A", to: "#D97706", glow: "#F59E0B", glyph: "+" },
  { id: "project_milestone", label: "Project Builder", description: "Reached a project creation milestone.",  from: "#BAE6FD", to: "#0284C7", glow: "#0EA5E9", glyph: "P" },
  { id: "credit_milestone", label: "Power User", description: "Reached a credit usage milestone.",            from: "#FECACA", to: "#DC2626", glow: "#EF4444", glyph: "XP", pulse: true },
];

const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(
  PROFILE_BADGES.map((b) => [b.id, b]),
);

export function ProfileBadgeIcon({
  id,
  size = 28,
  className = "",
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const def = BADGE_MAP[id];
  if (!def) return null;
  const px = `${size}px`;
  return (
    <span
      className={`relative inline-grid place-items-center rounded-[8px] shadow-lg ${className}`}
      style={{
        width: px,
        height: px,
        background: `linear-gradient(135deg, ${def.from}, ${def.to})`,
        boxShadow: `0 0 0 1px ${def.glow}55, 0 0 18px ${def.glow}66, inset 0 1px 0 rgba(255,255,255,0.35)`,
      }}
      title={def.label}
      aria-label={def.label}
    >
      {/* shine */}
      <span
        className="pointer-events-none absolute inset-0 rounded-[8px] opacity-70"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 45%)",
        }}
      />
      <span
        className="relative font-black leading-none text-white drop-shadow"
        style={{ fontSize: Math.round(size * 0.5) }}
      >
        {def.glyph}
      </span>
    </span>
  );
}

export function ProfileBadgeRow({
  ids,
  size = 26,
  max = 12,
  className = "",
}: {
  ids: string[] | null | undefined;
  size?: number;
  max?: number;
  className?: string;
}) {
  const shown = useMemo(
    () => (ids ?? []).filter((id) => !!BADGE_MAP[id]).slice(0, max),
    [ids, max],
  );
  if (shown.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {shown.map((id) => (
        <ProfileBadgeIcon key={id} id={id} size={size} />
      ))}
    </div>
  );
}

export function getBadgeDef(id: string): BadgeDef | undefined {
  return BADGE_MAP[id];
}
