import { useState } from "react";
import { Smile } from "lucide-react";

const EMOJI_GROUPS = [
  {
    name: "Faces",
    emojis: ["😀", "😄", "😂", "🤣", "😊", "😍", "😎", "🤔", "😮", "😢", "😡", "🤯", "🥳", "😴"],
  },
  {
    name: "React",
    emojis: ["👍", "👎", "🙏", "👏", "🙌", "💪", "🔥", "💯", "🎉", "❤️", "💔", "✨", "👀", "✅"],
  },
  {
    name: "Build",
    emojis: ["🎮", "🤖", "🧱", "📜", "🧩", "🛠️", "💾", "📡", "🖥️", "🚀", "⚙️", "🔧", "🧠", "💡"],
  },
  {
    name: "Roblox",
    emojis: ["🟩", "🏭", "⚔️", "🏰", "🐾", "🏁", "🚪", "💎", "💰", "🪙", "⭐", "🏆", "🛡️", "👑"],
  },
  {
    name: "Fun",
    emojis: ["☕", "🍕", "🍔", "🍩", "🍿", "🎵", "🎧", "🌟", "🌈", "🌊", "🌋", "❄️", "🌙", "☀️"],
  },
];

export function EmojiPicker({
  onPick,
  label = "Emoji",
  align = "end",
}: {
  onPick: (emoji: string) => void;
  label?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(EMOJI_GROUPS[0].name);
  const active = EMOJI_GROUPS.find((g) => g.name === group) ?? EMOJI_GROUPS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
        aria-label={label}
      >
        <Smile className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute bottom-9 z-50 w-[calc(100vw-2rem)] max-w-[260px] rounded-xl border border-border bg-surface-elevated p-2 shadow-xl ${
              align === "start" ? "left-0" : "right-0"
            }`}
          >
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
              {EMOJI_GROUPS.map((g) => (
                <button
                  type="button"
                  key={g.name}
                  onClick={() => setGroup(g.name)}
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    group === g.name
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {active.emojis.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => {
                    onPick(e);
                    setOpen(false);
                  }}
                  className="grid h-8 w-8 place-items-center rounded text-lg transition hover:bg-surface"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", ":blox_gg:"];
