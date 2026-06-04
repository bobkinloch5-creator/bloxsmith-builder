// BloxSmith custom emote registry. Use `:name:` in chat to render.
import mascot from "@/assets/emotes/blox-mascot.png";
import happy from "@/assets/emotes/blox-happy.png";
import cool from "@/assets/emotes/blox-cool.png";
import love from "@/assets/emotes/blox-love.png";
import fire from "@/assets/emotes/blox-fire.png";
import sad from "@/assets/emotes/blox-sad.png";
import party from "@/assets/emotes/blox-party.png";
import gg from "@/assets/emotes/blox-gg.png";

export type EmoteCategory = "BloxBot" | "Builder" | "Roblox" | "Status" | "Reactions" | "Fun";

export type Emote = {
  name: string;
  src?: string;
  emoji?: string;
  label: string;
  category: EmoteCategory;
  aliases?: string[];
};

export const EMOTE_CATEGORIES: EmoteCategory[] = [
  "BloxBot",
  "Builder",
  "Roblox",
  "Status",
  "Reactions",
  "Fun",
];

export const EMOTES: Emote[] = [
  { name: "blox", src: mascot, label: "BloxBot", category: "BloxBot", aliases: ["bloxbot"] },
  {
    name: "blox_happy",
    src: happy,
    label: "Happy BloxBot",
    category: "BloxBot",
    aliases: ["happy"],
  },
  { name: "blox_cool", src: cool, label: "Cool BloxBot", category: "BloxBot", aliases: ["cool"] },
  { name: "blox_love", src: love, label: "Love BloxBot", category: "BloxBot", aliases: ["love"] },
  { name: "blox_fire", src: fire, label: "Fire BloxBot", category: "BloxBot", aliases: ["fire"] },
  { name: "blox_sad", src: sad, label: "Sad BloxBot", category: "BloxBot", aliases: ["sad"] },
  {
    name: "blox_party",
    src: party,
    label: "Party BloxBot",
    category: "BloxBot",
    aliases: ["party"],
  },
  { name: "blox_gg", src: gg, label: "GG BloxBot", category: "BloxBot", aliases: ["gg"] },
  { name: "blox_wave", src: mascot, label: "BloxBot Wave", category: "BloxBot", aliases: ["wave"] },
  {
    name: "blox_think",
    src: cool,
    label: "BloxBot Think",
    category: "BloxBot",
    aliases: ["think"],
  },
  {
    name: "blox_build",
    src: fire,
    label: "BloxBot Build",
    category: "BloxBot",
    aliases: ["build"],
  },
  { name: "blox_win", src: party, label: "BloxBot Win", category: "BloxBot", aliases: ["win"] },
  { name: "blox_oof", src: sad, label: "BloxBot Oof", category: "BloxBot", aliases: ["oof"] },

  { name: "studio", emoji: "🧱", label: "Studio", category: "Builder", aliases: ["brick"] },
  { name: "script", emoji: "📜", label: "Script", category: "Builder", aliases: ["code"] },
  { name: "remote", emoji: "📡", label: "Remote", category: "Builder", aliases: ["event"] },
  { name: "module", emoji: "🧩", label: "Module", category: "Builder" },
  { name: "datastore", emoji: "💾", label: "DataStore", category: "Builder", aliases: ["save"] },
  { name: "ui", emoji: "🖥️", label: "UI", category: "Builder", aliases: ["gui"] },
  { name: "bugfix", emoji: "🛠️", label: "Bug Fix", category: "Builder", aliases: ["fix"] },
  { name: "publish", emoji: "🚀", label: "Publish", category: "Builder" },

  { name: "robux", emoji: "💚", label: "Robux", category: "Roblox" },
  { name: "obby", emoji: "🟩", label: "Obby", category: "Roblox" },
  { name: "tycoon", emoji: "🏭", label: "Tycoon", category: "Roblox" },
  { name: "sword", emoji: "⚔️", label: "Sword", category: "Roblox" },
  { name: "pet", emoji: "🐾", label: "Pet", category: "Roblox" },
  { name: "tower", emoji: "🏰", label: "Tower", category: "Roblox" },
  { name: "racing", emoji: "🏁", label: "Racing", category: "Roblox" },
  { name: "sim", emoji: "🎮", label: "Simulator", category: "Roblox" },

  { name: "online", emoji: "🟢", label: "Online", category: "Status" },
  { name: "idle", emoji: "🟡", label: "Idle", category: "Status" },
  { name: "dnd", emoji: "⛔", label: "Do Not Disturb", category: "Status" },
  { name: "verified", emoji: "✅", label: "Verified", category: "Status" },
  { name: "owner", emoji: "👑", label: "Owner", category: "Status" },
  { name: "staff", emoji: "🛡️", label: "Staff", category: "Status" },
  { name: "boost", emoji: "✨", label: "Boost", category: "Status" },
  { name: "credits", emoji: "∞", label: "Credits", category: "Status" },

  { name: "yes", emoji: "👍", label: "Yes", category: "Reactions" },
  { name: "no", emoji: "👎", label: "No", category: "Reactions" },
  { name: "heart", emoji: "❤️", label: "Heart", category: "Reactions" },
  { name: "laugh", emoji: "😂", label: "Laugh", category: "Reactions" },
  { name: "hype", emoji: "🔥", label: "Hype", category: "Reactions" },
  { name: "eyes", emoji: "👀", label: "Eyes", category: "Reactions" },
  { name: "party", emoji: "🎉", label: "Party", category: "Reactions" },
  { name: "hundred", emoji: "💯", label: "100", category: "Reactions" },

  { name: "pizza", emoji: "🍕", label: "Pizza", category: "Fun" },
  { name: "coffee", emoji: "☕", label: "Coffee", category: "Fun" },
  { name: "music", emoji: "🎵", label: "Music", category: "Fun" },
  { name: "star", emoji: "⭐", label: "Star", category: "Fun" },
  { name: "sparkle", emoji: "🌟", label: "Sparkle", category: "Fun" },
  { name: "brain", emoji: "🧠", label: "Brain", category: "Fun" },
  { name: "gem", emoji: "💎", label: "Gem", category: "Fun" },
  { name: "trophy", emoji: "🏆", label: "Trophy", category: "Fun" },
];

export const EMOTE_MAP: Record<string, Emote> = Object.fromEntries(
  EMOTES.flatMap((e) => [[e.name, e], ...(e.aliases ?? []).map((alias) => [alias, e])]),
);

export const EMOTE_TOKEN_RE = /:([a-z][a-z0-9_]{1,24}):/gi;

export const MASCOT_SRC = mascot;

export function isEmoteToken(value: string) {
  const match = /^:([a-z][a-z0-9_]{1,24}):$/i.exec(value.trim());
  return match ? EMOTE_MAP[match[1].toLowerCase()] : null;
}
