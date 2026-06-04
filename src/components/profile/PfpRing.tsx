// Animated ring effect around avatar (Discord Nitro vibe).
export type PfpEffectId =
  | "none"
  | "gold"
  | "rainbow"
  | "flame"
  | "electric"
  | "ice"
  | "galaxy"
  | "rose";

export const PFP_EFFECTS: { id: PfpEffectId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "gold", label: "Gold" },
  { id: "rainbow", label: "Rainbow" },
  { id: "flame", label: "Flame" },
  { id: "electric", label: "Electric" },
  { id: "ice", label: "Ice" },
  { id: "galaxy", label: "Galaxy" },
  { id: "rose", label: "Rose" },
];

const RING_STYLE: Record<PfpEffectId, React.CSSProperties> = {
  none: {},
  gold: {
    background:
      "conic-gradient(from 0deg, #fde047, #f59e0b, #facc15, #fde047)",
    animation: "pe-holo 4s linear infinite",
  },
  rainbow: {
    background:
      "conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #7c3cff, #ec4899, #ef4444)",
    animation: "pe-holo 5s linear infinite",
  },
  flame: {
    background:
      "conic-gradient(from 0deg, #f97316, #ef4444, #facc15, #f97316)",
    animation: "pe-holo 3s linear infinite",
    boxShadow: "0 0 18px #f97316cc",
  },
  electric: {
    background: "conic-gradient(from 0deg, #38bdf8, #c084fc, #38bdf8)",
    animation: "pe-holo 2.5s linear infinite",
    boxShadow: "0 0 18px #38bdf8aa",
  },
  ice: {
    background: "conic-gradient(from 0deg, #bae6fd, #e0f2fe, #93c5fd, #bae6fd)",
    animation: "pe-holo 6s linear infinite",
    boxShadow: "0 0 18px #93c5fdaa",
  },
  galaxy: {
    background:
      "conic-gradient(from 0deg, #1e1b4b, #7c3cff, #ec4899, #0ea5e9, #1e1b4b)",
    animation: "pe-holo 7s linear infinite",
  },
  rose: {
    background:
      "conic-gradient(from 0deg, #fb7185, #ec4899, #f43f5e, #fb7185)",
    animation: "pe-holo 4s linear infinite",
    boxShadow: "0 0 18px #f43f5eaa",
  },
};

export function PfpRing({
  effect,
  children,
  size = 64,
  className = "",
  animated = true,
}: {
  effect?: PfpEffectId | string | null;
  children: React.ReactNode;
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  const id = (effect ?? "none") as PfpEffectId;
  if (id === "none") {
    return (
      <div className={`grid place-items-center rounded-full ${className}`} style={{ width: size, height: size }}>
        {children}
      </div>
    );
  }
  const style = RING_STYLE[id] ?? RING_STYLE.none;
  const ringStyle = animated ? style : { ...style, animation: undefined };
  return (
    <div
      className={`relative inline-grid place-items-center rounded-full ${className}`}
      style={{ width: size + 6, height: size + 6, padding: 3, ...ringStyle }}
    >
      <div
        className="grid place-items-center rounded-full bg-surface"
        style={{ width: size, height: size }}
      >
        {children}
      </div>
    </div>
  );
}
