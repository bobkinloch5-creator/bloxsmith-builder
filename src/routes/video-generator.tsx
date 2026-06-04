import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import {
  startVideoGeneration,
  checkVideoGeneration,
  getVideoRateLimit,
  COMET_VIDEO_MODEL_OPTIONS,
  DEFAULT_COMET_VIDEO_MODEL_EXPORT,
  VIDEO_CREDIT_COST_EXPORT,
  type VideoJob,
  type VideoRateLimit,
  type CometVideoModelId,
} from "@/lib/video-studio.functions";
import {
  Film,
  Sparkles,
  Download,
  Loader2,
  AlertCircle,
  Clock,
  Upload,
  X,
  Wand2,
} from "lucide-react";

export const Route = createFileRoute("/video-generator")({
  component: VideoGeneratorPage,
  head: () => ({
    meta: [
      { title: "AI Roblox Video Generator | BloxSmith" },
      {
        name: "description",
        content:
          "Generate cinematic Roblox game trailers, cutscenes, and promos with AI. Pick a movie style, preview in 3D, and download your clip.",
      },
      {
        name: "keywords",
        content:
          "AI Roblox video generator, Roblox trailer maker, Roblox cutscene AI, game promo video generator, BloxSmith video",
      },
    ],
  }),
});

const DURATIONS: Array<4 | 6 | 8 | 10 | 12 | 15> = [4, 6, 8, 10, 12, 15];
const RESOLUTIONS = ["720p", "1080p"] as const;
const VIDEO_COST = VIDEO_CREDIT_COST_EXPORT;

// Roblox-flavored movie-style presets. Each fills the prompt with a strong,
// genre-appropriate starting point the user can tweak.
const PRESETS: Array<{ label: string; emoji: string; prompt: string }> = [
  {
    label: "Tycoon Trailer",
    emoji: "🏭",
    prompt:
      "Cinematic Roblox tycoon game trailer: sweeping camera over a colorful blocky factory empire, conveyor belts and money piles, dynamic zoom-ins on upgrades, bright punchy lighting, energetic promo feel.",
  },
  {
    label: "Obby Showcase",
    emoji: "🧗",
    prompt:
      "Fast-paced Roblox obby showcase: a blocky avatar leaping across floating neon platforms over lava, dramatic near-misses, dynamic chase camera, vibrant stylized colors.",
  },
  {
    label: "Horror Teaser",
    emoji: "👻",
    prompt:
      "Dark Roblox horror game teaser: dim flickering hallway in a blocky mansion, fog rolling across the floor, a shadowy figure at the end, slow creeping camera, tense cinematic atmosphere.",
  },
  {
    label: "Simulator Promo",
    emoji: "⚡",
    prompt:
      "High-energy Roblox simulator promo: blocky avatar smashing through giant objects, numbers and pets exploding everywhere, rapid satisfying progression montage, bright saturated colors.",
  },
  {
    label: "RPG Cinematic",
    emoji: "⚔️",
    prompt:
      "Epic Roblox RPG cinematic: a blocky hero in armor raising a glowing sword on a mountaintop, sweeping fantasy landscape, dramatic clouds and god rays, orchestral movie-trailer energy.",
  },
  {
    label: "Racing Promo",
    emoji: "🏎️",
    prompt:
      "Adrenaline Roblox racing trailer: blocky cars drifting around a neon city track at night, motion-blur speed, dynamic low chase cam, sparks and tire smoke, vibrant arcade colors.",
  },
  {
    label: "Tower Defense",
    emoji: "🏰",
    prompt:
      "Roblox tower defense trailer: waves of blocky enemies marching down a path, turrets firing colorful projectiles, explosions and effects, top-down sweeping camera, lively cartoon style.",
  },
  {
    label: "Anime Battle",
    emoji: "🌀",
    prompt:
      "Roblox anime fighting game cinematic: two blocky characters clashing with glowing energy auras, speed lines, dramatic impact frames, vivid anime-style lighting and color.",
  },
];

function VideoGeneratorPage() {
  const { user } = useAuth();
  const start = startVideoGeneration;
  const check = checkVideoGeneration;
  const getLimit = getVideoRateLimit;

  const [prompt, setPrompt] = useState("");
  const [videoModel, setVideoModel] = useState<CometVideoModelId>(DEFAULT_COMET_VIDEO_MODEL_EXPORT);
  const selectedVideoModel =
    COMET_VIDEO_MODEL_OPTIONS.find((option) => option.id === videoModel) ??
    COMET_VIDEO_MODEL_OPTIONS[0];
  const videoCost = selectedVideoModel?.creditCost ?? VIDEO_COST;
  const [durationS, setDurationS] = useState<4 | 6 | 8 | 10 | 12 | 15>(6);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [job, setJob] = useState<VideoJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<VideoRateLimit | null>(null);
  const [now, setNow] = useState(Date.now());
  const [refImage, setRefImage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    getLimit({ data: { model: videoModel } })
      .then((r) => setLimit(r as VideoRateLimit))
      .catch(() => {});
  }, [getLimit, user, videoModel]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const poll = useCallback(
    (taskId: string) => {
      pollRef.current = setTimeout(async () => {
        try {
          const next = (await check({ data: { taskId } })) as VideoJob;
          setJob(next);
          if (next.status === "completed" || next.status === "failed") {
            setBusy(false);
            setStartedAt(null);
            if (next.status === "failed") {
              setError(next.error ?? "Generation failed.");
              toast.error(next.error ?? "Video generation failed.");
            }
          } else {
            poll(taskId);
          }
        } catch (err) {
          setBusy(false);
          setStartedAt(null);
          setError(err instanceof Error ? err.message : "Failed to check status.");
        }
      }, 3000);
    },
    [check],
  );

  async function generate() {
    if (!user) {
      toast.error("Please sign in to generate videos.");
      return;
    }
    if (prompt.trim().length < 3) {
      toast.error("Describe your video or pick a preset first.");
      return;
    }
    setError(null);
    setJob(null);
    setBusy(true);
    setStartedAt(Date.now());
    try {
      const result = (await start({
        data: {
          prompt,
          model: videoModel,
          durationS,
          resolution,
          ...(refImage ? { referenceImageDataUrl: refImage } : {}),
        },
      })) as VideoJob;
      setJob(result);
      getLimit({ data: { model: videoModel } })
        .then((r) => setLimit(r as VideoRateLimit))
        .catch(() => {});
      if (result.status === "completed" || result.status === "failed") {
        setBusy(false);
        setStartedAt(null);
        if (result.status === "failed") setError(result.error ?? "Generation failed.");
      } else {
        poll(result.taskId);
      }
    } catch (err: unknown) {
      setBusy(false);
      setStartedAt(null);
      const msg = err instanceof Error ? err.message : "Failed to start generation.";
      setError(msg);
      toast.error(msg);
      if (typeof err === "object" && err !== null && "rateLimited" in err) {
        getLimit({ data: { model: videoModel } })
          .then((r) => setLimit(r as VideoRateLimit))
          .catch(() => {});
      }
    }
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6_000_000) {
      toast.error("Image too large (max 6MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setRefImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  const blocked = !!(limit && !limit.allowed && limit.nextAvailableAt);
  const countdown = blocked
    ? formatCountdown(new Date(limit!.nextAvailableAt!).getTime() - now)
    : null;

  // Progress + ETA while rendering. Sora/Comet video typically takes several minutes,
  // so we estimate against a 150s baseline and cap visual progress at 95%
  // until the real video URL lands (so it never shows 100% prematurely).
  const ETA_TOTAL_MS = 150_000;
  const elapsedMs = startedAt ? now - startedAt : 0;
  const progressPct = busy
    ? Math.min(95, Math.round((elapsedMs / ETA_TOTAL_MS) * 100))
    : job?.status === "completed"
      ? 100
      : 0;
  const etaMs = Math.max(0, ETA_TOTAL_MS - elapsedMs);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start gap-3 mb-1">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/25 to-accent/20 grid place-items-center shadow-lg shadow-primary/10">
            <Film className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold leading-tight">AI Roblox Video Generator</h1>
              <span className="rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                1 / week
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Cinematic Roblox trailers &amp; cutscenes ·{" "}
              <span className="text-foreground font-medium">{videoCost} credits</span> · one per
              week
            </p>
          </div>
        </div>

        {/* Weekly limit banner */}
        {blocked && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-amber-100">You've used your video this week</div>
              <div className="text-amber-200/80 text-xs mt-0.5">
                Video generation is limited to once per week. Next video unlocks in{" "}
                <span className="font-mono text-amber-100">{countdown}</span>.
              </div>
            </div>
          </div>
        )}

        {/* Presets */}
        <div className="mt-5">
          <label className="text-xs font-medium text-muted-foreground">Pick a movie style</label>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                onClick={() => setPrompt(p.prompt)}
                className="group rounded-xl border border-border bg-surface-elevated/40 p-2.5 text-left transition hover:border-primary/40 hover:bg-surface disabled:opacity-50"
              >
                <div className="text-lg leading-none">{p.emoji}</div>
                <div className="mt-1 text-[11px] font-semibold leading-tight">{p.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="mt-4 rounded-2xl border border-border bg-surface-elevated/40 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Describe your video</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1500}
              rows={4}
              placeholder="Pick a style above, or describe your own Roblox scene — e.g. a blocky hero sprinting across a floating obby at sunset, cinematic chase camera…"
              disabled={busy}
              className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none disabled:opacity-50"
            />
            <div className="text-[10px] text-muted-foreground text-right mt-1">
              {prompt.length}/1500
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Video model</label>
              <select
                value={videoModel}
                onChange={(e) => setVideoModel(e.target.value as CometVideoModelId)}
                disabled={busy}
                className="mt-1.5 h-[34px] w-full rounded-md border border-border bg-background/40 px-2 text-xs text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50"
              >
                {COMET_VIDEO_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} · {option.creditCost} credits
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                {selectedVideoModel.creditCost} credits · {selectedVideoModel.description}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Length</label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={busy}
                    onClick={() => setDurationS(d)}
                    className={`rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-50 ${
                      durationS === d
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quality</label>
              <div className="mt-1.5 flex gap-1.5">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    onClick={() => setResolution(r)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-50 ${
                      resolution === r
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional reference image */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Reference image (optional)
            </label>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Animate a still image instead of pure text-to-video.
            </p>
            {refImage ? (
              <div className="mt-1.5 relative inline-block">
                <img
                  src={refImage}
                  alt="reference"
                  className="h-20 rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setRefImage(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-background border border-border text-muted-foreground hover:text-foreground"
                  aria-label="Remove reference image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="mt-1.5 inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs hover:border-primary/40 transition disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" /> Upload image
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onPickImage}
            />
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={busy || blocked || prompt.trim().length < 3}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Generate video ({videoCost} credits)
              </>
            )}
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Limited to 1 video per week · generation usually takes 1–3 minutes
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Progress / 3D preview / result */}
        {job && (
          <div className="mt-4 rounded-2xl border border-border bg-surface-elevated/40 p-4">
            {job.status !== "completed" && job.status !== "failed" && (
              <div className="flex flex-col items-center py-6 text-center">
                {/* Animated 3D-style preview while rendering */}
                <div className="reel-3d-scene mb-5">
                  <div className="reel-3d-cube">
                    <div className="reel-3d-face reel-3d-front">
                      <Film className="h-7 w-7" />
                    </div>
                    <div className="reel-3d-face reel-3d-back">
                      <Film className="h-7 w-7" />
                    </div>
                    <div className="reel-3d-face reel-3d-right">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <div className="reel-3d-face reel-3d-left">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <div className="reel-3d-face reel-3d-top" />
                    <div className="reel-3d-face reel-3d-bottom" />
                  </div>
                </div>

                <div className="text-sm font-medium capitalize">
                  {job.status === "queued" ? "Queued" : "Rendering"}…
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Building your Roblox clip — sit tight, this usually takes 1–3 minutes.
                </div>

                {/* Progress bar + ETA */}
                <div className="mt-4 w-full max-w-sm">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span className="font-mono">{progressPct}%</span>
                    <span>ETA ~{formatCountdown(etaMs)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {job.status === "completed" && job.videoUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> Your video is ready
                </div>
                <video
                  src={job.videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full rounded-lg border border-border bg-black"
                />
                <a
                  href={job.videoUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
                >
                  <Download className="h-4 w-4" /> Download video
                </a>
              </div>
            )}

            {job.status === "completed" && !job.videoUrl && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Generation finished but no video URL was returned. Please try again.
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />

      {/* Scoped styles for the 3D rendering preview */}
      <style>{`
        .reel-3d-scene { perspective: 600px; width: 90px; height: 90px; }
        .reel-3d-cube {
          position: relative; width: 90px; height: 90px;
          transform-style: preserve-3d;
          animation: reel3dSpin 4s linear infinite;
        }
        .reel-3d-face {
          position: absolute; width: 90px; height: 90px;
          display: grid; place-items: center;
          border: 1px solid oklch(0.6 0.12 160 / 0.5);
          background: oklch(0.18 0.03 165 / 0.55);
          color: oklch(0.82 0.15 160);
          border-radius: 10px;
          backdrop-filter: blur(2px);
        }
        .reel-3d-front  { transform: translateZ(45px); }
        .reel-3d-back   { transform: rotateY(180deg) translateZ(45px); }
        .reel-3d-right  { transform: rotateY(90deg) translateZ(45px); }
        .reel-3d-left   { transform: rotateY(-90deg) translateZ(45px); }
        .reel-3d-top    { transform: rotateX(90deg) translateZ(45px); }
        .reel-3d-bottom { transform: rotateX(-90deg) translateZ(45px); }
        @keyframes reel3dSpin {
          0%   { transform: rotateX(-20deg) rotateY(0deg); }
          100% { transform: rotateX(-20deg) rotateY(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .reel-3d-cube { animation: none; transform: rotateX(-20deg) rotateY(30deg); }
        }
      `}</style>
    </div>
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
