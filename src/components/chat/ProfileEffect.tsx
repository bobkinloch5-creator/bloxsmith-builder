// Animated profile effects rendered as overlays.
// Pure CSS/SVG so they're performant and work over any banner.
import { memo } from "react";

export type ProfileEffectId =
  | "none"
  | "sparkle"
  | "aurora"
  | "neon"
  | "holographic"
  | "confetti"
  | "stars"
  | "comet"
  | "runes"
  | "spotlight";

export const PROFILE_EFFECTS: { id: ProfileEffectId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "sparkle", label: "Sparkle" },
  { id: "aurora", label: "Aurora" },
  { id: "neon", label: "Neon Pulse" },
  { id: "holographic", label: "Holographic" },
  { id: "confetti", label: "Confetti" },
  { id: "stars", label: "Starfield" },
  { id: "comet", label: "Comet Trail" },
  { id: "runes", label: "Runes" },
  { id: "spotlight", label: "Spotlight" },
];

function hexToRgb(hex?: string | null) {
  if (!hex) return "124, 60, 255";
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "124, 60, 255";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export const ProfileEffect = memo(function ProfileEffect({
  effect,
  accent,
  className = "",
}: {
  effect?: ProfileEffectId | string | null;
  accent?: string | null;
  className?: string;
}) {
  const e = (effect ?? "none") as ProfileEffectId;
  if (e === "none" || !e) return null;
  const rgb = hexToRgb(accent);

  if (e === "aurora") {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
        style={{
          background: `radial-gradient(60% 80% at 20% 10%, rgba(${rgb},0.45), transparent 60%), radial-gradient(50% 70% at 80% 30%, rgba(0,217,255,0.35), transparent 60%), radial-gradient(40% 60% at 50% 90%, rgba(255,77,166,0.30), transparent 60%)`,
          animation: "pe-aurora 8s ease-in-out infinite alternate",
          mixBlendMode: "screen",
        }}
      />
    );
  }

  if (e === "neon") {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${className}`}
        style={{
          boxShadow: `inset 0 0 28px rgba(${rgb},0.55), inset 0 0 80px rgba(${rgb},0.25)`,
          animation: "pe-neon 2.4s ease-in-out infinite",
        }}
      />
    );
  }

  if (e === "holographic") {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
        style={{
          background:
            "linear-gradient(115deg, rgba(255,77,166,0.25), rgba(124,60,255,0.20), rgba(0,217,255,0.25), rgba(34,197,94,0.20), rgba(255,77,166,0.25))",
          backgroundSize: "300% 100%",
          animation: "pe-holo 6s linear infinite",
          mixBlendMode: "screen",
        }}
      />
    );
  }

  if (e === "comet") {
    return (
      <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${-15 + i * 18}%`,
              top: `${18 + (i % 3) * 22}%`,
              width: 70,
              height: 2,
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent, rgba(${rgb},0.95), #fff)`,
              boxShadow: `0 0 12px rgba(${rgb},0.8)`,
              transform: "rotate(-18deg)",
              animation: `pc-shine ${3.2 + i * 0.32}s ease-in-out ${i * 0.28}s infinite`,
            }}
          />
        ))}
      </div>
    );
  }

  if (e === "runes") {
    const glyphs = ["✦", "◇", "✧", "△", "✕", "◌", "✶", "◆"];
    return (
      <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
        {glyphs.map((g, i) => (
          <span
            key={`${g}-${i}`}
            style={{
              position: "absolute",
              left: `${8 + ((i * 13) % 84)}%`,
              top: `${10 + ((i * 29) % 76)}%`,
              color: `rgba(${rgb},0.75)`,
              fontWeight: 900,
              fontSize: 12 + (i % 3) * 3,
              textShadow: `0 0 10px rgba(${rgb},0.95)`,
              animation: `pe-twinkle ${2.8 + i * 0.2}s ease-in-out ${i * 0.18}s infinite`,
            }}
          >
            {g}
          </span>
        ))}
      </div>
    );
  }

  if (e === "spotlight") {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${className}`}
        style={{
          background: `radial-gradient(42% 80% at 35% 0%, rgba(${rgb},0.34), transparent 68%), radial-gradient(35% 70% at 78% 0%, rgba(255,255,255,0.16), transparent 72%)`,
          animation: "pe-neon 3.8s ease-in-out infinite",
          mixBlendMode: "screen",
        }}
      />
    );
  }

  if (e === "sparkle" || e === "stars" || e === "confetti") {
    const count = e === "confetti" ? 18 : e === "stars" ? 26 : 14;
    const items = Array.from({ length: count }, (_, i) => i);
    return (
      <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
        {items.map((i) => {
          const left = (i * 37) % 100;
          const top = (i * 53) % 100;
          const delay = (i % 7) * 0.35;
          const size = e === "confetti" ? 5 + (i % 4) : 2 + (i % 3);
          const color =
            e === "confetti"
              ? ["#ff4da6", "#7c3cff", "#00d9ff", "#22c55e", "#f59e0b"][i % 5]
              : e === "stars"
                ? "#ffffff"
                : `rgb(${rgb})`;
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                borderRadius: e === "confetti" ? 1 : "50%",
                background: color,
                boxShadow: e === "stars" ? "0 0 6px #fff" : `0 0 8px ${color}`,
                opacity: 0.85,
                animation: `${e === "confetti" ? "pe-fall" : "pe-twinkle"} ${
                  3 + (i % 5)
                }s ease-in-out ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>
    );
  }

  return null;
});
