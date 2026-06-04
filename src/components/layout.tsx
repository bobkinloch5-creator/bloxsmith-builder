import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { createRobloxStyleAvatar } from "@/lib/generated-avatar";
import logo from "@/assets/logo.png";
import { useEffect, useState } from "react";
import {
  User,
  Settings,
  CreditCard,
  LogOut,
  ChevronDown,
  Home,
  LayoutDashboard,
  Puzzle,
  BookOpen,
  Sparkles,
  BadgeDollarSign,
  MessageCircle,
  Box,
  Shirt,
  Image as ImageIcon,
  Layout as LayoutIcon,
  Star,
  Users,
  GalleryHorizontal,
  Trophy,
  Lightbulb,
  Server,
  FileText,
  HelpCircle,
  Bug,
  Clock,
  Film,
  X,
  Copy,
  Check,
} from "lucide-react";
import { PluginStatus } from "@/components/PluginStatus";
import { McpStatus } from "@/components/McpStatus";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { creditBalanceTitle, formatCreditBalance } from "@/lib/credit-display";
import { getBadgeDef } from "@/components/profile/ProfileBadges";
import {
  mergeProfileBadgeIds,
  normalizeProfileBadgeIds,
  roleProfileBadgeIds,
} from "@/lib/profile-badges";
import { ProfileMenuAvatar, ProfileMenuPreview } from "@/components/profile/ProfileMenuPreview";
import { LAUNCH_PROMO_CODE, LAUNCH_PROMO_COPY, LAUNCH_PROMO_END_LABEL } from "@/lib/launch-promo";

type NavItem = {
  to: string;
  label: string;
  icon?: typeof Home;
  authOnly?: boolean;
  guestOnly?: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/dashboard", label: "Dashboard", authOnly: true },
  { to: "/templates", label: "Templates" },
  { to: "/script-doctor", label: "Script Doctor", authOnly: true },
  { to: "/clothing", label: "Clothing" },
  { to: "/image-generator", label: "Images" },
  { to: "/video-generator", label: "Video Generator" },
  { to: "/generate-3d", label: "3D Model Generator" },
  { to: "/ui-generator", label: "UI Generator" },
  { to: "/showcase", label: "Showcase" },
  { to: "/browse", label: "Community Chat" },
  { to: "/gallery", label: "Gallery" },
  { to: "/achievements", label: "Achievements" },
  { to: "/ideas", label: "Ideas" },
  { to: "/pricing", label: "Pricing" },
  { to: "/docs", label: "Docs" },
  { to: "/plugin", label: "Plugin" },
  { to: "/mcp", label: "MCP" },
  { to: "/mcp-servers", label: "MCP Servers", authOnly: true },
  { to: "/changelog", label: "Changelog" },
  { to: "/faq", label: "FAQ" },
];

const MOBILE_NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Build", icon: LayoutDashboard, authOnly: true },
  { to: "/account", label: "Profile", icon: User, authOnly: true },
  { to: "/login", label: "Login", icon: User, guestOnly: true },
  { to: "/pricing", label: "Credits", icon: BadgeDollarSign },
  { to: "/templates", label: "Templates", icon: Sparkles },
  { to: "/script-doctor", label: "Fix Scripts", icon: Bug, authOnly: true },
  { to: "/clothing", label: "Clothing", icon: Shirt },
  { to: "/image-generator", label: "Images", icon: ImageIcon },
  { to: "/video-generator", label: "Video Generator", icon: Film },
  { to: "/generate-3d", label: "3D Model Generator", icon: Box },
  { to: "/ui-generator", label: "UI Generator", icon: LayoutIcon },
  { to: "/showcase", label: "Showcase", icon: Star },
  { to: "/browse", label: "Community Chat", icon: Users },
  { to: "/gallery", label: "Gallery", icon: GalleryHorizontal },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/ideas", label: "Ideas", icon: Lightbulb },
  { to: "/docs", label: "Docs", icon: BookOpen },
  { to: "/plugin", label: "Plugin", icon: Puzzle },
  { to: "/mcp", label: "MCP", icon: Box },
  { to: "/mcp-servers", label: "MCP Servers", icon: Server, authOnly: true },
  { to: "/changelog", label: "Changelog", icon: FileText },
  { to: "/faq", label: "FAQ", icon: HelpCircle },
];

const BETA_BANNER_STORAGE_KEY = "bloxsmith-beta-banner-dismissed";

function BetaNotice() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(window.localStorage.getItem(BETA_BANNER_STORAGE_KEY) === "true");
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    window.localStorage.setItem(BETA_BANNER_STORAGE_KEY, "true");
    setHidden(true);
  };

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/10 px-3 py-2 text-xs text-amber-200/90 relative z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 pr-8 text-center">
        <span className="font-semibold bg-amber-500/20 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider text-amber-400">
          Beta
        </span>
        <span>
          BloxSmith is currently in beta. Some things might not work perfectly, but we are here to
          improve!
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-amber-200/80 transition hover:bg-amber-500/15 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
        aria-label="Dismiss beta notice"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function LaunchPromoBanner() {
  const [copied, setCopied] = useState(false);

  const fallbackCopy = () => {
    const textarea = document.createElement("textarea");
    textarea.value = LAUNCH_PROMO_CODE;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  };

  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(LAUNCH_PROMO_CODE);
        } catch {
          if (!fallbackCopy()) throw new Error("Promo code copy failed");
        }
      } else {
        if (!fallbackCopy()) throw new Error("Promo code copy failed");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative z-50 border-b border-primary/15 bg-primary/10 px-3 py-2 text-xs text-primary-glow">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 text-center sm:flex-row">
        <span className="rounded-md border border-primary/25 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          Launch sale
        </span>
        <span className="font-medium text-foreground">
          {LAUNCH_PROMO_COPY} on credit purchases. Good until {LAUNCH_PROMO_END_LABEL}.
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary/25 bg-background/60 px-3 py-1 text-xs font-bold text-primary-glow transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label={`Copy promo code ${LAUNCH_PROMO_CODE}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : LAUNCH_PROMO_CODE}
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const { user, signOut, profile, isOwner, roles } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const bannerUrl = profile?.banner_url || user?.user_metadata?.banner_url || null;
  const fallbackAvatar = createRobloxStyleAvatar(user?.id || user?.email);
  const menuBadgeIds = mergeProfileBadgeIds([
    ...roleProfileBadgeIds(roles),
    ...normalizeProfileBadgeIds((profile as any)?.profile_badges),
    (profile as any)?.discord_claimed ? "booster" : "",
    (profile as any)?.credits > 0 ? "supporter" : "",
  ]);
  const menuBadgeNames = menuBadgeIds
    .map((id) => getBadgeDef(id)?.label)
    .filter(Boolean)
    .join(", ");

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.authOnly || user);
  const mobileItems = MOBILE_NAV_ITEMS.filter((item) => {
    if (item.authOnly && !user) return false;
    if (item.guestOnly && user) return false;
    return true;
  });

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [profileOpen]);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <BetaNotice />
      <LaunchPromoBanner />
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 shrink-0 notranslate"
            translate="no"
          >
            <img
              src={logo}
              alt="BloxSmith logo"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-md"
            />
            <span className="truncate text-base sm:text-lg font-bold whitespace-nowrap">
              Blox<span className="gradient-text">Smith</span>
            </span>
            <span className="ml-1 hidden lg:inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/20">
              Beta
            </span>
          </Link>

          <nav className="hidden shrink-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Browse
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[24rem] max-w-[calc(100vw-1.5rem)] p-2"
              >
                <div className="mb-2 grid gap-2">
                  <Link
                    to="/templates"
                    className="group rounded-lg border border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-surface/80 to-primary/10 p-3 transition hover:border-amber-400/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                          <Sparkles className="h-4 w-4 text-amber-300" />
                          Premium Templates
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Credit-costing Roblox starter kits: tycoons, RPG hubs, battle passes,
                          trading plazas, and more.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        credits
                      </span>
                    </div>
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/generate-3d"
                      className="rounded-lg border border-border/60 bg-background/50 p-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-surface"
                    >
                      <Box className="mb-1 h-4 w-4 text-primary" />
                      3D Model Generator
                    </Link>
                    <Link
                      to="/ui-generator"
                      className="rounded-lg border border-border/60 bg-background/50 p-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-surface"
                    >
                      <LayoutIcon className="mb-1 h-4 w-4 text-primary" />
                      Fancy UI Generator
                    </Link>
                  </div>
                </div>
                <div className="my-2 h-px bg-border/70" />
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Pages
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {visibleNavItems.map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to as any} className="w-full cursor-pointer">
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
                <div className="my-2 h-px bg-border/70" />
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Community
                </div>
                <DropdownMenuItem asChild>
                  <a
                    href="https://discord.gg/ZzdqTpntB"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full cursor-pointer"
                  >
                    Discord +10 free credits
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href="https://kingdavez.click"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full cursor-pointer"
                  >
                    External 3D Model Site
                  </a>
                </DropdownMenuItem>
                <div className="my-2 h-px bg-border/70" />
                <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Site controls
                </div>
                <div className="grid gap-2 px-2 pb-1" onClick={(event) => event.stopPropagation()}>
                  {/* Theme picker moved to the navbar — nesting it inside this
                    Radix dropdown swallowed clicks and clipped the panel. */}
                  {user && (
                    <div className="flex flex-wrap items-center gap-2">
                      <PluginStatus compact />
                      <McpStatus compact />
                    </div>
                  )}
                </div>
                {user && (
                  <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    Build status and MCP controls are tucked here so the header stays readable.
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex shrink-0 items-center gap-2 lg:gap-2.5 ml-auto">
            <LiveHeaderClock className="hidden 2xl:inline-flex" />
            {/* Theme + language selectors live directly on the navbar (not in
              the Browse dropdown — nesting them in the Radix menu broke clicks
              and clipped the panels). Shown at every breakpoint. */}
            <div className="hidden md:flex shrink-0 items-center gap-2">
              <a
                href="https://discord.gg/YJ8xPFNSSX"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#5865F2]/30 bg-[#5865F2]/10 text-[#5865F2] hover:bg-[#5865F2]/20 transition"
                aria-label="Join our Discord server"
                title="Discord"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
                </svg>
              </a>
              <ThemeToggle />
              <LanguageSwitcher compact />
            </div>
            <div className="flex md:hidden items-center gap-1.5">
              <a
                href="https://discord.gg/YJ8xPFNSSX"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#5865F2]/30 bg-[#5865F2]/10 text-[#5865F2] hover:bg-[#5865F2]/20 transition"
                aria-label="Join our Discord server"
                title="Discord"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
                </svg>
              </a>
              <ThemeToggle />
              <LanguageSwitcher compact />
            </div>

            {user ? (
              <>
                <Link
                  to="/pricing"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 text-xs font-semibold text-primary-glow hover:bg-primary/20 transition whitespace-nowrap tabular-nums"
                  title={profile ? creditBalanceTitle(profile.credits, isOwner) : "Loading credits"}
                  aria-label={
                    profile ? creditBalanceTitle(profile.credits, isOwner) : "Loading credits"
                  }
                >
                  {profile
                    ? formatCreditBalance(profile.credits, isOwner, { compact: true })
                    : "..."}
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setProfileOpen((o) => !o)}
                    className="inline-flex h-9 max-w-[10.5rem] items-center gap-1.5 sm:gap-2 rounded-full border border-primary/20 bg-surface/85 pl-1.5 pr-2 text-xs font-semibold text-foreground shadow-sm hover:bg-surface-elevated transition"
                    aria-expanded={profileOpen}
                    aria-label="Open profile menu"
                    type="button"
                  >
                    <ProfileMenuAvatar
                      src={avatarUrl}
                      fallback={fallbackAvatar}
                      profile={profile as any}
                      size={24}
                      compact
                    />
                    <span className="hidden 2xl:inline min-w-0 max-w-[7rem] truncate">
                      {profile?.display_name || "Builder"}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 shrink-0 text-muted-foreground transition ${profileOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 z-50 w-[20rem] sm:w-[22rem]">
                        <ProfileMenuPreview
                          profile={profile as any}
                          roles={roles}
                          avatarUrl={avatarUrl}
                          fallbackAvatar={fallbackAvatar}
                          bannerUrl={bannerUrl}
                          badgeIds={menuBadgeIds}
                          badgeNames={menuBadgeNames}
                          lightweight
                        >
                          <div className="relative z-10 py-1.5">
                            <Link
                              to="/account"
                              onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface transition"
                            >
                              <User className="h-3.5 w-3.5 text-muted-foreground" /> Profile
                            </Link>
                            <Link
                              to="/account"
                              onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface transition"
                            >
                              <Settings className="h-3.5 w-3.5 text-muted-foreground" /> Settings
                            </Link>
                            <Link
                              to="/pricing"
                              onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface transition"
                            >
                              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" /> Buy
                              Credits
                            </Link>
                          </div>
                          <div className="relative z-10 border-t border-border/40 py-1.5">
                            <button
                              onClick={() => {
                                setProfileOpen(false);
                                signOut();
                              }}
                              className="flex items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 w-full transition"
                              type="button"
                            >
                              <LogOut className="h-3.5 w-3.5" /> Sign out
                            </button>
                          </div>
                        </ProfileMenuPreview>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="btn-shine rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow)]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>

        <nav
          className="md:hidden flex items-center gap-2 border-t border-border/70 bg-background/95 px-2 py-2"
          aria-label="Mobile navigation"
        >
          <LiveHeaderClock className="inline-flex md:hidden" />
          <div className="flex-1 min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max min-w-full items-center gap-2">
              {mobileItems.map((item) => {
                const Icon = item.icon;
                const isProfile = item.to === "/account" && user;
                return (
                  <Link
                    key={item.to}
                    to={item.to as any}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-2 text-xs font-semibold text-foreground active:scale-[0.98] hover:bg-surface-elevated"
                  >
                    {isProfile ? (
                      <ProfileMenuAvatar
                        src={avatarUrl}
                        fallback={fallbackAvatar}
                        profile={profile as any}
                        size={24}
                        compact
                      />
                    ) : (
                      Icon && <Icon className="h-3.5 w-3.5 text-primary" />
                    )}
                    {item.label}
                  </Link>
                );
              })}
              <a
                href="https://kingdavez.click"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-2 text-xs font-semibold text-foreground active:scale-[0.98] hover:bg-surface-elevated"
              >
                <Box className="h-3.5 w-3.5 text-primary" /> 3D Model Generator
              </a>
              <a
                href="https://discord.gg/ZzdqTpntB"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#5865F2]/30 bg-[#5865F2]/15 px-3 py-2 text-xs font-bold text-[#8ea0ff] active:scale-[0.98] hover:bg-[#5865F2]/25"
              >
                Discord +10
              </a>
              {user && (
                <>
                  <PluginStatus compact />
                  <McpStatus compact />
                </>
              )}
            </div>
          </div>
        </nav>
      </header>
      <span id="main-content" tabIndex={-1} className="sr-only" aria-hidden="true" />
    </>
  );
}

function LiveHeaderClock({ className = "inline-flex" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now
    ? now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:-- --";

  return (
    <div
      className={`${className} h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-surface/70 px-3 text-xs font-semibold text-foreground/90 shadow-sm tabular-nums`}
      title="Local 12-hour time"
      aria-label={`Local time ${time}`}
      suppressHydrationWarning
    >
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span>{time}</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} BloxSmith. Build real Roblox games with AI.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link to="/terms" className="hover:text-foreground transition">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-foreground transition">
            Privacy
          </Link>
          <Link to="/legal" className="hover:text-foreground transition">
            Legal
          </Link>
        </nav>
        <p className="text-[11px] text-muted-foreground/80">
          Made only by{" "}
          <a
            href="https://github.com/bobkinloch5-creator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-glow hover:underline font-semibold"
          >
            Dave Kinloch
          </a>
        </p>
      </div>
    </footer>
  );
}
