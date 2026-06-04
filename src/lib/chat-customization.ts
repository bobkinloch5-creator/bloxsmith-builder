import {
  Sparkles,
  Star,
  Crown,
  Flame,
  Heart,
  Leaf,
  Zap,
  Moon,
  Sun,
  Rocket,
  Gem,
  Trophy,
  Music,
  Gamepad2,
  Cake,
  Coffee,
  Sailboat,
  Mountain,
  Cloud,
  Snowflake,
  PawPrint,
  Anchor,
  type LucideIcon,
} from "lucide-react";

/** Built-in name icons. All clean, no profanity, no edgy imagery. */
export const CHAT_ICONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "sparkles", label: "Sparkles", Icon: Sparkles },
  { id: "star", label: "Star", Icon: Star },
  { id: "crown", label: "Crown", Icon: Crown },
  { id: "flame", label: "Flame", Icon: Flame },
  { id: "heart", label: "Heart", Icon: Heart },
  { id: "leaf", label: "Leaf", Icon: Leaf },
  { id: "zap", label: "Bolt", Icon: Zap },
  { id: "moon", label: "Moon", Icon: Moon },
  { id: "sun", label: "Sun", Icon: Sun },
  { id: "rocket", label: "Rocket", Icon: Rocket },
  { id: "gem", label: "Gem", Icon: Gem },
  { id: "trophy", label: "Trophy", Icon: Trophy },
  { id: "music", label: "Music", Icon: Music },
  { id: "gamepad", label: "Gamepad", Icon: Gamepad2 },
  { id: "cake", label: "Cake", Icon: Cake },
  { id: "coffee", label: "Coffee", Icon: Coffee },
  { id: "sailboat", label: "Sailboat", Icon: Sailboat },
  { id: "mountain", label: "Mountain", Icon: Mountain },
  { id: "cloud", label: "Cloud", Icon: Cloud },
  { id: "snowflake", label: "Snow", Icon: Snowflake },
  { id: "paw", label: "Paw", Icon: PawPrint },
  { id: "anchor", label: "Anchor", Icon: Anchor },
];

export const CHAT_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CHAT_ICONS.map((i) => [i.id, i.Icon]),
);

/** Curated gradient presets (also work as solid colors if length === 1). */
export const NAME_GRADIENT_PRESETS: { id: string; label: string; stops: string[] }[] = [
  { id: "aurora", label: "Aurora", stops: ["#a78bfa", "#22d3ee", "#34d399"] },
  { id: "sunset", label: "Sunset", stops: ["#fb7185", "#f59e0b", "#facc15"] },
  { id: "ocean", label: "Ocean", stops: ["#0ea5e9", "#22d3ee"] },
  { id: "candy", label: "Candy", stops: ["#f472b6", "#a78bfa"] },
  { id: "lime", label: "Lime", stops: ["#84cc16", "#22d3ee"] },
  { id: "ember", label: "Ember", stops: ["#ef4444", "#f97316", "#fde047"] },
  { id: "royal", label: "Royal", stops: ["#6366f1", "#ec4899"] },
  { id: "mint", label: "Mint", stops: ["#10b981", "#a7f3d0"] },
  { id: "rose-gold", label: "Rose Gold", stops: ["#fda4af", "#fcd34d"] },
  { id: "midnight", label: "Midnight", stops: ["#818cf8", "#c4b5fd", "#f9a8d4"] },
];

export const TEXT_GRADIENT_PRESETS: { id: string; label: string; stops: string[] }[] = [
  { id: "default", label: "Default", stops: [] },
  { id: "soft-sky", label: "Soft Sky", stops: ["#bae6fd", "#e0f2fe"] },
  { id: "warm", label: "Warm", stops: ["#fed7aa", "#fde68a"] },
  { id: "rose", label: "Rose", stops: ["#fecdd3", "#fbcfe8"] },
  { id: "lavender", label: "Lavender", stops: ["#ddd6fe", "#e9d5ff"] },
  { id: "mint", label: "Mint", stops: ["#bbf7d0", "#a7f3d0"] },
];

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/** Returns a sanitized, max-4-stop gradient array, or null if invalid/empty. */
export function sanitizeGradient(stops: unknown): string[] | null {
  if (!Array.isArray(stops)) return null;
  const clean = stops
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => HEX_RE.test(s))
    .slice(0, 4);
  return clean.length ? clean : null;
}

export function sanitizeIcon(id: unknown): string | null {
  if (typeof id !== "string") return null;
  return id in CHAT_ICON_MAP ? id : null;
}

/** Build CSS for solid (1 stop) or linear-gradient (2+ stops) text fill. */
export function gradientTextStyle(
  stops: string[] | null | undefined,
): React.CSSProperties | undefined {
  if (!stops || !stops.length) return undefined;
  if (stops.length === 1) return { color: stops[0] };
  return {
    backgroundImage: `linear-gradient(90deg, ${stops.join(", ")})`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
  };
}

/** Curated set of safe, broadly-supported fonts for chat. */
export const CHAT_FONTS: { id: string; label: string; stack: string }[] = [
  { id: "default", label: "Default", stack: "" },
  { id: "sans", label: "Sans", stack: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { id: "serif", label: "Serif", stack: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Mono", stack: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  { id: "rounded", label: "Rounded", stack: "'Nunito', 'Quicksand', system-ui, sans-serif" },
  { id: "display", label: "Display", stack: "'Space Grotesk', 'Poppins', system-ui, sans-serif" },
  { id: "handwritten", label: "Handwritten", stack: "'Caveat', 'Comic Sans MS', cursive" },
  { id: "futuristic", label: "Futuristic", stack: "'Orbitron', 'Audiowide', system-ui, sans-serif" },
  { id: "elegant", label: "Elegant", stack: "'Playfair Display', Georgia, serif" },
];

export const CHAT_FONT_MAP: Record<string, string> = Object.fromEntries(
  CHAT_FONTS.map((f) => [f.id, f.stack]),
);

export function sanitizeFont(id: unknown): string | null {
  if (typeof id !== "string") return null;
  if (id === "default" || !(id in CHAT_FONT_MAP)) return null;
  return id;
}

export function chatFontStyle(id: string | null | undefined): React.CSSProperties | undefined {
  if (!id) return undefined;
  const stack = CHAT_FONT_MAP[id];
  if (!stack) return undefined;
  return { fontFamily: stack };
}

