// Roblox-themed animated backgrounds rendered as pure CSS gradients + keyframes.
// Used as the banner backdrop on profile cards.
import { memo } from "react";

export type ProfileBackgroundId =
  | "none"
  | "custom"
  | "studio"
  | "neon-city"
  | "obby"
  | "forest"
  | "space"
  | "lava"
  | "clouds"
  | "void"
  | "sunset"
  | "ocean"
  | "candy"
  | "matrix"
  | "futuristic"
  | "simulator"
  | "tycoon"
  | "anime"
  | "fantasy"
  | "city"
  | "neon"
  | "dark"
  | "premium";

export const PROFILE_BACKGROUNDS: { id: ProfileBackgroundId; label: string; preview: string }[] = [
  { id: "none", label: "None", preview: "linear-gradient(135deg,#1f2937,#0b1220)" },
  { id: "studio", label: "Studio", preview: "linear-gradient(135deg,#0ea5e9,#1e293b)" },
  { id: "neon-city", label: "Neon City", preview: "linear-gradient(135deg,#ff00aa,#7c3cff,#00d9ff)" },
  { id: "obby", label: "Obby", preview: "linear-gradient(135deg,#22c55e,#facc15,#ef4444)" },
  { id: "forest", label: "Forest", preview: "linear-gradient(135deg,#064e3b,#16a34a)" },
  { id: "space", label: "Space", preview: "linear-gradient(135deg,#0b1220,#7c3cff)" },
  { id: "lava", label: "Lava", preview: "linear-gradient(135deg,#7f1d1d,#f97316)" },
  { id: "clouds", label: "Clouds", preview: "linear-gradient(135deg,#bfdbfe,#f8fafc)" },
  { id: "void", label: "Void", preview: "linear-gradient(135deg,#000,#1e1b4b)" },
  { id: "sunset", label: "Sunset", preview: "linear-gradient(135deg,#f97316,#ec4899,#7c3cff)" },
  { id: "ocean", label: "Ocean", preview: "linear-gradient(135deg,#0c4a6e,#06b6d4)" },
  { id: "candy", label: "Candy", preview: "linear-gradient(135deg,#fbcfe8,#a78bfa,#67e8f9)" },
  { id: "matrix", label: "Matrix", preview: "linear-gradient(135deg,#000,#16a34a)" },
  { id: "futuristic", label: "Futuristic", preview: "linear-gradient(135deg,#06111f,#22d3ee,#8b5cf6)" },
  { id: "simulator", label: "Simulator", preview: "linear-gradient(135deg,#22c55e,#60a5fa,#fde047)" },
  { id: "tycoon", label: "Tycoon", preview: "linear-gradient(135deg,#111827,#f59e0b,#22c55e)" },
  { id: "anime", label: "Anime", preview: "linear-gradient(135deg,#fb7185,#c084fc,#60a5fa)" },
  { id: "fantasy", label: "Fantasy", preview: "linear-gradient(135deg,#14532d,#7c3aed,#facc15)" },
  { id: "city", label: "City", preview: "linear-gradient(135deg,#0f172a,#475569,#38bdf8)" },
  { id: "neon", label: "Neon", preview: "linear-gradient(135deg,#020617,#00d9ff,#ff4da6)" },
  { id: "dark", label: "Dark", preview: "linear-gradient(135deg,#020617,#111827,#334155)" },
  { id: "premium", label: "Premium", preview: "linear-gradient(135deg,#171717,#f59e0b,#fde68a)" },
];

const STYLES: Record<ProfileBackgroundId, React.CSSProperties> = {
  none: {},
  custom: {},
  studio: {
    background:
      "radial-gradient(120% 90% at 20% 0%, #0ea5e9 0%, transparent 55%), radial-gradient(120% 90% at 100% 100%, #1e293b 0%, transparent 60%), linear-gradient(135deg,#0b1220,#1e293b)",
  },
  "neon-city": {
    background:
      "linear-gradient(135deg, rgba(255,0,170,0.7), rgba(124,60,255,0.55) 50%, rgba(0,217,255,0.6))",
    backgroundSize: "200% 200%",
    animation: "pe-holo 9s linear infinite",
  },
  obby: {
    background:
      "repeating-linear-gradient(45deg, #22c55e 0 18px, #facc15 18px 36px, #ef4444 36px 54px, #3b82f6 54px 72px)",
    opacity: 0.85,
  },
  forest: {
    background:
      "radial-gradient(80% 90% at 30% 20%, #16a34a 0%, transparent 60%), radial-gradient(60% 80% at 80% 80%, #064e3b 0%, transparent 60%), linear-gradient(135deg,#052e1a,#064e3b)",
  },
  space: {
    background:
      "radial-gradient(2px 2px at 20% 30%, #fff 50%, transparent 51%), radial-gradient(2px 2px at 70% 60%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 40% 80%, #fff 50%, transparent 51%), radial-gradient(2px 2px at 85% 20%, #fff 50%, transparent 51%), linear-gradient(135deg, #0b1220, #1e1b4b, #7c3cff)",
    backgroundSize: "200px 200px, 220px 220px, 180px 180px, 240px 240px, 100% 100%",
  },
  lava: {
    background:
      "radial-gradient(60% 80% at 30% 100%, #f97316 0%, transparent 60%), radial-gradient(60% 80% at 80% 100%, #dc2626 0%, transparent 60%), linear-gradient(180deg, #7f1d1d, #1c1917)",
    animation: "pe-aurora 6s ease-in-out infinite alternate",
  },
  clouds: {
    background:
      "radial-gradient(60% 50% at 20% 30%, rgba(255,255,255,0.9) 0%, transparent 60%), radial-gradient(50% 40% at 80% 60%, rgba(255,255,255,0.7) 0%, transparent 60%), linear-gradient(180deg,#bfdbfe,#e0f2fe)",
  },
  void: {
    background:
      "radial-gradient(80% 80% at 50% 50%, #1e1b4b 0%, transparent 70%), linear-gradient(135deg,#000,#0f172a)",
  },
  sunset: {
    background:
      "linear-gradient(180deg, #312e81 0%, #7c3cff 30%, #ec4899 60%, #f97316 85%, #fbbf24 100%)",
  },
  ocean: {
    background:
      "radial-gradient(80% 80% at 30% 0%, #06b6d4 0%, transparent 60%), linear-gradient(180deg,#0c4a6e,#082f49)",
  },
  candy: {
    background:
      "linear-gradient(135deg,#fbcfe8,#a78bfa,#67e8f9,#fde68a)",
    backgroundSize: "300% 300%",
    animation: "pe-holo 12s linear infinite",
  },
  matrix: {
    background:
      "repeating-linear-gradient(180deg, rgba(34,197,94,0.18) 0 2px, transparent 2px 6px), linear-gradient(135deg, #000, #052e16)",
  },
  futuristic: {
    background:
      "linear-gradient(120deg, rgba(34,211,238,.12) 0 1px, transparent 1px 44px), linear-gradient(30deg, rgba(139,92,246,.18) 0 1px, transparent 1px 52px), radial-gradient(90% 90% at 15% 10%, rgba(34,211,238,.65), transparent 58%), radial-gradient(70% 80% at 90% 80%, rgba(139,92,246,.55), transparent 60%), linear-gradient(135deg,#020617,#071827 48%,#111827)",
    backgroundSize: "44px 44px, 52px 52px, 100% 100%, 100% 100%, 100% 100%",
    animation: "pe-holo 14s linear infinite",
  },
  simulator: {
    background:
      "radial-gradient(circle at 18% 72%, rgba(253,224,71,.9) 0 5%, transparent 6%), radial-gradient(circle at 82% 24%, rgba(96,165,250,.8) 0 7%, transparent 8%), repeating-linear-gradient(45deg, rgba(255,255,255,.12) 0 10px, transparent 10px 22px), linear-gradient(135deg,#14532d,#22c55e 45%,#0ea5e9)",
    animation: "pe-aurora 8s ease-in-out infinite alternate",
  },
  tycoon: {
    background:
      "linear-gradient(90deg, rgba(245,158,11,.18) 0 2px, transparent 2px 28px), linear-gradient(180deg, rgba(34,197,94,.18) 0 2px, transparent 2px 28px), radial-gradient(70% 80% at 80% 20%, rgba(245,158,11,.55), transparent 60%), linear-gradient(135deg,#111827,#064e3b)",
    backgroundSize: "28px 28px, 28px 28px, 100% 100%, 100% 100%",
  },
  anime: {
    background:
      "radial-gradient(circle at 20% 20%, rgba(255,255,255,.85) 0 2px, transparent 3px), radial-gradient(75% 80% at 20% 0%, rgba(251,113,133,.68), transparent 60%), radial-gradient(80% 90% at 100% 70%, rgba(96,165,250,.65), transparent 60%), linear-gradient(135deg,#581c87,#be185d)",
    backgroundSize: "48px 48px, 100% 100%, 100% 100%, 100% 100%",
    animation: "pe-holo 16s linear infinite",
  },
  fantasy: {
    background:
      "radial-gradient(2px 2px at 18% 28%, #fde68a 50%, transparent 51%), radial-gradient(2px 2px at 82% 34%, #fff 50%, transparent 51%), radial-gradient(80% 90% at 26% 10%, rgba(34,197,94,.5), transparent 60%), radial-gradient(80% 80% at 90% 90%, rgba(124,58,237,.55), transparent 62%), linear-gradient(135deg,#052e16,#2e1065)",
    backgroundSize: "140px 140px, 180px 180px, 100% 100%, 100% 100%, 100% 100%",
  },
  city: {
    background:
      "linear-gradient(to top, rgba(15,23,42,1) 0 20%, transparent 20%), repeating-linear-gradient(90deg, rgba(148,163,184,.28) 0 18px, transparent 18px 34px), radial-gradient(90% 80% at 50% 0%, rgba(56,189,248,.55), transparent 60%), linear-gradient(180deg,#0f172a,#020617)",
  },
  neon: {
    background:
      "radial-gradient(70% 80% at 18% 12%, rgba(0,217,255,.72), transparent 55%), radial-gradient(80% 80% at 85% 76%, rgba(255,77,166,.62), transparent 62%), repeating-linear-gradient(90deg, rgba(255,255,255,.1) 0 1px, transparent 1px 38px), linear-gradient(135deg,#020617,#111827)",
    backgroundSize: "100% 100%, 100% 100%, 38px 38px, 100% 100%",
    animation: "pe-holo 10s linear infinite",
  },
  dark: {
    background:
      "radial-gradient(80% 80% at 50% 0%, rgba(71,85,105,.5), transparent 65%), radial-gradient(60% 60% at 90% 90%, rgba(15,23,42,.9), transparent 60%), linear-gradient(135deg,#020617,#0f172a,#111827)",
  },
  premium: {
    background:
      "radial-gradient(80% 70% at 22% 10%, rgba(253,230,138,.62), transparent 55%), radial-gradient(80% 90% at 100% 100%, rgba(245,158,11,.46), transparent 62%), linear-gradient(135deg,#171717,#2a1804,#020617)",
    animation: "pe-aurora 7s ease-in-out infinite alternate",
  },
};

export const ProfileBackground = memo(function ProfileBackground({
  id,
  customUrl,
  className = "",
}: {
  id?: ProfileBackgroundId | string | null;
  customUrl?: string | null;
  className?: string;
}) {
  const key = (id ?? "none") as ProfileBackgroundId;
  if (key === "custom" && customUrl) {
    const isVideo = /\.(mp4|webm)(\?|$)/i.test(customUrl);
    return (
      <div aria-hidden className={`absolute inset-0 overflow-hidden ${className}`}>
        {isVideo ? (
          <video
            src={customUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img src={customUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/10 to-transparent" />
      </div>
    );
  }
  const style = STYLES[key] ?? {};
  return <div aria-hidden className={`absolute inset-0 ${className}`} style={style} />;
});
