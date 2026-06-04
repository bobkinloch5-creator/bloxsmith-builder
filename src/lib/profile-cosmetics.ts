export const RESERVED_CHAT_ICON_IDS = ["crown"] as const;

export const RESERVED_PROFILE_DECORATION_IDS = [
  "crown",
  "cosmic_crown",
  "coin_crown",
  "royal_wings",
] as const;

const RESERVED_CHAT_ICON_SET = new Set<string>(RESERVED_CHAT_ICON_IDS);
const RESERVED_PROFILE_DECORATION_SET = new Set<string>(RESERVED_PROFILE_DECORATION_IDS);

export function canUseReservedCosmetics(roles: readonly string[] | null | undefined) {
  return !!roles?.some((role) => role === "owner" || role === "admin");
}

export function isReservedChatIcon(id: unknown) {
  return typeof id === "string" && RESERVED_CHAT_ICON_SET.has(id);
}

export function isReservedProfileDecoration(id: unknown) {
  return typeof id === "string" && RESERVED_PROFILE_DECORATION_SET.has(id);
}
