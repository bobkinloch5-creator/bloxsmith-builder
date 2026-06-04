import { memo, type ReactNode } from "react";

export type ProfileCardEffectId =
  | "none"
  | "soft_glow"
  | "aurora_edge"
  | "premium_shine"
  | "scanline"
  | "starfield"
  | "pixel_rain";

export const PROFILE_CARD_EFFECTS: { id: ProfileCardEffectId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "soft_glow", label: "Soft Glow" },
  { id: "aurora_edge", label: "Aurora Edge" },
  { id: "premium_shine", label: "Premium Shine" },
  { id: "scanline", label: "Scanline" },
  { id: "starfield", label: "Starfield" },
  { id: "pixel_rain", label: "Pixel Rain" },
];

function hexToRgb(hex?: string | null) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!match) return "12, 18, 28";
  const n = parseInt(match[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function cardChromeStyle(color?: string | null): React.CSSProperties {
  const rgb = hexToRgb(color);
  return {
    background: `linear-gradient(180deg, rgba(${rgb},0.34), rgba(${rgb},0.16) 42%, rgba(2,6,12,0.96))`,
    borderColor: `rgba(${rgb},0.44)`,
    boxShadow: `0 0 0 1px rgba(${rgb},0.15), 0 28px 90px -64px rgba(${rgb},0.95)`,
  };
}

export const ProfileCardEffect = memo(function ProfileCardEffect({
  effect,
  color,
  className = "",
}: {
  effect?: ProfileCardEffectId | string | null;
  color?: string | null;
  className?: string;
}) {
  const e = (effect ?? "none") as ProfileCardEffectId;
  if (e === "none") return null;
  const rgb = hexToRgb(color);

  if (e === "soft_glow") {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${className}`}
        style={{
          boxShadow: `inset 0 0 42px rgba(${rgb},0.34), inset 0 0 100px rgba(${rgb},0.14)`,
          animation: "pe-neon 3.2s ease-in-out infinite",
        }}
      />
    );
  }

  if (e === "aurora_edge") {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 opacity-80 ${className}`}
        style={{
          background: `radial-gradient(70% 30% at 10% 0%, rgba(${rgb},0.32), transparent 70%), radial-gradient(55% 35% at 90% 8%, rgba(0,217,255,0.24), transparent 72%)`,
          animation: "pe-aurora 8s ease-in-out infinite alternate",
          mixBlendMode: "screen",
        }}
      />
    );
  }

  if (e === "premium_shine") {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${className}`}
        style={{
          background:
            "linear-gradient(115deg, transparent 0%, transparent 36%, rgba(255,255,255,0.2) 48%, transparent 60%, transparent 100%)",
          backgroundSize: "260% 100%",
          animation: "pc-shine 5.5s ease-in-out infinite",
          mixBlendMode: "screen",
        }}
      />
    );
  }

  if (e === "scanline") {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${className}`}
        style={{
          background: `repeating-linear-gradient(180deg, transparent 0 7px, rgba(${rgb},0.14) 8px, transparent 10px)`,
          animation: "pc-scan 7s linear infinite",
        }}
      />
    );
  }

  const count = e === "pixel_rain" ? 24 : 22;
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${(i * 41) % 100}%`,
            top: `${(i * 29) % 100}%`,
            width: e === "pixel_rain" ? 3 + (i % 3) : 2 + (i % 2),
            height: e === "pixel_rain" ? 10 + (i % 5) * 3 : 2 + (i % 2),
            borderRadius: e === "pixel_rain" ? 2 : "50%",
            background: e === "pixel_rain" ? `rgba(${rgb},0.65)` : "#fff",
            boxShadow: e === "pixel_rain" ? `0 0 10px rgba(${rgb},0.7)` : "0 0 8px #fff",
            animation: `${e === "pixel_rain" ? "pc-rain" : "pe-twinkle"} ${
              3 + (i % 5)
            }s ease-in-out ${(i % 8) * 0.22}s infinite`,
          }}
        />
      ))}
    </div>
  );
});

export function ProfileCardChrome({
  color,
  effect,
  className = "",
  children,
}: {
  color?: string | null;
  effect?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden border ${className}`} style={cardChromeStyle(color)}>
      <ProfileCardEffect effect={effect} color={color} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
