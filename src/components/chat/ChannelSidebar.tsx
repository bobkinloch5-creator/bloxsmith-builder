import { Bug, Hash, Megaphone, LifeBuoy, Shield, Users, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type Channel = {
  slug: string;
  name: string;
  description: string | null;
  view_role: string;
  post_role: string;
  icon: string | null;
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  hash: Hash,
  megaphone: Megaphone,
  "life-buoy": LifeBuoy,
  shield: Shield,
  bug: Bug,
};

export function ChannelSidebar({
  channels,
  current,
  onSelect,
  view,
  onViewChange,
  friendCount,
  dmUnread,
}: {
  channels: Channel[];
  current: string;
  onSelect: (slug: string) => void;
  view: "channels" | "friends";
  onViewChange: (v: "channels" | "friends") => void;
  friendCount: number;
  dmUnread: number;
}) {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-background/40 py-2">
      <button
        type="button"
        onClick={() => onViewChange("channels")}
        title="Channels"
        className={cn(
          "grid h-10 w-10 place-items-center rounded-xl transition",
          view === "channels"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-surface hover:text-foreground",
        )}
      >
        <Hash className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onViewChange("friends")}
        title="Friends & DMs"
        className={cn(
          "relative grid h-10 w-10 place-items-center rounded-xl transition",
          view === "friends"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-surface hover:text-foreground",
        )}
      >
        <Users className="h-4 w-4" />
        {dmUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
            {dmUnread > 9 ? "9+" : dmUnread}
          </span>
        )}
      </button>

      <div className="my-1 h-px w-8 bg-border" />

      {view === "channels" &&
        channels.map((c) => {
          const Ico = (c.icon && ICON_MAP[c.icon]) || Hash;
          const active = current === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => onSelect(c.slug)}
              title={`#${c.name}${c.description ? ` — ${c.description}` : ""}`}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl transition",
                active
                  ? "bg-primary/15 text-primary ring-2 ring-primary/40"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Ico className="h-4 w-4" />
            </button>
          );
        })}
      {view === "friends" && (
        <div className="px-1 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageCircle className="mx-auto h-4 w-4" />
          <div>{friendCount}</div>
        </div>
      )}
    </aside>
  );
}
