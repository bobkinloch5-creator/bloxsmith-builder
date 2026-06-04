import { Crown, ShieldCheck, Sparkles, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Role = "owner" | "admin" | "moderator" | "premium" | "user";

const ROLE_META: Record<
  Role,
  { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  owner: {
    label: "Owner",
    Icon: Crown,
    cls: "bg-gradient-to-r from-amber-500/20 to-yellow-400/20 text-amber-300 border-amber-400/40 shadow-[0_0_18px_-6px_rgba(251,191,36,0.7)]",
  },
  admin: {
    label: "Admin",
    Icon: ShieldCheck,
    cls: "bg-gradient-to-r from-rose-500/20 to-red-400/20 text-rose-300 border-rose-400/40",
  },
  moderator: {
    label: "Moderator",
    Icon: ShieldCheck,
    cls: "bg-gradient-to-r from-sky-500/20 to-cyan-400/20 text-sky-300 border-sky-400/40",
  },
  premium: {
    label: "Premium",
    Icon: Sparkles,
    cls: "bg-gradient-to-r from-violet-500/20 to-fuchsia-400/20 text-violet-300 border-violet-400/40",
  },
  user: {
    label: "Member",
    Icon: UserIcon,
    cls: "bg-surface-elevated text-muted-foreground border-border",
  },
};

interface RoleBadgeProps {
  role: Role;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function RoleBadge({ role, size = "sm", showLabel = true, className }: RoleBadgeProps) {
  const meta = ROLE_META[role] ?? ROLE_META.user;
  const Icon = meta.Icon;
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold transition",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        meta.cls,
        className,
      )}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {showLabel ? meta.label : null}
    </span>
  );
}

interface RoleBadgesProps {
  roles: Role[] | string[];
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const ROLE_PRIORITY: Role[] = ["owner", "admin", "moderator", "premium", "user"];

export function RoleBadges({ roles, size = "sm", showLabel = true, className }: RoleBadgesProps) {
  const set = new Set((roles ?? []).map((r) => String(r) as Role));
  // Only show the highest role to avoid clutter (owner overrides admin, etc.)
  const top = ROLE_PRIORITY.find((r) => set.has(r));
  if (!top || top === "user") return null;
  return <RoleBadge role={top} size={size} showLabel={showLabel} className={className} />;
}
