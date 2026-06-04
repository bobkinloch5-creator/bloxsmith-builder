import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type ChatBgStyle =
  | "default"
  | "solid"
  | "gradient"
  | "mesh"
  | "dots"
  | "grid"
  | "aurora"
  | "stripes"
  // animated / premium
  | "aurora-anim"
  | "stars"
  | "matrix"
  | "roblox-studio"
  | "neon-city"
  | "lava"
  | "custom-image";

export type ChatPrefs = {
  font_size: "sm" | "md" | "lg";
  density: "compact" | "cozy" | "comfy";
  emote_size: "compact" | "normal" | "large";
  sound_enabled: boolean;
  notify_mode: "off" | "mentions" | "all";
  theme_accent: string | null;
  show_system: boolean;
  show_bubbles: boolean;
  quick_reactions: string[];
  // Background (local-only)
  bg_style: ChatBgStyle;
  bg_color: string;
  bg_color2: string;
  bg_opacity: number; // 0..1
  bg_image_url: string | null; // for "custom-image"
};

export const DEFAULT_PREFS: ChatPrefs = {
  font_size: "md",
  density: "cozy",
  emote_size: "normal",
  sound_enabled: true,
  notify_mode: "mentions",
  theme_accent: null,
  show_system: true,
  show_bubbles: true,
  quick_reactions: ["👍", "❤️", "😂", "🔥", "🎉", ":blox_gg:"],
  bg_style: "default",
  bg_color: "#0b1220",
  bg_color2: "#1e1b4b",
  bg_opacity: 0.98,
  bg_image_url: null,
};

const LS_KEY = "bloxsmith.chatprefs.v1";

// Fields persisted to the DB (others are local-only)
const DB_FIELDS = ["font_size", "density", "sound_enabled", "notify_mode", "theme_accent"] as const;

export function useChatPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<ChatPrefs>(() => {
    if (typeof localStorage === "undefined") return DEFAULT_PREFS;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return normalizePrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
    return DEFAULT_PREFS;
  });

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("global_chat_user_prefs")
        .select("font_size,density,sound_enabled,notify_mode,theme_accent")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancel || !data) return;
      setPrefs((prev) => {
        const next: ChatPrefs = {
          ...prev,
          font_size: (data.font_size as any) ?? prev.font_size,
          density: (data.density as any) ?? prev.density,
          sound_enabled: data.sound_enabled ?? prev.sound_enabled,
          notify_mode: (data.notify_mode as any) ?? prev.notify_mode,
          theme_accent: (data.theme_accent as any) ?? prev.theme_accent,
        };
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id]);

  async function update(patch: Partial<ChatPrefs>) {
    const next = normalizePrefs({ ...prefs, ...patch });
    setPrefs(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
    if (!user) return;
    // Only persist DB fields if they changed
    const dbPatch: Record<string, unknown> = {};
    for (const k of DB_FIELDS) if (k in patch) dbPatch[k] = (patch as any)[k];
    if (Object.keys(dbPatch).length === 0) return;
    await (supabase as any)
      .from("global_chat_user_prefs")
      .upsert({ user_id: user.id, ...dbPatch, updated_at: new Date().toISOString() });
  }

  return { prefs, update };
}

function normalizePrefs(input: ChatPrefs): ChatPrefs {
  const quick = Array.isArray(input.quick_reactions)
    ? input.quick_reactions
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 10)
    : DEFAULT_PREFS.quick_reactions;
  return {
    ...input,
    emote_size: ["compact", "normal", "large"].includes(input.emote_size)
      ? input.emote_size
      : DEFAULT_PREFS.emote_size,
    quick_reactions: quick.length ? quick : DEFAULT_PREFS.quick_reactions,
  };
}

export function fontSizeClass(size: ChatPrefs["font_size"]) {
  if (size === "sm") return "text-xs";
  if (size === "lg") return "text-base";
  return "text-sm";
}
export function densityClass(d: ChatPrefs["density"]) {
  if (d === "compact") return "space-y-1.5 py-2";
  if (d === "comfy") return "space-y-4 py-4";
  return "space-y-3 py-3";
}

/** Build a CSS background style for the chat window from prefs. */
export function chatBackgroundStyle(prefs: ChatPrefs): React.CSSProperties | undefined {
  const { bg_style, bg_color: c1, bg_color2: c2, bg_opacity } = prefs;
  if (bg_style === "default") return undefined;
  const base: React.CSSProperties = { opacity: undefined };
  let backgroundImage: string | undefined;
  let backgroundColor: string | undefined = c1;
  let backgroundSize: string | undefined;
  let backgroundPosition: string | undefined;

  switch (bg_style) {
    case "solid":
      backgroundImage = "none";
      break;
    case "gradient":
      backgroundImage = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
      break;
    case "mesh":
      backgroundImage = [
        `radial-gradient(at 20% 20%, ${c1} 0px, transparent 50%)`,
        `radial-gradient(at 80% 0%, ${c2} 0px, transparent 50%)`,
        `radial-gradient(at 80% 80%, ${c1} 0px, transparent 50%)`,
        `radial-gradient(at 0% 80%, ${c2} 0px, transparent 50%)`,
      ].join(", ");
      backgroundColor = "#000";
      break;
    case "dots":
      backgroundImage = `radial-gradient(${c2} 1px, transparent 1px)`;
      backgroundSize = "16px 16px";
      backgroundColor = c1;
      break;
    case "grid":
      backgroundImage = `linear-gradient(${c2}33 1px, transparent 1px), linear-gradient(90deg, ${c2}33 1px, transparent 1px)`;
      backgroundSize = "24px 24px";
      backgroundColor = c1;
      break;
    case "stripes":
      backgroundImage = `repeating-linear-gradient(45deg, ${c1} 0 12px, ${c2} 12px 24px)`;
      break;
    case "aurora":
      backgroundImage = [
        `radial-gradient(60% 50% at 20% 30%, ${c1}cc 0%, transparent 60%)`,
        `radial-gradient(50% 60% at 80% 70%, ${c2}cc 0%, transparent 60%)`,
        `radial-gradient(40% 40% at 60% 20%, ${c1}88 0%, transparent 60%)`,
      ].join(", ");
      backgroundColor = "#05060d";
      break;
    case "aurora-anim":
      backgroundImage = [
        `radial-gradient(60% 50% at 20% 30%, ${c1}cc 0%, transparent 60%)`,
        `radial-gradient(50% 60% at 80% 70%, ${c2}cc 0%, transparent 60%)`,
        `radial-gradient(40% 40% at 60% 20%, ${c1}88 0%, transparent 60%)`,
      ].join(", ");
      backgroundColor = "#05060d";
      backgroundSize = "200% 200%";
      (base as any).animation = "chatbg-aurora 18s ease-in-out infinite";
      break;
    case "stars":
      backgroundImage = [
        `radial-gradient(2px 2px at 20% 30%, #fff, transparent)`,
        `radial-gradient(1.5px 1.5px at 70% 80%, #fff, transparent)`,
        `radial-gradient(1.5px 1.5px at 40% 60%, #fff, transparent)`,
        `radial-gradient(2px 2px at 85% 25%, #fff, transparent)`,
        `radial-gradient(1px 1px at 10% 80%, #fff, transparent)`,
        `radial-gradient(1.5px 1.5px at 55% 15%, #fff, transparent)`,
      ].join(", ");
      backgroundSize = "300px 300px";
      backgroundColor = "#03040a";
      (base as any).animation = "chatbg-stars 60s linear infinite";
      break;
    case "matrix":
      backgroundImage = `repeating-linear-gradient(180deg, ${c1}22 0 2px, transparent 2px 22px), repeating-linear-gradient(90deg, ${c2}22 0 2px, transparent 2px 22px)`;
      backgroundColor = "#020a04";
      backgroundSize = "100% 100%, 100% 100%";
      (base as any).animation = "chatbg-matrix 30s linear infinite";
      break;
    case "roblox-studio":
      // Diagonal blueprint / grid like Roblox Studio viewport
      backgroundImage = `
        linear-gradient(135deg, #0e1726 0%, #1a2a4a 100%),
        linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
      `;
      backgroundSize = "100% 100%, 36px 36px, 36px 36px";
      backgroundColor = "#0e1726";
      break;
    case "neon-city":
      backgroundImage = [
        `radial-gradient(60% 60% at 20% 80%, #ec489966 0%, transparent 60%)`,
        `radial-gradient(60% 60% at 80% 20%, #06b6d466 0%, transparent 60%)`,
        `linear-gradient(180deg, #07091a 0%, #1a0b2e 100%)`,
      ].join(", ");
      backgroundColor = "#07091a";
      backgroundSize = "200% 200%, 200% 200%, 100% 100%";
      (base as any).animation = "chatbg-aurora 24s ease-in-out infinite";
      break;
    case "lava":
      backgroundImage = [
        `radial-gradient(50% 50% at 30% 70%, #f9731699 0%, transparent 60%)`,
        `radial-gradient(50% 50% at 70% 30%, #dc262699 0%, transparent 60%)`,
        `linear-gradient(180deg, #1a0a05 0%, #2b0a04 100%)`,
      ].join(", ");
      backgroundColor = "#1a0a05";
      backgroundSize = "200% 200%, 200% 200%, 100% 100%";
      (base as any).animation = "chatbg-aurora 16s ease-in-out infinite";
      break;
    case "custom-image":
      if (prefs.bg_image_url) {
        backgroundImage = `url("${prefs.bg_image_url}")`;
        backgroundSize = "cover";
        backgroundPosition = "center";
        backgroundColor = "#000";
      }
      break;
  }

  return {
    ...base,
    backgroundColor,
    backgroundImage,
    backgroundSize,
    backgroundPosition,
    // Use a wrapper opacity via rgba isn't trivial; rely on bg_opacity for color mixing.
    // Apply opacity to background by layering with a translucent overlay using filter is complex —
    // instead use bg_opacity to fade the colors via opacity on the aside is too strong.
    // We expose --chat-bg-opacity for downstream overlays if needed.
    ["--chat-bg-opacity" as any]: String(bg_opacity),
  };
}
