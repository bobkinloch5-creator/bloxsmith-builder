// Shared UI generator constants/types that are safe for both client and server.
// Keep server-only AI/provider code out of React routes and components.

export const UI_CATEGORIES = [
  "Gamepass Shop",
  "Dev Product Shop",
  "Coin Shop",
  "Gem Shop",
  "Main Menu",
  "Title Screen",
  "Pause Menu",
  "Loading Screen",
  "Settings Menu",
  "Inventory",
  "Pet Inventory",
  "Crafting UI",
  "Skill Tree",
  "Battle Pass",
  "Map Vote UI",
  "Dialogue UI",
  "Notification UI",
  "Trading",
  "Daily Rewards",
  "Spin Wheel",
  "Codes Redeem",
  "Quest UI",
  "Teleport UI",
  "Upgrade UI",
  "Rebirth UI",
  "Leaderboard",
  "Admin Panel",
  "Mobile Controls",
  "HUD",
  "Custom",
] as const;

export type UICategory = (typeof UI_CATEGORIES)[number];

export const UI_STYLES = ["Modern", "Neon", "Minimal", "Cartoon", "Glass", "Anime"] as const;
export type UIStyle = (typeof UI_STYLES)[number];
