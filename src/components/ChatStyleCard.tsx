import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateProfileCustomization } from "@/lib/profile-customization.functions";
import { Check, Loader2, Palette, RotateCcw, Sparkles, X } from "lucide-react";
import {
  CHAT_ICONS,
  CHAT_ICON_MAP,
  CHAT_FONTS,
  NAME_GRADIENT_PRESETS,
  TEXT_GRADIENT_PRESETS,
  chatFontStyle,
  gradientTextStyle,
  sanitizeFont,
  sanitizeGradient,
  sanitizeIcon,
} from "@/lib/chat-customization";
import { ProfileEffect, PROFILE_EFFECTS, type ProfileEffectId } from "./chat/ProfileEffect";
import { canUseReservedCosmetics, isReservedChatIcon } from "@/lib/profile-cosmetics";

const ACCENT_PRESETS = [
  "#7c3cff",
  "#00d9ff",
  "#ff4da6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a78bfa",
  "#38bdf8",
];

const NICK_RE = /^[A-Za-z0-9 _.\-]{0,24}$/;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function stopsToCss(stops: string[] | null): string {
  if (!stops || !stops.length) return "transparent";
  if (stops.length === 1) return stops[0];
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function ChatStyleCard() {
  const { user, profile, refresh, roles } = useAuth();
  const saveProfile = useServerFn(updateProfileCustomization);
  const [nameStops, setNameStops] = useState<string[]>([]);
  const [textStops, setTextStops] = useState<string[]>([]);
  const [icon, setIcon] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [font, setFont] = useState<string>("default");
  const [accent, setAccent] = useState<string>("");
  const [effect, setEffect] = useState<ProfileEffectId>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = profile as any;
    setNameStops(sanitizeGradient(profile?.chat_name_gradient) ?? []);
    setTextStops(sanitizeGradient(profile?.chat_text_gradient) ?? []);
    setIcon(sanitizeIcon(profile?.chat_icon));
    setNickname(profile?.chat_nickname ?? "");
    setFont(sanitizeFont(profile?.chat_font) ?? "default");
    setAccent(typeof p?.profile_accent === "string" ? p.profile_accent : "");
    setEffect((p?.profile_effect as ProfileEffectId) ?? "none");
  }, [profile]);

  const displayName =
    nickname.trim() || profile?.display_name || user?.email?.split("@")[0] || "You";
  const Icon = icon ? CHAT_ICON_MAP[icon] : null;
  const canUseReserved = canUseReservedCosmetics(roles);

  const fontStyle = useMemo(() => chatFontStyle(font), [font]);
  const previewName = useMemo(
    () => ({ ...gradientTextStyle(nameStops.length ? nameStops : null), ...fontStyle }),
    [nameStops, fontStyle],
  );
  const previewText = useMemo(
    () => ({ ...gradientTextStyle(textStops.length ? textStops : null), ...fontStyle }),
    [textStops, fontStyle],
  );

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const cleanName = sanitizeGradient(nameStops);
      const cleanText = sanitizeGradient(textStops);
      const cleanIcon = sanitizeIcon(icon);
      if (cleanIcon && isReservedChatIcon(cleanIcon) && !canUseReserved) {
        throw new Error("The crown chat icon is reserved for owners/admins.");
      }
      const cleanFont = sanitizeFont(font);
      const trimmedNick = nickname.trim();
      if (trimmedNick && !NICK_RE.test(trimmedNick)) {
        throw new Error("Nickname must be 1-24 chars: letters, numbers, space . _ -");
      }
      const cleanAccent = HEX_RE.test(accent) ? accent : null;
      const cleanEffect = PROFILE_EFFECTS.some((e) => e.id === effect) ? effect : "none";
      const result = await saveProfile({
        data: {
          chat_name_gradient: cleanName,
          chat_text_gradient: cleanText,
          chat_icon: cleanIcon,
          chat_nickname: trimmedNick || null,
          chat_font: cleanFont,
          profile_accent: cleanAccent,
          profile_effect: cleanEffect,
        },
      });

      await refresh();
      const warning = (result as any)?.warning;
      if (warning) toast.warning(warning);
      else toast.success("Chat style saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save chat style");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setNameStops([]);
    setTextStops([]);
    setIcon(null);
    setNickname("");
    setFont("default");
    setAccent("");
    setEffect("none");
  };

  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Chat style
          </h3>
          <p className="text-xs text-muted-foreground">
            Personalize how your name, messages, and icon appear in the global chat.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs hover:bg-surface-elevated"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-border bg-background/40 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Preview
        </div>
        <div className="flex items-start gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-bold text-muted-foreground">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              displayName.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {Icon ? (
                <Icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={nameStops[0] ? { color: nameStops[0] } : undefined}
                />
              ) : null}
              <span className="truncate text-xs font-semibold" style={previewName}>
                {displayName}
              </span>
              <span className="text-[10px] text-muted-foreground">just now</span>
            </div>
            <div className="mt-0.5 text-sm leading-relaxed text-foreground" style={previewText}>
              Looking good! This is how your messages will appear.
            </div>
          </div>
        </div>
      </div>

      {/* Nickname */}
      <div className="space-y-1.5">
        <div>
          <div className="text-sm font-medium">Chat nickname</div>
          <div className="text-[11px] text-muted-foreground">
            Shown in chat instead of your real name. Leave empty to use your display name.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            placeholder={profile?.display_name ?? "your nickname"}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          {nickname && (
            <button
              onClick={() => setNickname("")}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] hover:bg-surface-elevated"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Letters, numbers, space, . _ - (max 24). {nickname.length}/24
        </div>
      </div>

      {/* Font family */}
      <div className="space-y-1.5">
        <div>
          <div className="text-sm font-medium">Font</div>
          <div className="text-[11px] text-muted-foreground">
            Applies to your name and messages in chat.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {CHAT_FONTS.map((f) => {
            const active = font === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFont(f.id)}
                className={`rounded-lg border px-2 py-2 text-center text-xs transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                }`}
                style={chatFontStyle(f.id)}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Name gradient */}
      <GradientPicker
        label="Name color"
        helper="Up to 4 colors. One color = solid, two or more = gradient."
        stops={nameStops}
        onChange={setNameStops}
        presets={NAME_GRADIENT_PRESETS}
      />

      {/* Text gradient */}
      <GradientPicker
        label="Message text color"
        helper="Optional. Leave empty for the default theme color."
        stops={textStops}
        onChange={setTextStops}
        presets={TEXT_GRADIENT_PRESETS}
        allowEmpty
      />

      {/* Icon */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Name icon</div>
            <div className="text-[11px] text-muted-foreground">
              A small icon shown right before your name. Pick one or none.
            </div>
          </div>
          {icon && (
            <button
              onClick={() => setIcon(null)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] hover:bg-surface-elevated"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-11 gap-1.5">
          {CHAT_ICONS.map(({ id, label, Icon: I }) => {
            const active = icon === id;
            const locked = isReservedChatIcon(id) && !canUseReserved;
            return (
              <button
                key={id}
                title={locked ? `${label} — owner/admin only` : label}
                disabled={locked}
                onClick={() => setIcon(active ? null : id)}
                className={`relative grid aspect-square place-items-center rounded-lg border transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : locked
                      ? "cursor-not-allowed border-border bg-surface/50 text-muted-foreground/35"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                }`}
              >
                <I
                  className="h-4 w-4"
                  style={active && nameStops[0] ? { color: nameStops[0] } : undefined}
                />
                {active && (
                  <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
                {locked && (
                  <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full border border-border bg-background text-[9px] text-muted-foreground">
                    x
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile flair: accent color + animated effect */}
      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium">Profile flair</div>
          <div className="text-[11px] text-muted-foreground">
            Pick an accent color and an animated effect for your profile card. Visible to everyone
            who opens your profile.
          </div>
        </div>

        {/* Live preview */}
        <div
          className="relative h-24 overflow-hidden rounded-xl border border-border bg-background/40"
          style={
            accent
              ? { background: `linear-gradient(135deg, ${accent}55, ${accent}11 60%, transparent)` }
              : undefined
          }
        >
          <ProfileEffect effect={effect} accent={accent || undefined} />
          <div className="absolute inset-0 grid place-items-center">
            <span
              className="text-sm font-bold"
              style={accent ? { color: accent, textShadow: `0 0 14px ${accent}66` } : undefined}
            >
              {displayName}
            </span>
          </div>
        </div>

        {/* Accent color */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground mr-1">Accent</span>
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              title={c}
              className={`h-6 w-6 rounded-full border-2 transition ${accent.toLowerCase() === c.toLowerCase() ? "border-foreground scale-110" : "border-border hover:scale-105"}`}
              style={{ background: c }}
            />
          ))}
          <input
            type="color"
            value={HEX_RE.test(accent) ? accent : "#7c3cff"}
            onChange={(e) => setAccent(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
          />
          <input
            type="text"
            value={accent}
            placeholder="#7c3cff"
            maxLength={7}
            onChange={(e) => setAccent(e.target.value)}
            className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
          />
          {accent && (
            <button
              onClick={() => setAccent("")}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] hover:bg-surface-elevated"
            >
              Clear
            </button>
          )}
        </div>

        {/* Effect */}
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {PROFILE_EFFECTS.map((e) => {
            const active = effect === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setEffect(e.id)}
                className={`rounded-lg border px-2 py-2 text-xs transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary/85 px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {saving ? "Saving…" : "Save chat style"}
        </button>
      </div>
    </div>
  );
}

function GradientPicker({
  label,
  helper,
  stops,
  onChange,
  presets,
  allowEmpty = false,
}: {
  label: string;
  helper?: string;
  stops: string[];
  onChange: (s: string[]) => void;
  presets: { id: string; label: string; stops: string[] }[];
  allowEmpty?: boolean;
}) {
  const setStop = (i: number, v: string) => {
    const next = [...stops];
    next[i] = v;
    onChange(next);
  };
  const addStop = () => {
    if (stops.length >= 4) return;
    onChange([...stops, stops[stops.length - 1] ?? "#a78bfa"]);
  };
  const removeStop = (i: number) => {
    const next = stops.filter((_, idx) => idx !== i);
    if (!allowEmpty && next.length === 0) onChange(["#a78bfa"]);
    else onChange(next);
  };

  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {helper && <div className="text-[11px] text-muted-foreground">{helper}</div>}
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.stops)}
            title={p.label}
            className="group flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1 text-[11px] hover:bg-surface-elevated"
          >
            <span
              className="h-3 w-6 rounded-full border border-border/50"
              style={{ background: stopsToCss(p.stops.length ? p.stops : null) || "transparent" }}
            />
            {p.label}
          </button>
        ))}
      </div>

      {/* Stops */}
      <div className="flex flex-wrap items-center gap-2">
        {stops.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-1"
          >
            <input
              type="color"
              value={HEX_RE.test(c) ? c : "#a78bfa"}
              onChange={(e) => setStop(i, e.target.value)}
              className="h-6 w-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <input
              type="text"
              value={c}
              maxLength={9}
              onChange={(e) => setStop(i, e.target.value)}
              className="w-20 bg-transparent text-xs outline-none"
            />
            <button
              onClick={() => removeStop(i)}
              className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-surface-elevated hover:text-destructive"
              title="Remove stop"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {stops.length < 4 && (
          <button
            onClick={addStop}
            className="rounded-lg border border-dashed border-border bg-surface px-2 py-1.5 text-xs hover:bg-surface-elevated"
          >
            + Add color
          </button>
        )}
      </div>

      {/* Live gradient bar */}
      <div
        className="h-2.5 w-full rounded-full border border-border/60"
        style={{ background: stopsToCss(stops.length ? stops : null) }}
      />
    </div>
  );
}
