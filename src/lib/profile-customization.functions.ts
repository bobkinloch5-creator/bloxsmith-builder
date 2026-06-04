import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  PROFILE_BADGE_IDS,
  normalizeProfileBadgeIds,
  roleProfileBadgeIds,
  selectableProfileBadgeIds,
  ProfileBadgeId,
} from "@/lib/profile-badges";
import { isValidProfileUsername, normalizeProfileUsername } from "@/lib/profile-username";
import {
  canUseReservedCosmetics,
  isReservedChatIcon,
  isReservedProfileDecoration,
} from "@/lib/profile-cosmetics";

const HEX = /^#[0-9a-fA-F]{6}$/;
const PROFILE_EFFECT_IDS = [
  "none",
  "sparkle",
  "aurora",
  "neon",
  "holographic",
  "confetti",
  "stars",
  "comet",
  "runes",
  "spotlight",
] as const;
const PROFILE_BACKGROUND_IDS = [
  "none",
  "custom",
  "studio",
  "neon-city",
  "obby",
  "forest",
  "space",
  "lava",
  "clouds",
  "void",
  "sunset",
  "ocean",
  "candy",
  "matrix",
  "futuristic",
  "simulator",
  "tycoon",
  "anime",
  "fantasy",
  "city",
  "neon",
  "dark",
  "premium",
] as const;
const PFP_EFFECT_IDS = [
  "none",
  "gold",
  "rainbow",
  "flame",
  "electric",
  "ice",
  "galaxy",
  "rose",
] as const;
const PROFILE_DECORATION_IDS = [
  "none",
  "top_hat",
  "halo",
  "crown",
  "devil_horns",
  "headphones",
  "flower_crown",
  "wings",
  "snowflake",
  "santa",
  "party",
  "ninja",
  "witch",
  "neon_ring",
  "pumpkin",
  "cyber_visor",
  "bunny_ears",
  "cosmic_crown",
  "plasma_halo",
  "royal_wings",
  "lightning_aura",
  "crystal_spikes",
  "orbit",
  "flame_aura",
  "star_shower",
  "glitch_frame",
  "heart_aura",
  "coin_crown",
  "builder_goggles",
] as const;
const PROFILE_CARD_EFFECT_IDS = [
  "none",
  "soft_glow",
  "aurora_edge",
  "premium_shine",
  "scanline",
  "starfield",
  "pixel_rain",
] as const;
const CHAT_ICON_IDS = [
  "sparkles",
  "star",
  "crown",
  "flame",
  "heart",
  "leaf",
  "zap",
  "moon",
  "sun",
  "rocket",
  "gem",
  "trophy",
  "music",
  "gamepad",
  "cake",
  "coffee",
  "sailboat",
  "mountain",
  "cloud",
  "snowflake",
  "paw",
  "anchor",
] as const;
const CHAT_FONT_IDS = [
  "sans",
  "serif",
  "mono",
  "rounded",
  "display",
  "handwritten",
  "futuristic",
  "elegant",
] as const;
const HEX_ARRAY = z.array(z.string().regex(HEX)).min(1).max(4);
const Schema = z
  .object({
    display_name: z.string().min(1).max(64).optional().nullable(),
    username: z.string().min(2).max(32).optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    pronouns: z.string().max(32).optional().nullable(),
    location: z.string().max(64).optional().nullable(),
    status_message: z.string().max(100).optional().nullable(),
    banner_url: z.string().url().max(4096).optional().nullable(),
    avatar_url: z.string().url().max(4096).optional().nullable(),
    chat_name_gradient: HEX_ARRAY.optional().nullable(),
    chat_text_gradient: HEX_ARRAY.optional().nullable(),
    chat_icon: z.enum(CHAT_ICON_IDS).optional().nullable(),
    chat_nickname: z
      .string()
      .max(24)
      .regex(/^[A-Za-z0-9 _.\-]*$/)
      .optional()
      .nullable(),
    chat_font: z.enum(CHAT_FONT_IDS).optional().nullable(),
    profile_accent: z.string().regex(HEX).optional().nullable(),
    profile_card_color: z.string().regex(HEX).optional().nullable(),
    profile_card_effect: z.enum(PROFILE_CARD_EFFECT_IDS).optional().nullable(),
    profile_effect: z.enum(PROFILE_EFFECT_IDS).optional().nullable(),
    profile_background: z.enum(PROFILE_BACKGROUND_IDS).optional().nullable(),
    custom_background_url: z.string().url().max(4096).optional().nullable(),
    profile_layout: z.enum(["classic", "card", "cinematic", "compact"]).optional(),
    pfp_effect: z.enum(PFP_EFFECT_IDS).optional(),
    private_profile: z.boolean().optional(),
    hide_email: z.boolean().optional(),
    presence_enabled: z.boolean().optional(),
    show_activity: z.boolean().optional(),
    presence_status: z.enum(["online", "idle", "dnd", "invisible"]).optional(),
    profile_badges: z
      .array(z.enum(PROFILE_BADGE_IDS))
      .max(12)
      .transform((ids) => Array.from(new Set(ids)))
      .optional(),
    profile_decoration: z.enum(PROFILE_DECORATION_IDS).optional(),
  })
  .strict();

function isMissingColumnError(error: any) {
  const code = error?.code;
  const message = String(error?.message ?? "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(message)
  );
}

type SavedProfile = {
  display_name: string | null;
  username: string | null;
  bio: string | null;
  pronouns: string | null;
  location: string | null;
  status_message: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  chat_name_gradient: string[] | null;
  chat_text_gradient: string[] | null;
  chat_icon: string | null;
  chat_nickname: string | null;
  chat_font: string | null;
  profile_accent: string | null;
  profile_card_color: string | null;
  profile_card_effect: string | null;
  profile_effect: string | null;
  profile_background: string | null;
  custom_background_url: string | null;
  profile_layout: string | null;
  pfp_effect: string | null;
  private_profile: boolean;
  hide_email: boolean;
  presence_enabled: boolean;
  show_activity: boolean;
  presence_status: string | null;
  profile_badges: string[];
  profile_decoration: string | null;
};

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function stringArrayOrNull(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null;
}

function toSavedProfile(row: any): SavedProfile | null {
  if (!row) return null;
  return {
    display_name: textOrNull(row.display_name),
    username: textOrNull(row.username),
    bio: textOrNull(row.bio),
    pronouns: textOrNull(row.pronouns),
    location: textOrNull(row.location),
    status_message: textOrNull(row.status_message),
    banner_url: textOrNull(row.banner_url),
    avatar_url: textOrNull(row.avatar_url),
    chat_name_gradient: stringArrayOrNull(row.chat_name_gradient),
    chat_text_gradient: stringArrayOrNull(row.chat_text_gradient),
    chat_icon: textOrNull(row.chat_icon),
    chat_nickname: textOrNull(row.chat_nickname),
    chat_font: textOrNull(row.chat_font),
    profile_accent: textOrNull(row.profile_accent),
    profile_card_color: textOrNull(row.profile_card_color),
    profile_card_effect: textOrNull(row.profile_card_effect),
    profile_effect: textOrNull(row.profile_effect),
    profile_background: textOrNull(row.profile_background),
    custom_background_url: textOrNull(row.custom_background_url),
    profile_layout: textOrNull(row.profile_layout),
    pfp_effect: textOrNull(row.pfp_effect),
    private_profile: row.private_profile === true,
    hide_email: row.hide_email !== false,
    presence_enabled: row.presence_enabled !== false,
    show_activity: row.show_activity !== false,
    presence_status: textOrNull(row.presence_status),
    profile_badges: stringArrayOrNull(row.profile_badges) ?? [],
    profile_decoration: textOrNull(row.profile_decoration),
  };
}

export const updateProfileCustomization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await (supabase as any).rpc("ensure_my_profile");
    // Strip undefined so we only update fields the caller actually sent.
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    let roleList: string[] | null = null;
    async function getRoleList() {
      if (roleList) return roleList;
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      roleList = ((roles ?? []) as { role: string }[]).map((row) => row.role);
      return roleList;
    }

    if (patch.username !== undefined) {
      const username = normalizeProfileUsername(patch.username);
      if (!isValidProfileUsername(username)) {
        throw new Error(
          "Username must be 2-32 characters using letters, numbers, underscores, or dots.",
        );
      }

      const { data: existingUsername, error: usernameError } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("username_normalized", username)
        .neq("id", userId)
        .maybeSingle();

      if (usernameError && !isMissingColumnError(usernameError)) {
        throw new Error(usernameError.message);
      }
      if (existingUsername?.id) {
        throw new Error("That username is already taken.");
      }

      patch.username = username;
      patch.username_normalized = username;
    }

    if (
      patch.chat_icon !== undefined &&
      typeof patch.chat_icon === "string" &&
      isReservedChatIcon(patch.chat_icon)
    ) {
      const roles = await getRoleList();
      if (!canUseReservedCosmetics(roles)) {
        throw new Error("The crown chat icon is reserved for owners/admins.");
      }
    }

    if (
      patch.profile_decoration !== undefined &&
      isReservedProfileDecoration(patch.profile_decoration)
    ) {
      const roles = await getRoleList();
      if (!canUseReservedCosmetics(roles)) {
        throw new Error("That profile decoration is reserved for owners/admins.");
      }
    }

    if (patch.profile_badges !== undefined) {
      const [roles, { data: existingProfile }] = await Promise.all([
        getRoleList(),
        (supabase as any).from("profiles").select("profile_badges").eq("id", userId).single(),
      ]);
      const preservedEarned = normalizeProfileBadgeIds(existingProfile?.profile_badges).filter(
        (id: ProfileBadgeId) => !selectableProfileBadgeIds([id]).includes(id),
      );
      patch.profile_badges = Array.from(
        new Set([
          ...preservedEarned,
          ...selectableProfileBadgeIds(patch.profile_badges),
          ...roleProfileBadgeIds(roles),
        ]),
      ).slice(0, 12);
    }

    let row: any = null;
    let error: any = null;
    // Up to a few attempts: if the live DB is missing a column the app writes,
    // Postgres rejects the whole UPDATE (code 42703). Rather than losing every
    // change the user made, drop the unknown column and retry with the rest.
    const droppedColumns: string[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await (supabase as any)
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select("*")
        .single();
      row = res.data;
      error = res.error;
      if (!error) break;

      const message = String(error.message ?? "");
      if (!isMissingColumnError(error)) break;

      // Identify the offending column from the error and remove it.
      const match = message.match(/column "?([a-z_]+)"?/i) || message.match(/'([a-z_]+)' column/i);
      const col = match?.[1];
      if (!col || !(col in patch)) break;
      delete patch[col];
      droppedColumns.push(col);
      if (Object.keys(patch).length === 0) {
        error = null;
        break;
      }
    }

    if (error) {
      console.error("[updateProfileCustomization] update failed", {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
        sentBadges: patch.profile_badges,
        sentDecoration: patch.profile_decoration,
      });
      throw new Error(error.message);
    }

    if (droppedColumns.length > 0) {
      // Surface this clearly: the save mostly succeeded but the database is
      // behind on a migration, so a few fields could not be stored.
      console.error("[updateProfileCustomization] skipped columns missing from DB", droppedColumns);
      return {
        ok: true,
        profile: toSavedProfile(row),
        warning: `Saved, but these fields aren't available yet: ${droppedColumns.join(", ")}. A database migration is pending.`,
      };
    }

    // If badges/decoration didn't actually persist, retry them in isolation
    // so a single bad value on another field can't silently strip them.
    const mismatch =
      (patch.profile_badges !== undefined &&
        JSON.stringify(row?.profile_badges ?? []) !== JSON.stringify(patch.profile_badges)) ||
      (patch.profile_decoration !== undefined &&
        row?.profile_decoration !== patch.profile_decoration);

    if (mismatch) {
      console.warn("[updateProfileCustomization] persistence mismatch — retrying", {
        sentBadges: patch.profile_badges,
        gotBadges: row?.profile_badges,
        sentDecoration: patch.profile_decoration,
        gotDecoration: row?.profile_decoration,
      });
      const fb: Record<string, unknown> = {};
      if (patch.profile_badges !== undefined) fb.profile_badges = patch.profile_badges;
      if (patch.profile_decoration !== undefined) fb.profile_decoration = patch.profile_decoration;
      const { error: e2 } = await (supabase as any).from("profiles").update(fb).eq("id", userId);
      if (e2) {
        console.error("[updateProfileCustomization] fallback failed", e2);
        throw new Error(e2.message);
      }
      const refreshed = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!refreshed.error) row = refreshed.data;
    }

    return { ok: true, profile: toSavedProfile(row) };
  });
