import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PublicProfileSchema = z.object({
  userId: z.string().uuid(),
});

export const getPublicUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PublicProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const viewerId = context.userId;
    const requestedId = data.userId;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id,user_id,display_name,username,chat_nickname,avatar_url,bio,roblox_user_id,roblox_username,roblox_avatar_url,banner_url,private_profile,profile_accent,profile_card_color,profile_card_effect,profile_effect,profile_background,custom_background_url,pfp_effect,status_message,pronouns,location,presence_enabled,presence_status,last_seen_at,show_activity,current_activity,profile_badges,profile_decoration,favorite_game_types",
      )
      .or(`id.eq.${requestedId},user_id.eq.${requestedId}`)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) {
      return {
        profile: null,
        targetUserId: requestedId,
        roles: [],
        friend: null,
        followerCount: 0,
        isFollowing: false,
        isBlocked: false,
        achievements: [],
        level: null,
        gameCreations: [],
      };
    }

    const targetUserId = (profile as any).user_id ?? profile.id ?? requestedId;
    const [
      friendRes,
      rolesRes,
      followerRes,
      myFollowRes,
      myBlockRes,
      achievementsRes,
      levelRes,
      defsRes,
      showcaseRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("friend_requests")
        .select("id,requester_id,addressee_id,status")
        .or(
          `and(requester_id.eq.${viewerId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${viewerId})`,
        )
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", targetUserId),
      supabaseAdmin
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", targetUserId),
      supabaseAdmin
        .from("user_follows")
        .select("follower_id")
        .eq("follower_id", viewerId)
        .eq("following_id", targetUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_blocks")
        .select("blocker_id")
        .eq("blocker_id", viewerId)
        .eq("blocked_id", targetUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_achievements")
        .select("achievement_key, unlocked_at")
        .eq("user_id", targetUserId)
        .order("unlocked_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("user_levels").select("level,xp").eq("user_id", targetUserId).maybeSingle(),
      supabaseAdmin.from("achievements").select("key,name,icon,xp_reward"),
      supabaseAdmin
        .from("projects")
        .select("id,name,showcase_title,showcase_thumbnail_url,showcase_likes_count,game_type")
        .eq("user_id", targetUserId)
        .eq("showcase_published", true)
        .order("showcase_published_at", { ascending: false })
        .limit(6),
    ]);

    const friend = friendRes.data ?? null;
    const isFriend = (friend as any)?.status === "accepted";
    const isSelf = viewerId === targetUserId || viewerId === profile.id;
    const privateRestricted = Boolean((profile as any).private_profile && !isSelf && !isFriend);
    const safeProfile = privateRestricted
      ? {
          ...profile,
          bio: null,
          roblox_user_id: null,
          roblox_username: null,
          roblox_avatar_url: null,
          status_message: null,
          pronouns: null,
          location: null,
          presence_enabled: false,
          presence_status: "invisible",
          show_activity: false,
          current_activity: null,
          profile_badges: null,
          favorite_game_types: null,
        }
      : profile;

    const defMap = new Map<string, { name: string; icon: string | null; xp_reward: number | null }>();
    ((defsRes.data ?? []) as any[]).forEach((d) =>
      defMap.set(d.key, { name: d.name, icon: d.icon, xp_reward: d.xp_reward }),
    );

    return {
      profile: safeProfile,
      targetUserId,
      roles: ((rolesRes.data ?? []) as any[]).map((row) => row.role),
      friend,
      followerCount: followerRes.count ?? 0,
      isFollowing: !!myFollowRes.data,
      isBlocked: !!myBlockRes.data,
      achievements: privateRestricted ? [] : ((achievementsRes.data ?? []) as any[]).map((row) => {
        const def = defMap.get(row.achievement_key);
        return {
          key: row.achievement_key as string,
          name: def?.name ?? row.achievement_key,
          icon: def?.icon ?? null,
          xp_reward: def?.xp_reward ?? null,
          unlocked_at: row.unlocked_at as string,
        };
      }),
      level: privateRestricted
        ? null
        : levelRes.data
        ? { level: (levelRes.data as any).level ?? 1, xp: (levelRes.data as any).xp ?? 0 }
        : null,
      gameCreations: privateRestricted ? [] : ((showcaseRes.data ?? []) as any[]).map((project) => ({
        id: project.id,
        title: project.showcase_title || project.name,
        thumbnail: project.showcase_thumbnail_url ?? null,
        likes: project.showcase_likes_count ?? 0,
        gameType: project.game_type ?? "Unknown",
      })),
    };
  });
