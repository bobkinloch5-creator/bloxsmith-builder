import { useRef } from "react";
import {
  Settings2,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  AtSign,
  X,
  Image as ImageIcon,
  Upload,
  Trash2,
  SmilePlus,
} from "lucide-react";
import { type ChatPrefs, type ChatBgStyle, chatBackgroundStyle } from "@/lib/chat-prefs";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isEmoteToken } from "@/lib/emotes";

const BG_STYLES: { v: ChatBgStyle; l: string }[] = [
  { v: "default", l: "Default" },
  { v: "solid", l: "Solid" },
  { v: "gradient", l: "Gradient" },
  { v: "mesh", l: "Mesh" },
  { v: "aurora", l: "Aurora" },
  { v: "aurora-anim", l: "Aurora ✨" },
  { v: "stars", l: "Stars ✨" },
  { v: "matrix", l: "Matrix ✨" },
  { v: "roblox-studio", l: "Studio" },
  { v: "neon-city", l: "Neon City ✨" },
  { v: "lava", l: "Lava ✨" },
  { v: "dots", l: "Dots" },
  { v: "grid", l: "Grid" },
  { v: "stripes", l: "Stripes" },
  { v: "custom-image", l: "Custom Image" },
];

const PRESETS: { name: string; patch: Partial<ChatPrefs> }[] = [
  { name: "Midnight", patch: { bg_style: "gradient", bg_color: "#0b1220", bg_color2: "#1e1b4b" } },
  { name: "Sunset", patch: { bg_style: "gradient", bg_color: "#7c2d12", bg_color2: "#db2777" } },
  { name: "Ocean", patch: { bg_style: "mesh", bg_color: "#0ea5e9", bg_color2: "#6366f1" } },
  { name: "Forest", patch: { bg_style: "mesh", bg_color: "#064e3b", bg_color2: "#84cc16" } },
  { name: "Neon", patch: { bg_style: "aurora-anim", bg_color: "#a855f7", bg_color2: "#22d3ee" } },
  {
    name: "Studio",
    patch: { bg_style: "roblox-studio", bg_color: "#0e1726", bg_color2: "#1a2a4a" },
  },
  { name: "Cyber", patch: { bg_style: "neon-city", bg_color: "#ec4899", bg_color2: "#06b6d4" } },
  { name: "Lava", patch: { bg_style: "lava", bg_color: "#f97316", bg_color2: "#dc2626" } },
  { name: "Stars", patch: { bg_style: "stars", bg_color: "#03040a", bg_color2: "#ffffff" } },
  { name: "Matrix", patch: { bg_style: "matrix", bg_color: "#22c55e", bg_color2: "#22c55e" } },
  { name: "Carbon", patch: { bg_style: "dots", bg_color: "#0a0a0a", bg_color2: "#525252" } },
  { name: "Candy", patch: { bg_style: "stripes", bg_color: "#fb7185", bg_color2: "#f472b6" } },
];

export function ChatSettingsPanel({
  prefs,
  onChange,
  onClose,
}: {
  prefs: ChatPrefs;
  onChange: (p: Partial<ChatPrefs>) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-surface-elevated/98 backdrop-blur-xl">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          <h2 className="text-sm font-bold">Chat preferences</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4 text-sm">
        <Row label="Font size">
          <ButtonGroup
            value={prefs.font_size}
            options={[
              { v: "sm", l: "Small" },
              { v: "md", l: "Medium" },
              { v: "lg", l: "Large" },
            ]}
            onChange={(v) => onChange({ font_size: v as any })}
          />
        </Row>
        <Row label="Density">
          <ButtonGroup
            value={prefs.density}
            options={[
              { v: "compact", l: "Compact" },
              { v: "cozy", l: "Cozy" },
              { v: "comfy", l: "Comfy" },
            ]}
            onChange={(v) => onChange({ density: v as any })}
          />
        </Row>
        <Row label="Emote size">
          <ButtonGroup
            value={prefs.emote_size}
            options={[
              { v: "compact", l: "Compact" },
              { v: "normal", l: "Normal" },
              { v: "large", l: "Large" },
            ]}
            onChange={(v) => onChange({ emote_size: v })}
          />
        </Row>
        <Row label="Sound">
          <ButtonGroup
            value={prefs.sound_enabled ? "on" : "off"}
            options={[
              { v: "on", l: "On", icon: <Volume2 className="h-3 w-3" /> },
              { v: "off", l: "Off", icon: <VolumeX className="h-3 w-3" /> },
            ]}
            onChange={(v) => onChange({ sound_enabled: v === "on" })}
          />
        </Row>
        <Row label="System messages">
          <ButtonGroup
            value={prefs.show_system ? "on" : "off"}
            options={[
              { v: "on", l: "Show" },
              { v: "off", l: "Hide" },
            ]}
            onChange={(v) => onChange({ show_system: v === "on" })}
          />
        </Row>
        <Row label="Chat bubbles (popups on new messages)">
          <ButtonGroup
            value={prefs.show_bubbles ? "on" : "off"}
            options={[
              { v: "on", l: "On" },
              { v: "off", l: "Off" },
            ]}
            onChange={(v) => onChange({ show_bubbles: v === "on" })}
          />
        </Row>
        <Row label="Notifications">
          <ButtonGroup
            value={prefs.notify_mode}
            options={[
              { v: "off", l: "Off", icon: <BellOff className="h-3 w-3" /> },
              { v: "mentions", l: "Mentions", icon: <AtSign className="h-3 w-3" /> },
              { v: "all", l: "All", icon: <Bell className="h-3 w-3" /> },
            ]}
            onChange={(v) => onChange({ notify_mode: v as any })}
          />
        </Row>
        <Row
          label={
            <>
              <SmilePlus className="mr-1 inline h-3 w-3" />
              Quick reactions
            </>
          }
        >
          <QuickReactionEditor
            value={prefs.quick_reactions}
            onChange={(quick_reactions) => onChange({ quick_reactions })}
          />
        </Row>
        <Row label="Accent color">
          <div className="flex flex-wrap gap-1.5">
            {[null, "#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#ef4444"].map(
              (c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ theme_accent: c })}
                  className={`h-6 w-6 rounded-full border-2 ${
                    prefs.theme_accent === c ? "border-foreground" : "border-border"
                  }`}
                  style={{ background: c ?? "transparent" }}
                  aria-label={c ?? "Default"}
                >
                  {c === null && <span className="text-[10px]">∅</span>}
                </button>
              ),
            )}
          </div>
        </Row>

        <div className="h-px bg-border" />

        <Row
          label={
            <>
              <ImageIcon className="mr-1 inline h-3 w-3" />
              Background style
            </>
          }
        >
          <div className="flex flex-wrap gap-1">
            {BG_STYLES.map((s) => (
              <button
                key={s.v}
                type="button"
                onClick={() => onChange({ bg_style: s.v })}
                className={`rounded-md border px-2 py-1 text-xs ${
                  prefs.bg_style === s.v
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-surface"
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>
        </Row>

        {prefs.bg_style === "custom-image" && (
          <Row label="Custom image">
            <ChatBgImageUploader
              url={prefs.bg_image_url}
              onChange={(url) => onChange({ bg_image_url: url })}
            />
          </Row>
        )}

        {prefs.bg_style !== "default" && prefs.bg_style !== "custom-image" && (
          <>
            <Row label="Background colors">
              <div className="flex items-center gap-3">
                <ColorInput
                  label="Primary"
                  value={prefs.bg_color}
                  onChange={(v) => onChange({ bg_color: v })}
                />
                <ColorInput
                  label="Accent"
                  value={prefs.bg_color2}
                  onChange={(v) => onChange({ bg_color2: v })}
                />
              </div>
            </Row>

            <Row label="Presets">
              <div className="grid grid-cols-4 gap-1.5">
                {PRESETS.map((p) => {
                  const preview = chatBackgroundStyle({ ...prefs, ...p.patch } as ChatPrefs);
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => onChange(p.patch)}
                      className="group flex flex-col items-stretch gap-1 rounded-md border border-border p-1 hover:border-primary"
                    >
                      <div className="h-10 w-full rounded" style={preview} />
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Row>
          </>
        )}

        {prefs.bg_style !== "default" && (
          <Row label="Live preview">
            <div
              className="h-16 w-full rounded-lg border border-border"
              style={chatBackgroundStyle(prefs)}
            />
          </Row>
        )}

        <p className="pt-2 text-[11px] text-muted-foreground">
          Name color, message gradient, and icon are set in your profile.
        </p>
      </div>
    </div>
  );
}

function QuickReactionEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const rows = [...value.slice(0, 10)];
  while (rows.length < 6) rows.push("");

  function update(index: number, next: string) {
    const clean = next.trim().slice(0, 32);
    const copy = [...rows];
    copy[index] = clean;
    onChange(copy.filter(Boolean).slice(0, 10));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {rows.slice(0, 6).map((item, index) => {
          const emote = isEmoteToken(item);
          return (
            <label
              key={index}
              className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-background/40 p-1.5"
            >
              <span className="grid h-8 place-items-center rounded bg-surface/60 text-lg">
                {emote?.src ? (
                  <img src={emote.src} alt="" className="h-6 w-6 object-contain" />
                ) : (
                  emote?.emoji || item || "＋"
                )}
              </span>
              <input
                value={item}
                onChange={(event) => update(index, event.target.value)}
                placeholder={index === 5 ? ":blox_gg:" : "🔥"}
                className="w-full rounded border border-border bg-background px-1 py-0.5 text-center text-[10px] outline-none focus:border-primary"
              />
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Use normal emoji or BloxSmith tokens like :blox_happy:, :tycoon:, :script:, and :owner:.
      </p>
    </div>
  );
}

function ChatBgImageUploader({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!user) {
      toast.error("Sign in to upload");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/chat-bg-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("profile-media")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
    onChange(data.publicUrl);
    toast.success("Background updated");
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {url ? (
        <div
          className="h-12 w-20 rounded border border-border bg-cover bg-center"
          style={{ backgroundImage: `url("${url}")` }}
        />
      ) : (
        <div className="grid h-12 w-20 place-items-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
          No image
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface"
      >
        <Upload className="h-3 w-3" />
        Upload
      </button>
      {url && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-surface"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      )}
    </div>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
      />
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
}

function ButtonGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; l: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
            value === o.v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-surface"
          }`}
        >
          {o.icon}
          {o.l}
        </button>
      ))}
    </div>
  );
}
