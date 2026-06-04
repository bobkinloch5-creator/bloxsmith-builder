import { useState } from "react";
import { Search } from "lucide-react";
import { EMOTE_CATEGORIES, EMOTES, MASCOT_SRC, type EmoteCategory } from "@/lib/emotes";

export function EmotePicker({
  onPick,
  align = "end",
}: {
  onPick: (token: string) => void;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<EmoteCategory>("BloxBot");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = EMOTES.filter((e) => {
    if (q) {
      return [e.name, e.label, ...(e.aliases ?? [])].some((part) => part.toLowerCase().includes(q));
    }
    return e.category === category;
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
        aria-label="BloxSmith emotes"
      >
        <img src={MASCOT_SRC} alt="" className="h-5 w-5 object-contain" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute bottom-9 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface-elevated p-2 shadow-xl ${
              align === "start" ? "left-0" : "right-0"
            }`}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <img src={MASCOT_SRC} alt="" className="h-6 w-6 rounded-full object-contain" />
              <div>
                <div className="text-xs font-bold">BloxSmith emotes</div>
                <div className="text-[10px] text-muted-foreground">
                  Use tokens in chat or reactions.
                </div>
              </div>
            </div>
            <label className="mb-2 flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2 py-1 text-xs">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search emotes..."
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
            {!q && (
              <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
                {EMOTE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      category === cat
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:bg-surface"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="grid max-h-64 grid-cols-5 gap-1 overflow-y-auto pr-1">
              {visible.map((e) => (
                <button
                  key={e.name}
                  type="button"
                  title={`:${e.name}:`}
                  onClick={() => {
                    onPick(`:${e.name}:`);
                    setOpen(false);
                  }}
                  className="flex h-14 flex-col items-center justify-center rounded-lg transition hover:bg-surface"
                >
                  {e.src ? (
                    <img
                      src={e.src}
                      alt={e.label}
                      className="h-8 w-8 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-2xl leading-none">{e.emoji}</span>
                  )}
                  <span className="mt-0.5 max-w-full truncate px-1 text-[9px] text-muted-foreground">
                    {e.name}
                  </span>
                </button>
              ))}
              {visible.length === 0 && (
                <div className="col-span-5 py-6 text-center text-xs text-muted-foreground">
                  No emotes found.
                </div>
              )}
            </div>
            <div className="mt-1.5 border-t border-border/60 px-1 pt-1.5 text-[10px] text-muted-foreground">
              Type <code className="rounded bg-surface px-1">:blox_happy:</code>,{" "}
              <code className="rounded bg-surface px-1">:tycoon:</code>, or{" "}
              <code className="rounded bg-surface px-1">:script:</code>.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
