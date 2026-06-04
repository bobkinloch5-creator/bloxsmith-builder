import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeDollarSign,
  Bot,
  Box,
  Check,
  Image,
  LayoutDashboard,
  MessageCircle,
  Palette,
  Plug,
  Settings,
  Shirt,
  Sparkles,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { saveOnboardingProgress } from "@/lib/onboarding.functions";

const SNOOZE_KEY = "bloxsmith.onboarding.snoozed.v2";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  kicker: string;
  body: string;
  cta?: { label: string; href: string };
  tips: string[];
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    kicker: "Welcome",
    title: "Learn BloxSmith in a few minutes",
    body:
      "This tour shows how BloxSmith helps you build Roblox games, generate assets, manage credits, customize your profile, earn badges, and stay organized.",
    tips: ["Your progress saves to your account.", "Finish the tour to earn a profile badge and reward credits."],
  },
  {
    icon: Bot,
    kicker: "AI Builder",
    title: "Build Roblox systems with AI",
    body:
      "Start from your dashboard, describe the game or feature, and BloxSmith helps create scripts, UI, folders, remotes, and gameplay systems.",
    cta: { label: "Open dashboard", href: "/dashboard" },
    tips: ["Use clear goals like tycoon, simulator, obby, RPG, or shop system.", "Keep Roblox Studio open when using the plugin."],
  },
  {
    icon: Plug,
    kicker: "Studio Plugin",
    title: "Connect Roblox Studio",
    body:
      "The Studio plugin is how BloxSmith syncs generated project files into Roblox Studio so your website work becomes real Roblox content.",
    cta: { label: "Plugin setup", href: "/plugin" },
    tips: ["Generate a link token in account settings.", "Keep the plugin open while building."],
  },
  {
    icon: LayoutDashboard,
    kicker: "Projects",
    title: "Organize every Roblox game",
    body:
      "Projects keep prompts, generated files, templates, build history, plugin sync, and game structure together.",
    cta: { label: "View projects", href: "/dashboard" },
    tips: ["Create one project per game.", "Use templates to start faster."],
  },
  {
    icon: WandSparkles,
    kicker: "UI Generator",
    title: "Generate polished Roblox UI",
    body:
      "Use the UI Generator for gamepass shops, spin wheels, inventories, HUDs, rewards, settings screens, leaderboards, and custom Roblox interfaces.",
    cta: { label: "Open UI Generator", href: "/ui-generator" },
    tips: ["Pick a template and style first.", "Save good generations to your library."],
  },
  {
    icon: Box,
    kicker: "3D Model Generator",
    title: "Create Roblox-ready 3D models",
    body:
      "BloxSmith includes a 3D Model Generator website feature for text-to-3D and image-to-3D assets, with Tripo-backed exports and Roblox Studio import guidance.",
    cta: { label: "Open 3D Model Generator", href: "/generate-3d" },
    tips: ["Use low-poly descriptions for Roblox performance.", "Export GLB or FBX for Studio workflows."],
  },
  {
    icon: Image,
    kicker: "Image Generator",
    title: "Generate icons and artwork",
    body:
      "Create Roblox thumbnails, game icons, ads, badges, promo art, concept art, and UI assets from prompts.",
    cta: { label: "Open image generator", href: "/image-generator" },
    tips: ["Use aspect ratio and style controls.", "Keep outputs appropriate and Roblox-safe."],
  },
  {
    icon: Shirt,
    kicker: "Clothing",
    title: "Design Roblox clothing",
    body:
      "Generate shirts, hoodies, pants, accessories, and wearable concepts, then preview them before uploading to Roblox.",
    cta: { label: "Open clothing studio", href: "/clothing" },
    tips: ["Preview in 3D before downloading.", "Use clean prompts for better wearable results."],
  },
  {
    icon: BadgeDollarSign,
    kicker: "Credits",
    title: "Understand credits and limits",
    body:
      "Credits power premium AI work. You can buy credits, claim daily credits, redeem promo codes, and track usage from your account page.",
    cta: { label: "Credits page", href: "/pricing" },
    tips: ["Owners show unlimited usage.", "Usage analytics show where credits went."],
  },
  {
    icon: UserRound,
    kicker: "Profiles",
    title: "Customize your public profile",
    body:
      "Choose avatar decorations, rings, animated card effects, Roblox-style profile backgrounds, profile card colors, badges, privacy, and presence settings.",
    cta: { label: "Customize profile", href: "/account" },
    tips: ["Profile backgrounds and badges show in chat popovers.", "Locked badges are earned, not manually faked."],
  },
  {
    icon: MessageCircle,
    kicker: "Community",
    title: "Use chat, friends, and badges",
    body:
      "Global Chat helps you ask questions, share progress, follow builders, earn chat activity perks, and show achievements on your profile.",
    cta: { label: "Open community chat", href: "/browse" },
    tips: ["Follow chat rules to keep access.", "Badges unlock from real activity and milestones."],
  },
  {
    icon: Settings,
    kicker: "Finish",
    title: "You are ready to build",
    body:
      "You now know the main BloxSmith workflow: build games, generate assets, manage credits, customize your profile, and connect Studio.",
    cta: { label: "Account settings", href: "/account" },
    tips: ["Completing this step awards the BloxSmith Ready badge.", "Reward credits are granted once per account."],
  },
];

export function Onboarding({
  force = false,
  onClose,
}: { force?: boolean; onClose?: () => void } = {}) {
  const { profile, refresh } = useAuth();
  const saveProgress = useServerFn(saveOnboardingProgress);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const completed = !!profile?.onboarding_completed_at;
  const progressPct = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  useEffect(() => {
    if (force) {
      setOpen(true);
      setStep(Math.min(Math.max(Number(profile?.onboarding_step ?? 0), 0), STEPS.length - 1));
      return;
    }
    if (completed) return;
    if (typeof window !== "undefined" && localStorage.getItem(SNOOZE_KEY) === "1") return;
    setOpen(true);
    setStep(Math.min(Math.max(Number(profile?.onboarding_step ?? 0), 0), STEPS.length - 1));
  }, [completed, force, profile?.onboarding_step]);

  const persist = async (nextStep: number, done = false) => {
    setSaving(true);
    try {
      const result = await saveProgress({
        data: { step: nextStep, completed: done },
      });
      if (done) {
        if (typeof window !== "undefined") localStorage.removeItem(SNOOZE_KEY);
        await refresh();
        toast.success(
          result.creditsAwarded > 0
            ? `Onboarding complete — badge unlocked and +${result.creditsAwarded} credits!`
            : "Onboarding complete — badge unlocked!",
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save onboarding progress");
    } finally {
      setSaving(false);
    }
  };

  const dismiss = () => {
    if (typeof window !== "undefined") localStorage.setItem(SNOOZE_KEY, "1");
    setOpen(false);
    onClose?.();
  };

  const next = async () => {
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      await persist(nextStep, false);
    } else {
      await persist(step, true);
      setOpen(false);
      onClose?.();
    }
  };

  const previous = async () => {
    const nextStep = Math.max(0, step - 1);
    setStep(nextStep);
    await persist(nextStep, false);
  };

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-3 backdrop-blur-md sm:p-6">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,.12),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(245,158,11,.12),transparent_34%)]" />
        <div className="relative flex items-start justify-between gap-3 border-b border-border/70 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary-glow">
              BloxSmith onboarding
            </div>
            <h2 className="mt-1 text-lg font-bold sm:text-2xl">Get started without guessing</h2>
          </div>
          <button
            onClick={dismiss}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            aria-label="Close onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative grid min-h-0 flex-1 md:grid-cols-[15rem_1fr]">
          <aside className="hidden border-r border-border/70 p-3 md:block">
            <div className="space-y-1">
              {STEPS.map((item, index) => {
                const StepIcon = item.icon;
                const active = index === step;
                const done = index < step;
                return (
                  <button
                    key={item.title}
                    onClick={() => setStep(index)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      active
                        ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                        : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${done ? "bg-emerald-500/15 text-emerald-300" : "bg-background/70 text-primary"}`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 truncate">{item.kicker}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Step {step + 1} of {STEPS.length}</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-border bg-background/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-primary-glow to-amber-300 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/40 p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary-glow shadow-[0_0_26px_rgba(34,211,238,.16)]">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary-glow">
                    {current.kicker}
                  </div>
                  <h3 className="mt-1 text-xl font-bold sm:text-3xl">{current.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {current.tips.map((tip) => (
                      <div
                        key={tip}
                        className="rounded-xl border border-border/70 bg-surface/50 p-3 text-xs text-foreground/85"
                        title={tip}
                      >
                        <div className="mb-1 flex items-center gap-1.5 font-semibold text-primary-glow">
                          <Palette className="h-3.5 w-3.5" /> Tip
                        </div>
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={dismiss}
                className="order-3 text-xs font-medium text-muted-foreground hover:text-foreground sm:order-1"
              >
                Remind me later
              </button>
              <div className="order-2 flex flex-wrap justify-end gap-2">
                <button
                  onClick={previous}
                  disabled={saving || step === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                {current.cta && (
                  <Link
                    to={current.cta.href as any}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-glow transition hover:bg-primary/15"
                  >
                    {current.cta.label}
                  </Link>
                )}
                <button
                  onClick={next}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-50"
                >
                  {step === STEPS.length - 1 ? (
                    <>
                      <Award className="h-3.5 w-3.5" /> Finish & claim reward
                    </>
                  ) : (
                    <>
                      Next <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
