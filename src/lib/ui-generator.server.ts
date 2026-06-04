// UI Generator: fast Roblox ScreenGui spec generation + plugin action conversion.
// Server-only.
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { createProvider } from "@/lib/ai-providers.server";
import {
  createGroqProvider,
  BLOXSMITH_THINK_MODEL,
  sanitizingFetch,
} from "@/lib/ai-gateway.server";
import { getNeokensApiKey } from "@/lib/neokens-config.server";

function createLovableProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: sanitizingFetch,
  });
}

// ---------------- UISpec schema ----------------
// Compact, model-friendly schema. Coordinates use a single struct so the model
// has fewer ways to get it wrong than emitting Roblox UDim2 strings.

const Udim2 = z.object({
  xScale: z.number().min(-1).max(2),
  xOffset: z.number().int().min(-2000).max(2000),
  yScale: z.number().min(-1).max(2),
  yOffset: z.number().int().min(-2000).max(2000),
});

const Color = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

const ElementBase = {
  id: z.string().min(1).max(48),
  name: z.string().min(1).max(60),
  position: Udim2.optional(),
  size: Udim2.optional(),
  anchorPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  zIndex: z.number().int().min(0).max(100).optional(),
  backgroundColor: Color.optional(),
  backgroundTransparency: z.number().min(0).max(1).optional(),
  cornerRadius: z.number().int().min(0).max(240).optional(),
  strokeColor: Color.optional(),
  strokeThickness: z.number().min(0).max(10).optional(),
  gradient: z
    .object({
      from: Color,
      to: Color,
      rotation: z.number().min(0).max(360).default(90),
    })
    .optional(),
};

type UIElement = {
  type: "Frame" | "TextLabel" | "TextButton" | "ImageButton" | "ImageLabel" | "ScrollingFrame";
  id: string;
  name: string;
  text?: string;
  textColor?: { r: number; g: number; b: number };
  textSize?: number;
  font?: string;
  textAlign?: "Left" | "Center" | "Right";
  image?: string; // rbxassetid:// or asset id number string
  position?: z.infer<typeof Udim2>;
  size?: z.infer<typeof Udim2>;
  anchorPoint?: { x: number; y: number };
  zIndex?: number;
  backgroundColor?: { r: number; g: number; b: number };
  backgroundTransparency?: number;
  cornerRadius?: number;
  strokeColor?: { r: number; g: number; b: number };
  strokeThickness?: number;
  gradient?: {
    from: { r: number; g: number; b: number };
    to: { r: number; g: number; b: number };
    rotation: number;
  };
  layout?: "List" | "Grid" | "None";
  layoutDirection?: "Vertical" | "Horizontal";
  layoutPadding?: number;
  cellSize?: z.infer<typeof Udim2>;
  children?: UIElement[];
};

// Use z.lazy for recursion so both AI output and deterministic templates validate.
const UIElementSchema: z.ZodType<UIElement> = z.lazy(() =>
  z.object({
    type: z.enum([
      "Frame",
      "TextLabel",
      "TextButton",
      "ImageButton",
      "ImageLabel",
      "ScrollingFrame",
    ]),
    ...ElementBase,
    text: z.string().max(200).optional(),
    textColor: Color.optional(),
    textSize: z.number().int().min(8).max(64).optional(),
    font: z.string().max(40).optional(),
    textAlign: z.enum(["Left", "Center", "Right"]).optional(),
    image: z.string().max(120).optional(),
    layout: z.enum(["List", "Grid", "None"]).optional(),
    layoutDirection: z.enum(["Vertical", "Horizontal"]).optional(),
    layoutPadding: z.number().int().min(0).max(80).optional(),
    cellSize: Udim2.optional(),
    children: z.array(UIElementSchema).max(40).optional(),
  }),
) as unknown as z.ZodType<UIElement>;

export const UISpecSchema = z.object({
  title: z.string().min(1).max(80),
  screenGuiName: z.string().min(1).max(60),
  mobileFriendly: z.boolean().default(true),
  description: z.string().max(400).optional(),
  root: UIElementSchema,
  remoteEvents: z.array(z.string().min(1).max(60)).max(10).optional(),
  serverScript: z.string().max(8000).optional(),
  localScript: z.string().max(8000).optional(),
});

export type UISpec = z.infer<typeof UISpecSchema>;

// ---------------- Categories & system prompt ----------------

export const UI_CATEGORIES = [
  "Gamepass Shop",
  "Dev Product Shop",
  "Coin Shop",
  "Gem Shop",
  "Main Menu",
  "Title Screen",
  "Pause Menu",
  "Loading Screen",
  "Settings Menu",
  "Inventory",
  "Pet Inventory",
  "Crafting UI",
  "Skill Tree",
  "Battle Pass",
  "Map Vote UI",
  "Dialogue UI",
  "Notification UI",
  "Trading",
  "Daily Rewards",
  "Spin Wheel",
  "Codes Redeem",
  "Quest UI",
  "Teleport UI",
  "Upgrade UI",
  "Rebirth UI",
  "Leaderboard",
  "Admin Panel",
  "Mobile Controls",
  "HUD",
  "Custom",
] as const;

export type UICategory = (typeof UI_CATEGORIES)[number];

export const UI_STYLES = ["Modern", "Neon", "Minimal", "Cartoon", "Glass", "Anime"] as const;
export type UIStyle = (typeof UI_STYLES)[number];

const UI_AI_TIMEOUT_MS = 12_000;
const UI_AI_OUTPUT_TOKENS = 6_500;

const STYLE_HINTS: Record<UIStyle, string> = {
  Modern:
    "Rounded corners (12-16px), drop shadows via UIStroke, balanced spacing, subtle gradients.",
  Neon: "Dark backgrounds, glowing neon accents on borders/text, strong gradients, vivid primary color.",
  Minimal:
    "Flat colors, no gradients, thin strokes, generous whitespace, small corner radius (4-8px).",
  Cartoon:
    "Thick borders (3-4px), bright saturated colors, large rounded corners (20-28px), playful fonts (FredokaOne/LuckiestGuy).",
  Glass:
    "Semi-transparent backgrounds (0.3-0.5 transparency), subtle gradients, frosted look, thin white strokes.",
  Anime: "Pastel/vivid gradients, sharp accents, decorative strokes, rounded but stylized.",
};

export const UI_SYSTEM_PROMPT = `You are BloxSmith's Roblox UI Generator. You design beautiful, production-ready Roblox ScreenGui layouts.

OUTPUT CONTRACT
Return a single JSON object matching the UISpec schema:
- title: short human title
- screenGuiName: PascalCase ScreenGui name (e.g. "GamepassShopGui")
- mobileFriendly: true unless user says otherwise
- root: a Frame element (the main container) with children
- remoteEvents: list of RemoteEvent names if the UI needs server validation (purchases, rewards)
- serverScript: optional Luau ServerScript content (validate purchases server-side)
- localScript: optional Luau LocalScript content (UI behavior, button handlers)

LAYOUT RULES
- Root Frame should fill the screen or center a modal. Use Scale (not Offset) so it scales on all devices.
- Use anchorPoint {x:0.5, y:0.5} + position {xScale:0.5, yScale:0.5} for centered modals.
- Make the UI look premium: layered panels, clear hierarchy, vivid accent borders, gradients, decorative badges, status rows, and strong Roblox game readability.
- Never ship an empty/simple one-card GUI. Every result needs at least: themed background, headline/title, subtitle/status text, 3-6 primary actions, at least one secondary panel/card/list, close/back affordance when appropriate, and a LocalScript that wires clicks + hover/press feedback.
- Main menus must feel like a real Roblox game's first screen: title/logo area, Play as the dominant CTA, Settings/Shop/Credits/Servers or Updates, a news/updates card, a player/profile or reward card, footer/version text, animated entry, hover grow, press squish, and Play should hide the menu.
- For vague prompts like "make a menu", infer a complete, polished main menu shell instead of asking follow-up questions.
- For HUDs, include currency/resource counters, objective/quest text, compact buttons, notification/toast area, and mobile-safe spacing.
- For shops/inventories/rewards, include item cards with labels, price/rarity/status badges, primary CTA, selected-state behavior in LocalScript, and server RemoteEvents when rewards or purchases matter.
- Vary the composition to fit the request. Do not reuse the same panel every time. Choose from full-screen title screens, side navigation dashboards, bottom action bars, card grids, radial/action menus, modal dialogs, HUD overlays, quest dialogue, map voting, crafting, battle pass, skill tree, and notification/toast systems.
- Backgrounds must fit the prompt theme: space, city, fantasy, obby, tycoon, horror, cute, simulator, premium, forest, ocean, lava, icy, cyber, and Roblox lobby styles should each look distinct through layered 2D Frames/ImageLabels, gradients, skyline/silhouette strips, clouds/stars, glass panels, or themed icon cards.
- For Main Menu, title screen, loading screen, or any request mentioning a background: build a full-screen 2D background INSIDE the ScreenGui. Use an ImageLabel or Frame named BackgroundImage/BackgroundLayer with size {1,0,1,0}, position {0,0,0,0}, zIndex 1, ScaleType Crop if image, plus a dark overlay if needed. Put title/buttons above it at zIndex 3+. Never represent UI backgrounds with Workspace parts, 3D models, terrain, or giant blocks.
- Buttons: cornerRadius 10-18, strokeThickness 1-3, hover-friendly sizes (min 44px height), bold labels.
- Circular widgets such as spin wheels, profile rings, or meters may use high cornerRadius values matching half their pixel size.
- For shop grids use layout:"Grid" with cellSize.
- For lists use layout:"List" with layoutDirection.
- Always set readable textColor (high contrast against background).
- Colors in 0-255 RGB. Use real palettes, not always grey.

LUAU RULES
- LocalScripts go inside the UI. Use script.Parent to find elements (use .Name lookups matching ids).
- RemoteEvents you declare go in ReplicatedStorage. Server script in ServerScriptService listens.
- For Gamepass/DevProduct shops: use MarketplaceService:PromptGamePassPurchase / PromptProductPurchase. Validate ownership server-side with UserOwnsGamePassAsync. Never trust the client.
- For coins/gems/codes/spin/daily rewards: server validates and updates leaderstats. Client only requests.
- Keep scripts concise: under 150 lines each. Use clear comments.
- Use task.wait / task.spawn (not wait/spawn).

QUALITY BAR
- The UI should look like it belongs in a top Roblox game: no default grey panels, no tiny text, no cramped controls, no unstyled buttons, no floating unlabeled boxes.
- Use depth: background layer, overlay layer, panel/card layer, text/action layer. Keep ZIndex ordered.
- Use names that make scripts reliable: PlayButton, SettingsButton, ShopButton, CloseButton, MainPanel, ButtonStack, NewsCard, RewardCard, HudBar, ContentGrid.
- Prefer complete working behavior over decorative-only UI. If the UI has buttons, the LocalScript must wire them.
- Add a small UI click Sound in the LocalScript (SoundId rbxassetid://6895079853, Volume 0.35) and play it on button clicks unless the user explicitly asks for silent UI.

DO NOT include markdown, prose, or explanations — JSON only.`;

function wantsMainMenuBackground(opts: { category: UICategory; prompt: string }) {
  return (
    opts.category === "Main Menu" ||
    opts.category === "Title Screen" ||
    opts.category === "Loading Screen" ||
    /\b(main\s*menu|title\s*screen|start\s*screen|play\s*button|menu\s+background|background\s+menu)\b/i.test(
      opts.prompt,
    )
  );
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixColor(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  amount: number,
) {
  return {
    r: clampColor(a.r + (b.r - a.r) * amount),
    g: clampColor(a.g + (b.g - a.g) * amount),
    b: clampColor(a.b + (b.b - a.b) * amount),
  };
}

function themedBackgroundLayers(opts: {
  prompt: string;
  primary: { r: number; g: number; b: number };
  accent: { r: number; g: number; b: number };
  bg: { r: number; g: number; b: number };
  variant: number;
}): UIElement[] {
  const text = opts.prompt.toLowerCase();
  const isSpace = /space|galaxy|planet|star|cosmic/.test(text);
  const isCity = /city|street|tower|skyscraper|urban/.test(text);
  const isFantasy = /fantasy|magic|castle|medieval|dragon|forest/.test(text);
  const isLava = /lava|fire|volcano|inferno/.test(text);
  const isIce = /ice|snow|frost|winter/.test(text);
  const themeColor = isLava
    ? { r: 236, g: 76, b: 32 }
    : isIce
      ? { r: 96, g: 210, b: 255 }
      : isFantasy
        ? { r: 80, g: 220, b: 140 }
        : isCity
          ? { r: 55, g: 142, b: 255 }
          : isSpace
            ? { r: 154, g: 101, b: 255 }
            : opts.primary;
  const secondary = mixColor(opts.accent, themeColor, 0.45);
  const horizonY = [0.72, 0.62, 0.78, 0.56][opts.variant % 4] ?? 0.7;
  const layers: UIElement[] = [
    {
      type: "Frame",
      id: "BackgroundLayer",
      name: "BackgroundLayer",
      position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
      size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
      backgroundColor: mixColor(opts.bg, themeColor, 0.18),
      gradient: {
        from: mixColor(opts.bg, themeColor, 0.08),
        to: mixColor(opts.bg, secondary, 0.4),
        rotation: [25, 120, 60, 155][opts.variant % 4] ?? 35,
      },
      zIndex: 1,
    },
    {
      type: "Frame",
      id: "HorizonBand",
      name: "HorizonBand",
      position: { xScale: 0, xOffset: 0, yScale: horizonY, yOffset: 0 },
      size: { xScale: 1, xOffset: 0, yScale: 0.12, yOffset: 0 },
      backgroundColor: themeColor,
      backgroundTransparency: 0.56,
      gradient: { from: themeColor, to: secondary, rotation: 0 },
      zIndex: 1,
    },
    {
      type: "Frame",
      id: "ThemeSilhouetteA",
      name: "ThemeSilhouetteA",
      position: {
        xScale: isCity ? 0.05 : 0.08,
        xOffset: 0,
        yScale: isCity ? 0.42 : 0.22,
        yOffset: 0,
      },
      size: { xScale: 0, xOffset: isCity ? 96 : 240, yScale: 0, yOffset: isCity ? 280 : 240 },
      backgroundColor: mixColor(themeColor, opts.bg, isCity ? 0.25 : 0.1),
      backgroundTransparency: 0.5,
      cornerRadius: isCity ? 8 : 120,
      strokeColor: secondary,
      strokeThickness: 1,
      zIndex: 1,
    },
    {
      type: "Frame",
      id: "ThemeSilhouetteB",
      name: "ThemeSilhouetteB",
      position: {
        xScale: isCity ? 0.72 : 0.68,
        xOffset: 0,
        yScale: isCity ? 0.36 : 0.14,
        yOffset: 0,
      },
      size: { xScale: 0, xOffset: isCity ? 124 : 300, yScale: 0, yOffset: isCity ? 330 : 300 },
      backgroundColor: secondary,
      backgroundTransparency: 0.62,
      cornerRadius: isCity ? 10 : 150,
      strokeColor: themeColor,
      strokeThickness: 1,
      zIndex: 1,
    },
    {
      type: "Frame",
      id: "DarkOverlay",
      name: "DarkOverlay",
      position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
      size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
      backgroundColor: { r: 0, g: 0, b: 0 },
      backgroundTransparency: 0.38,
      zIndex: 2,
    },
  ];
  return layers;
}

// ---------------- AI gateway pick (mirrors help-chat) ----------------
type GatewayChoice = { gw: (m: string) => any; modelName: string; providerName: string };

function listGateways(): GatewayChoice[] {
  const out: GatewayChoice[] = [];
  // Prefer user-supplied Gemini key first when set (cheapest + user controls quota).
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const gw = createProvider("google", geminiKey);
    out.push({ gw, modelName: "gemini-2.5-flash", providerName: "google" });
    out.push({ gw, modelName: "gemini-2.5-pro", providerName: "google" });
  }
  const neoKey = getNeokensApiKey();
  if (neoKey) {
    const gw = createProvider("neokens", neoKey);
    out.push({ gw, modelName: "gemini-3-flash", providerName: "neokens" });
    out.push({ gw, modelName: "gpt-5.2", providerName: "neokens" });
  }
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    out.push({
      gw: createGroqProvider(groqKey),
      modelName: BLOXSMITH_THINK_MODEL,
      providerName: "groq",
    });
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    const gw = createLovableProvider(lovableKey);
    out.push({ gw, modelName: "google/gemini-3-flash-preview", providerName: "lovable" });
    out.push({ gw, modelName: "openai/gpt-5-mini", providerName: "lovable" });
  }
  return out;
}

function safeInstanceName(value: string | undefined, fallback: string) {
  const cleaned = String(value || fallback)
    .replace(/[^A-Za-z0-9_ ]+/g, " ")
    .trim()
    .replace(/\s+/g, "");
  return cleaned || fallback;
}

function cleanJsonText(text: string) {
  const raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return candidate;
}

function parseJsonObject(text: string) {
  return JSON.parse(cleanJsonText(text));
}

function normalizeElement(el: UIElement, fallbackName: string): UIElement {
  const name = safeInstanceName(el.name || el.id, fallbackName);
  const out: UIElement = {
    ...el,
    id: safeInstanceName(el.id || name, name),
    name,
    children: Array.isArray(el.children)
      ? el.children
          .slice(0, 40)
          .map((child, idx) => normalizeElement(child, `${name}Child${idx + 1}`))
      : undefined,
  };
  if (out.type === "TextLabel" || out.type === "TextButton") {
    out.textSize ??= 18;
    out.textColor ??= { r: 255, g: 255, b: 255 };
    out.backgroundTransparency ??= out.type === "TextLabel" ? 1 : out.backgroundTransparency;
  }
  return out;
}

function applyVisibilityDefaults(el: UIElement, zIndex = 1): UIElement {
  const next: UIElement = {
    ...el,
    zIndex: el.zIndex ?? zIndex,
    backgroundTransparency:
      el.type === "TextLabel" ? (el.backgroundTransparency ?? 1) : el.backgroundTransparency,
  };
  const childZ = Math.max(next.zIndex ?? zIndex, zIndex) + 1;
  next.children = next.children?.map((child, idx) => {
    const requestedZ = child.zIndex ?? childZ + idx;
    return applyVisibilityDefaults(child, requestedZ);
  });
  return next;
}

function normalizeUISpec(
  spec: UISpec,
  opts: { category: UICategory; bgColor?: { r: number; g: number; b: number } },
): UISpec {
  const title = spec.title?.trim() || `${opts.category} UI`;
  const screenGuiName = safeInstanceName(
    spec.screenGuiName,
    `${safeInstanceName(title, "BloxSmithUI")}Gui`,
  );
  const root = applyVisibilityDefaults(normalizeElement(spec.root, "RootFrame"), 1);
  root.type = "Frame";
  root.id ||= "RootFrame";
  root.name ||= "RootFrame";
  root.position ??= { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 };
  root.size ??= { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 };
  root.backgroundColor ??= opts.bgColor ?? { r: 15, g: 23, b: 42 };
  root.backgroundTransparency ??= 0;
  root.zIndex ??= 1;
  return UISpecSchema.parse({
    ...spec,
    title,
    screenGuiName,
    root,
    mobileFriendly: spec.mobileFriendly ?? true,
  });
}

function buttonTextForCategory(category: UICategory) {
  if (category.includes("Shop")) return ["VIP Pass", "2x Coins", "Starter Pack", "Ultra Bundle"];
  if (category === "Inventory" || category === "Pet Inventory")
    return ["Equip", "Upgrade", "Favorite", "Delete"];
  if (category === "Trading") return ["Add Item", "Ready", "Accept", "Cancel"];
  if (category === "Daily Rewards") return ["Day 1", "Day 2", "Day 3", "Claim"];
  if (category === "Spin Wheel") return ["Spin", "Lucky Boost", "Rewards", "Close"];
  if (category === "Settings Menu") return ["Music", "SFX", "Graphics", "Controls"];
  if (category === "Admin Panel") return ["Kick", "Ban", "Give Coins", "Teleport"];
  if (category === "Pause Menu") return ["Resume", "Settings", "Respawn", "Leave"];
  if (category === "Title Screen") return ["Play", "Servers", "Shop", "Settings"];
  if (category === "Crafting UI") return ["Craft", "Recipe", "Materials", "Upgrade"];
  if (category === "Skill Tree") return ["Unlock", "Equip", "Reset", "Details"];
  if (category === "Battle Pass") return ["Claim", "Premium", "Missions", "Rewards"];
  if (category === "Map Vote UI") return ["Vote Map 1", "Vote Map 2", "Vote Map 3", "Ready"];
  if (category === "Dialogue UI") return ["Continue", "Quest", "Accept", "Close"];
  if (category === "Notification UI") return ["Claim", "View", "Dismiss", "Next"];
  return ["Play", "Shop", "Settings", "Close"];
}

function createFallbackUISpec(opts: {
  category: UICategory;
  style: UIStyle;
  prompt: string;
  primaryColor?: { r: number; g: number; b: number };
  accentColor?: { r: number; g: number; b: number };
  bgColor?: { r: number; g: number; b: number };
  title?: string;
}): UISpec {
  const primary = opts.primaryColor ?? { r: 245, g: 158, b: 11 };
  const accent = opts.accentColor ?? { r: 139, g: 92, b: 246 };
  const bg = opts.bgColor ?? { r: 15, g: 23, b: 42 };
  const title = opts.title?.trim() || `${opts.category}`;
  const screenGuiName = safeInstanceName(`${title}Gui`, "BloxSmithGeneratedGui");
  const buttons = buttonTextForCategory(opts.category);
  const needsRemote = /Shop|Rewards|Spin|Codes|Trading|Admin/.test(opts.category);
  const variant = stableHash(`${opts.category}|${opts.style}|${opts.prompt}|${title}`) % 4;
  const backgroundLayers = themedBackgroundLayers({
    prompt: `${opts.category} ${opts.prompt}`,
    primary,
    accent,
    bg,
    variant,
  });

  if (wantsMainMenuBackground(opts)) {
    const menuButtons = ["Play", "Settings", "Shop", "Credits"].map(
      (label, idx): UIElement => ({
        type: "TextButton",
        id: `${label}Button`,
        name: `${label}Button`,
        text: label,
        textColor: { r: 255, g: 255, b: 255 },
        textSize: idx === 0 ? 28 : 22,
        font: "GothamBlack",
        size: { xScale: 1, xOffset: 0, yScale: 0, yOffset: idx === 0 ? 76 : 62 },
        backgroundColor: idx === 0 ? primary : { r: 24, g: 34, b: 52 },
        backgroundTransparency: idx === 0 ? 0 : 0.06,
        strokeColor: idx === 0 ? { r: 255, g: 255, b: 255 } : accent,
        strokeThickness: idx === 0 ? 3 : 2,
        cornerRadius: opts.style === "Cartoon" ? 24 : 18,
        gradient:
          opts.style === "Minimal"
            ? undefined
            : {
                from: idx === 0 ? primary : { r: 30, g: 41, b: 59 },
                to: idx === 0 ? accent : bg,
                rotation: 115,
              },
        zIndex: 4,
      }),
    );
    const menuInfoCards: UIElement[] = [
      {
        type: "Frame",
        id: "UpdateCard",
        name: "UpdateCard",
        size: { xScale: 1, xOffset: 0, yScale: 0, yOffset: 86 },
        backgroundColor: { r: 12, g: 18, b: 32 },
        backgroundTransparency: 0.08,
        cornerRadius: 18,
        strokeColor: primary,
        strokeThickness: 1.5,
        zIndex: 4,
        children: [
          {
            type: "TextLabel",
            id: "UpdateTitle",
            name: "UpdateTitle",
            text: "NEW UPDATE",
            textColor: primary,
            textSize: 14,
            font: "GothamBlack",
            position: { xScale: 0.07, xOffset: 0, yScale: 0.16, yOffset: 0 },
            size: { xScale: 0.86, xOffset: 0, yScale: 0, yOffset: 22 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 5,
          },
          {
            type: "TextLabel",
            id: "UpdateText",
            name: "UpdateText",
            text: "Fresh worlds, rewards, and limited boosts are live.",
            textColor: { r: 226, g: 232, b: 240 },
            textSize: 15,
            font: "GothamBold",
            position: { xScale: 0.07, xOffset: 0, yScale: 0.47, yOffset: 0 },
            size: { xScale: 0.86, xOffset: 0, yScale: 0, yOffset: 26 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 5,
          },
        ],
      },
      {
        type: "Frame",
        id: "RewardCard",
        name: "RewardCard",
        size: { xScale: 1, xOffset: 0, yScale: 0, yOffset: 86 },
        backgroundColor: mixColor(accent, bg, 0.52),
        backgroundTransparency: 0.02,
        cornerRadius: 18,
        strokeColor: accent,
        strokeThickness: 1.5,
        zIndex: 4,
        children: [
          {
            type: "TextLabel",
            id: "RewardTitle",
            name: "RewardTitle",
            text: "DAILY REWARD",
            textColor: { r: 255, g: 255, b: 255 },
            textSize: 14,
            font: "GothamBlack",
            position: { xScale: 0.07, xOffset: 0, yScale: 0.16, yOffset: 0 },
            size: { xScale: 0.86, xOffset: 0, yScale: 0, yOffset: 22 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 5,
          },
          {
            type: "TextLabel",
            id: "RewardText",
            name: "RewardText",
            text: "+500 coins waiting",
            textColor: { r: 241, g: 245, b: 249 },
            textSize: 18,
            font: "GothamBlack",
            position: { xScale: 0.07, xOffset: 0, yScale: 0.47, yOffset: 0 },
            size: { xScale: 0.86, xOffset: 0, yScale: 0, yOffset: 28 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 5,
          },
        ],
      },
      {
        type: "Frame",
        id: "ServerCard",
        name: "ServerCard",
        size: { xScale: 1, xOffset: 0, yScale: 0, yOffset: 86 },
        backgroundColor: { r: 8, g: 13, b: 24 },
        backgroundTransparency: 0.1,
        cornerRadius: 18,
        strokeColor: { r: 148, g: 163, b: 184 },
        strokeThickness: 1,
        zIndex: 4,
        children: [
          {
            type: "TextLabel",
            id: "ServerTitle",
            name: "ServerTitle",
            text: "SERVER STATUS",
            textColor: { r: 148, g: 163, b: 184 },
            textSize: 13,
            font: "GothamBlack",
            position: { xScale: 0.07, xOffset: 0, yScale: 0.16, yOffset: 0 },
            size: { xScale: 0.86, xOffset: 0, yScale: 0, yOffset: 22 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 5,
          },
          {
            type: "TextLabel",
            id: "ServerText",
            name: "ServerText",
            text: "Fast matchmaking enabled",
            textColor: { r: 226, g: 232, b: 240 },
            textSize: 16,
            font: "GothamBold",
            position: { xScale: 0.07, xOffset: 0, yScale: 0.47, yOffset: 0 },
            size: { xScale: 0.86, xOffset: 0, yScale: 0, yOffset: 26 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 5,
          },
        ],
      },
    ];

    const spec: UISpec = {
      title,
      screenGuiName,
      mobileFriendly: true,
      description:
        "Generated main menu with a real full-screen 2D ScreenGui background layer, overlay, title, and animated buttons.",
      root: {
        type: "Frame",
        id: "RootFrame",
        name: "RootFrame",
        position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
        size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
        backgroundColor: bg,
        children: [
          ...backgroundLayers,
          {
            type: "TextLabel",
            id: "TitleLabel",
            name: "TitleLabel",
            text: title,
            textColor: { r: 255, g: 255, b: 255 },
            textSize: 52,
            font: opts.style === "Cartoon" ? "LuckiestGuy" : "GothamBlack",
            position: { xScale: 0.055, xOffset: 0, yScale: 0.12, yOffset: 0 },
            size: { xScale: 0.72, xOffset: 0, yScale: 0, yOffset: 72 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 4,
          },
          {
            type: "TextLabel",
            id: "EyebrowLabel",
            name: "EyebrowLabel",
            text: "FEATURED EXPERIENCE",
            textColor: primary,
            textSize: 14,
            font: "GothamBlack",
            position: { xScale: 0.06, xOffset: 0, yScale: 0.085, yOffset: 0 },
            size: { xScale: 0.42, xOffset: 0, yScale: 0, yOffset: 24 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 4,
          },
          {
            type: "TextLabel",
            id: "SubtitleLabel",
            name: "SubtitleLabel",
            text: opts.prompt.slice(0, 74) || "Jump into your Roblox adventure",
            textColor: { r: 226, g: 232, b: 240 },
            textSize: 18,
            font: "GothamBold",
            position: { xScale: 0.06, xOffset: 0, yScale: 0.23, yOffset: 0 },
            size: { xScale: 0.56, xOffset: 0, yScale: 0, yOffset: 38 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 4,
          },
          {
            type: "Frame",
            id: "PlayerCard",
            name: "PlayerCard",
            position: { xScale: 0.06, xOffset: 0, yScale: 0.295, yOffset: 0 },
            size: { xScale: 0, xOffset: 360, yScale: 0, yOffset: 54 },
            backgroundColor: { r: 5, g: 8, b: 18 },
            backgroundTransparency: 0.32,
            cornerRadius: 18,
            strokeColor: { r: 255, g: 255, b: 255 },
            strokeThickness: 1,
            zIndex: 3,
            children: [
              {
                type: "TextLabel",
                id: "PlayerNameLabel",
                name: "PlayerNameLabel",
                text: "Welcome back, player",
                textColor: { r: 255, g: 255, b: 255 },
                textSize: 16,
                font: "GothamBold",
                position: { xScale: 0.06, xOffset: 0, yScale: 0.18, yOffset: 0 },
                size: { xScale: 0.88, xOffset: 0, yScale: 0, yOffset: 24 },
                backgroundTransparency: 1,
                textAlign: "Left",
                zIndex: 4,
              },
              {
                type: "TextLabel",
                id: "PlayerStatusLabel",
                name: "PlayerStatusLabel",
                text: "Level 1 - Ready to play",
                textColor: { r: 203, g: 213, b: 225 },
                textSize: 13,
                font: "Gotham",
                position: { xScale: 0.06, xOffset: 0, yScale: 0.58, yOffset: 0 },
                size: { xScale: 0.88, xOffset: 0, yScale: 0, yOffset: 18 },
                backgroundTransparency: 1,
                textAlign: "Left",
                zIndex: 4,
              },
            ],
          },
          {
            type: "Frame",
            id: "ButtonStack",
            name: "ButtonStack",
            position: { xScale: 0.06, xOffset: 0, yScale: 0.38, yOffset: 0 },
            size: { xScale: 0, xOffset: 360, yScale: 0, yOffset: 330 },
            backgroundColor: { r: 5, g: 8, b: 18 },
            backgroundTransparency: 0.22,
            cornerRadius: 24,
            strokeColor: { r: 255, g: 255, b: 255 },
            strokeThickness: 1.5,
            layout: "List",
            layoutPadding: 14,
            zIndex: 3,
            children: menuButtons,
          },
          {
            type: "Frame",
            id: "RightInfoPanel",
            name: "RightInfoPanel",
            position: { xScale: 0.67, xOffset: 0, yScale: 0.18, yOffset: 0 },
            size: { xScale: 0, xOffset: 330, yScale: 0, yOffset: 332 },
            backgroundColor: { r: 5, g: 8, b: 18 },
            backgroundTransparency: 0.26,
            cornerRadius: 24,
            strokeColor: accent,
            strokeThickness: 1.5,
            layout: "List",
            layoutPadding: 12,
            zIndex: 3,
            children: menuInfoCards,
          },
          {
            type: "TextLabel",
            id: "VersionLabel",
            name: "VersionLabel",
            text: "v1.0 - BloxSmith generated menu",
            textColor: { r: 148, g: 163, b: 184 },
            textSize: 13,
            font: "GothamBold",
            position: { xScale: 0.06, xOffset: 0, yScale: 0.91, yOffset: 0 },
            size: { xScale: 0.52, xOffset: 0, yScale: 0, yOffset: 28 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 4,
          },
        ],
      },
      remoteEvents: [],
      localScript: `local TweenService = game:GetService("TweenService")
local gui = script.Parent
local stack = gui:FindFirstChild("ButtonStack", true)
local rightPanel = gui:FindFirstChild("RightInfoPanel", true)
local playerName = gui:FindFirstChild("PlayerNameLabel", true)
local player = game:GetService("Players").LocalPlayer
local clickSound = gui:FindFirstChild("UIClickSound")
if not clickSound then
\tclickSound = Instance.new("Sound")
\tclickSound.Name = "UIClickSound"
\tclickSound.SoundId = "rbxassetid://6895079853"
\tclickSound.Volume = 0.35
\tclickSound.Parent = gui
end
if playerName and playerName:IsA("TextLabel") and player then
\tplayerName.Text = "Welcome back, " .. player.DisplayName
end
local function wireButton(button)
\tif not button:IsA("TextButton") then return end
\tlocal normalSize = button.Size
\tbutton.MouseEnter:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = normalSize + UDim2.fromOffset(10, 4) }):Play()
\tend)
\tbutton.MouseLeave:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = normalSize }):Play()
\tend)
\tbutton.MouseButton1Down:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = normalSize + UDim2.fromOffset(-6, -3) }):Play()
\tend)
\tbutton.MouseButton1Up:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.11, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Size = normalSize + UDim2.fromOffset(10, 4) }):Play()
\tend)
\tbutton.MouseButton1Click:Connect(function()
\t\tif clickSound then clickSound:Play() end
\t\tprint("[BloxSmith MainMenu] clicked", button.Name)
\t\tif button.Name == "PlayButton" then gui.Enabled = false end
\tend)
end
for _, item in ipairs(gui:GetDescendants()) do wireButton(item) end
if stack then
\tstack.Position = stack.Position + UDim2.fromOffset(-30, 0)
\tTweenService:Create(stack, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Position = UDim2.fromScale(0.06, 0.38) }):Play()
end
if rightPanel then
\trightPanel.Position = rightPanel.Position + UDim2.fromOffset(30, 0)
\tTweenService:Create(rightPanel, TweenInfo.new(0.42, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Position = UDim2.fromScale(0.67, 0.18) }):Play()
end`,
    };

    return normalizeUISpec(spec, opts);
  }

  if (opts.category === "Spin Wheel") {
    const rewards = ["500 Coins", "2x Luck", "Rare Pet", "Gems", "Boost", "Jackpot"];
    const rewardBadges: UIElement[] = rewards.map((label, idx) => {
      const positions = [
        { xScale: 0.5, yScale: 0.1 },
        { xScale: 0.78, yScale: 0.25 },
        { xScale: 0.78, yScale: 0.67 },
        { xScale: 0.5, yScale: 0.84 },
        { xScale: 0.22, yScale: 0.67 },
        { xScale: 0.22, yScale: 0.25 },
      ];
      const pos = positions[idx] ?? positions[0];
      return {
        type: "TextLabel",
        id: `RewardBadge${idx + 1}`,
        name: `RewardBadge${idx + 1}`,
        text: label,
        textColor: { r: 255, g: 255, b: 255 },
        textSize: 16,
        font: "GothamBold",
        anchorPoint: { x: 0.5, y: 0.5 },
        position: { xScale: pos.xScale, xOffset: 0, yScale: pos.yScale, yOffset: 0 },
        size: { xScale: 0, xOffset: 124, yScale: 0, yOffset: 40 },
        backgroundColor: idx % 2 === 0 ? { r: 255, g: 255, b: 255 } : { r: 17, g: 24, b: 39 },
        backgroundTransparency: idx % 2 === 0 ? 0.82 : 0.12,
        strokeColor: { r: 255, g: 255, b: 255 },
        strokeThickness: 1.5,
        cornerRadius: 20,
      };
    });

    const spec: UISpec = {
      title,
      screenGuiName,
      mobileFriendly: true,
      description: `Generated ${opts.style} Spin Wheel UI with server-validated reward request.`,
      root: {
        type: "Frame",
        id: "RootFrame",
        name: "RootFrame",
        position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
        size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
        backgroundColor: bg,
        children: [
          {
            type: "Frame",
            id: "MainPanel",
            name: "MainPanel",
            anchorPoint: { x: 0.5, y: 0.5 },
            position: { xScale: 0.5, xOffset: 0, yScale: 0.5, yOffset: 0 },
            size: { xScale: 0.76, xOffset: 0, yScale: 0.76, yOffset: 0 },
            backgroundColor: { r: 10, g: 14, b: 24 },
            backgroundTransparency: opts.style === "Glass" ? 0.16 : 0,
            cornerRadius: opts.style === "Cartoon" ? 30 : 20,
            strokeColor: accent,
            strokeThickness: opts.style === "Neon" ? 3 : 1.5,
            gradient:
              opts.style === "Minimal"
                ? undefined
                : { from: bg, to: { r: 17, g: 24, b: 39 }, rotation: 135 },
            children: [
              {
                type: "TextLabel",
                id: "TitleLabel",
                name: "TitleLabel",
                text: title,
                textColor: { r: 255, g: 255, b: 255 },
                textSize: 34,
                font: "GothamBlack",
                position: { xScale: 0.06, xOffset: 0, yScale: 0.06, yOffset: 0 },
                size: { xScale: 0.72, xOffset: 0, yScale: 0, yOffset: 52 },
                backgroundTransparency: 1,
                textAlign: "Left",
              },
              {
                type: "TextButton",
                id: "CloseButton",
                name: "CloseButton",
                text: "X",
                textColor: { r: 255, g: 255, b: 255 },
                textSize: 20,
                font: "GothamBold",
                position: { xScale: 0.92, xOffset: 0, yScale: 0.06, yOffset: 0 },
                size: { xScale: 0, xOffset: 48, yScale: 0, yOffset: 48 },
                backgroundColor: { r: 31, g: 41, b: 55 },
                backgroundTransparency: 0.1,
                cornerRadius: 14,
              },
              {
                type: "Frame",
                id: "WheelGlow",
                name: "WheelGlow",
                anchorPoint: { x: 0.5, y: 0.5 },
                position: { xScale: 0.38, xOffset: 0, yScale: 0.54, yOffset: 0 },
                size: { xScale: 0, xOffset: 456, yScale: 0, yOffset: 456 },
                backgroundColor: primary,
                backgroundTransparency: 0.78,
                cornerRadius: 228,
                strokeColor: accent,
                strokeThickness: 2,
              },
              {
                type: "Frame",
                id: "WheelRing",
                name: "WheelRing",
                anchorPoint: { x: 0.5, y: 0.5 },
                position: { xScale: 0.38, xOffset: 0, yScale: 0.54, yOffset: 0 },
                size: { xScale: 0, xOffset: 420, yScale: 0, yOffset: 420 },
                backgroundColor: { r: 18, g: 24, b: 38 },
                cornerRadius: 210,
                strokeColor: primary,
                strokeThickness: 7,
                gradient: { from: primary, to: accent, rotation: 45 },
                children: [
                  ...rewardBadges,
                  {
                    type: "TextLabel",
                    id: "Pointer",
                    name: "Pointer",
                    text: "WIN",
                    textColor: { r: 12, g: 18, b: 28 },
                    textSize: 18,
                    font: "GothamBlack",
                    anchorPoint: { x: 0.5, y: 0.5 },
                    position: { xScale: 0.5, xOffset: 0, yScale: 0.5, yOffset: 0 },
                    size: { xScale: 0, xOffset: 118, yScale: 0, yOffset: 118 },
                    backgroundColor: { r: 255, g: 255, b: 255 },
                    backgroundTransparency: 0.08,
                    strokeColor: primary,
                    strokeThickness: 5,
                    cornerRadius: 59,
                  },
                ],
              },
              {
                type: "TextLabel",
                id: "WheelMarker",
                name: "WheelMarker",
                text: "V",
                textColor: primary,
                textSize: 32,
                font: "GothamBlack",
                anchorPoint: { x: 0.5, y: 0.5 },
                position: { xScale: 0.38, xOffset: 0, yScale: 0.24, yOffset: 0 },
                size: { xScale: 0, xOffset: 48, yScale: 0, yOffset: 42 },
                backgroundTransparency: 1,
              },
              {
                type: "Frame",
                id: "RewardPanel",
                name: "RewardPanel",
                position: { xScale: 0.65, xOffset: 0, yScale: 0.25, yOffset: 0 },
                size: { xScale: 0.28, xOffset: 0, yScale: 0.42, yOffset: 0 },
                backgroundColor: { r: 15, g: 23, b: 42 },
                backgroundTransparency: 0.08,
                cornerRadius: 16,
                strokeColor: { r: 71, g: 85, b: 105 },
                strokeThickness: 1,
                layout: "List",
                layoutPadding: 10,
                children: rewards.slice(0, 4).map((label, idx) => ({
                  type: "TextLabel",
                  id: `PrizeRow${idx + 1}`,
                  name: `PrizeRow${idx + 1}`,
                  text: `${idx + 1}. ${label}`,
                  textColor: { r: 226, g: 232, b: 240 },
                  textSize: 15,
                  font: "GothamBold",
                  backgroundColor: { r: 30, g: 41, b: 59 },
                  backgroundTransparency: 0.12,
                  cornerRadius: 10,
                  textAlign: "Left",
                })),
              },
              {
                type: "TextButton",
                id: "SpinButton",
                name: "SpinButton",
                text: "SPIN NOW",
                textColor: { r: 255, g: 255, b: 255 },
                textSize: 22,
                font: "GothamBlack",
                anchorPoint: { x: 0.5, y: 0.5 },
                position: { xScale: 0.79, xOffset: 0, yScale: 0.79, yOffset: 0 },
                size: { xScale: 0.28, xOffset: 0, yScale: 0, yOffset: 64 },
                backgroundColor: primary,
                strokeColor: accent,
                strokeThickness: 3,
                cornerRadius: 18,
              },
            ],
          },
        ],
      },
      remoteEvents: [`${screenGuiName}Request`],
      localScript: `local gui = script.Parent\nlocal close = gui:FindFirstChild("CloseButton", true)\nlocal spin = gui:FindFirstChild("SpinButton", true)\nif close and close:IsA("TextButton") then\n\tclose.MouseButton1Click:Connect(function()\n\t\tgui.Enabled = false\n\tend)\nend\nif spin and spin:IsA("TextButton") then\n\tspin.MouseButton1Click:Connect(function()\n\t\tprint("BloxSmith spin requested")\n\tend)\nend`,
      serverScript: `local ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal remote = ReplicatedStorage:FindFirstChild("${screenGuiName}Request") or Instance.new("RemoteEvent")\nremote.Name = "${screenGuiName}Request"\nremote.Parent = ReplicatedStorage\nremote.OnServerEvent:Connect(function(player)\n\tprint("BloxSmith Spin Wheel request", player.Name)\n\t-- Validate cooldowns and grant rewards here.\nend)`,
    };

    return normalizeUISpec(spec, opts);
  }

  const cardChildren: UIElement[] = buttons.map((label, idx) => ({
    type: "TextButton",
    id: `ActionButton${idx + 1}`,
    name: `ActionButton${idx + 1}`,
    text:
      idx === 0
        ? `${label}\nFeatured`
        : opts.category.includes("Shop")
          ? `${label}\n${[199, 399, 799, 1299][idx] ?? 499} coins`
          : `${label}\nReady`,
    textColor: { r: 255, g: 255, b: 255 },
    textSize: 16,
    font: "GothamBold",
    backgroundColor: idx === 0 ? primary : { r: 20, g: 28, b: 44 },
    strokeColor: idx === 0 ? accent : { r: 96, g: 116, b: 148 },
    strokeThickness: idx === 0 ? 2 : 1.5,
    cornerRadius: opts.style === "Cartoon" ? 22 : 16,
    gradient:
      opts.style === "Minimal"
        ? undefined
        : {
            from: idx % 2 === 0 ? primary : { r: 30, g: 41, b: 59 },
            to: idx % 2 === 0 ? accent : { r: 15, g: 23, b: 42 },
            rotation: 135,
          },
  }));

  const panelLayouts = [
    {
      position: { xScale: 0.5, xOffset: 0, yScale: 0.5, yOffset: 0 },
      size: { xScale: 0.56, xOffset: 0, yScale: 0.66, yOffset: 0 },
    },
    {
      position: { xScale: 0.34, xOffset: 0, yScale: 0.52, yOffset: 0 },
      size: { xScale: 0.46, xOffset: 0, yScale: 0.72, yOffset: 0 },
    },
    {
      position: { xScale: 0.5, xOffset: 0, yScale: 0.62, yOffset: 0 },
      size: { xScale: 0.78, xOffset: 0, yScale: 0.56, yOffset: 0 },
    },
    {
      position: { xScale: 0.66, xOffset: 0, yScale: 0.52, yOffset: 0 },
      size: { xScale: 0.46, xOffset: 0, yScale: 0.72, yOffset: 0 },
    },
  ] as const;
  const panelLayout = panelLayouts[variant] ?? panelLayouts[0];
  const contentY = variant === 2 ? 0.26 : 0.28;
  const contentHeight = variant === 2 ? 0.42 : 0.5;

  const spec: UISpec = {
    title,
    screenGuiName,
    mobileFriendly: true,
    description: `Generated ${opts.style} ${opts.category} UI by BloxSmith.`,
    root: {
      type: "Frame",
      id: "RootFrame",
      name: "RootFrame",
      position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
      size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
      backgroundColor: bg,
      children: [
        ...backgroundLayers,
        {
          type: "Frame",
          id: "MainPanel",
          name: "MainPanel",
          anchorPoint: { x: 0.5, y: 0.5 },
          position: panelLayout.position,
          size: panelLayout.size,
          backgroundColor: { r: 10, g: 14, b: 24 },
          backgroundTransparency: opts.style === "Glass" ? 0.18 : 0,
          cornerRadius: opts.style === "Cartoon" ? 32 : 22,
          strokeColor: accent,
          strokeThickness: opts.style === "Neon" ? 3 : 2,
          gradient:
            opts.style === "Minimal"
              ? undefined
              : { from: bg, to: { r: 18, g: 24, b: 38 }, rotation: 135 },
          zIndex: 3,
          children: [
            {
              type: "Frame",
              id: "SideRail",
              name: "SideRail",
              position: { xScale: 0.025, xOffset: 0, yScale: 0.08, yOffset: 0 },
              size: { xScale: 0, xOffset: 10, yScale: 0.84, yOffset: 0 },
              backgroundColor: primary,
              cornerRadius: 8,
              gradient:
                opts.style === "Minimal" ? undefined : { from: primary, to: accent, rotation: 90 },
              zIndex: 4,
            },
            {
              type: "Frame",
              id: "HeaderGlow",
              name: "HeaderGlow",
              position: { xScale: 0.04, xOffset: 0, yScale: 0.04, yOffset: 0 },
              size: { xScale: 0.92, xOffset: 0, yScale: 0, yOffset: 78 },
              backgroundColor: primary,
              backgroundTransparency: 0.78,
              cornerRadius: 18,
              strokeColor: accent,
              strokeThickness: 1,
            },
            {
              type: "TextLabel",
              id: "TitleLabel",
              name: "TitleLabel",
              text: title,
              textColor: { r: 255, g: 255, b: 255 },
              textSize: 32,
              font: "GothamBlack",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.06, yOffset: 0 },
              size: { xScale: 0.72, xOffset: 0, yScale: 0, yOffset: 50 },
              backgroundTransparency: 1,
              textAlign: "Left",
            },
            {
              type: "TextLabel",
              id: "StatusBadge",
              name: "StatusBadge",
              text: "BLOXSMITH",
              textColor: { r: 255, g: 255, b: 255 },
              textSize: 12,
              font: "GothamBlack",
              position: { xScale: 0.72, xOffset: 0, yScale: 0.075, yOffset: 0 },
              size: { xScale: 0.16, xOffset: 0, yScale: 0, yOffset: 34 },
              backgroundColor: accent,
              cornerRadius: 14,
              strokeColor: { r: 255, g: 255, b: 255 },
              strokeThickness: 1,
            },
            {
              type: "TextLabel",
              id: "SubtitleLabel",
              name: "SubtitleLabel",
              text: opts.prompt.slice(0, 90) || `Premium Roblox ${opts.category} UI`,
              textColor: { r: 203, g: 213, b: 225 },
              textSize: 16,
              font: "Gotham",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.16, yOffset: 0 },
              size: { xScale: 0.72, xOffset: 0, yScale: 0, yOffset: 30 },
              backgroundTransparency: 1,
              textAlign: "Left",
            },
            {
              type: "TextButton",
              id: "CloseButton",
              name: "CloseButton",
              text: "X",
              textColor: { r: 255, g: 255, b: 255 },
              textSize: 24,
              font: "GothamBold",
              position: { xScale: 0.88, xOffset: 0, yScale: 0.06, yOffset: 0 },
              size: { xScale: 0, xOffset: 42, yScale: 0, yOffset: 42 },
              backgroundColor: { r: 51, g: 65, b: 85 },
              cornerRadius: 12,
            },
            {
              type: "Frame",
              id: "ContentGrid",
              name: "ContentGrid",
              position: { xScale: 0.06, xOffset: 0, yScale: contentY, yOffset: 0 },
              size: { xScale: 0.88, xOffset: 0, yScale: contentHeight, yOffset: 0 },
              backgroundColor: { r: 15, g: 23, b: 42 },
              backgroundTransparency: 0.16,
              cornerRadius: 18,
              strokeColor: { r: 71, g: 85, b: 105 },
              strokeThickness: 1,
              layout: "Grid",
              layoutPadding: 14,
              cellSize: { xScale: 0, xOffset: 180, yScale: 0, yOffset: 92 },
              children: cardChildren,
            },
            {
              type: "Frame",
              id: "StatsStrip",
              name: "StatsStrip",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.72, yOffset: 0 },
              size: { xScale: 0.88, xOffset: 0, yScale: 0, yOffset: 54 },
              backgroundColor: { r: 2, g: 6, b: 23 },
              backgroundTransparency: 0.22,
              cornerRadius: 16,
              strokeColor: { r: 71, g: 85, b: 105 },
              strokeThickness: 1,
              layout: "List",
              layoutDirection: "Horizontal",
              layoutPadding: 12,
              zIndex: 4,
              children: [
                {
                  type: "TextLabel",
                  id: "StatOne",
                  name: "StatOne",
                  text: opts.category.includes("Shop") ? "Coins: 2,450" : "Status: Ready",
                  textColor: { r: 226, g: 232, b: 240 },
                  textSize: 14,
                  font: "GothamBold",
                  size: { xScale: 0.32, xOffset: 0, yScale: 1, yOffset: 0 },
                  backgroundColor: { r: 15, g: 23, b: 42 },
                  backgroundTransparency: 0.18,
                  cornerRadius: 12,
                  textAlign: "Center",
                  zIndex: 5,
                },
                {
                  type: "TextLabel",
                  id: "StatTwo",
                  name: "StatTwo",
                  text: opts.category === "HUD" ? "Quest: Find 3 crystals" : "Bonus: +20%",
                  textColor: { r: 226, g: 232, b: 240 },
                  textSize: 14,
                  font: "GothamBold",
                  size: { xScale: 0.32, xOffset: 0, yScale: 1, yOffset: 0 },
                  backgroundColor: { r: 15, g: 23, b: 42 },
                  backgroundTransparency: 0.18,
                  cornerRadius: 12,
                  textAlign: "Center",
                  zIndex: 5,
                },
                {
                  type: "TextLabel",
                  id: "StatThree",
                  name: "StatThree",
                  text: "Mobile ready",
                  textColor: { r: 226, g: 232, b: 240 },
                  textSize: 14,
                  font: "GothamBold",
                  size: { xScale: 0.32, xOffset: 0, yScale: 1, yOffset: 0 },
                  backgroundColor: { r: 15, g: 23, b: 42 },
                  backgroundTransparency: 0.18,
                  cornerRadius: 12,
                  textAlign: "Center",
                  zIndex: 5,
                },
              ],
            },
            {
              type: "TextButton",
              id: "PrimaryCTA",
              name: "PrimaryCTA",
              text: opts.category.includes("Shop") ? "Purchase Selected" : "Confirm",
              textColor: { r: 255, g: 255, b: 255 },
              textSize: 20,
              font: "GothamBold",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.82, yOffset: 0 },
              size: { xScale: 0.88, xOffset: 0, yScale: 0, yOffset: 58 },
              backgroundColor: primary,
              strokeColor: accent,
              strokeThickness: 2,
              cornerRadius: 18,
              gradient:
                opts.style === "Minimal" ? undefined : { from: primary, to: accent, rotation: 90 },
            },
            {
              type: "TextLabel",
              id: "FooterNote",
              name: "FooterNote",
              text: needsRemote
                ? "Server validated rewards and purchases"
                : "Responsive Roblox ScreenGui layout",
              textColor: { r: 148, g: 163, b: 184 },
              textSize: 13,
              font: "Gotham",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.93, yOffset: 0 },
              size: { xScale: 0.88, xOffset: 0, yScale: 0, yOffset: 24 },
              backgroundTransparency: 1,
            },
          ],
        },
      ],
    },
    remoteEvents: needsRemote ? [`${screenGuiName}Request`] : [],
    localScript: `local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local gui = script.Parent
local panel = gui:FindFirstChild("MainPanel", true) or gui:FindFirstChild("RootFrame", true)
local remote = ReplicatedStorage:FindFirstChild("${screenGuiName}Request")
local selectedButton = nil
local clickSound = gui:FindFirstChild("UIClickSound")
if not clickSound then
\tclickSound = Instance.new("Sound")
\tclickSound.Name = "UIClickSound"
\tclickSound.SoundId = "rbxassetid://6895079853"
\tclickSound.Volume = 0.35
\tclickSound.Parent = gui
end

local function tween(object, time, props)
\tTweenService:Create(object, TweenInfo.new(time, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), props):Play()
end

local function findStroke(button)
\treturn button:FindFirstChildOfClass("UIStroke")
end

local function wireButton(button)
\tif not button:IsA("TextButton") then return end
\tlocal normalSize = button.Size
\tlocal stroke = findStroke(button)
\tbutton.MouseEnter:Connect(function()
\t\ttween(button, 0.14, { Size = normalSize + UDim2.fromOffset(8, 3) })
\t\tif stroke then tween(stroke, 0.14, { Thickness = math.max(stroke.Thickness, 2.5) }) end
\tend)
\tbutton.MouseLeave:Connect(function()
\t\ttween(button, 0.14, { Size = normalSize })
\t\tif stroke and selectedButton ~= button then tween(stroke, 0.14, { Thickness = 1.5 }) end
\tend)
\tbutton.MouseButton1Down:Connect(function()
\t\ttween(button, 0.08, { Size = normalSize + UDim2.fromOffset(-5, -2) })
\tend)
\tbutton.MouseButton1Up:Connect(function()
\t\ttween(button, 0.1, { Size = normalSize + UDim2.fromOffset(8, 3) })
\tend)
\tbutton.MouseButton1Click:Connect(function()
\t\tif clickSound then clickSound:Play() end
\t\tif button.Name == "CloseButton" then
\t\t\tgui.Enabled = false
\t\t\treturn
\t\tend
\t\tselectedButton = button
\t\tfor _, other in ipairs(gui:GetDescendants()) do
\t\t\tif other:IsA("TextButton") and other ~= button then
\t\t\t\tlocal otherStroke = findStroke(other)
\t\t\t\tif otherStroke then otherStroke.Thickness = 1.5 end
\t\t\tend
\t\tend
\t\tif stroke then tween(stroke, 0.12, { Thickness = 3 }) end
\t\tif remote then remote:FireServer(button.Name) end
\t\tprint("BloxSmith UI button clicked:", button.Name)
\tend)
end

for _, btn in ipairs(gui:GetDescendants()) do
\twireButton(btn)
end
if panel and panel:IsA("GuiObject") then
\tlocal finalPosition = panel.Position
\tlocal finalTransparency = panel.BackgroundTransparency
\tpanel.Position = finalPosition + UDim2.fromOffset(0, 24)
\tpanel.BackgroundTransparency = math.min(finalTransparency + 0.18, 0.9)
\tTweenService:Create(panel, TweenInfo.new(0.32, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
\t\tPosition = finalPosition,
\t\tBackgroundTransparency = finalTransparency
\t}):Play()
end`,
    serverScript: needsRemote
      ? `local ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal remote = ReplicatedStorage:FindFirstChild("${screenGuiName}Request") or Instance.new("RemoteEvent")\nremote.Name = "${screenGuiName}Request"\nremote.Parent = ReplicatedStorage\nremote.OnServerEvent:Connect(function(player, action)\n\tprint("BloxSmith UI request", player.Name, action)\n\t-- TODO: validate purchases/rewards on the server before granting anything.\nend)`
      : undefined,
  };

  return normalizeUISpec(spec, opts);
}

async function tryGeneratePlainJson(gateway: GatewayChoice, userPrompt: string): Promise<UISpec> {
  const { text } = await generateText({
    model: gateway.gw(gateway.modelName) as any,
    system: `${UI_SYSTEM_PROMPT}\n\nReturn ONLY parseable JSON. Do not wrap it in markdown.`,
    prompt: userPrompt,
    maxOutputTokens: UI_AI_OUTPUT_TOKENS,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(UI_AI_TIMEOUT_MS),
  });
  if (!text?.trim()) throw new Error("No text returned by provider.");
  return UISpecSchema.parse(parseJsonObject(text));
}

// ---------------- Generate ----------------
export async function generateUISpec(opts: {
  category: UICategory;
  style: UIStyle;
  prompt: string;
  primaryColor?: { r: number; g: number; b: number };
  accentColor?: { r: number; g: number; b: number };
  bgColor?: { r: number; g: number; b: number };
  title?: string;
}): Promise<UISpec> {
  const instantSpec = createFallbackUISpec(opts);
  const gateways = listGateways();
  if (gateways.length === 0) {
    console.warn("[ui-gen] no AI provider configured; using deterministic fallback UI");
    return instantSpec;
  }

  const styleHint = STYLE_HINTS[opts.style];
  const palette =
    [
      opts.primaryColor
        ? `Primary RGB(${opts.primaryColor.r},${opts.primaryColor.g},${opts.primaryColor.b})`
        : null,
      opts.accentColor
        ? `Accent  RGB(${opts.accentColor.r},${opts.accentColor.g},${opts.accentColor.b})`
        : null,
      opts.bgColor ? `Background RGB(${opts.bgColor.r},${opts.bgColor.g},${opts.bgColor.b})` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "use a tasteful palette appropriate to the category";

  const userPrompt = `Category: ${opts.category}
Style: ${opts.style} — ${styleHint}
Palette: ${palette}
Variation seed: ${stableHash(`${opts.category}|${opts.style}|${opts.prompt}|${opts.title || ""}`) % 997}
${opts.title ? `Preferred title text: "${opts.title}"\n` : ""}User request:
${opts.prompt}

Produce a polished, fully populated UISpec for this Roblox UI. Include working LocalScript and (where it makes sense) a ServerScript with RemoteEvents for purchase/reward validation. Keep the hierarchy concise and complete.
Make this layout feel specific to the request. Use a different composition/background treatment than a generic centered card whenever the prompt asks for a menu, HUD, dialogue, shop, lobby, or themed background.
Do not create a bare mockup. Add the pieces a player expects: header/title, readable subtitle or objective, 3-6 real actions, secondary cards/rows, status/currency/reward details, close/back controls where useful, hover/press tweens, selected-state feedback, and mobile-safe sizes.
If this is a main menu/title screen, make Play the hero CTA and include Settings, Shop, Credits/Servers, updates/news, player/reward/status card, footer/version text, and an entry animation.
If this is a shop, inventory, settings panel, HUD, rewards, quest, or admin GUI, include category-specific rows/cards and script behavior instead of generic placeholder buttons.
${wantsMainMenuBackground(opts) ? "Main menu background requirement: create the background as ScreenGui children only. Use BackgroundLayer/BackgroundImage plus overlay behind the buttons; do not create or imply Workspace parts, 3D blocks, terrain, or camera-selected objects." : ""}`;

  let lastErr: any = null;
  for (const gateway of gateways.slice(0, 2)) {
    try {
      const spec = await tryGeneratePlainJson(gateway, userPrompt);
      return normalizeUISpec(spec, opts);
    } catch (err: any) {
      lastErr = err;
      console.warn(
        `[ui-gen] ${gateway.providerName}/${gateway.modelName} JSON output failed; trying deterministic fallback:`,
        err?.message || err,
      );
    }
  }

  console.warn(
    "[ui-gen] providers were slow/empty; returning deterministic UI:",
    lastErr?.message || lastErr,
  );
  return instantSpec;
}

// ---------------- Spec -> plugin actions + files ----------------
// Converts the spec into the action protocol the BloxSmith plugin already
// understands (see src/routes/execute.ts). Each Instance becomes a `create`
// action with properties translated into the plugin's serialized types.

type PluginAction = { type: string; [k: string]: any };
type GenFile = {
  path: string;
  file_type: "Script" | "LocalScript" | "ModuleScript";
  service_location: "ServerScriptService" | "ReplicatedStorage" | "StarterGui";
  content: string;
};

function udim2(u?: { xScale: number; xOffset: number; yScale: number; yOffset: number }) {
  if (!u) return undefined;
  return {
    __t: "UDim2",
    xs: u.xScale,
    xo: u.xOffset,
    ys: u.yScale,
    yo: u.yOffset,
    // Back-compat for any newer plugin/client readers that use explicit names.
    xScale: u.xScale,
    xOffset: u.xOffset,
    yScale: u.yScale,
    yOffset: u.yOffset,
  };
}
function color3(c?: { r: number; g: number; b: number }) {
  if (!c) return undefined;
  return { __t: "Color3", r: c.r, g: c.g, b: c.b };
}

function propsForElement(el: UIElement) {
  const props: Record<string, unknown> = {};
  props.Visible = true;
  if (el.size) props.Size = udim2(el.size);
  if (el.position) props.Position = udim2(el.position);
  if (el.anchorPoint)
    props.AnchorPoint = { __t: "Vector2", x: el.anchorPoint.x, y: el.anchorPoint.y };
  if (el.backgroundColor) props.BackgroundColor3 = color3(el.backgroundColor);
  if (typeof el.backgroundTransparency === "number")
    props.BackgroundTransparency = el.backgroundTransparency;
  if (typeof el.zIndex === "number") props.ZIndex = el.zIndex;

  if (el.type === "TextLabel" || el.type === "TextButton") {
    if (el.text != null) props.Text = el.text;
    if (el.textColor) props.TextColor3 = color3(el.textColor);
    if (el.textSize) props.TextSize = el.textSize;
    if (el.font) props.Font = { __t: "Enum", enum: "Font", value: el.font };
    if (el.textAlign)
      props.TextXAlignment = { __t: "Enum", enum: "TextXAlignment", value: el.textAlign };
  }
  if (el.type === "TextButton" || el.type === "ImageButton") {
    props.Active = true;
    props.AutoButtonColor = true;
  }
  if (el.type === "ImageButton" || el.type === "ImageLabel") {
    if (el.image) {
      const img = /^\d+$/.test(el.image) ? `rbxassetid://${el.image}` : el.image;
      props.Image = img;
    }
  }
  if (el.type === "ScrollingFrame") {
    props.ScrollBarThickness = 8;
    props.CanvasSize = udim2({ xScale: 0, xOffset: 0, yScale: 1, yOffset: 200 });
  }
  return props;
}

function pushElement(el: UIElement, parentPath: string, actions: PluginAction[]) {
  const className =
    el.type === "Frame"
      ? "Frame"
      : el.type === "TextLabel"
        ? "TextLabel"
        : el.type === "TextButton"
          ? "TextButton"
          : el.type === "ImageButton"
            ? "ImageButton"
            : el.type === "ImageLabel"
              ? "ImageLabel"
              : "ScrollingFrame";

  actions.push({
    type: "create",
    className,
    name: el.name,
    parent: parentPath,
    properties: propsForElement(el),
  });

  const myPath = `${parentPath}.${el.name}`;

  if (el.cornerRadius && el.cornerRadius > 0) {
    actions.push({
      type: "create",
      className: "UICorner",
      name: "UICorner",
      parent: myPath,
      properties: { CornerRadius: { __t: "UDim", s: 0, o: el.cornerRadius } },
    });
  }
  if (el.strokeColor && el.strokeThickness) {
    actions.push({
      type: "create",
      className: "UIStroke",
      name: "UIStroke",
      parent: myPath,
      properties: {
        Color: color3(el.strokeColor),
        Thickness: el.strokeThickness,
      },
    });
  }
  if (el.gradient) {
    actions.push({
      type: "create",
      className: "UIGradient",
      name: "UIGradient",
      parent: myPath,
      properties: {
        Rotation: el.gradient.rotation,
        Color: {
          __t: "ColorSequence",
          stops: [
            { time: 0, color: color3(el.gradient.from) },
            { time: 1, color: color3(el.gradient.to) },
          ],
        },
      },
    });
  }
  if (el.layout === "List") {
    actions.push({
      type: "create",
      className: "UIListLayout",
      name: "UIListLayout",
      parent: myPath,
      properties: {
        FillDirection: {
          __t: "Enum",
          enum: "FillDirection",
          value: el.layoutDirection === "Horizontal" ? "Horizontal" : "Vertical",
        },
        Padding: { __t: "UDim", scale: 0, offset: el.layoutPadding ?? 8 },
        SortOrder: { __t: "Enum", enum: "SortOrder", value: "LayoutOrder" },
      },
    });
  } else if (el.layout === "Grid") {
    actions.push({
      type: "create",
      className: "UIGridLayout",
      name: "UIGridLayout",
      parent: myPath,
      properties: {
        CellSize: udim2(el.cellSize ?? { xScale: 0, xOffset: 120, yScale: 0, yOffset: 120 }),
        CellPadding: udim2({
          xScale: 0,
          xOffset: el.layoutPadding ?? 8,
          yScale: 0,
          yOffset: el.layoutPadding ?? 8,
        }),
        SortOrder: { __t: "Enum", enum: "SortOrder", value: "LayoutOrder" },
      },
    });
  }

  for (const child of el.children ?? []) pushElement(child, myPath, actions);
}

function visibilityBootstrapSource(screenGuiName: string, source: string) {
  return `-- BloxSmith visibility guard: generated UI should be visible immediately in Studio and Play.
local gui = script.Parent
if gui and gui:IsA("ScreenGui") then
\tgui.Enabled = true
\tgui.IgnoreGuiInset = true
\tgui.ResetOnSpawn = false
\tgui.DisplayOrder = math.max(gui.DisplayOrder, 999999)
end
for _, item in ipairs(gui:GetDescendants()) do
\tif item:IsA("GuiObject") then
\t\titem.Visible = true
\tend
end
print("[BloxSmith UI] ${screenGuiName} is enabled and visible.")

${source}`;
}

export function specToPluginPayload(spec: UISpec): { actions: PluginAction[]; files: GenFile[] } {
  const actions: PluginAction[] = [];
  const files: GenFile[] = [];

  // 1. ScreenGui under StarterGui
  actions.push({
    type: "create",
    className: "ScreenGui",
    name: spec.screenGuiName,
    parent: "StarterGui",
    properties: {
      Enabled: true,
      ResetOnSpawn: false,
      IgnoreGuiInset: true,
      DisplayOrder: 999999,
      ZIndexBehavior: { __t: "Enum", enum: "ZIndexBehavior", value: "Sibling" },
    },
  });

  // 2. Walk the tree
  pushElement(spec.root, `StarterGui.${spec.screenGuiName}`, actions);

  // 3. RemoteEvents
  for (const re of spec.remoteEvents ?? []) {
    actions.push({
      type: "create",
      className: "RemoteEvent",
      name: re,
      parent: "ReplicatedStorage",
    });
  }

  // 4. LocalScript inside the ScreenGui
  if (spec.localScript && spec.localScript.trim()) {
    const localScript = visibilityBootstrapSource(spec.screenGuiName, spec.localScript);
    files.push({
      path: `StarterGui/${spec.screenGuiName}/UIController`,
      file_type: "LocalScript",
      service_location: "StarterGui",
      content: localScript,
    });
    actions.push({
      type: "create",
      className: "LocalScript",
      name: "UIController",
      parent: `StarterGui.${spec.screenGuiName}`,
      properties: { Source: localScript },
    });
  } else {
    const localScript = visibilityBootstrapSource(spec.screenGuiName, "");
    actions.push({
      type: "create",
      className: "LocalScript",
      name: "UIVisibilityGuard",
      parent: `StarterGui.${spec.screenGuiName}`,
      properties: { Source: localScript },
    });
  }

  // 5. ServerScript
  if (spec.serverScript && spec.serverScript.trim()) {
    files.push({
      path: `ServerScriptService/${spec.screenGuiName}Server`,
      file_type: "Script",
      service_location: "ServerScriptService",
      content: spec.serverScript,
    });
    actions.push({
      type: "create",
      className: "Script",
      name: `${spec.screenGuiName}Server`,
      parent: "ServerScriptService",
      properties: { Source: spec.serverScript },
    });
  }

  return { actions, files };
}

// Pretty Luau export (concatenated) for the Code tab.
export function specToLuauPreview(spec: UISpec): string {
  const parts: string[] = [];
  parts.push(
    `-- ${spec.title}\n-- ScreenGui: ${spec.screenGuiName}\n-- Place ScreenGui under StarterGui.`,
  );
  if (spec.remoteEvents?.length) {
    parts.push(
      `\n-- RemoteEvents (ReplicatedStorage):\n` +
        spec.remoteEvents.map((r) => `--   ${r}`).join("\n"),
    );
  }
  if (spec.localScript) parts.push(`\n-- LocalScript (inside ScreenGui):\n${spec.localScript}`);
  if (spec.serverScript)
    parts.push(`\n-- ServerScript (ServerScriptService):\n${spec.serverScript}`);
  return parts.join("\n");
}
