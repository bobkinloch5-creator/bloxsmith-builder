import {
  ShoppingBag,
  Coins,
  Gem,
  Menu,
  Loader2,
  Settings,
  Package,
  PawPrint,
  ArrowLeftRight,
  Gift,
  RotateCw,
  Ticket,
  Target,
  MapPin,
  ArrowUp,
  Sparkles,
  Trophy,
  Shield,
  Gamepad,
  Heart,
  Wand2,
} from "lucide-react";
import type { UICategory } from "@/lib/ui-generator.shared";

type Item = { category: UICategory; icon: any; tagline: string; premium?: boolean };

export const TEMPLATES: Item[] = [
  { category: "Gamepass Shop", icon: ShoppingBag, tagline: "Premium passes & VIP", premium: true },
  { category: "Dev Product Shop", icon: ShoppingBag, tagline: "One-time purchases", premium: true },
  { category: "Coin Shop", icon: Coins, tagline: "Sell coins for Robux" },
  { category: "Gem Shop", icon: Gem, tagline: "Sell premium currency" },
  { category: "Main Menu", icon: Menu, tagline: "Cinematic title screen", premium: true },
  { category: "Loading Screen", icon: Loader2, tagline: "Branded splash" },
  { category: "Settings Menu", icon: Settings, tagline: "Volume, graphics, controls" },
  { category: "Inventory", icon: Package, tagline: "Item grid with details" },
  { category: "Pet Inventory", icon: PawPrint, tagline: "Pets with rarity & equip" },
  { category: "Trading", icon: ArrowLeftRight, tagline: "Two-player trade window" },
  { category: "Daily Rewards", icon: Gift, tagline: "7-day claim grid" },
  { category: "Spin Wheel", icon: RotateCw, tagline: "Lucky wheel rewards", premium: true },
  { category: "Codes Redeem", icon: Ticket, tagline: "Promo code input" },
  { category: "Quest UI", icon: Target, tagline: "Active quest tracker" },
  { category: "Teleport UI", icon: MapPin, tagline: "Server / place picker" },
  { category: "Upgrade UI", icon: ArrowUp, tagline: "Stat upgrade ladder" },
  { category: "Rebirth UI", icon: Sparkles, tagline: "Rebirth confirm + perks" },
  { category: "Leaderboard", icon: Trophy, tagline: "Top players list" },
  { category: "Admin Panel", icon: Shield, tagline: "Mod tools & commands", premium: true },
  { category: "Mobile Controls", icon: Gamepad, tagline: "Touch joystick + buttons" },
  { category: "HUD", icon: Heart, tagline: "Coins, gems, XP, health" },
  { category: "Custom", icon: Wand2, tagline: "Describe anything" },
];

export function TemplateGrid({
  active,
  onPick,
}: {
  active: UICategory;
  onPick: (c: UICategory) => void;
}) {
  return (
    <div className="space-y-3.5">
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background/20 to-accent/5 p-3.5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Premium UI Templates
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Each generation costs 5 credits and builds a Studio-ready ScreenGui with scripts,
          remotes, gradients, strokes, and responsive layout.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
      {TEMPLATES.map(({ category, icon: Icon, tagline, premium }) => {
        const isActive = active === category;
        return (
          <button
            key={category}
            onClick={() => onPick(category)}
            title={`${category} — ${tagline}`}
            className={`relative overflow-hidden text-left rounded-xl border p-2.5 transition-all duration-300 ease-out active:scale-[0.97] hover:scale-[1.015] hover:-translate-y-[1px] group ${
              isActive
                ? "border-primary bg-gradient-to-br from-primary/15 via-background/40 to-primary/5 shadow-[0_0_20px_-5px_oklch(0.73_0.17_158_/_0.25),inset_2px_0_0_var(--primary)]"
                : premium
                  ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-400/40 hover:shadow-[0_8px_20px_-8px_rgba(245,158,11,0.15)]"
                  : "border-border/60 bg-background/25 hover:bg-surface hover:border-primary/30 hover:shadow-[0_8px_20px_-8px_oklch(0.73_0.17_158_/_0.12)]"
            }`}
          >
            {premium && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-2 py-0.5 text-[8.5px] font-black uppercase text-black tracking-wider shadow-sm">
                Pro
              </span>
            )}
            <div className="flex items-center gap-2">
              <span
                className={`grid h-8.5 w-8.5 shrink-0 place-items-center rounded-lg transition-colors duration-300 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(20,241,149,0.3)]"
                    : "bg-surface-elevated/80 text-muted-foreground group-hover:text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="pr-8 text-[12px] font-bold leading-tight text-foreground truncate">
                  {category}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-[10.5px] leading-tight text-muted-foreground group-hover:text-muted-foreground/90">
                    {tagline}
                  </p>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    isActive ? "bg-primary/20 text-primary-glow" : "bg-primary/10 text-muted-foreground group-hover:text-primary-glow"
                  }`}>
                    5 cr
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );

}
