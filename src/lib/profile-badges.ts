export const PROFILE_BADGE_IDS = [
  "founder",
  "early",
  "developer",
  "verified",
  "supporter",
  "booster",
  "legend",
  "creator",
  "translator",
  "bug_hunter",
  "staff",
  "moderator",
  "og",
  "nitro",
  "active",
  "explorer",
  "artist",
  "scripter",
  "onboarding",
  "asset_smith",
  "model_maker",
  "ui_architect",
  "image_artist",
  "clothier",
  "inviter",
  "project_milestone",
  "credit_milestone",
] as const;

export type ProfileBadgeId = (typeof PROFILE_BADGE_IDS)[number];

export const LOCKED_PROFILE_BADGE_IDS = [
  "founder",
  "verified",
  "staff",
  "moderator",
  "onboarding",
  "asset_smith",
  "model_maker",
  "ui_architect",
  "image_artist",
  "clothier",
  "inviter",
  "project_milestone",
  "credit_milestone",
] as const satisfies readonly ProfileBadgeId[];

export const SELECTABLE_PROFILE_BADGE_IDS = PROFILE_BADGE_IDS.filter(
  (id) => !LOCKED_PROFILE_BADGE_IDS.includes(id as (typeof LOCKED_PROFILE_BADGE_IDS)[number]),
) as ProfileBadgeId[];

const BADGE_ID_SET = new Set<string>(PROFILE_BADGE_IDS);
const SELECTABLE_BADGE_ID_SET = new Set<string>(SELECTABLE_PROFILE_BADGE_IDS);

export function normalizeProfileBadgeIds(ids: unknown, max = 12): ProfileBadgeId[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.map(String)))
    .filter((id): id is ProfileBadgeId => BADGE_ID_SET.has(id))
    .slice(0, max);
}

export function selectableProfileBadgeIds(ids: unknown, max = 12): ProfileBadgeId[] {
  return normalizeProfileBadgeIds(ids, max).filter((id) => SELECTABLE_BADGE_ID_SET.has(id));
}

export function roleProfileBadgeIds(roles: readonly string[] | null | undefined): ProfileBadgeId[] {
  const set = new Set((roles ?? []).map(String));
  const ids: ProfileBadgeId[] = [];
  if (set.has("owner")) ids.push("founder");
  if (set.has("owner") || set.has("admin")) ids.push("staff");
  if (set.has("moderator")) ids.push("moderator");
  if (set.has("owner") || set.has("admin") || set.has("moderator")) ids.push("verified");
  return ids;
}

export function activityProfileBadgeIds(input: {
  projectCount?: number | null;
  creditsUsed?: number | null;
  usageSources?: readonly string[] | null;
  model3dCount?: number | null;
  discordClaimed?: boolean | null;
  referredBy?: string | null;
  onboardingCompleted?: boolean | null;
  credits?: number | null;
}): ProfileBadgeId[] {
  const sources = new Set((input.usageSources ?? []).map((source) => String(source).toLowerCase()));
  const ids: ProfileBadgeId[] = [];
  if (input.onboardingCompleted) ids.push("onboarding");
  if ((input.projectCount ?? 0) > 0) ids.push("creator");
  if ((input.projectCount ?? 0) >= 3) ids.push("developer", "project_milestone");
  if ((input.creditsUsed ?? 0) > 0) ids.push("active", "asset_smith");
  if ((input.creditsUsed ?? 0) >= 25) ids.push("scripter", "credit_milestone");
  if ((input.model3dCount ?? 0) > 0) ids.push("model_maker");
  if (sources.has("ui_generator") || sources.has("template_install")) ids.push("ui_architect");
  if (sources.has("image_generator") || sources.has("image_studio")) ids.push("image_artist", "artist");
  if (sources.has("clothing")) ids.push("clothier");
  if (input.discordClaimed) ids.push("booster");
  if (input.referredBy) ids.push("inviter");
  if ((input.credits ?? 0) > 0) ids.push("supporter");
  return Array.from(new Set(ids));
}

export function mergeProfileBadgeIds(
  ids: Array<string | null | undefined>,
  max = 12,
): ProfileBadgeId[] {
  return normalizeProfileBadgeIds(ids.filter(Boolean), max);
}
