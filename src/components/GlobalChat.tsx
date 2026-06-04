import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  MessagesSquare,
  MessageCircle,
  Send,
  X,
  Loader2,
  Trash2,
  Volume2,
  VolumeX,
  ShieldAlert,
  Bot,
  MoreVertical,
  Reply,
  Pin,
  PinOff,
  Flag,
  Image as ImageIcon,
  Settings2,
  Shield,
  AtSign,
  Users,
  Hash,
  Megaphone,
  LifeBuoy,
  FileText,
  Gamepad2,
  ExternalLink,
  UserPlus,
  Languages,
  ScrollText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  Bug,
} from "lucide-react";
import { translateChatMessage } from "@/lib/chat-translate.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RoleBadges, type Role } from "@/components/RoleBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CHAT_ICON_MAP,
  gradientTextStyle,
  sanitizeGradient,
  sanitizeIcon,
  sanitizeFont,
  chatFontStyle,
} from "@/lib/chat-customization";
import { EmojiPicker, QUICK_REACTIONS } from "@/components/chat/EmojiPicker";
import { EmotePicker } from "@/components/chat/EmotePicker";
import { EMOTE_MAP, isEmoteToken } from "@/lib/emotes";
import { ChatSettingsPanel } from "@/components/chat/ChatSettingsPanel";
import { ChatModerationPanel } from "@/components/chat/ChatModerationPanel";
import { useChatPrefs, fontSizeClass, densityClass, chatBackgroundStyle } from "@/lib/chat-prefs";
import { useServerFn } from "@tanstack/react-start";
import { moderateChatMessage } from "@/lib/chat-moderation.functions";

import { ChannelSidebar, type Channel } from "@/components/chat/ChannelSidebar";
import { FriendsPanel } from "@/components/chat/FriendsPanel";
import { UserProfilePopover } from "@/components/chat/UserProfilePopover";
import bloxbotAvatar from "@/assets/bloxbot-avatar.png";
import { ProfileEffect } from "@/components/chat/ProfileEffect";
import { PfpRing } from "@/components/profile/PfpRing";
import { AvatarDecoration } from "@/components/profile/ProfileDecoration";
import { PROFILE_BADGES, ProfileBadgeRow } from "@/components/profile/ProfileBadges";
import { ProfileBackground } from "@/components/profile/ProfileBackground";
import { ProfileCardEffect, cardChromeStyle } from "@/components/profile/ProfileCardEffects";
import { presenceFromProfile } from "@/lib/presence";
import { profileHandle } from "@/lib/profile-username";
import { usePersistentDraft } from "@/hooks/usePersistentDraft";

type DbMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  reply_to_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  pinned_at: string | null;
  flagged: boolean | null;
  channel_id?: string | null;
  is_announcement?: boolean | null;
};

type Author = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  roles: Role[];
  badges: string[];
  profile_badges: string[];
  profile_accent: string | null;
  profile_effect: string | null;
  profile_background: string | null;
  custom_background_url: string | null;
  profile_card_color: string | null;
  profile_card_effect: string | null;
  pfp_effect: string | null;
  profile_decoration: string | null;
  status_message: string | null;
  presence_enabled: boolean | null;
  presence_status: string | null;
  last_seen_at: string | null;
  chat_name_gradient: string[] | null;
  chat_text_gradient: string[] | null;
  chat_icon: string | null;
  chat_nickname: string | null;
  chat_font: string | null;
};

type HydratedAuthorProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  profile_badges: unknown;
  profile_accent: string | null;
  profile_effect: string | null;
  profile_background: string | null;
  custom_background_url: string | null;
  profile_card_color: string | null;
  profile_card_effect: string | null;
  pfp_effect: string | null;
  profile_decoration: string | null;
  status_message: string | null;
  presence_enabled: boolean | null;
  presence_status: string | null;
  last_seen_at: string | null;
  chat_name_gradient: unknown;
  chat_text_gradient: unknown;
  chat_icon: unknown;
  chat_nickname: string | null;
  chat_font: unknown;
};

type Reaction = { id: string; message_id: string; user_id: string; emoji: string };
type RenderMessage = DbMessage & { ephemeralBot?: boolean };
const MAX_CHAT_MESSAGES = 220;

function capChatMessages(rows: RenderMessage[]) {
  return rows.length > MAX_CHAT_MESSAGES ? rows.slice(-MAX_CHAT_MESSAGES) : rows;
}

type SendGlobalChatMessageArgs = {
  content: string;
  replyToId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  channelId?: string | null;
};

const OPEN_KEY = "bloxsmith.globalchat.open";
const CHAT_MESSAGE_SELECT_FULL =
  "id,user_id,content,created_at,deleted_at,reply_to_id,attachment_url,attachment_type,pinned_at,flagged,channel_id,is_announcement";
const CHAT_MESSAGE_SELECT_WITHOUT_ANNOUNCEMENT =
  "id,user_id,content,created_at,deleted_at,reply_to_id,attachment_url,attachment_type,pinned_at,flagged,channel_id";
const CHAT_MESSAGE_SELECT_LEGACY = "id,user_id,content,created_at,deleted_at";

const CHAT_RULES = [
  {
    title: "Be respectful",
    detail: "No bullying, harassment, threats, hate speech, slurs, or targeting people.",
  },
  {
    title: "Keep it BloxSmith and Roblox friendly",
    detail: "Talk about builds, scripts, UI, games, feedback, trading ideas, and community help.",
  },
  {
    title: "No spam or flooding",
    detail:
      "Do not repeat messages, blast emotes, advertise constantly, or try to bypass slow mode.",
  },
  {
    title: "No scams, unsafe links, or begging",
    detail:
      "Do not ask for passwords, tokens, Robux, accounts, payment info, or suspicious off-site clicks.",
  },
  {
    title: "Keep it clean",
    detail:
      "No NSFW, gore, illegal content, extreme profanity, or content meant to shock other users.",
  },
  {
    title: "Protect privacy",
    detail:
      "Do not share private info like real names, addresses, phone numbers, emails, or school details.",
  },
  {
    title: "Follow staff directions",
    detail: "If staff ask you to stop, move channels, or cool down, listen the first time.",
  },
];

const CHAT_CONSEQUENCES = [
  {
    title: "Message blocked or removed",
    detail:
      "Unsafe words, duplicate spam, banned links, and reported messages can be blocked or deleted.",
  },
  {
    title: "Warning",
    detail: "Staff may send a warning that appears at the top of chat so you know what to fix.",
  },
  {
    title: "Timeout or mute",
    detail: "Repeated rule breaks can lead to a 5 minute, 1 hour, or longer mute from Global Chat.",
  },
  {
    title: "Account restriction",
    detail:
      "Scams, threats, NSFW content, harassment, ban evasion, or serious abuse can lead to a ban.",
  },
];

function isRpcSignatureError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? error ?? "");
  return (
    code === "PGRST202" ||
    code === "PGRST203" ||
    /schema cache|could not find.*function|function .* does not exist|parameter|argument/i.test(
      message,
    )
  );
}

function isMissingChatColumnError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? error ?? "");
  return (
    code === "42703" ||
    code === "PGRST200" ||
    code === "PGRST204" ||
    /column .* does not exist|could not find .* column|schema cache/i.test(message)
  );
}

function normalizeChatMessage(row: Partial<DbMessage>): DbMessage {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    content: String(row.content ?? ""),
    created_at: String(row.created_at ?? new Date().toISOString()),
    deleted_at: row.deleted_at ?? null,
    reply_to_id: row.reply_to_id ?? null,
    attachment_url: row.attachment_url ?? null,
    attachment_type: row.attachment_type ?? null,
    pinned_at: row.pinned_at ?? null,
    flagged: row.flagged ?? false,
    channel_id: row.channel_id ?? "general",
    is_announcement: row.is_announcement ?? false,
  };
}

async function fetchGlobalChatMessages(messageLimit: number) {
  let lastError: any = null;
  for (const select of [
    CHAT_MESSAGE_SELECT_FULL,
    CHAT_MESSAGE_SELECT_WITHOUT_ANNOUNCEMENT,
    CHAT_MESSAGE_SELECT_LEGACY,
  ]) {
    const res = await (supabase as any)
      .from("global_chat_messages")
      .select(select)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(messageLimit);
    if (!res.error) {
      return {
        data: ((res.data ?? []) as Partial<DbMessage>[]).map(normalizeChatMessage),
        error: null,
      };
    }
    lastError = res.error;
    if (!isMissingChatColumnError(res.error)) break;
  }
  return { data: [] as DbMessage[], error: lastError };
}

async function sendGlobalChatMessage({
  content,
  replyToId = null,
  attachmentUrl = null,
  attachmentType = null,
  channelId = "general",
}: SendGlobalChatMessageArgs) {
  const full = await (supabase as any).rpc("send_global_chat_message_v2", {
    _content: content,
    _reply_to_id: replyToId,
    _attachment_url: attachmentUrl,
    _attachment_type: attachmentType,
    _channel_id: channelId || "general",
  });
  if (!full.error || !isRpcSignatureError(full.error)) return full;

  const withoutChannel = await (supabase as any).rpc("send_global_chat_message_v2", {
    _content: content,
    _reply_to_id: replyToId,
    _attachment_url: attachmentUrl,
    _attachment_type: attachmentType,
  });
  if (!withoutChannel.error || !isRpcSignatureError(withoutChannel.error)) return withoutChannel;

  if (!replyToId && !attachmentUrl && !attachmentType) {
    const oneArg = await (supabase as any).rpc("send_global_chat_message_v2", {
      p_content: content,
    });
    if (!oneArg.error || !isRpcSignatureError(oneArg.error)) return oneArg;
  }

  return full;
}

function realtimeTopic(prefix: string) {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Tiny safe markdown: **bold**, *italic*, `code`, links + @mentions
function renderRich(
  text: string,
  currentUserName: string | null,
  accent?: string | null,
  emoteSize: "compact" | "normal" | "large" = "normal",
) {
  const parts: Array<{
    t: "text" | "b" | "i" | "code" | "link" | "mention" | "emote";
    v: string;
    href?: string;
  }> = [];
  const re =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/\S+|@[A-Za-z0-9_]{2,32}|:[a-z][a-z0-9_]{1,24}:)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: "text", v: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) parts.push({ t: "b", v: tok.slice(2, -2) });
    else if (tok.startsWith("`")) parts.push({ t: "code", v: tok.slice(1, -1) });
    else if (tok.startsWith("*")) parts.push({ t: "i", v: tok.slice(1, -1) });
    else if (tok.startsWith("@")) parts.push({ t: "mention", v: tok });
    else if (tok.startsWith(":") && tok.endsWith(":")) {
      const key = tok.slice(1, -1).toLowerCase();
      if (EMOTE_MAP[key]) parts.push({ t: "emote", v: key });
      else parts.push({ t: "text", v: tok });
    } else parts.push({ t: "link", v: tok, href: tok });
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ t: "text", v: text.slice(last) });
  // If the entire message is just a single emote token, render it larger.
  const onlyEmote = parts.length === 1 && parts[0].t === "emote";
  const inlineEmoteClass =
    emoteSize === "compact" ? "h-5 w-5" : emoteSize === "large" ? "h-8 w-8" : "h-6 w-6";
  const soloEmoteClass =
    emoteSize === "compact" ? "h-12 w-12" : emoteSize === "large" ? "h-20 w-20" : "h-16 w-16";
  return parts.map((p, i) => {
    if (p.t === "b") return <strong key={i}>{p.v}</strong>;
    if (p.t === "i") return <em key={i}>{p.v}</em>;
    if (p.t === "code")
      return (
        <code key={i} className="rounded bg-surface px-1 py-0.5 text-[0.85em] font-mono">
          {p.v}
        </code>
      );
    if (p.t === "link")
      return (
        <a
          key={i}
          href={p.href}
          target="_blank"
          rel="noreferrer noopener"
          className="underline text-primary break-all"
        >
          {p.v}
        </a>
      );
    if (p.t === "emote") {
      const e = EMOTE_MAP[p.v];
      if (!e.src) {
        return (
          <span
            key={i}
            title={`:${e.name}:`}
            className={cn("inline-block select-none", onlyEmote ? "text-5xl" : "text-[1.25em]")}
          >
            {e.emoji}
          </span>
        );
      }
      return (
        <img
          key={i}
          src={e.src}
          alt={`:${e.name}:`}
          title={`:${e.name}:`}
          loading="lazy"
          className={cn(
            "inline-block align-[-0.35em] object-contain select-none",
            onlyEmote ? soloEmoteClass : inlineEmoteClass,
          )}
        />
      );
    }
    if (p.t === "mention") {
      const mine = currentUserName && p.v.slice(1).toLowerCase() === currentUserName.toLowerCase();
      return (
        <span
          key={i}
          className={cn(
            "rounded px-1 font-semibold",
            mine ? "bg-primary/30 text-primary-foreground" : "bg-primary/15 text-primary",
          )}
          style={!mine && accent ? { backgroundColor: `${accent}26`, color: accent } : undefined}
        >
          {p.v}
        </span>
      );
    }
    return <span key={i}>{p.v}</span>;
  });
}

export function GlobalChat({ inline = false }: { inline?: boolean } = {}) {
  const { user, profile, isAdmin, isModerator, roles, refresh } = useAuth();
  const isOwner = roles.includes("owner");
  const canModerate = isModerator;
  const { prefs, update: updatePrefs } = useChatPrefs();
  const moderate = useServerFn(moderateChatMessage);

  const [open, setOpen] = useState(inline);
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    if (typeof window === "undefined") return { w: 480, h: 720 };
    try {
      const raw = localStorage.getItem("globalChat:size");
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.w === "number" && typeof p?.h === "number") return p;
      }
    } catch {}
    return { w: 480, h: 720 };
  });
  useEffect(() => {
    try {
      localStorage.setItem("globalChat:size", JSON.stringify(size));
    } catch {}
  }, [size]);
  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = size.w;
      const startH = size.h;
      const onMove = (ev: PointerEvent) => {
        const maxW = Math.max(360, window.innerWidth - 40);
        const maxH = Math.max(420, window.innerHeight - 60);
        // Anchored bottom-left: drag right grows width, drag up grows height
        const nextW = Math.min(maxW, Math.max(360, startW + (ev.clientX - startX)));
        const nextH = Math.min(maxH, Math.max(420, startH - (ev.clientY - startY)));
        setSize({ w: nextW, h: nextH });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [size.w, size.h],
  );
  const [messages, setMessages] = useState<RenderMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [authors, setAuthors] = useState<Map<string, Author>>(new Map());
  const [draft, setDraft, clearDraft] = usePersistentDraft({
    key: user?.id ? `bloxsmith.draft.global-chat.${user.id}` : null,
    initial: "",
  });
  const [sending, setSending] = useState(false);
  // Safety watchdog: if `sending` ever stays true (e.g. an awaited call never
  // settles), the textarea and send button stay disabled and the user can't
  // send anything with no visible error. Force-clear it so the input recovers.
  useEffect(() => {
    if (!sending) return;
    const t = setTimeout(() => setSending(false), 12000);
    return () => clearTimeout(t);
  }, [sending]);
  const [slow, setSlow] = useState(0);
  const [muted, setMuted] = useState<Date | null>(null);
  const [unread, setUnread] = useState(0);
  const [replyTo, setReplyTo] = useState<RenderMessage | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMod, setShowMod] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showUsers, setShowUsers] = useState(() => {
    if (inline) return false;
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(min-width: 768px)").matches ?? false;
  });
  const [showLogs, setShowLogs] = useState(false);
  const [showRobloxShare, setShowRobloxShare] = useState(false);
  const [robloxUrl, setRobloxUrl] = useState("");
  const [robloxCaption, setRobloxCaption] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [clockTime, setClockTime] = useState(() => formatClock(new Date()));
  const [localMuted, setLocalMuted] = useState<Set<string>>(new Set());
  const [chatBubbles, setChatBubbles] = useState<
    {
      id: string;
      userId: string;
      name: string;
      color: string | null;
      avatar: string | null;
      content: string;
    }[]
  >([]);
  const [translations, setTranslations] = useState<
    Map<string, { text: string; detected: string } | "loading">
  >(new Map());
  const translateFn = useServerFn(translateChatMessage);
  const handleTranslate = useCallback(
    async (msgId: string, content: string) => {
      setTranslations((prev) => {
        const next = new Map(prev);
        // toggle off if already shown
        const cur = next.get(msgId);
        if (cur && cur !== "loading") {
          next.delete(msgId);
          return next;
        }
        next.set(msgId, "loading");
        return next;
      });
      try {
        const res = await translateFn({ data: { content, target: "English" } });
        setTranslations((prev) => {
          const next = new Map(prev);
          next.set(msgId, { text: res.text, detected: res.detected });
          return next;
        });
      } catch {
        setTranslations((prev) => {
          const next = new Map(prev);
          next.delete(msgId);
          return next;
        });
        toast.error("Translation failed");
      }
    },
    [translateFn],
  );
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<{ id: string; reason: string | null }[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string>("general");
  const [view, setView] = useState<"channels" | "friends">("channels");
  const [activeDm, setActiveDm] = useState<string | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [dmUnread, setDmUnread] = useState(0);
  const presenceSyncedRef = useRef(false);
  const activeDmRef = useRef<string | null>(null);
  useEffect(() => {
    activeDmRef.current = activeDm;
  }, [activeDm]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const presenceChanRef = useRef<any>(null);
  const lastTypingSentRef = useRef(0);
  // Refs to keep realtime handler stable (avoid re-subscribing on every state change)
  const authorsRef = useRef(authors);
  const openRef = useRef(open);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    authorsRef.current = authors;
  }, [authors]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    const tick = () => setClockTime(formatClock(new Date()));
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const mergeAuthorProfile = useCallback((p: any) => {
    if (!p?.id) return;
    setAuthors((prev) => {
      const existing = prev.get(p.id);
      const nick =
        typeof p.chat_nickname === "string" && p.chat_nickname.trim()
          ? p.chat_nickname.trim()
          : null;
      const next = new Map(prev);
      next.set(p.id, {
        roles: existing?.roles ?? [],
        badges: existing?.badges ?? [],
        display_name: nick ?? p.display_name ?? existing?.display_name ?? null,
        username: typeof p.username === "string" ? p.username : (existing?.username ?? null),
        avatar_url: p.avatar_url ?? existing?.avatar_url ?? null,
        profile_badges: Array.isArray(p.profile_badges)
          ? p.profile_badges
          : (existing?.profile_badges ?? []),
        profile_accent:
          typeof p.profile_accent === "string"
            ? p.profile_accent
            : (existing?.profile_accent ?? null),
        profile_effect:
          typeof p.profile_effect === "string"
            ? p.profile_effect
            : (existing?.profile_effect ?? null),
        profile_background:
          typeof p.profile_background === "string"
            ? p.profile_background
            : (existing?.profile_background ?? null),
        custom_background_url:
          typeof p.custom_background_url === "string"
            ? p.custom_background_url
            : (existing?.custom_background_url ?? null),
        profile_card_color:
          typeof p.profile_card_color === "string"
            ? p.profile_card_color
            : (existing?.profile_card_color ?? null),
        profile_card_effect:
          typeof p.profile_card_effect === "string"
            ? p.profile_card_effect
            : (existing?.profile_card_effect ?? null),
        pfp_effect:
          typeof p.pfp_effect === "string" ? p.pfp_effect : (existing?.pfp_effect ?? null),
        profile_decoration:
          typeof p.profile_decoration === "string"
            ? p.profile_decoration
            : (existing?.profile_decoration ?? null),
        status_message:
          typeof p.status_message === "string"
            ? p.status_message
            : (existing?.status_message ?? null),
        presence_enabled: p.presence_enabled ?? existing?.presence_enabled ?? null,
        presence_status:
          typeof p.presence_status === "string"
            ? p.presence_status
            : (existing?.presence_status ?? null),
        last_seen_at:
          typeof p.last_seen_at === "string" ? p.last_seen_at : (existing?.last_seen_at ?? null),
        chat_name_gradient:
          sanitizeGradient(p.chat_name_gradient) ?? existing?.chat_name_gradient ?? null,
        chat_text_gradient:
          sanitizeGradient(p.chat_text_gradient) ?? existing?.chat_text_gradient ?? null,
        chat_icon: sanitizeIcon(p.chat_icon) ?? existing?.chat_icon ?? null,
        chat_nickname: nick ?? existing?.chat_nickname ?? null,
        chat_font: sanitizeFont(p.chat_font) ?? existing?.chat_font ?? null,
      });
      return next;
    });
  }, []);

  // Open state
  useEffect(() => {
    if (inline) {
      setOpen(true);
      return;
    }
    if (typeof localStorage !== "undefined") setOpen(localStorage.getItem(OPEN_KEY) === "1");
  }, [inline]);

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    if (open) setUnread(0);
  }, [open]);

  // Hydrate authors
  const loadAuthors = useCallback(async (ids: string[]) => {
    const current = authorsRef.current;
    const need = ids.filter((id) => {
      if (!id) return false;
      const existing = current.get(id);
      // Re-fetch if we don't have the author yet, or if roles/badges were never hydrated
      if (!existing) return true;
      if ((existing.roles?.length ?? 0) === 0 && (existing.badges?.length ?? 0) === 0) return true;
      return false;
    });
    if (!need.length) return;
    const [{ data: profs }, { data: rs }, { data: badges }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,display_name,username,avatar_url,profile_badges,profile_accent,profile_effect,profile_background,custom_background_url,profile_card_color,profile_card_effect,pfp_effect,profile_decoration,status_message,presence_enabled,presence_status,last_seen_at,chat_name_gradient,chat_text_gradient,chat_icon,chat_nickname,chat_font",
        )
        .in("id", need),
      (supabase as any).from("user_roles").select("user_id,role").in("user_id", need),
      (supabase as any).from("user_badges").select("user_id,badge").in("user_id", need),
    ]);
    const rolesByUser = new Map<string, Role[]>();
    ((rs ?? []) as { user_id: string; role: Role }[]).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    const badgesByUser = new Map<string, string[]>();
    ((badges ?? []) as { user_id: string; badge: string }[]).forEach((b) => {
      const arr = badgesByUser.get(b.user_id) ?? [];
      arr.push(b.badge);
      badgesByUser.set(b.user_id, arr);
    });
    setAuthors((prev) => {
      const next = new Map(prev);
      const hydrated = new Set<string>();
      ((profs ?? []) as HydratedAuthorProfile[]).forEach((p) => {
        hydrated.add(p.id);
        const nick =
          typeof p.chat_nickname === "string" && p.chat_nickname.trim()
            ? p.chat_nickname.trim()
            : null;
        next.set(p.id, {
          display_name: nick ?? p.display_name,
          username: typeof p.username === "string" ? p.username : null,
          avatar_url: p.avatar_url,
          roles: rolesByUser.get(p.id) ?? [],
          badges: badgesByUser.get(p.id) ?? [],
          profile_badges: Array.isArray(p.profile_badges) ? p.profile_badges : [],
          profile_accent: typeof p.profile_accent === "string" ? p.profile_accent : null,
          profile_effect: typeof p.profile_effect === "string" ? p.profile_effect : null,
          profile_background:
            typeof p.profile_background === "string" ? p.profile_background : null,
          custom_background_url:
            typeof p.custom_background_url === "string" ? p.custom_background_url : null,
          profile_card_color:
            typeof p.profile_card_color === "string" ? p.profile_card_color : null,
          profile_card_effect:
            typeof p.profile_card_effect === "string" ? p.profile_card_effect : null,
          pfp_effect: typeof p.pfp_effect === "string" ? p.pfp_effect : null,
          profile_decoration:
            typeof p.profile_decoration === "string" ? p.profile_decoration : null,
          status_message: typeof p.status_message === "string" ? p.status_message : null,
          presence_enabled: p.presence_enabled ?? null,
          presence_status: typeof p.presence_status === "string" ? p.presence_status : null,
          last_seen_at: typeof p.last_seen_at === "string" ? p.last_seen_at : null,
          chat_name_gradient: sanitizeGradient(p.chat_name_gradient),
          chat_text_gradient: sanitizeGradient(p.chat_text_gradient),
          chat_icon: sanitizeIcon(p.chat_icon),
          chat_nickname: nick,
          chat_font: sanitizeFont(p.chat_font),
        });
      });
      need.forEach((id) => {
        if (hydrated.has(id) || next.has(id)) return;
        next.set(id, {
          display_name: `Builder ${id.slice(0, 4)}`,
          username: null,
          avatar_url: null,
          roles: rolesByUser.get(id) ?? [],
          badges: badgesByUser.get(id) ?? [],
          profile_badges: [],
          profile_accent: null,
          profile_effect: null,
          profile_background: null,
          custom_background_url: null,
          profile_card_color: null,
          profile_card_effect: null,
          pfp_effect: null,
          profile_decoration: null,
          status_message: null,
          presence_enabled: true,
          presence_status: "online",
          last_seen_at: null,
          chat_name_gradient: null,
          chat_text_gradient: null,
          chat_icon: null,
          chat_nickname: null,
          chat_font: null,
        });
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (profile && user?.id) mergeAuthorProfile({ ...(profile as any), id: user.id });
  }, [profile, user?.id, mergeAuthorProfile]);

  // Initial fetch
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const messageLimit = inline ? 160 : 80;
      const reactionLimit = inline ? 400 : 160;
      const [msgRes, settingsRes, muteRes, reactRes, wordsRes, warnRes, localMuteRes, chanRes] =
        await Promise.all([
          fetchGlobalChatMessages(messageLimit),
          supabase
            .from("global_chat_settings")
            .select("slow_mode_seconds")
            .eq("id", 1)
            .maybeSingle(),
          (supabase as any)
            .from("global_chat_mutes")
            .select("muted_until")
            .eq("user_id", user.id)
            .maybeSingle(),
          (supabase as any)
            .from("global_chat_reactions")
            .select("id,message_id,user_id,emoji")
            .limit(reactionLimit),
          (supabase as any).from("global_chat_blocked_words").select("word"),
          (supabase as any)
            .from("global_chat_warnings")
            .select("id,reason")
            .eq("user_id", user.id)
            .is("acknowledged_at", null),
          (supabase as any)
            .from("user_chat_local_mutes")
            .select("muted_user_id")
            .eq("user_id", user.id),
          (supabase as any)
            .from("chat_channels")
            .select("slug,name,description,view_role,post_role,icon,position")
            .order("position"),
        ]);
      if (cancelled) return;
      if (msgRes.error) console.warn("[global-chat] message fetch failed:", msgRes.error);
      const rows = (((msgRes as any).data ?? []) as DbMessage[]).reverse();
      setMessages(rows);
      setSlow(((settingsRes.data as any)?.slow_mode_seconds as number) ?? 0);
      const until = (muteRes.data as any)?.muted_until
        ? new Date((muteRes.data as any).muted_until)
        : null;
      setMuted(until && until > new Date() ? until : null);
      setReactions((reactRes.data ?? []) as Reaction[]);
      setBlockedWords(((wordsRes.data ?? []) as any[]).map((w) => String(w.word).toLowerCase()));
      setWarnings((warnRes.data ?? []) as any);
      setLocalMuted(
        new Set(((localMuteRes.data ?? []) as any[]).map((r) => String(r.muted_user_id))),
      );
      setChannels(((chanRes as any)?.data ?? []) as Channel[]);
      await loadAuthors(Array.from(new Set(rows.map((r) => r.user_id))));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loadAuthors, inline]);

  // Realtime: messages + reactions + settings + presence + typing
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(realtimeTopic("bloxsmith-chat"), { config: { presence: { key: user.id } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_chat_messages" },
        async (payload) => {
          const row = payload.new as DbMessage;
          if (row.deleted_at) return;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : capChatMessages([...prev, row]),
          );
          if (!openRef.current && row.user_id !== user.id) setUnread((u) => u + 1);
          await loadAuthors([row.user_id]);
          // Sound + notification
          if (row.user_id !== user.id) {
            const p = prefsRef.current;
            const mentioned = mentionsMe(
              row.content,
              authorsRef.current.get(user.id)?.display_name,
            );
            if (
              p.sound_enabled &&
              profile?.presence_status !== "dnd" &&
              (p.notify_mode === "all" || (p.notify_mode === "mentions" && mentioned))
            ) {
              playPing();
            }
            if (row.is_announcement && p.notify_mode !== "off") {
              toast.info("Official BloxSmith announcement", {
                description: row.content.replace(/^📣\s*/u, "").slice(0, 160),
                action: { label: "Open chat", onClick: () => setOpen(true) },
                duration: 9000,
              });
              if (p.sound_enabled && profile?.presence_status !== "dnd") {
                playPing();
                setTimeout(() => playPing(), 140);
              }
            }
            // Floating chat bubble popup
            if (p.show_bubbles && !row.deleted_at && row.content?.trim()) {
              const a = authorsRef.current.get(row.user_id);
              const bubbleId = `${row.id}-${Date.now()}`;
              setChatBubbles((prev) => [
                ...prev.slice(-3),
                {
                  id: bubbleId,
                  userId: row.user_id,
                  name: a?.chat_nickname ?? a?.display_name ?? "Someone",
                  color: a?.chat_name_gradient?.[0] ?? null,
                  avatar: a?.avatar_url ?? null,
                  content: row.content.slice(0, 140),
                },
              ]);
              setTimeout(() => {
                setChatBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
              }, 5000);
            }
            if (mentioned && p.notify_mode !== "off") {
              const a = authorsRef.current.get(row.user_id);
              const who = a?.display_name ?? "Someone";
              toast.info(`${who} mentioned you`, {
                description: row.content.slice(0, 140),
                action: { label: "Open chat", onClick: () => setOpen(true) },
              });
              if (p.sound_enabled && profile?.presence_status !== "dnd") {
                playPing();
                setTimeout(() => playPing(), 180);
              }
            }
            if (
              p.notify_mode !== "off" &&
              document.hidden &&
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              if (p.notify_mode === "all" || mentioned) {
                const a = authorsRef.current.get(row.user_id);
                new Notification(a?.display_name ?? "New message", {
                  body: row.content.slice(0, 140),
                  silent: !p.sound_enabled || profile?.presence_status === "dnd",
                });
              }
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "global_chat_messages" },
        (payload) => {
          const row = payload.new as DbMessage;
          setMessages((prev) => {
            if (row.deleted_at) return prev.filter((m) => m.id !== row.id);
            return prev.map((m) => (m.id === row.id ? { ...m, ...row } : m));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "global_chat_settings" },
        (payload) => {
          setSlow(((payload.new as any).slow_mode_seconds as number) ?? 0);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          mergeAuthorProfile(payload.new as any);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_chat_reactions" },
        (payload) => {
          setReactions((prev) => [...prev, payload.new as Reaction]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "global_chat_reactions" },
        (payload) => {
          const r = payload.old as Reaction;
          setReactions((prev) => prev.filter((x) => x.id !== r.id));
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        setOnlineUsers(Object.keys(state));
        loadAuthors(Object.keys(state));
        presenceSyncedRef.current = true;
      })
      .on("presence", { event: "join" }, async ({ key }) => {
        if (!presenceSyncedRef.current) return; // skip initial population
        if (key === user.id) return;
        await loadAuthors([key]);
        let name = authorsRef.current.get(key)?.display_name;
        if (!name) {
          const { data: p } = await supabase
            .from("profiles")
            .select("display_name,chat_nickname")
            .eq("id", key)
            .maybeSingle();
          name = (p?.chat_nickname?.trim() || p?.display_name || "Someone") as string;
        }
        if (prefsRef.current.sound_enabled && profile?.presence_status !== "dnd") playJoin();
        setMessages((prev) =>
          capChatMessages([
            ...prev,
            {
              id: `sys-join-${key}-${Date.now()}`,
              user_id: "bloxbot",
              content: `🟢 ${name} joined the chat`,
              created_at: new Date().toISOString(),
              deleted_at: null,
              reply_to_id: null,
              attachment_url: null,
              attachment_type: null,
              pinned_at: null,
              flagged: false,
              ephemeralBot: true,
            },
          ]),
        );
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (!presenceSyncedRef.current) return;
        if (key === user.id) return;
        const a = authorsRef.current.get(key);
        const name = a?.display_name ?? "Someone";
        if (prefsRef.current.sound_enabled && profile?.presence_status !== "dnd") playLeave();
        setMessages((prev) =>
          capChatMessages([
            ...prev,
            {
              id: `sys-leave-${key}-${Date.now()}`,
              user_id: "bloxbot",
              content: `🔴 ${name} left the chat`,
              created_at: new Date().toISOString(),
              deleted_at: null,
              reply_to_id: null,
              attachment_url: null,
              attachment_type: null,
              pinned_at: null,
              flagged: false,
              ephemeralBot: true,
            },
          ]),
        );
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const uid = (payload.payload as any)?.user_id;
        if (!uid || uid === user.id) return;
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(uid, Date.now());
          return next;
        });
      });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });
    presenceChanRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      presenceChanRef.current = null;
    };
  }, [user?.id, profile?.presence_status, loadAuthors, mergeAuthorProfile]);

  // Realtime: achievement unlocks → pop into global chat for everyone
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(realtimeTopic("bloxsmith-achievements"))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_achievements" },
        async (payload) => {
          const row = payload.new as { user_id: string; achievement_key: string };
          if (!row?.user_id || !row?.achievement_key) return;
          const [{ data: ach }, _a] = await Promise.all([
            supabase
              .from("achievements")
              .select("name,icon,xp_reward,credit_reward")
              .eq("key", row.achievement_key)
              .maybeSingle(),
            loadAuthors([row.user_id]),
          ]);
          const author = authorsRef.current.get(row.user_id);
          const name = author?.display_name ?? "A builder";
          const achName = (ach as any)?.name ?? row.achievement_key;
          const xp = (ach as any)?.xp_reward ?? 0;
          const credits = (ach as any)?.credit_reward ?? 0;
          const rewards = [xp ? `+${xp} XP` : null, credits ? `+${credits} credits` : null]
            .filter(Boolean)
            .join(" · ");
          const content = `🏆 ${name} unlocked **${achName}**${rewards ? ` (${rewards})` : ""}`;
          setMessages((prev) =>
            capChatMessages([
              ...prev,
              {
                id: `ach-${row.user_id}-${row.achievement_key}-${Date.now()}`,
                user_id: "bloxbot",
                content,
                created_at: new Date().toISOString(),
                deleted_at: null,
                reply_to_id: null,
                attachment_url: null,
                attachment_type: null,
                pinned_at: null,
                flagged: false,
                ephemeralBot: true,
              },
            ]),
          );
          if (prefsRef.current.sound_enabled && row.user_id !== user.id) playPing();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, loadAuthors]);

  // Realtime: own level-ups → toast notification
  useEffect(() => {
    if (!user) return;
    let lastLevel: number | null = null;
    (async () => {
      const { data } = await (supabase as any)
        .from("user_levels")
        .select("level")
        .eq("user_id", user.id)
        .maybeSingle();
      lastLevel = (data?.level as number) ?? 1;
    })();
    const ch = supabase
      .channel(realtimeTopic("bloxsmith-levels"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_levels", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = (payload.new as any)?.level as number | undefined;
          if (typeof next !== "number") return;
          if (lastLevel !== null && next > lastLevel) {
            toast.success(`🎉 Level Up! You're now Level ${next}`, {
              description: "Keep chatting and building to earn more XP.",
              duration: 6000,
            });
            if (prefsRef.current.sound_enabled) {
              playTone(523, 0.12);
              setTimeout(() => playTone(659, 0.12), 100);
              setTimeout(() => playTone(784, 0.18), 200);
            }
          }
          lastLevel = next;
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  // Realtime: incoming DMs → toast + unread badge
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(realtimeTopic("bloxsmith-dms"))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as { sender_id: string; content: string };
          if (!row?.sender_id) return;
          await loadAuthors([row.sender_id]);
          const a = authorsRef.current.get(row.sender_id);
          const who = a?.display_name ?? "Someone";
          // Only badge/toast if not actively viewing that DM
          if (!(view === "friends" && activeDmRef.current === row.sender_id)) {
            setDmUnread((n) => n + 1);
            toast.info(`💬 ${who} sent you a DM`, {
              description: row.content.slice(0, 140),
              action: {
                label: "Open",
                onClick: () => {
                  setOpen(true);
                  setView("friends");
                  setActiveDm(row.sender_id);
                  setDmUnread(0);
                },
              },
            });
            if (prefsRef.current.sound_enabled && profile?.presence_status !== "dnd") playPing();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, profile?.presence_status, loadAuthors]);

  // Prune stale typing entries
  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers((prev) => {
        const cutoff = Date.now() - 4000;
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of next)
          if (v < cutoff) {
            next.delete(k);
            changed = true;
          }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  // Autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Request notification permission on first open if mode != off
  useEffect(() => {
    if (
      open &&
      prefs.notify_mode !== "off" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, [open, prefs.notify_mode]);

  function playPing() {
    playTone(880, 0.18);
  }
  function playJoin() {
    // ascending two-tone
    playTone(523, 0.12);
    setTimeout(() => playTone(784, 0.16), 90);
  }
  function playLeave() {
    // descending two-tone
    playTone(523, 0.12);
    setTimeout(() => playTone(330, 0.18), 90);
  }
  function playTone(freq: number, dur: number) {
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        audioCtxRef.current = ctx;
      }
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    } catch {}
  }

  function mentionsMe(text: string, name?: string | null) {
    if (!name) return false;
    return new RegExp(`@${escapeRegex(name)}\\b`, "i").test(text);
  }

  function checkBlocked(text: string): string | null {
    if (!blockedWords.length) return null;
    const lower = text.toLowerCase();
    const normalized = normalizeModeratedText(text);
    for (const w of blockedWords) {
      if (!w) continue;
      const nw = normalizeModeratedText(w);
      if (lower.includes(w) || (nw.length >= 3 && normalized.includes(nw))) return w;
    }
    return null;
  }

  function checkAllCapsSpam(text: string) {
    if (text.length < 15) return false;
    const letters = text.replace(/[^A-Za-z]/g, "");
    if (letters.length < 12) return false;
    const upper = letters.replace(/[^A-Z]/g, "").length;
    return upper / letters.length > 0.85;
  }

  async function uploadAttachment(file: File): Promise<string | null> {
    if (!user) return null;
    if (!file.type.startsWith("image/")) {
      toast.error("Only images are allowed");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be < 5 MB");
      return null;
    }
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(error.message);
      return null;
    }
    const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    return pub.publicUrl;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !pendingFile) || sending) return;

    // Slash commands
    if (trimmed.startsWith("/")) {
      setSending(true);
      clearDraft();
      try {
        await runSlashCommand(trimmed);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
      return;
    }

    setSending(true);
    try {
      // Block links client-side too (kept clean + friendly)
      if (
        /(https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|net|org|io|gg|xyz|co|me|app|dev|tv|live|link)(\/|\s|$))/i.test(
          trimmed,
        )
      ) {
        toast.error("Links aren't allowed in chat — keep it clean and friendly 💙");
        setSending(false);
        return;
      }
      // Profanity
      const bad = checkBlocked(trimmed);
      if (bad) {
        toast.error(`Blocked word: "${bad}"`);
        setSending(false);
        return;
      }
      if (checkAllCapsSpam(trimmed)) {
        toast.error("Please don't shout (too many CAPS)");
        setSending(false);
        return;
      }

      // AI moderation (best-effort). MUST NOT be able to hang the send:
      // if the gateway is slow/unreachable and this await never settles,
      // `sending` stays true forever and the input locks up with no error.
      // Race it against a timeout and fail open.
      if (trimmed.length > 5) {
        try {
          const verdict = await Promise.race([
            moderate({ data: { content: trimmed } }),
            new Promise<{ allow: boolean; reason?: string | null }>((resolve) =>
              setTimeout(() => resolve({ allow: true, reason: null }), 1800),
            ),
          ]);
          if (verdict && !verdict.allow) {
            toast.error(`Blocked by AI moderation: ${verdict.reason || "violates rules"}`);
            setSending(false);
            return;
          }
        } catch {
          /* fail open */
        }
      }

      // Upload file
      let attachment_url: string | null = null;
      let attachment_type: string | null = null;
      if (pendingFile) {
        attachment_url = await uploadAttachment(pendingFile);
        if (!attachment_url) {
          setSending(false);
          return;
        }
        attachment_type = "image";
      }

      const { error } = await sendGlobalChatMessage({
        content: trimmed,
        replyToId: replyTo?.id ?? null,
        attachmentUrl: attachment_url,
        attachmentType: attachment_type,
        channelId: currentChannel,
      });
      if (error) {
        const m = String(error.message || "Failed to send");
        if (m.includes("blocked_word"))
          toast.error("Message blocked by automod. Keep chat safe, clean, and Roblox-friendly.");
        else if (m.includes("slow_mode")) toast.error(`Slow mode — wait ${slow}s`);
        else if (m.includes("muted")) toast.error("You're muted");
        else if (m.includes("duplicate")) toast.error("That looks like a duplicate");
        else if (m.includes("too_long")) toast.error("Message is too long");
        else if (m.includes("links_not_allowed"))
          toast.error("Links aren't allowed in chat — keep it clean and friendly 💙");
        else if (m.includes("unknown_channel"))
          toast.error("This channel isn't set up yet. Try #general or refresh.");
        else if (m.includes("forbidden_channel")) toast.error("You can't post in this channel.");
        else if (m.includes("banned")) toast.error("Your account is banned from chat.");
        else if (m.includes("empty_message")) toast.error("Type a message first.");
        else if (m.includes("attachments_disabled"))
          toast.error("Attachments are currently disabled.");
        else toast.error(m);
        setDraft(trimmed);
      } else {
        clearDraft();
        setReplyTo(null);
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err: any) {
      // Anything thrown above (network drop, server-fn 500, unexpected error)
      // must surface — otherwise pressing Enter looks like it does nothing.
      console.error("[GlobalChat.send] failed", err);
      toast.error(
        err?.message ? `Couldn't send: ${err.message}` : "Couldn't send message. Try again.",
      );
      setDraft(trimmed);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function runSlashCommand(text: string) {
    const m = text.match(/^\/(\w+)(?:\s+(.*))?$/s);
    if (!m) return;
    const cmd = m[1].toLowerCase();
    const args = (m[2] ?? "").trim();
    const findMention = (input: string) => {
      const mm = input.match(/@([A-Za-z0-9_ .-]{2,40})/);
      const q = mm?.[1]?.trim().toLowerCase();
      if (!q) return null;
      for (const [id, a] of authors) {
        const handle = profileHandle(a.username).slice(1);
        if (a.display_name?.toLowerCase() === q || handle === q) {
          return { id, name: a.display_name ?? `@${handle}` };
        }
      }
      return null;
    };
    const modOnly = () => {
      if (!canModerate) {
        toast.error("Moderator command only");
        return false;
      }
      return true;
    };
    const staffOnly = () => {
      if (!isAdmin) {
        toast.error("Admin command only");
        return false;
      }
      return true;
    };
    const ownerOnly = () => {
      if (!isOwner) {
        toast.error("Owner command only");
        return false;
      }
      return true;
    };
    if (cmd === "help") {
      pushEphemeralBot(
        [
          "BloxBot commands:",
          "/rules, /credits, /daily, /profile, /badges, /rank, /project, /publish, /plugin, /models, /updates",
          "/report @user reason, /mute @user, /follow @user, /friend @user, /dm @user message, /online, /staff",
          "/me <action>, /shrug, /clear-mine",
          ...(canModerate ? ["Moderation: /warn, /timeout"] : []),
          ...(isAdmin
            ? [
                "Admin: /announce, /badge, /giveaway create, /giveaway finish, /ban, /unban, /feature, /changelog, /slow, /clear",
              ]
            : []),
          ...(isOwner ? ["Owner: /event, /givecredits, /takecredits, /role"] : []),
          "Fun: /giveaway <id> joins a giveaway. Credit minigame rewards are rate-limited server-side.",
        ].join("\n"),
      );
      return;
    }
    if (cmd === "rules") {
      setShowRules(true);
      pushEphemeralBot(
        "Opened Global Chat rules. Short version: be respectful, keep it BloxSmith/Roblox friendly, no spam, scams, NSFW, harassment, unsafe links, or personal info. Breaking rules can mean message removal, a warning, timeout/mute, or account restrictions.",
      );
      return;
    }
    if (cmd === "credits") {
      pushEphemeralBot(
        `Credit balance: ${isOwner ? "unlimited (owner)" : `${profile?.credits ?? 0} credits`}.`,
      );
      return;
    }
    if (cmd === "daily") {
      const { data, error } = await (supabase as any).rpc("claim_daily_credits");
      if (error) toast.error(error.message);
      else {
        await refresh();
        pushEphemeralBot(
          (data as any)?.claimed
            ? `Daily claimed: +${(data as any).amount} credits. Balance: ${(data as any).credits}.`
            : "Daily already claimed today.",
        );
      }
      return;
    }
    if (cmd === "profile") {
      pushEphemeralBot(
        `Profile: ${profile?.display_name ?? user?.email ?? "Builder"}\nRank: ${roles.join(", ") || "user"}\nCredits: ${profile?.credits ?? 0}`,
      );
      return;
    }
    if (cmd === "badges") {
      pushEphemeralBot(
        [
          `Your chat badges: ${(authors.get(user!.id)?.badges ?? []).join(", ") || "none yet"}.`,
          "",
          badgeHelpText(),
        ].join("\n"),
      );
      return;
    }
    if (cmd === "rank") {
      pushEphemeralBot(
        `Rank: ${isOwner ? "Owner" : roles.includes("admin") ? "Staff/Admin" : roles.includes("moderator") ? "Moderator" : "Member"}.`,
      );
      return;
    }
    if (cmd === "project") {
      const id = location.pathname.match(/\/project\/([^/]+)/)?.[1];
      pushEphemeralBot(
        id ? `Current project ID: ${id}` : "Open a project page to see current project info.",
      );
      return;
    }
    if (cmd === "publish") {
      pushEphemeralBot(
        "To publish: open a project, polish the build, use the project publish/showcase controls, add a title/description/thumbnail, then submit it to Published Creations.",
      );
      return;
    }
    if (cmd === "plugin") {
      pushEphemeralBot(
        "Plugin setup: open /plugin, install the Roblox Studio plugin, sign in, copy/connect your token, then use Sync in Studio to pull BloxSmith commands.",
      );
      return;
    }
    if (cmd === "models") {
      pushEphemeralBot(
        "AI features: Roblox game builder, Luau scripting, UI Generator, image/clothing generation, toolbox assets, project planning, fixes, and plugin sync.",
      );
      return;
    }
    if (cmd === "updates") {
      pushEphemeralBot(
        "Latest update: auth/session cleanup, AI Help removed, Global Chat kept, and BloxBot command upgrades. Open /changelog for the full list.",
      );
      return;
    }
    if (["report", "mute", "follow", "friend", "dm"].includes(cmd)) {
      const target = findMention(args);
      if (!target) {
        pushEphemeralBot("I couldn't find that @user in this chat session.");
        return;
      }
      const rest = args.replace(/@([A-Za-z0-9_ .-]{2,40})/, "").trim();
      if (cmd === "report") {
        const { error } = await (supabase as any).rpc("report_chat_user", {
          _reported_user_id: target.id,
          _reason: rest || "Reported from BloxBot",
        });
        if (error) toast.error(error.message);
        else toast.success("Report sent");
        return;
      }
      if (cmd === "mute") {
        await (supabase as any)
          .from("user_chat_local_mutes")
          .upsert({ user_id: user!.id, muted_user_id: target.id });
        setLocalMuted((s) => new Set([...s, target.id]));
        pushEphemeralBot(`${target.name} muted locally.`);
        return;
      }
      if (cmd === "follow") {
        const { error } = await (supabase as any)
          .from("user_follows")
          .upsert({ follower_id: user!.id, following_id: target.id });
        if (error) toast.error(error.message);
        else pushEphemeralBot(`You now follow ${target.name}.`);
        return;
      }
      if (cmd === "friend") {
        const { error } = await (supabase as any)
          .from("friend_requests")
          .upsert({ requester_id: user!.id, addressee_id: target.id, status: "pending" });
        if (error) toast.error(error.message);
        else pushEphemeralBot(`Friend request sent to ${target.name}.`);
        return;
      }
      if (cmd === "dm") {
        const { error } = await (supabase as any)
          .from("direct_messages")
          .insert({ sender_id: user!.id, recipient_id: target.id, content: rest || "👋" });
        if (error) toast.error(error.message);
        else pushEphemeralBot(`DM sent to ${target.name}.`);
        return;
      }
    }
    if (cmd === "online") {
      const ids = activeChatUserIds;
      pushEphemeralBot(
        `Online: ${ids.map((id) => authors.get(id)?.display_name ?? id.slice(0, 6)).join(", ") || "none"}.`,
      );
      return;
    }
    if (cmd === "staff") {
      pushEphemeralBot(
        `Staff online: ${
          activeChatUserIds
            .filter((id) =>
              authors
                .get(id)
                ?.roles.some((r) => r === "owner" || r === "admin" || r === "moderator"),
            )
            .map((id) => authors.get(id)?.display_name ?? "Staff")
            .join(", ") || "none visible"
        }.`,
      );
      return;
    }
    if (cmd === "announce") {
      if (!staffOnly()) return;
      const { error } = await (supabase as any).rpc("admin_chat_announce", { _content: args });
      if (error) toast.error(error.message);
      return;
    }
    if (cmd === "event") {
      if (!ownerOnly()) return;
      const [amountRaw, minutesRaw, ...titleParts] = args.split(/\s+/);
      const amount = parseInt(amountRaw, 10) || 5;
      const minutes = parseInt(minutesRaw, 10) || 15;
      const title = titleParts.join(" ") || "BloxSmith Admin Event";
      const { error } = await (supabase as any).rpc("owner_start_credit_event", {
        _title: title,
        _amount: amount,
        _minutes: minutes,
      });
      if (error) toast.error(error.message);
      else toast.success("Admin event started");
      return;
    }
    if (cmd === "giveaway") {
      if (args.toLowerCase().startsWith("create ")) {
        if (!staffOnly()) return;
        const [, creditsRaw, minutesRaw, ...titleParts] = args.split(/\s+/);
        const prize = parseInt(creditsRaw, 10) || 25;
        const minutes = parseInt(minutesRaw, 10) || 10;
        const title = titleParts.join(" ") || "BloxSmith Giveaway";
        const { error } = await (supabase as any).rpc("admin_create_chat_giveaway", {
          _title: title,
          _prize_credits: prize,
          _minutes: minutes,
          _winner_count: 1,
        });
        if (error) toast.error(error.message);
        else toast.success("Giveaway created");
        return;
      }
      if (args.toLowerCase().startsWith("finish ")) {
        if (!staffOnly()) return;
        const id = args.split(/\s+/)[1] ?? "";
        const { error } = await (supabase as any).rpc("admin_finish_chat_giveaway", {
          _giveaway_id: id,
        });
        if (error) toast.error(error.message);
        else toast.success("Giveaway finished");
        return;
      }
      const id = args.trim();
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        pushEphemeralBot(
          "Giveaway help:\nAdmin: /giveaway create 25 10 Build Night\nJoin: /giveaway giveaway-id",
        );
        return;
      }
      const { error } = await (supabase as any).rpc("join_chat_giveaway", { _giveaway_id: id });
      if (error) toast.error(error.message);
      else pushEphemeralBot("You're entered. Good luck!");
      return;
    }
    if (
      ["givecredits", "takecredits", "badge", "role", "warn", "timeout", "ban", "unban"].includes(
        cmd,
      )
    ) {
      const needsOwner = cmd === "givecredits" || cmd === "takecredits" || cmd === "role";
      const needsMod = cmd === "warn" || cmd === "timeout";
      if (needsOwner ? !ownerOnly() : needsMod ? !modOnly() : !staffOnly()) return;
      const target = findMention(args);
      if (!target) return toast.error("Use @user");
      const rest = args.replace(/@([A-Za-z0-9_ .-]{2,40})/, "").trim();
      const [first, ...tail] = rest.split(/\s+/);
      const reason = tail.join(" ") || "BloxBot staff command";
      if (cmd === "givecredits" || cmd === "takecredits") {
        const amount = Math.abs(parseInt(first, 10));
        if (!amount) return toast.error("Enter amount");
        const { error } = await (supabase as any).rpc("admin_adjust_credits", {
          _user_id: target.id,
          _amount: cmd === "takecredits" ? -amount : amount,
          _reason: reason,
        });
        if (error) toast.error(error.message);
        else toast.success("Credits updated");
        return;
      }
      if (cmd === "badge") {
        if (!first) {
          pushEphemeralBot(`Badge command help:\n/badge @user badge_id\n\n${badgeHelpText()}`);
          return;
        }
        const { error } = await (supabase as any).rpc("admin_grant_badge", {
          _user_id: target.id,
          _badge: first,
        });
        if (error) {
          toast.error(error.message);
          pushEphemeralBot(`I couldn't grant that badge.\n\n${badgeHelpText()}`);
        } else toast.success("Badge granted");
        return;
      }
      if (cmd === "role") {
        if (!ownerOnly()) return;
        const role = first === "owner" ? "admin" : first === "mod" ? "moderator" : first;
        const { error } = await (supabase as any).rpc("admin_set_role", {
          _user_id: target.id,
          _role: role,
          _grant: true,
        });
        if (error) toast.error(error.message);
        else toast.success("Role updated");
        return;
      }
      if (cmd === "warn") {
        const { error } = await (supabase as any).rpc("admin_chat_warn", {
          _user_id: target.id,
          _reason: rest || "Warning",
        });
        if (error) toast.error(error.message);
        else toast.success("Warned");
        return;
      }
      if (cmd === "timeout") {
        const minutes = parseInt(first, 10) || 5;
        await muteUser(target.id, minutes, reason);
        return;
      }
      if (cmd === "ban" || cmd === "unban") {
        const { error } = await (supabase as any).rpc("admin_set_ban", {
          _user_id: target.id,
          _banned: cmd === "ban",
          _reason: reason,
        });
        if (error) toast.error(error.message);
        else toast.success(cmd === "ban" ? "Banned" : "Unbanned");
        return;
      }
    }
    if (cmd === "feature") {
      if (!staffOnly()) return;
      const { error } = await (supabase as any).rpc("admin_feature_project", { _project_id: args });
      if (error) toast.error(error.message);
      else toast.success("Project featured");
      return;
    }
    if (cmd === "changelog") {
      if (!staffOnly()) return;
      const { error } = await (supabase as any).rpc("admin_quick_changelog", { _message: args });
      if (error) toast.error(error.message);
      else toast.success("Changelog note added");
      return;
    }
    if (cmd === "me") {
      await sendRaw(`_${args || "…"}_`);
      return;
    }
    if (cmd === "shrug") {
      await sendRaw(`¯\\_(ツ)_/¯ ${args}`);
      return;
    }
    if (cmd === "clear-mine") {
      const { error } = await supabase
        .from("global_chat_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .is("deleted_at", null);
      if (error) toast.error(error.message);
      else toast.success("Your messages cleared");
      return;
    }
    if (cmd === "slow") {
      if (!isAdmin) return toast.error("Admins only");
      const n = parseInt(args, 10);
      if (Number.isNaN(n) || n < 0 || n > 3600) return toast.error("Usage: /slow 0-3600");
      const { error } = await (supabase as any).rpc("admin_chat_set_slow_mode", { _seconds: n });
      if (error) toast.error(error.message);
      else toast.success(n === 0 ? "Slow mode off" : `Slow mode: ${n}s`);
      return;
    }
    if (cmd === "clear") {
      if (!isAdmin) return toast.error("Admins only");
      const { error } = await (supabase as any).rpc("admin_chat_clear_all");
      if (error) toast.error(error.message);
      else {
        setMessages([]);
        toast.success("Chat cleared");
      }
      return;
    }
    pushEphemeralBot(`Unknown command: /${cmd}. Try /help`);
  }

  async function sendRaw(content: string) {
    const { error } = await sendGlobalChatMessage({ content, channelId: currentChannel });
    if (error) toast.error(error.message);
  }

  async function shareRobloxGame() {
    const url = robloxUrl.trim();
    const caption = robloxCaption.trim();
    if (!url) return toast.error("Paste a Roblox game URL");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return toast.error("That doesn't look like a valid URL");
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "roblox.com" && host !== "web.roblox.com") {
      return toast.error("Only roblox.com links are allowed");
    }
    if (!/\/games?\//i.test(parsed.pathname) && !/\/users\//i.test(parsed.pathname)) {
      return toast.error("Use a Roblox game or user link");
    }
    setSending(true);
    try {
      const { error } = await sendGlobalChatMessage({
        content: caption, // caption text only; link goes in attachment_url
        replyToId: null,
        attachmentUrl: parsed.toString(),
        attachmentType: "roblox",
        channelId: currentChannel,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Roblox game shared");
        setShowRobloxShare(false);
        setRobloxUrl("");
        setRobloxCaption("");
      }
    } finally {
      setSending(false);
    }
  }

  function pushEphemeralBot(content: string) {
    setMessages((prev) =>
      capChatMessages([
        ...prev,
        {
          id: `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          user_id: "bloxbot",
          content,
          created_at: new Date().toISOString(),
          deleted_at: null,
          reply_to_id: null,
          attachment_url: null,
          attachment_type: null,
          pinned_at: null,
          flagged: false,
          ephemeralBot: true,
        },
      ]),
    );
  }

  async function deleteMessage(id: string) {
    const { error } = await (supabase as any).rpc("admin_chat_delete_message", { _message_id: id });
    if (error) toast.error(error.message);
  }
  async function muteUser(uid: string, minutes: number | null, reason: string) {
    const { error } = await (supabase as any).rpc("admin_chat_mute", {
      _user_id: uid,
      _minutes: minutes,
      _reason: reason,
    });
    if (error) toast.error(error.message);
    else toast.success(minutes ? `Muted ${minutes}m` : "Muted permanently");
  }
  async function unmuteUser(uid: string) {
    const { error } = await (supabase as any).rpc("admin_chat_unmute", { _user_id: uid });
    if (error) toast.error(error.message);
    else toast.success("Unmuted");
  }
  async function pinMessage(id: string, pin: boolean) {
    const { error } = await (supabase as any).rpc("admin_chat_pin_message", {
      _message_id: id,
      _pin: pin,
    });
    if (error) toast.error(error.message);
    else toast.success(pin ? "Pinned" : "Unpinned");
  }
  async function warnUser(uid: string) {
    const reason = window.prompt("Warning reason?");
    if (!reason) return;
    const { error } = await (supabase as any).rpc("admin_chat_warn", {
      _user_id: uid,
      _reason: reason,
    });
    if (error) toast.error(error.message);
    else toast.success("Warning sent");
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const mine = reactions.find(
      (r) => r.message_id === messageId && r.user_id === user!.id && r.emoji === emoji,
    );
    if (mine) {
      await (supabase as any).from("global_chat_reactions").delete().eq("id", mine.id);
    } else {
      await (supabase as any)
        .from("global_chat_reactions")
        .insert({ message_id: messageId, user_id: user!.id, emoji });
    }
  }

  async function reportMessage(m: RenderMessage) {
    const reason = window.prompt("Why are you reporting this?");
    if (reason === null) return;
    const { error } = await (supabase as any).from("global_chat_reports").insert({
      message_id: m.id,
      reported_user_id: m.user_id,
      reporter_id: user!.id,
      reason,
    });
    if (error) {
      if (error.code === "23505") toast.error("You already reported this message");
      else toast.error(error.message);
    } else toast.success("Reported — thanks");
  }

  async function ackWarning(id: string) {
    await (supabase as any)
      .from("global_chat_warnings")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    setWarnings((w) => w.filter((x) => x.id !== id));
  }

  function onDraftChange(v: string) {
    setDraft(v);
    // mention detection
    const at = v.lastIndexOf("@");
    if (at >= 0) {
      const tail = v.slice(at + 1);
      if (/^[A-Za-z0-9_]*$/.test(tail) && tail.length <= 24) setMentionQuery(tail);
      else setMentionQuery(null);
    } else setMentionQuery(null);
    // typing broadcast (throttled)
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000 && presenceChanRef.current) {
      lastTypingSentRef.current = now;
      presenceChanRef.current
        .send({ type: "broadcast", event: "typing", payload: { user_id: user!.id } })
        .catch(() => {});
    }
  }

  function applyMention(name: string) {
    const at = draft.lastIndexOf("@");
    if (at < 0) return;
    setDraft(draft.slice(0, at) + "@" + name + " ");
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(draft);
  }

  const myRoles = useMemo(() => roles as Role[], [roles]);
  const myName = user ? (authors.get(user.id)?.display_name ?? null) : null;
  const visibleChannels = useMemo(
    () => channels.filter((c) => c.view_role !== "admin" || isAdmin),
    [channels, isAdmin],
  );
  const activeChannel = useMemo(
    () => visibleChannels.find((c) => c.slug === currentChannel) ?? visibleChannels[0] ?? null,
    [visibleChannels, currentChannel],
  );
  const canPostHere = !activeChannel || activeChannel.post_role !== "admin" || isAdmin;
  const visibleMessages = useMemo(
    () =>
      messages.filter((m) => {
        const slug = activeChannel?.slug ?? "general";
        if (m.ephemeralBot) return prefs.show_system && slug === "general";
        return (m.channel_id ?? "general") === slug;
      }),
    [messages, activeChannel?.slug, prefs.show_system],
  );
  const messagesById = useMemo(
    () => new Map(visibleMessages.map((m) => [m.id, m])),
    [visibleMessages],
  );
  const pinned = useMemo(
    () => visibleMessages.filter((m) => m.pinned_at).slice(-3),
    [visibleMessages],
  );
  const reactionsByMessage = useMemo(() => {
    const grouped = new Map<string, Reaction[]>();
    for (const reaction of reactions) {
      const list = grouped.get(reaction.message_id);
      if (list) list.push(reaction);
      else grouped.set(reaction.message_id, [reaction]);
    }
    return grouped;
  }, [reactions]);
  const accent = prefs.theme_accent;
  const recentChatSet = useMemo(() => {
    const cutoff = Date.now() - 15 * 60_000;
    const ids = new Set<string>();
    for (const message of visibleMessages) {
      if (message.ephemeralBot || message.user_id === "bloxbot") continue;
      const created = new Date(message.created_at).getTime();
      if (Number.isFinite(created) && created >= cutoff) ids.add(message.user_id);
    }
    return ids;
  }, [visibleMessages]);
  const activeChatUserIds = useMemo(() => {
    const ids = new Set<string>(onlineUsers);
    for (const [id, author] of authors) {
      if (id === "bloxbot") continue;
      const presence = presenceFromProfile({
        presence_enabled: author.presence_enabled,
        presence_status: author.presence_status,
        last_seen_at: author.last_seen_at,
      });
      if (presence.label !== "Offline" || recentChatSet.has(id)) ids.add(id);
    }
    return Array.from(ids).filter((id) => id !== "bloxbot");
  }, [authors, onlineUsers, recentChatSet]);
  const activeChatSet = useMemo(() => new Set(activeChatUserIds), [activeChatUserIds]);
  const memberGroups = useMemo(() => {
    const rows = Array.from(authors.entries())
      .filter(([id]) => id !== "bloxbot")
      .map(([id, author]) => ({ id, author, online: activeChatSet.has(id) }))
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return displayAuthorName(a.author, a.id).localeCompare(displayAuthorName(b.author, b.id));
      });
    const take = (label: string, test: (a: Author) => boolean) => {
      const members = rows.filter(({ author }) => test(author));
      return members.length ? [{ label, members }] : [];
    };
    const groupedIds = new Set<string>();
    const groups: { label: string; members: { id: string; author: Author; online: boolean }[] }[] =
      [];
    for (const group of [
      ...take("Owner", (a) => a.roles.includes("owner")),
      ...take("Staff Team", (a) => a.roles.includes("admin") || a.roles.includes("moderator")),
      ...take(
        "Partners & Premium",
        (a) =>
          a.roles.includes("premium") ||
          a.badges.includes("creator") ||
          a.profile_badges.includes("supporter"),
      ),
      ...take(
        "OG",
        (a) =>
          a.badges.includes("og") ||
          a.profile_badges.includes("og") ||
          a.profile_badges.includes("early"),
      ),
    ]) {
      const members = group.members.filter((member) => !groupedIds.has(member.id));
      members.forEach((member) => groupedIds.add(member.id));
      if (members.length) groups.push({ ...group, members });
    }
    const rest = rows.filter((member) => !groupedIds.has(member.id));
    if (rest.length) groups.push({ label: "Online & Recent", members: rest });
    return groups;
  }, [activeChatSet, authors]);

  // Mention suggestions
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [] as { id: string; name: string }[];
    const q = mentionQuery.toLowerCase();
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    for (const [id, a] of authors) {
      const n = a.display_name;
      const handle = profileHandle(a.username).slice(1);
      if ((!n && !handle) || seen.has(id)) continue;
      if (q === "" || n?.toLowerCase().includes(q) || handle.toLowerCase().includes(q)) {
        out.push({ id, name: n || `@${handle}` });
        seen.add(id);
      }
      if (out.length >= 5) break;
    }
    return out;
  }, [mentionQuery, authors]);

  if (!user) return null;

  return (
    <>
      {/* Floating chat bubble popups */}
      {chatBubbles.length > 0 && (
        <div className="pointer-events-none fixed z-[9997] top-20 right-4 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2">
          {chatBubbles.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setOpen(true);
                setChatBubbles((prev) => prev.filter((x) => x.id !== b.id));
              }}
              className="pointer-events-auto group flex items-start gap-2 rounded-2xl border border-border bg-surface-elevated/95 px-3 py-2 text-left shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-4 fade-in duration-300 hover:border-primary hover:bg-surface-elevated"
            >
              {b.avatar ? (
                <img src={b.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-xs font-bold leading-tight"
                  style={b.color ? { color: b.color } : undefined}
                >
                  {b.name}
                </div>
                <div className="line-clamp-2 text-[12px] leading-snug text-muted-foreground group-hover:text-foreground">
                  {b.content}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!inline && !open && typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open chat"
            className="fixed z-[9998] bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 md:left-5 flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2.5 text-foreground shadow-2xl ring-1 ring-black/5 transition hover:bg-surface hover:scale-[1.02] active:scale-95"
          >
            <MessagesSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Chat</span>
            {unread > 0 && (
              <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>,
          document.body,
        )}

      {open && (
        <aside
          role="dialog"
          aria-label="Global chat"
          className={cn(
            "flex flex-col overflow-hidden border-border bg-surface-elevated/98 shadow-2xl backdrop-blur-xl",
            inline
              ? "relative h-[min(720px,calc(100dvh-14rem))] min-h-[420px] w-full rounded-2xl border"
              : "fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[9999] h-[min(82dvh,720px)] max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] rounded-2xl border md:inset-x-auto md:left-5 md:right-auto md:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
          )}
          style={{
            ...(chatBackgroundStyle(prefs) ?? {}),
            ...(accent ? ({ ["--chat-accent" as any]: accent } as React.CSSProperties) : {}),
            ...(!inline &&
            typeof window !== "undefined" &&
            window.matchMedia?.("(min-width: 768px)").matches
              ? { width: `${size.w}px`, height: `${size.h}px` }
              : {}),
          }}
        >
          {!inline && (
            <div
              onPointerDown={startResize}
              role="separator"
              aria-label="Resize chat"
              title="Drag to resize"
              className="hidden md:block absolute -top-1 -right-1 z-20 h-5 w-5 cursor-nesw-resize rounded-tr-2xl bg-transparent hover:bg-primary/20 transition"
            />
          )}
          <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15"
                style={accent ? { background: `${accent}22` } : undefined}
              >
                <MessagesSquare
                  className="h-4 w-4 text-primary"
                  style={accent ? { color: accent } : undefined}
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight">Global Chat</div>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] leading-tight text-muted-foreground">
                  {slow > 0 ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-amber-500">
                      <VolumeX className="h-3 w-3" /> Slow {slow}s
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Volume2 className="h-3 w-3" /> Live
                    </span>
                  )}
                  <span>·</span>
                  <span
                    className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums"
                    title="Local time"
                  >
                    <Clock className="h-3 w-3" /> {clockTime}
                  </span>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setShowUsers((v) => !v)}
                    className="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground"
                  >
                    <Users className="h-3 w-3" /> {activeChatUserIds.length} online
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowUsers((v) => !v)}
                aria-label="Members"
                title="Members"
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground",
                  showUsers && "bg-primary/15 text-primary",
                )}
              >
                <Users className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("friends");
                  setDmUnread(0);
                }}
                aria-label="Friends & DMs"
                className="relative grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                <UserPlus className="h-4 w-4" />
                {dmUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {dmUnread > 9 ? "9+" : dmUnread}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowLogs(true)}
                aria-label="Chat logs"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowRules(true)}
                aria-label="Chat rules"
                title="Chat rules"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                <ScrollText className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Settings"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              {canModerate && (
                <button
                  type="button"
                  onClick={() => setShowMod(true)}
                  aria-label="Moderation"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
                >
                  <Shield className="h-4 w-4" />
                </button>
              )}
              {!inline && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </header>

          {/* Warnings banner */}
          {warnings.map((w) => (
            <div
              key={w.id}
              className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300"
            >
              <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Moderator warning</div>
                <div className="text-amber-200/90">
                  {w.reason || "Please review the chat rules."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => ackWarning(w.id)}
                className="rounded border border-amber-400/40 px-2 py-0.5 text-[11px] hover:bg-amber-500/20"
              >
                OK
              </button>
            </div>
          ))}

          {/* Pinned bar */}
          {pinned.length > 0 && (
            <div className="border-b border-border bg-primary/5 px-3 py-1.5">
              {pinned.map((p) => {
                const a = authors.get(p.user_id);
                return (
                  <div key={p.id} className="flex items-center gap-1.5 text-[11px]">
                    <Pin className="h-3 w-3 text-primary shrink-0" />
                    <span className="font-semibold">{a?.display_name ?? "User"}:</span>
                    <span className="truncate text-muted-foreground">
                      {renderRich(p.content, myName, accent, "compact")}
                    </span>
                    {canModerate && (
                      <button
                        type="button"
                        onClick={() => pinMessage(p.id, false)}
                        className="ml-auto text-muted-foreground hover:text-destructive"
                      >
                        <PinOff className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Members list */}
          {showUsers && (
            <MembersListPanel
              groups={memberGroups}
              onlineCount={activeChatUserIds.length}
              onClose={() => setShowUsers(false)}
              onOpenProfile={(uid) => {
                setProfileUid(uid);
                setShowUsers(false);
              }}
              onOpenDm={(uid) => {
                setActiveDm(uid);
                setView("friends");
                setShowUsers(false);
                setDmUnread(0);
              }}
            />
          )}

          {visibleChannels.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background/40 px-2 py-1.5">
              {visibleChannels.map((c) => {
                const Ico =
                  c.icon === "megaphone"
                    ? Megaphone
                    : c.icon === "life-buoy"
                      ? LifeBuoy
                      : c.icon === "shield"
                        ? Shield
                        : c.icon === "bug"
                          ? Bug
                          : Hash;
                const active = (activeChannel?.slug ?? "general") === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setCurrentChannel(c.slug)}
                    title={c.description ?? c.name}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                      active
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border bg-surface/40 text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                  >
                    <Ico className="h-3 w-3" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          <div
            ref={scrollRef}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3",
              densityClass(prefs.density),
            )}
          >
            {visibleMessages.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No messages in #{activeChannel?.name ?? "general"} yet — say hi!
              </p>
            )}
            {visibleMessages.map((m) => {
              const isMe = m.user_id === user.id;
              const isBot = m.ephemeralBot;
              const author = !isBot ? authors.get(m.user_id) : null;
              const name = isBot ? "BloxBot" : author?.display_name || (isMe ? "You" : "User");
              const replyTarget = m.reply_to_id ? messagesById.get(m.reply_to_id) : null;
              const replyAuthor = replyTarget ? authors.get(replyTarget.user_id) : null;
              const msgReacts = reactionsByMessage.get(m.id) ?? [];
              const grouped = new Map<string, { count: number; mine: boolean }>();
              for (const r of msgReacts) {
                const g = grouped.get(r.emoji) ?? { count: 0, mine: false };
                g.count++;
                if (r.user_id === user.id) g.mine = true;
                grouped.set(r.emoji, g);
              }
              return (
                <div key={m.id} className="group flex gap-2">
                  <ChatAvatar
                    isBot={!!isBot}
                    author={author ?? null}
                    name={name}
                    onClick={() => !isBot && setProfileUid(m.user_id)}
                  />
                  <div className="min-w-0 flex-1">
                    {replyTarget && (
                      <div className="mb-1 flex items-center gap-1 rounded-md border-l-2 border-primary/50 bg-surface/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                        <Reply className="h-2.5 w-2.5" />
                        <span className="font-semibold">
                          {replyAuthor?.display_name ?? "User"}:
                        </span>
                        <span className="truncate">{replyTarget.content || "(image)"}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isBot && author?.chat_icon && CHAT_ICON_MAP[author.chat_icon]
                        ? (() => {
                            const Ico = CHAT_ICON_MAP[author.chat_icon!];
                            const stops = author.chat_name_gradient;
                            return (
                              <Ico
                                className="h-3.5 w-3.5 shrink-0"
                                style={stops?.length ? { color: stops[0] } : undefined}
                                aria-hidden
                              />
                            );
                          })()
                        : null}
                      {isBot ? (
                        <span className="truncate text-xs font-semibold">{name}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setProfileUid(m.user_id)}
                          className="truncate text-xs font-semibold hover:underline"
                          style={{
                            ...gradientTextStyle(author?.chat_name_gradient),
                            ...chatFontStyle(author?.chat_font),
                          }}
                        >
                          {name}
                        </button>
                      )}
                      {isBot ? (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                          BOT
                        </span>
                      ) : (
                        author && <RoleBadges roles={author.roles} size="sm" showLabel={false} />
                      )}
                      {!isBot && author?.profile_badges?.length ? (
                        <ProfileBadgeRow
                          ids={author.profile_badges}
                          size={16}
                          max={4}
                          className="shrink-0"
                        />
                      ) : null}
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(m.created_at)}
                      </span>
                      {m.is_announcement && (
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                          Official Announcement
                        </span>
                      )}
                      {m.pinned_at && <Pin className="h-2.5 w-2.5 text-primary" />}
                      {isBot && (
                        <span className="text-[10px] text-muted-foreground">
                          · only you see this
                        </span>
                      )}
                      {!isBot && (
                        <MsgActions
                          isAdmin={!!canModerate}
                          isSelf={isMe}
                          pinned={!!m.pinned_at}
                          onReply={() => {
                            setReplyTo(m);
                            inputRef.current?.focus();
                          }}
                          quickReactions={prefs.quick_reactions}
                          onReact={(e) => toggleReaction(m.id, e)}
                          onReport={() => reportMessage(m)}
                          onDelete={() => deleteMessage(m.id)}
                          onMute={(min) => muteUser(m.user_id, min, "via chat")}
                          onUnmute={() => unmuteUser(m.user_id)}
                          onPin={() => pinMessage(m.id, !m.pinned_at)}
                          onWarn={() => warnUser(m.user_id)}
                        />
                      )}
                    </div>
                    {m.content && (
                      <div
                        className={cn(
                          "mt-0.5 break-words leading-relaxed whitespace-pre-wrap text-foreground",
                          fontSizeClass(prefs.font_size),
                        )}
                        style={
                          !isBot
                            ? {
                                ...gradientTextStyle(author?.chat_text_gradient),
                                ...chatFontStyle(author?.chat_font),
                              }
                            : undefined
                        }
                      >
                        {renderRich(m.content, myName, accent, prefs.emote_size)}
                      </div>
                    )}
                    {!isBot &&
                      m.content &&
                      (() => {
                        const tr = translations.get(m.id);
                        const isLoading = tr === "loading";
                        const shown = tr && tr !== "loading" ? tr : null;
                        return (
                          <div className="mt-1 flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handleTranslate(m.id, m.content!)}
                              className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-surface/60 px-2 py-0.5 text-[10px] text-muted-foreground opacity-0 transition hover:bg-surface hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Languages className="h-3 w-3" />
                              )}
                              {shown
                                ? "Hide translation"
                                : isLoading
                                  ? "Translating…"
                                  : "Translate"}
                            </button>
                            {shown && (
                              <div
                                className={cn(
                                  "rounded-md border-l-2 border-primary/60 bg-surface/40 px-2 py-1 text-foreground",
                                  fontSizeClass(prefs.font_size),
                                )}
                              >
                                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary/80">
                                  Translated
                                  {shown.detected && shown.detected !== "unknown"
                                    ? ` from ${shown.detected}`
                                    : ""}
                                </div>
                                <div className="break-words whitespace-pre-wrap">{shown.text}</div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    {m.attachment_url && m.attachment_type === "image" && (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 block"
                      >
                        <img
                          src={m.attachment_url}
                          alt="attachment"
                          className="max-h-60 rounded-lg border border-border object-cover"
                        />
                      </a>
                    )}
                    {m.attachment_url && m.attachment_type === "roblox" && (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface/60 p-2 text-xs hover:bg-surface"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-emerald-400">
                          <Gamepad2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                            Roblox
                          </div>
                          <div className="truncate text-foreground">
                            {m.attachment_url.replace(/^https?:\/\//, "")}
                          </div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    )}
                    {grouped.size > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Array.from(grouped.entries()).map(([emoji, g]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(m.id, emoji)}
                            className={cn(
                              "chat-reaction-pill flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] shadow-sm transition",
                              g.mine
                                ? "border-primary/50 bg-primary/15 text-primary-glow"
                                : "border-border bg-surface/50 hover:border-primary/35 hover:bg-surface",
                            )}
                          >
                            <ReactionSymbol value={emoji} />
                            <span className="text-muted-foreground">{g.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {typingUsers.size > 0 && (
              <div className="text-[11px] italic text-muted-foreground">
                {Array.from(typingUsers.keys())
                  .slice(0, 3)
                  .map((id) => authors.get(id)?.display_name ?? "Someone")
                  .join(", ")}{" "}
                typing…
              </div>
            )}
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="flex items-center gap-2 border-t border-border bg-surface/40 px-3 py-1.5 text-[11px]">
              <Reply className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground">
                Replying to{" "}
                <strong className="text-foreground">
                  {authors.get(replyTo.user_id)?.display_name ?? "User"}
                </strong>
                : {replyTo.content.slice(0, 60)}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* File preview */}
          {pendingFile && (
            <div className="flex items-center gap-2 border-t border-border bg-surface/40 px-3 py-1.5 text-[11px]">
              <ImageIcon className="h-3 w-3 text-primary" />
              <span className="truncate text-muted-foreground">
                {pendingFile.name} · {Math.round(pendingFile.size / 1024)} KB
              </span>
              <button
                type="button"
                onClick={() => {
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="ml-auto text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="relative shrink-0 border-t border-border p-2">
            {/* Mention suggestions */}
            {mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-2 right-2 mb-1 overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-xl">
                {mentionSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applyMention(s.name)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-surface"
                  >
                    <AtSign className="h-3 w-3 text-primary" /> {s.name}
                  </button>
                ))}
              </div>
            )}

            {muted && (
              <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                <ShieldAlert className="h-3 w-3" />
                You're muted until {muted.toLocaleString()}.
              </div>
            )}
            <div className="flex flex-wrap items-end gap-1.5 sm:flex-nowrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image"
                className="order-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground sm:order-none"
                disabled={!!muted}
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowRobloxShare(true)}
                aria-label="Share a Roblox game"
                title="Share a Roblox game"
                className="order-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-emerald-400 sm:order-none"
                disabled={!!muted || !canPostHere}
              >
                <Gamepad2 className="h-4 w-4" />
              </button>
              <span className="order-1 sm:order-none">
                <EmojiPicker
                  align="start"
                  onPick={(em) => {
                    setDraft((d) => d + em);
                    inputRef.current?.focus();
                  }}
                />
              </span>
              <span className="order-1 sm:order-none">
                <EmotePicker
                  align="start"
                  onPick={(tok) => {
                    setDraft((d) => d + (d && !d.endsWith(" ") ? " " : "") + tok + " ");
                    inputRef.current?.focus();
                  }}
                />
              </span>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  } else if (e.key === "Escape") {
                    setReplyTo(null);
                    setMentionQuery(null);
                  }
                }}
                placeholder={
                  muted
                    ? "You're muted"
                    : !canPostHere
                      ? `Only staff can post in #${activeChannel?.name ?? ""}`
                      : `Message #${activeChannel?.name ?? "general"}… (@ to mention, / for commands)`
                }
                disabled={!!muted || sending || !canPostHere}
                maxLength={500}
                rows={2}
                className={cn(
                  "order-2 max-h-32 min-h-[44px] min-w-[calc(100%-2.9rem)] flex-1 resize-none overflow-y-auto rounded-lg border border-border bg-background/60 px-2.5 py-2 leading-relaxed focus:border-primary/50 focus:outline-none disabled:opacity-50 sm:order-none sm:min-w-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border",
                  fontSizeClass(prefs.font_size),
                  chatFontStyle(profile?.chat_font) && "",
                )}
                style={chatFontStyle(profile?.chat_font)}
              />
              <button
                type="submit"
                disabled={sending || (!draft.trim() && !pendingFile) || !!muted || !canPostHere}
                aria-label="Send"
                className="order-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40 sm:order-none"
                style={accent ? { background: accent } : undefined}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                You as <RoleBadges roles={myRoles} size="sm" showLabel /> · {draft.length}/500
              </span>
              {slow > 0 && !canModerate && <span>Slow mode {slow}s</span>}
            </div>
          </form>

          {showSettings && (
            <ChatSettingsPanel
              prefs={prefs}
              onChange={updatePrefs}
              onClose={() => setShowSettings(false)}
            />
          )}
          {showMod && canModerate && (
            <ChatModerationPanel
              onClose={() => setShowMod(false)}
              onDeleteMessage={deleteMessage}
              canManageWords={isAdmin}
            />
          )}
          {showRules && <ChatRulesPanel onClose={() => setShowRules(false)} />}

          {view === "friends" && (
            <div className="absolute inset-0 z-40 flex flex-col bg-surface-elevated/98 backdrop-blur-xl">
              <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <UserPlus className="h-4 w-4 text-primary" /> Friends & DMs
                </h2>
                <button
                  onClick={() => {
                    setView("channels");
                    setActiveDm(null);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-hidden">
                <FriendsPanel
                  activeDm={activeDm}
                  setActiveDm={setActiveDm}
                  onOpenProfile={(uid) => setProfileUid(uid)}
                />
              </div>
            </div>
          )}

          {profileUid && (
            <UserProfilePopover
              userId={profileUid}
              onClose={() => setProfileUid(null)}
              onOpenDm={(uid) => {
                setProfileUid(null);
                setView("friends");
                setActiveDm(uid);
                setDmUnread(0);
              }}
            />
          )}

          {showLogs && (
            <div className="absolute inset-0 z-40 flex flex-col bg-surface-elevated/98 backdrop-blur-xl">
              <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <FileText className="h-4 w-4 text-primary" /> Chat logs · #
                  {activeChannel?.name ?? "general"}
                </h2>
                <button
                  onClick={() => setShowLogs(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Showing {visibleMessages.length} message{visibleMessages.length === 1 ? "" : "s"}{" "}
                  from this session. Messages are auto-cleared after 7 days.
                </p>
                <div className="space-y-1 font-mono text-[11px] leading-relaxed">
                  {visibleMessages.map((m) => {
                    const name = m.ephemeralBot
                      ? "BloxBot"
                      : (authors.get(m.user_id)?.display_name ?? m.user_id.slice(0, 6));
                    const t = new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    const extra =
                      m.attachment_type === "image"
                        ? " [image]"
                        : m.attachment_type === "roblox"
                          ? ` [roblox: ${m.attachment_url}]`
                          : "";
                    return (
                      <div key={m.id} className="flex gap-2 border-b border-border/40 pb-1">
                        <span className="shrink-0 text-muted-foreground">{t}</span>
                        <span className="shrink-0 font-semibold text-primary">{name}:</span>
                        <span className="break-words text-foreground">
                          {m.content}
                          {extra}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {showRobloxShare && (
            <div
              className="absolute inset-0 z-40 grid place-items-center bg-background/70 backdrop-blur-sm p-4"
              onClick={() => setShowRobloxShare(false)}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Gamepad2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Share a Roblox game</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Paste a roblox.com game link.
                    </p>
                  </div>
                </div>
                <label className="text-[11px] font-semibold text-muted-foreground">Game URL</label>
                <input
                  type="url"
                  value={robloxUrl}
                  onChange={(e) => setRobloxUrl(e.target.value)}
                  placeholder="https://www.roblox.com/games/..."
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                />
                <label className="mt-2 block text-[11px] font-semibold text-muted-foreground">
                  Caption (optional, no links)
                </label>
                <input
                  type="text"
                  value={robloxCaption}
                  onChange={(e) => setRobloxCaption(e.target.value.slice(0, 200))}
                  placeholder="Check out my game!"
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowRobloxShare(false);
                      setRobloxUrl("");
                      setRobloxCaption("");
                    }}
                    className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs hover:bg-surface-elevated"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={shareRobloxGame}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" /> Share
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeModeratedText(s: string) {
  return s
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[!1|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z0-9]/g, "");
}

function badgeHelpText() {
  return [
    "Available profile badges:",
    ...PROFILE_BADGES.map((badge) => `• ${badge.id} — ${badge.label}: ${badge.description}`),
    "",
    "How to earn them: finish onboarding, build projects, generate assets, use the UI/image/clothing/3D tools, join Discord, invite friends, or receive staff/community badges when eligible.",
    "Admin usage: /badge @user badge_id",
  ].join("\n");
}

function ChatRulesPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-surface-elevated/98 backdrop-blur-xl">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ScrollText className="h-4 w-4 text-primary" /> Global Chat Rules
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat rules"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
          <div className="flex items-start gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold">Keep Global Chat safe and useful.</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Global Chat is for builders helping builders. Moderation can block unsafe messages
                automatically, and staff can review reports when something slips through.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {CHAT_RULES.map((rule, index) => (
            <div
              key={rule.title}
              className="flex gap-2 rounded-lg border border-border bg-surface/55 p-2.5"
            >
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold">
                  {index + 1}. {rule.title}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {rule.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        <section className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-300">
            <AlertTriangle className="h-4 w-4" /> What happens if you break rules
          </div>
          <div className="space-y-2">
            {CHAT_CONSEQUENCES.map((item) => (
              <div
                key={item.title}
                className="flex gap-2 rounded-lg border border-amber-500/15 bg-background/35 p-2"
              >
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber-500/15 text-amber-300">
                  {item.title.includes("Timeout") ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : item.title.includes("Account") ? (
                    <Ban className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold">{item.title}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-100/75">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-3 rounded-lg border border-border bg-background/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Use <span className="font-mono text-foreground">/report @user reason</span> or the message
          menu to report problems. False reports, dogpiling, and trying to dodge moderation can also
          be moderated.
        </div>
      </div>
    </div>
  );
}

function ChatAvatar({
  isBot,
  author,
  name,
  onClick,
}: {
  isBot: boolean;
  author: Author | null;
  name: string;
  onClick: () => void;
}) {
  if (isBot) {
    return (
      <button
        type="button"
        disabled
        className="grid h-9 w-9 shrink-0 cursor-default place-items-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-primary ring-2 ring-primary/40"
      >
        <img src={bloxbotAvatar} alt="BloxBot" className="h-9 w-9 rounded-full object-cover" />
      </button>
    );
  }

  const pr = presenceFromProfile({
    presence_enabled: author?.presence_enabled,
    presence_status: author?.presence_status,
    last_seen_at: author?.last_seen_at,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-10 w-10 shrink-0 overflow-visible text-[11px] font-bold text-muted-foreground transition hover:scale-105"
      title={name}
    >
      <span className="profile-effect-static absolute inset-0 overflow-hidden rounded-full opacity-70">
        <ProfileEffect
          effect={author?.profile_effect}
          accent={author?.profile_accent}
          className="profile-effect-static"
        />
      </span>
      <AvatarDecoration id={author?.profile_decoration} size={40} animated={false}>
        <PfpRing
          effect={author?.pfp_effect ?? "none"}
          size={34}
          className="relative z-10"
          animated={false}
        >
          {author?.avatar_url ? (
            <img
              src={author.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span>{name.slice(0, 1).toUpperCase()}</span>
          )}
        </PfpRing>
      </AvatarDecoration>
      <span
        className={`absolute bottom-0 right-0 z-20 h-3 w-3 rounded-full border-2 border-surface-elevated ${pr.dot}`}
        title={pr.label}
      />
    </button>
  );
}

function MembersListPanel({
  groups,
  onlineCount,
  onClose,
  onOpenProfile,
  onOpenDm,
}: {
  groups: { label: string; members: { id: string; author: Author; online: boolean }[] }[];
  onlineCount: number;
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenDm: (uid: string) => void;
}) {
  return (
    <div className="absolute inset-x-2 bottom-2 top-[58px] z-30 overflow-hidden rounded-xl border border-border bg-surface-elevated/95 shadow-2xl backdrop-blur-xl md:inset-x-auto md:right-0 md:top-[57px] md:bottom-0 md:w-80 md:rounded-none md:rounded-bl-xl md:border-y-0 md:border-r-0">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <div className="text-sm font-bold">Members</div>
          <div className="text-[10px] text-muted-foreground">{onlineCount} online now</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
          aria-label="Close members"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="h-[calc(100%-49px)] overflow-y-auto px-2 py-3">
        {groups.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No members loaded yet.</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-4">
              <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label} — {group.members.length}
              </div>
              <div className="space-y-1.5">
                {group.members.map((member) => (
                  <MemberCard
                    key={member.id}
                    id={member.id}
                    author={member.author}
                    online={member.online}
                    onOpenProfile={onOpenProfile}
                    onOpenDm={onOpenDm}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function MemberCard({
  id,
  author,
  online,
  onOpenProfile,
  onOpenDm,
}: {
  id: string;
  author: Author;
  online: boolean;
  onOpenProfile: (uid: string) => void;
  onOpenDm: (uid: string) => void;
}) {
  const name = displayAuthorName(author, id);
  const handle = profileHandle(author.username);
  const pr = presenceFromProfile({
    presence_enabled: author.presence_enabled,
    presence_status: author.presence_status,
    last_seen_at: author.last_seen_at,
  });
  const status = author.status_message || (online ? pr.label : "Recently active");
  return (
    <div
      className="group relative overflow-hidden rounded-xl border px-2.5 py-2 transition hover:-translate-y-0.5 hover:border-primary/50"
      style={cardChromeStyle(author.profile_card_color)}
    >
      <ProfileBackground
        id={author.profile_background ?? "none"}
        customUrl={author.custom_background_url}
        className="opacity-45"
      />
      <ProfileCardEffect effect={author.profile_card_effect} color={author.profile_card_color} />
      <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/45 to-transparent" />
      <div className="relative z-10 flex min-w-0 items-center gap-2">
        <ChatAvatar isBot={false} author={author} name={name} onClick={() => onOpenProfile(id)} />
        <button
          type="button"
          onClick={() => onOpenProfile(id)}
          className="min-w-0 flex-1 text-left"
        >
          <div
            className="truncate text-sm font-black leading-tight"
            style={{
              ...gradientTextStyle(author.chat_name_gradient),
              ...chatFontStyle(author.chat_font),
              color: author.chat_name_gradient?.length
                ? undefined
                : (author.profile_accent ?? undefined),
            }}
          >
            {author.chat_icon ? `${author.chat_icon} ` : ""}
            {name}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${online ? pr.dot : "bg-muted-foreground/40"}`}
            />
            <span className="truncate">{status}</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onOpenDm(id)}
          title={`Message ${name}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/45 text-muted-foreground opacity-0 transition hover:border-primary/50 hover:text-primary group-hover:opacity-100"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative z-10 mt-1.5 flex min-w-0 items-center gap-1.5 pl-12">
        <RoleBadges roles={author.roles} size="sm" showLabel />
        <ProfileBadgeRow
          ids={author.profile_badges?.length ? author.profile_badges : author.badges}
          size={17}
          max={4}
        />
        <span className="min-w-0 truncate text-[10px] text-muted-foreground">{handle}</span>
      </div>
    </div>
  );
}

function displayAuthorName(author: Author | null | undefined, id: string) {
  return (
    author?.chat_nickname ||
    author?.display_name ||
    profileHandle(author?.username).slice(1) ||
    id.slice(0, 8)
  );
}

function ReactionSymbol({ value }: { value: string }) {
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

function MsgActions({
  isAdmin,
  isSelf,
  pinned,
  quickReactions,
  onReply,
  onReact,
  onReport,
  onDelete,
  onMute,
  onUnmute,
  onPin,
  onWarn,
}: {
  isAdmin: boolean;
  isSelf: boolean;
  pinned: boolean;
  quickReactions: string[];
  onReply: () => void;
  onReact: (e: string) => void;
  onReport: () => void;
  onDelete: () => void;
  onMute: (min: number | null) => void;
  onUnmute: () => void;
  onPin: () => void;
  onWarn: () => void;
}) {
  const [more, setMore] = useState(false);
  const [pickReact, setPickReact] = useState(false);
  useEffect(() => {
    if (!more && !pickReact) return;
    const close = () => {
      setMore(false);
      setPickReact(false);
    };
    setTimeout(() => window.addEventListener("click", close, { once: true }), 0);
    return () => window.removeEventListener("click", close);
  }, [more, pickReact]);
  return (
    <div
      className="relative ml-auto flex items-center opacity-0 transition group-hover:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setPickReact((v) => !v)}
        className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
        aria-label="React"
      >
        <span className="text-xs">😊</span>
      </button>
      {pickReact && (
        <div className="absolute right-0 top-7 z-50 flex gap-0.5 rounded-lg border border-border bg-surface-elevated p-1 shadow-xl">
          {(quickReactions.length ? quickReactions : QUICK_REACTIONS).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onReact(e);
                setPickReact(false);
              }}
              title={e}
              className="grid h-7 w-7 place-items-center rounded text-base hover:bg-surface"
            >
              <ReactionSymbol value={e} />
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onReply}
        className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
        aria-label="Reply"
      >
        <Reply className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
        aria-label="More"
      >
        <MoreVertical className="h-3 w-3" />
      </button>
      {more && (
        <div className="absolute right-0 top-7 z-50 w-44 overflow-hidden rounded-lg border border-border bg-surface-elevated text-xs shadow-xl">
          {!isSelf && (
            <button
              type="button"
              onClick={() => {
                onReport();
                setMore(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface"
            >
              <Flag className="h-3 w-3" /> Report
            </button>
          )}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  onPin();
                  setMore(false);
                }}
                className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface"
              >
                {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}{" "}
                {pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  setMore(false);
                }}
                className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
              {!isSelf && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onWarn();
                      setMore(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface"
                  >
                    <ShieldAlert className="h-3 w-3" /> Warn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onMute(5);
                      setMore(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface"
                  >
                    <VolumeX className="h-3 w-3" /> Mute 5m
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onMute(60);
                      setMore(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface"
                  >
                    <VolumeX className="h-3 w-3" /> Mute 1h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onMute(null);
                      setMore(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface"
                  >
                    <VolumeX className="h-3 w-3" /> Mute perm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUnmute();
                      setMore(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface"
                  >
                    <Volume2 className="h-3 w-3" /> Unmute
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
