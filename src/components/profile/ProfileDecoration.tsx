// Discord-style avatar decorations: local image overlays positioned around the
// avatar (top hat, halo, crown, headphones, wings, etc.). Scales with the
// avatar size and keeps lightweight CSS motion around image-backed artwork.
import type { CSSProperties, ReactNode } from "react";

export type DecorationId =
  | "none"
  | "top_hat"
  | "halo"
  | "crown"
  | "devil_horns"
  | "headphones"
  | "flower_crown"
  | "wings"
  | "snowflake"
  | "santa"
  | "party"
  | "ninja"
  | "witch"
  | "neon_ring"
  | "pumpkin"
  | "cyber_visor"
  | "bunny_ears"
  | "cosmic_crown"
  | "plasma_halo"
  | "royal_wings"
  | "lightning_aura"
  | "crystal_spikes"
  | "orbit"
  | "flame_aura"
  | "star_shower"
  | "glitch_frame"
  | "heart_aura"
  | "coin_crown"
  | "builder_goggles";

type DecoDef = {
  id: DecorationId;
  label: string;
  /** preview fallback used if an image fails */
  preview: string;
  image?: string;
  imageScale?: number;
  imageOffsetX?: number; // -0.5..0.5
  imageOffsetY?: number; // -0.5..0.5
  imageRotate?: number;
  animated?: boolean;
  premium?: boolean;
};

export const PROFILE_DECORATIONS: DecoDef[] = [
  { id: "none",          label: "None",         preview: "—" },
  { id: "cosmic_crown",  label: "Cosmic Crown", preview: "Crown", image: "/avatar-decorations/cosmic-crown.svg", imageScale: 1.12, imageOffsetY: -0.62, premium: true, animated: true },
  { id: "plasma_halo",   label: "Plasma Halo",  preview: "Halo", image: "/avatar-decorations/plasma-halo.svg", imageScale: 1.28, imageOffsetY: -0.42, premium: true, animated: true },
  { id: "royal_wings",   label: "Royal Wings",  preview: "Wings", image: "/avatar-decorations/royal-wing.svg", premium: true, animated: true },
  { id: "orbit",         label: "Orbit",        preview: "Orbit", image: "/avatar-decorations/orbit.svg", premium: true, animated: true },
  { id: "star_shower",   label: "Star Shower",  preview: "Stars", image: "/avatar-decorations/star-shower.svg", imageScale: 1.35, imageOffsetY: -0.28, premium: true, animated: true },
  { id: "glitch_frame",  label: "Glitch Frame", preview: "Glitch", image: "/avatar-decorations/glitch-frame.svg", premium: true, animated: true },
  { id: "flame_aura",    label: "Flame Aura",   preview: "Flame", image: "/avatar-decorations/flame-aura.svg", premium: true, animated: true },
  { id: "lightning_aura", label: "Lightning",   preview: "Bolt", image: "/avatar-decorations/lightning.svg", premium: true, animated: true },
  { id: "crystal_spikes", label: "Crystal",     preview: "Crystal", image: "/avatar-decorations/crystal-spikes.svg", imageScale: 1, imageOffsetY: -0.46, premium: true },
  { id: "heart_aura",    label: "Heart Aura",   preview: "Hearts", image: "/avatar-decorations/heart-aura.svg", premium: true, animated: true },
  { id: "coin_crown",    label: "Coin Crown",   preview: "Coins", image: "/avatar-decorations/coin-crown.svg", imageScale: 1.02, imageOffsetY: -0.52, premium: true, animated: true },
  { id: "builder_goggles", label: "Builder",    preview: "Goggles", image: "/avatar-decorations/builder-goggles.svg", imageScale: 1, imageOffsetY: -0.05, premium: true },
  { id: "top_hat",       label: "Top hat",      preview: "Hat", image: "/avatar-decorations/top-hat.svg", imageScale: 0.9, imageOffsetY: -0.58, imageRotate: -8, animated: true },
  { id: "halo",          label: "Halo",         preview: "Halo", image: "/avatar-decorations/gold-halo.svg", imageScale: 1.15, imageOffsetY: -0.38, animated: true },
  { id: "crown",         label: "Crown",        preview: "Crown", image: "/avatar-decorations/crown.svg", imageScale: 0.88, imageOffsetY: -0.53, animated: true },
  { id: "devil_horns",   label: "Devil horns",  preview: "Horns", image: "/avatar-decorations/devil-horns.svg", imageScale: 1.02, imageOffsetY: -0.44 },
  { id: "headphones",    label: "Headphones",   preview: "Audio", image: "/avatar-decorations/headphones.svg", imageScale: 1.16, imageOffsetY: -0.06, animated: true },
  { id: "flower_crown",  label: "Flower crown", preview: "Flower", image: "/avatar-decorations/flower-crown.svg", imageScale: 1.08, imageOffsetY: -0.48 },
  { id: "wings",         label: "Angel wings",  preview: "Wings", image: "/avatar-decorations/angel-wing.svg", animated: true },
  { id: "snowflake",     label: "Frost",        preview: "Frost", image: "/avatar-decorations/snowflake.svg", imageScale: 0.62, imageOffsetY: -0.57, imageOffsetX: 0.38 },
  { id: "santa",         label: "Santa",        preview: "Santa", image: "/avatar-decorations/santa-hat.svg", imageScale: 0.92, imageOffsetY: -0.56, imageRotate: -6 },
  { id: "party",         label: "Party",        preview: "Party", image: "/avatar-decorations/party-popper.svg", imageScale: 0.72, imageOffsetY: -0.5, imageOffsetX: -0.34, imageRotate: -18 },
  { id: "ninja",         label: "Ninja",        preview: "Ninja", image: "/avatar-decorations/ninja-mask.svg", imageScale: 0.98, imageOffsetY: -0.08 },
  { id: "witch",         label: "Witch hat",    preview: "Witch", image: "/avatar-decorations/witch-hat.svg", imageScale: 0.98, imageOffsetY: -0.6, imageRotate: -10 },
  { id: "neon_ring",     label: "Neon",         preview: "Neon", image: "/avatar-decorations/neon-ring.svg", animated: true },
  { id: "pumpkin",       label: "Pumpkin",      preview: "Pumpkin", image: "/avatar-decorations/pumpkin.svg", imageScale: 0.64, imageOffsetY: -0.5 },
  { id: "cyber_visor",   label: "Cyber visor",  preview: "Visor", image: "/avatar-decorations/cyber-visor.svg", imageScale: 1, imageOffsetY: -0.04, animated: true },
  { id: "bunny_ears",    label: "Bunny ears",   preview: "Bunny", image: "/avatar-decorations/bunny-ears.svg", imageScale: 0.86, imageOffsetY: -0.66 },
];

const DECO_MAP: Record<string, DecoDef> = Object.fromEntries(
  PROFILE_DECORATIONS.map((d) => [d.id, d]),
);

function DecorationImage({
  def,
  size,
  className = "",
  mirror = false,
  style,
}: {
  def: DecoDef;
  size: number;
  className?: string;
  mirror?: boolean;
  style?: CSSProperties;
}) {
  if (!def.image) return null;
  const scale = def.imageScale ?? 1;
  const width = size * scale;
  const rotate = def.imageRotate ?? 0;
  const transform = [
    "translate(-50%, -50%)",
    `translate(${(def.imageOffsetX ?? 0) * size}px, ${(def.imageOffsetY ?? 0) * size}px)`,
    `rotate(${rotate}deg)`,
    mirror ? "scaleX(-1)" : "",
  ].filter(Boolean).join(" ");

  return (
    <img
      src={def.image}
      alt=""
      aria-hidden
      draggable={false}
      className={`pointer-events-none absolute left-1/2 top-1/2 select-none object-contain ${className}`}
      style={{
        width,
        height: width,
        transform,
        transformOrigin: "center",
        filter: "drop-shadow(0 5px 10px rgba(0,0,0,.45))",
        animation: def.animated ? "deco-float 3.6s ease-in-out infinite" : undefined,
        ...style,
      }}
    />
  );
}

/**
 * Wraps an avatar (children) with a decoration overlay.
 * The wrapper takes the same size as `size`; overlays extend outside.
 */
export function AvatarDecoration({
  id,
  size,
  children,
  className = "",
  animated = true,
}: {
  id?: string | null;
  size: number;
  children: ReactNode;
  className?: string;
  animated?: boolean;
}) {
  const def = DECO_MAP[id ?? "none"] ?? DECO_MAP.none;
  if (def.id === "none") return <div className={className}>{children}</div>;

  // Specials with paired/full-frame image artwork and extra lightweight motion.
  const specials: Record<string, ReactNode> = {
    cosmic_crown: (
      <>
        <DecorationImage def={def} size={size} />
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full bg-white"
            style={{
              left: `${18 + ((i * 17) % 68)}%`,
              top: `${-18 + ((i * 11) % 24)}%`,
              width: size * 0.055,
              height: size * 0.055,
              boxShadow: "0 0 10px #fff, 0 0 18px #a78bfa",
              animation: `pe-twinkle ${2.4 + i * 0.2}s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </>
    ),
    plasma_halo: (
      <DecorationImage def={def} size={size} style={{ animation: "pe-holo 4.8s linear infinite, deco-pulse 2.6s ease-in-out infinite" }} />
    ),
    royal_wings: (
      <>
        <DecorationImage def={{ ...def, imageScale: 0.9, imageOffsetX: -0.72 }} size={size} />
        <DecorationImage def={{ ...def, imageScale: 0.9, imageOffsetX: 0.72 }} size={size} mirror />
      </>
    ),
    orbit: (
      <>
        <div
          className="pointer-events-none absolute inset-[-10%] rounded-full"
          style={{
            border: "1px solid rgba(103,232,249,.45)",
            boxShadow: "0 0 18px rgba(103,232,249,.55)",
            transform: "rotate(-18deg)",
          }}
        />
        {["#67e8f9", "#f0abfc", "#facc15"].map((color, i) => (
          <span
            key={color}
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
            style={{
              "--orbit-radius": `${size * (0.48 + i * 0.08)}px`,
              width: size * 0.09,
              height: size * 0.09,
              marginLeft: -size * 0.045,
              marginTop: -size * 0.045,
              background: color,
              boxShadow: `0 0 12px ${color}`,
              animation: `deco-orbit ${3.2 + i * 1.1}s linear infinite`,
            } as CSSProperties}
          />
        ))}
      </>
    ),
    star_shower: (
      <>
        <DecorationImage def={def} size={size} />
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute text-white"
            style={{
              left: `${(i * 29) % 92}%`,
              top: `${-24 + ((i * 17) % 26)}%`,
              fontSize: size * (0.14 + (i % 3) * 0.035),
              textShadow: "0 0 10px #fff, 0 0 18px #facc15",
              animation: `pe-fall ${2.6 + (i % 4) * 0.45}s ease-in-out ${i * 0.16}s infinite`,
            }}
          >
            ✦
          </span>
        ))}
      </>
    ),
    glitch_frame: (
      <>
        <DecorationImage def={def} size={size} />
        <div
          className="pointer-events-none absolute inset-[-6%] rounded-full"
          style={{
            boxShadow: "4px 0 0 rgba(34,211,238,.9), -4px 0 0 rgba(244,63,94,.8), 0 0 22px rgba(34,211,238,.45)",
            animation: "deco-pulse 1.15s steps(2,end) infinite",
          }}
        />
        <div
          className="pointer-events-none absolute left-[-8%] right-[-8%] top-[42%] h-[12%]"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(34,211,238,.45), rgba(244,63,94,.4), transparent)",
            animation: "pc-scan 2.4s linear infinite",
          }}
        />
      </>
    ),
    flame_aura: (
      <DecorationImage def={{ ...def, imageScale: 1.35, imageOffsetY: 0.08 }} size={size} style={{ animation: "pe-aurora 2.4s ease-in-out infinite alternate" }} />
    ),
    lightning_aura: (
      <>
        <DecorationImage def={{ ...def, imageScale: 0.62, imageOffsetX: -0.62, imageOffsetY: 0.02 }} size={size} />
        <DecorationImage def={{ ...def, imageScale: 0.62, imageOffsetX: 0.62, imageOffsetY: 0.02 }} size={size} mirror />
      </>
    ),
    crystal_spikes: (
      <DecorationImage def={def} size={size} />
    ),
    heart_aura: (
      <>
        <DecorationImage def={def} size={size} />
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute text-pink-300"
            style={{
              left: `${8 + ((i * 19) % 82)}%`,
              top: `${-18 + ((i * 23) % 115)}%`,
              fontSize: size * 0.18,
              textShadow: "0 0 10px #fb7185",
              animation: `deco-float ${2.6 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`,
            }}
          >
            ♥
          </span>
        ))}
      </>
    ),
    coin_crown: (
      <DecorationImage def={def} size={size} />
    ),
    builder_goggles: (
      <DecorationImage def={def} size={size} />
    ),
    halo: (
      <DecorationImage def={def} size={size} />
    ),
    wings: (
      <>
        <DecorationImage def={{ ...def, imageScale: 0.86, imageOffsetX: -0.68 }} size={size} />
        <DecorationImage def={{ ...def, imageScale: 0.86, imageOffsetX: 0.68 }} size={size} mirror />
      </>
    ),
    neon_ring: (
      <DecorationImage def={{ ...def, imageScale: 1.18 }} size={size} style={{ animation: "pe-holo 4s linear infinite" }} />
    ),
  };

  return (
    <div
      className={`relative inline-block ${animated ? "" : "profile-effect-static"} ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
      {specials[def.id] ?? <DecorationImage def={def} size={size} />}
    </div>
  );
}

export function getDecorationDef(id: string) {
  return DECO_MAP[id];
}
