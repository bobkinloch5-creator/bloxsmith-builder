import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Check,
  X,
  Send,
  MessageCircle,
  UserPlus,
  Search,
  ArrowLeft,
  Loader2,
  ImagePlus,
  Palette,
  Gift,
  Coins,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker, QUICK_REACTIONS } from "@/components/chat/EmojiPicker";
import { EmotePicker } from "@/components/chat/EmotePicker";
import { isEmoteToken } from "@/lib/emotes";
import { MarkdownText } from "@/components/MarkdownText";
import { usePersistentDraft } from "@/hooks/usePersistentDraft";
import robloxHero from "@/assets/roblox-hero.png";
import themeTycoon from "@/assets/theme-tycoon.jpg";
import themeObby from "@/assets/theme-obby.jpg";
import themeSpace from "@/assets/theme-space.jpg";
import themeCyber from "@/assets/theme-cybercity.jpg";

type FriendRow = { id: string; requester_id: string; addressee_id: string; status: string };
type ProfileLite = {
  id: string;
  display_name: string | null;
  chat_nickname: string | null;
  avatar_url: string | null;
};
type DM = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
};
type DmReaction = { id: string; message_id: string; user_id: string; emoji: string };

const DM_THEMES = [
  {
    id: "classic",
    label: "Classic",
    image: null,
    tint: "from-emerald-500/10 via-cyan-500/5 to-transparent",
  },
  {
    id: "roblox",
    label: "Roblox",
    image: robloxHero,
    tint: "from-sky-500/25 via-emerald-500/10 to-black/30",
  },
  {
    id: "tycoon",
    label: "Tycoon",
    image: themeTycoon,
    tint: "from-amber-500/25 via-emerald-500/10 to-black/40",
  },
  {
    id: "obby",
    label: "Obby",
    image: themeObby,
    tint: "from-fuchsia-500/20 via-cyan-500/10 to-black/40",
  },
  {
    id: "space",
    label: "Space",
    image: themeSpace,
    tint: "from-indigo-500/25 via-cyan-500/10 to-black/40",
  },
  {
    id: "cyber",
    label: "Cyber",
    image: themeCyber,
    tint: "from-primary/25 via-emerald-500/10 to-black/40",
  },
] as const;

const MAX_DM_IMAGE_BYTES = 6 * 1024 * 1024;
const DM_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

function DmReactionSymbol({ value }: { value: string }) {
  const emote = isEmoteToken(value);
  if (!emote) return <span className="chat-reaction-emoji">{value}</span>;
  if (emote.src) {
    return (
      <img
        src={emote.src}
        alt={value}
        title={value}
        loading="lazy"
        className="chat-reaction-emoji h-5 w-5 object-contain"
      />
    );
  }
  return (
    <span className="chat-reaction-emoji" title={value}>
      {emote.emoji}
    </span>
  );
}

export function FriendsPanel({
  activeDm,
  setActiveDm,
  onOpenProfile,
}: {
  activeDm: string | null;
  setActiveDm: (uid: string | null) => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
  const [searching, setSearching] = useState(false);

  // Initial load
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("friend_requests")
        .select("id,requester_id,addressee_id,status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      if (cancel || !data) return;
      const rows = data as FriendRow[];
      setRequests(rows);
      const ids = Array.from(
        new Set(
          rows.flatMap((r) => [r.requester_id, r.addressee_id]).filter((id) => id !== user.id),
        ),
      );
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id,display_name,chat_nickname,avatar_url")
          .in("id", ids);
        if (ps) setProfiles(new Map((ps as ProfileLite[]).map((p) => [p.id, p])));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id]);

  // Realtime friendship updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`fr_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        (payload) => {
          const row = (payload.new ?? payload.old) as FriendRow;
          if (row.requester_id !== user.id && row.addressee_id !== user.id) return;
          setRequests((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== row.id);
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = row;
              return next;
            }
            return [...prev, row];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const friends = useMemo(
    () =>
      requests
        .filter((r) => r.status === "accepted")
        .map((r) => (r.requester_id === user?.id ? r.addressee_id : r.requester_id)),
    [requests, user?.id],
  );
  const incoming = useMemo(
    () => requests.filter((r) => r.status === "pending" && r.addressee_id === user?.id),
    [requests, user?.id],
  );
  const outgoing = useMemo(
    () => requests.filter((r) => r.status === "pending" && r.requester_id === user?.id),
    [requests, user?.id],
  );

  async function runSearch(q: string) {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,chat_nickname,avatar_url")
      .or(`display_name.ilike.%${q}%,chat_nickname.ilike.%${q}%`)
      .neq("id", user?.id ?? "")
      .limit(8);
    setSearchResults((data ?? []) as ProfileLite[]);
    setSearching(false);
  }

  async function sendRequest(targetId: string) {
    const { error } = await (supabase as any).rpc("send_friend_request", { _target: targetId });
    if (error) return toast.error(error.message);
    toast.success("Friend request sent");
    setSearch("");
    setSearchResults([]);
  }
  async function respond(id: string, accept: boolean) {
    const { error } = await (supabase as any).rpc("respond_friend_request", {
      _id: id,
      _accept: accept,
    });
    if (error) toast.error(error.message);
  }

  function nameFor(id: string) {
    const p = profiles.get(id);
    return p?.chat_nickname || p?.display_name || id.slice(0, 8);
  }

  if (activeDm) {
    return (
      <DmView
        otherId={activeDm}
        otherName={nameFor(activeDm)}
        onBack={() => setActiveDm(null)}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search */}
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Find people by name…"
            className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary"
          />
        </div>
        {search && (
          <div className="mt-2 space-y-1">
            {searching ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-muted-foreground">No matches.</p>
            ) : (
              searchResults.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface"
                >
                  <Avatar p={p} />
                  <button
                    onClick={() => onOpenProfile(p.id)}
                    className="flex-1 truncate text-left text-xs font-medium hover:underline"
                  >
                    {p.chat_nickname || p.display_name || "User"}
                  </button>
                  <button
                    onClick={() => sendRequest(p.id)}
                    className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    title="Add friend"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2 text-xs">
        {incoming.length > 0 && (
          <Section title={`Incoming (${incoming.length})`}>
            {incoming.map((r) => (
              <Row
                key={r.id}
                left={
                  <>
                    <Avatar p={profiles.get(r.requester_id)} />
                    <button
                      onClick={() => onOpenProfile(r.requester_id)}
                      className="truncate text-left hover:underline"
                    >
                      {nameFor(r.requester_id)}
                    </button>
                  </>
                }
                right={
                  <>
                    <button
                      onClick={() => respond(r.id, true)}
                      className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-white hover:opacity-90"
                      title="Accept"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => respond(r.id, false)}
                      className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface"
                      title="Decline"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                }
              />
            ))}
          </Section>
        )}

        {outgoing.length > 0 && (
          <Section title={`Sent (${outgoing.length})`}>
            {outgoing.map((r) => (
              <Row
                key={r.id}
                left={
                  <>
                    <Avatar p={profiles.get(r.addressee_id)} />
                    <span className="truncate text-muted-foreground">
                      {nameFor(r.addressee_id)}
                    </span>
                  </>
                }
                right={<span className="text-[10px] text-muted-foreground">pending</span>}
              />
            ))}
          </Section>
        )}

        <Section title={`Friends (${friends.length})`}>
          {friends.length === 0 ? (
            <p className="px-1 py-2 text-[11px] text-muted-foreground">
              No friends yet. Search above to find people.
            </p>
          ) : (
            friends.map((id) => (
              <Row
                key={id}
                left={
                  <>
                    <Avatar p={profiles.get(id)} />
                    <button
                      onClick={() => onOpenProfile(id)}
                      className="truncate text-left hover:underline"
                    >
                      {nameFor(id)}
                    </button>
                  </>
                }
                right={
                  <button
                    onClick={() => setActiveDm(id)}
                    className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    title="Message"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                }
              />
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      <div className="flex shrink-0 items-center gap-1">{right}</div>
    </div>
  );
}

function Avatar({ p }: { p?: ProfileLite }) {
  if (!p)
    return (
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[9px] text-muted-foreground">
        ?
      </div>
    );
  return p.avatar_url ? (
    <img src={p.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
  ) : (
    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[9px] font-bold text-muted-foreground">
      {(p.chat_nickname || p.display_name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function DmView({
  otherId,
  otherName,
  onBack,
  onOpenProfile,
}: {
  otherId: string;
  otherName: string;
  onBack: () => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { user, profile, refresh } = useAuth();
  const [messages, setMessages] = useState<DM[]>([]);
  const [draft, setDraft, clearDraft] = usePersistentDraft({
    key: user?.id ? `bloxsmith.draft.dm.${user.id}.${otherId}` : null,
    initial: "",
  });
  const [reactions, setReactions] = useState<DmReaction[]>([]);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [themeId, setThemeId] = usePersistentDraft({
    key: user?.id ? `bloxsmith.dm.theme.${user.id}.${otherId}` : null,
    initial: "classic",
    warnOnUnload: false,
  });
  const [showThemes, setShowThemes] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [giftAmount, setGiftAmount] = useState("5");
  const [giftNote, setGiftNote] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gifting, setGifting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const activeTheme = DM_THEMES.find((t) => t.id === themeId) ?? DM_THEMES[0];

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("direct_messages")
        .select(
          "id,sender_id,recipient_id,content,created_at,read_at,attachment_url,attachment_type,attachment_name",
        )
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancel) return;
      const rows = (data ?? []) as DM[];
      setMessages(rows);
      const ids = rows.map((m) => m.id);
      if (ids.length) {
        const { data: reactRows } = await (supabase as any)
          .from("direct_message_reactions")
          .select("id,message_id,user_id,emoji")
          .in("message_id", ids);
        if (!cancel) setReactions((reactRows ?? []) as DmReaction[]);
      } else {
        setReactions([]);
      }
      // Mark inbound as read
      await (supabase as any)
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", otherId)
        .eq("recipient_id", user.id)
        .is("read_at", null);
    })();
    const ch = supabase
      .channel(`dm_${user.id}_${otherId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as DM;
          const isMine =
            (row.sender_id === user.id && row.recipient_id === otherId) ||
            (row.sender_id === otherId && row.recipient_id === user.id);
          if (!isMine) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (row.sender_id === otherId) {
            (supabase as any)
              .from("direct_messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", row.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_message_reactions" },
        (payload) => {
          const row = payload.new as DmReaction;
          setReactions((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "direct_message_reactions" },
        (payload) => {
          const row = payload.old as DmReaction;
          setReactions((prev) => prev.filter((r) => r.id !== row.id));
        },
      )
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id, otherId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function uploadPendingImage(): Promise<{ url: string; name: string } | null> {
    if (!user || !pendingImage) return null;
    setUploading(true);
    try {
      const ext =
        pendingImage.file.type === "image/png"
          ? "png"
          : pendingImage.file.type === "image/webp"
            ? "webp"
            : "jpg";
      const path = `${user.id}/${otherId}/dm-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("dm-media")
        .upload(path, pendingImage.file, { contentType: pendingImage.file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("dm-media").getPublicUrl(path);
      return { url: data.publicUrl, name: pendingImage.file.name };
    } finally {
      setUploading(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if ((!t && !pendingImage) || sending || uploading || !user) return;
    setSending(true);
    try {
      const image = pendingImage ? await uploadPendingImage() : null;
      const { error } = await (supabase as any).from("direct_messages").insert({
        sender_id: user.id,
        recipient_id: otherId,
        content: t.slice(0, 2000),
        attachment_url: image?.url ?? null,
        attachment_type: image ? "image" : null,
        attachment_name: image?.name ?? null,
      });
      if (error) throw error;
      clearDraft();
      setPendingImage(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Message failed");
    } finally {
      setSending(false);
    }
  }

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!DM_IMAGE_TYPES.includes(file.type)) return toast.error("Use PNG, JPG, or WEBP images.");
    if (file.size > MAX_DM_IMAGE_BYTES) return toast.error("Image is too large (max 6MB).");
    const reader = new FileReader();
    reader.onload = () => setPendingImage({ file, preview: String(reader.result) });
    reader.onerror = () => toast.error("Could not preview that image.");
    reader.readAsDataURL(file);
  }

  const reactionsByMessage = useMemo(() => {
    const grouped = new Map<string, Map<string, { count: number; mine: boolean }>>();
    for (const reaction of reactions) {
      const byEmoji =
        grouped.get(reaction.message_id) ?? new Map<string, { count: number; mine: boolean }>();
      const current = byEmoji.get(reaction.emoji) ?? { count: 0, mine: false };
      current.count += 1;
      if (reaction.user_id === user?.id) current.mine = true;
      byEmoji.set(reaction.emoji, current);
      grouped.set(reaction.message_id, byEmoji);
    }
    return grouped;
  }, [reactions, user?.id]);

  async function toggleReaction(messageId: string, emoji: string) {
    if (!user) return;
    const mine = reactions.find(
      (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji,
    );
    if (mine) {
      await (supabase as any).from("direct_message_reactions").delete().eq("id", mine.id);
    } else {
      const { error } = await (supabase as any)
        .from("direct_message_reactions")
        .insert({ message_id: messageId, user_id: user.id, emoji });
      if (error) toast.error(error.message);
    }
  }

  async function sendCredits() {
    const amount = Math.floor(Number(giftAmount));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid credit amount.");
    setGifting(true);
    try {
      const { error } = await (supabase as any).rpc("transfer_credits_to_user", {
        _recipient: otherId,
        _amount: amount,
        _note: giftNote.trim() || null,
      });
      if (error) throw error;
      toast.success(`Sent ${amount} credits to ${otherName}`);
      setShowGift(false);
      setGiftAmount("5");
      setGiftNote("");
      await refresh();
    } catch (error: any) {
      toast.error(error?.message ?? "Credit transfer failed");
    } finally {
      setGifting(false);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {activeTheme.image && (
        <img
          src={activeTheme.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
      )}
      <div
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", activeTheme.tint)}
      />
      <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-border/70 bg-background/65 px-3 py-2 backdrop-blur">
        <button
          onClick={onBack}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar
          p={{ id: otherId, display_name: otherName, chat_nickname: otherName, avatar_url: null }}
        />
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onOpenProfile(otherId)}
            className="block truncate text-sm font-bold hover:underline"
          >
            {otherName}
          </button>
          <div className="text-[10px] text-muted-foreground">Direct message</div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowGift((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border/70 bg-surface/70 text-amber-300 hover:border-amber-300/60"
            title="Give credits"
          >
            <Gift className="h-4 w-4" />
          </button>
          {showGift && (
            <div className="absolute right-0 top-10 z-30 w-64 rounded-xl border border-border bg-surface-elevated p-3 text-xs shadow-2xl">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Coins className="h-4 w-4 text-amber-300" /> Give credits
              </div>
              <input
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                inputMode="numeric"
                className="mb-2 w-full rounded-lg border border-border bg-background/70 px-2 py-1.5 outline-none focus:border-primary"
                placeholder="Amount"
              />
              <input
                value={giftNote}
                onChange={(e) => setGiftNote(e.target.value)}
                maxLength={80}
                className="mb-2 w-full rounded-lg border border-border bg-background/70 px-2 py-1.5 outline-none focus:border-primary"
                placeholder="Optional note"
              />
              <button
                type="button"
                onClick={sendCredits}
                disabled={gifting}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {gifting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Send credits
              </button>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Balance: {profile?.credits ?? 0} credits
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowThemes((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border/70 bg-surface/70 text-primary hover:border-primary/60"
            title="DM theme"
          >
            <Palette className="h-4 w-4" />
          </button>
          {showThemes && (
            <div className="absolute right-0 top-10 z-30 grid w-56 grid-cols-2 gap-2 rounded-xl border border-border bg-surface-elevated p-2 shadow-2xl">
              {DM_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setThemeId(theme.id);
                    setShowThemes(false);
                  }}
                  className={cn(
                    "overflow-hidden rounded-lg border text-left text-[11px] font-semibold",
                    themeId === theme.id
                      ? "border-primary"
                      : "border-border hover:border-primary/60",
                  )}
                >
                  <div className="h-12 bg-surface">
                    {theme.image ? (
                      <img src={theme.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_top,#00ffc855,transparent_45%),#071312]" />
                    )}
                  </div>
                  <div className="px-2 py-1">{theme.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      <div
        ref={scrollRef}
        className="relative z-10 min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm"
      >
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">No messages yet — say hi!</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const grouped =
            reactionsByMessage.get(m.id) ?? new Map<string, { count: number; mine: boolean }>();
          return (
            <div key={m.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "relative max-w-[82%] rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-lg backdrop-blur",
                  mine
                    ? "border-primary/40 bg-primary text-primary-foreground"
                    : "border-border/70 bg-surface/85",
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 opacity-0 transition group-hover:opacity-100",
                    mine ? "-left-9" : "-right-9",
                  )}
                >
                  <EmojiPicker onPick={(emoji) => toggleReaction(m.id, emoji)} label="React" />
                </div>
                {m.content ? (
                  <div className="whitespace-pre-wrap break-words">
                    <MarkdownText text={m.content} />
                  </div>
                ) : null}
                {m.attachment_url && m.attachment_type === "image" ? (
                  <a
                    href={m.attachment_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 block overflow-hidden rounded-xl border border-white/10"
                  >
                    <img
                      src={m.attachment_url}
                      alt={m.attachment_name ?? "DM image"}
                      className="max-h-80 w-full object-cover transition duration-300 hover:scale-[1.015]"
                    />
                  </a>
                ) : null}
                {grouped.size > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Array.from(grouped.entries()).map(([emoji, g]) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => toggleReaction(m.id, emoji)}
                        className={cn(
                          "chat-reaction-pill flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] shadow-sm transition",
                          g.mine
                            ? "border-primary/50 bg-primary/15 text-primary-glow"
                            : "border-border bg-background/40 hover:border-primary/35",
                        )}
                      >
                        <DmReactionSymbol value={emoji} />
                        <span className="text-muted-foreground">{g.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div
                  className={cn(
                    "mt-0.5 text-[9px]",
                    mine ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={send}
        className="relative z-10 shrink-0 border-t border-border/70 bg-background/70 p-3 backdrop-blur"
      >
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-surface/80 p-2">
            <img
              src={pendingImage.preview}
              alt="Selected upload"
              className="h-16 w-24 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1 text-xs">
              <div className="truncate font-semibold">{pendingImage.file.name}</div>
              <div className="text-muted-foreground">
                {Math.ceil(pendingImage.file.size / 1024)} KB image preview
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-1.5 sm:flex-nowrap">
          <input
            ref={fileRef}
            type="file"
            accept={DM_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => pickImage(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="order-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface/80 text-muted-foreground hover:border-primary/60 hover:text-primary sm:order-none"
            title="Send image"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as FormEvent);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={`Message ${otherName} with **bold**, *italic*, or an image…`}
            className="order-2 max-h-24 min-h-[40px] min-w-[calc(100%-3rem)] flex-1 resize-none rounded-xl border border-primary/40 bg-background/75 px-3 py-2 text-sm outline-none focus:border-primary sm:order-none sm:min-w-0"
          />
          <span className="order-1 sm:order-none">
            <EmojiPicker align="start" onPick={(emoji) => setDraft((v) => `${v}${emoji}`)} />
          </span>
          <span className="order-1 sm:order-none">
            <EmotePicker
              align="start"
              onPick={(token) =>
                setDraft((v) => `${v}${v && !v.endsWith(" ") ? " " : ""}${token} `)
              }
            />
          </span>
          <button
            type="submit"
            disabled={sending || uploading || (!draft.trim() && !pendingImage)}
            className="order-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-40 sm:order-none"
          >
            {sending || uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-1 flex flex-wrap gap-1 sm:pl-12">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setDraft((v) => `${v}${emoji}`)}
              className="rounded-full border border-border/60 bg-surface/50 px-2 py-0.5 text-xs transition hover:-translate-y-0.5 hover:border-primary/50"
            >
              <DmReactionSymbol value={emoji} />
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
