import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Resolves a Roblox user by ID, returning profile + headshot + best-effort presence.
 * Presence often requires an auth cookie; we degrade gracefully when it doesn't.
 */
export const getRobloxPresence = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ userId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { userId } = data;
    const out: {
      userId: number;
      username: string | null;
      displayName: string | null;
      headshotUrl: string | null;
      avatarUrl: string | null;
      profileUrl: string;
      presence: {
        type: "offline" | "online" | "in-game" | "in-studio" | "invisible" | null;
        lastOnline: string | null;
        lastLocation: string | null;
        gameId: number | null;
        placeId: number | null;
        rootPlaceId: number | null;
        universeId: number | null;
      };
      thumbnail: { gameThumbnailUrl: string | null };
      error: string | null;
    } = {
      userId,
      username: null,
      displayName: null,
      headshotUrl: null,
      avatarUrl: null,
      profileUrl: `https://www.roblox.com/users/${userId}/profile`,
      presence: {
        type: null,
        lastOnline: null,
        lastLocation: null,
        gameId: null,
        placeId: null,
        rootPlaceId: null,
        universeId: null,
      },
      thumbnail: { gameThumbnailUrl: null },
      error: null,
    };

    const cookie = process.env.ROBLOX_COOKIE;

    try {
      // 1. Profile
      const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
      if (userRes.ok) {
        const u = (await userRes.json()) as { name?: string; displayName?: string };
        out.username = u.name ?? null;
        out.displayName = u.displayName ?? null;
      }

      // 2. Headshot + bust avatar
      const thumbRes = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      );
      if (thumbRes.ok) {
        const t = (await thumbRes.json()) as { data?: Array<{ imageUrl?: string }> };
        out.headshotUrl = t.data?.[0]?.imageUrl ?? null;
      }
      const fullRes = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
      );
      if (fullRes.ok) {
        const t = (await fullRes.json()) as { data?: Array<{ imageUrl?: string }> };
        out.avatarUrl = t.data?.[0]?.imageUrl ?? null;
      }

      // 3. Presence (requires cookie since 2022)
      const presenceRes = await fetch("https://presence.roblox.com/v1/presence/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: `.ROBLOSECURITY=${cookie}` } : {}),
        },
        body: JSON.stringify({ userIds: [userId] }),
      });
      if (presenceRes.ok) {
        const j = (await presenceRes.json()) as {
          userPresences?: Array<{
            userPresenceType?: number;
            lastLocation?: string;
            lastOnline?: string;
            gameId?: number | null;
            placeId?: number | null;
            rootPlaceId?: number | null;
            universeId?: number | null;
          }>;
        };
        const p = j.userPresences?.[0];
        if (p) {
          const map = ["offline", "online", "in-game", "in-studio", "invisible"] as const;
          out.presence.type = map[p.userPresenceType ?? 0] ?? null;
          out.presence.lastOnline = p.lastOnline ?? null;
          out.presence.lastLocation = p.lastLocation ?? null;
          out.presence.gameId = p.gameId ?? null;
          out.presence.placeId = p.placeId ?? null;
          out.presence.rootPlaceId = p.rootPlaceId ?? null;
          out.presence.universeId = p.universeId ?? null;

          // 4. Game thumbnail if in-game
          if (out.presence.universeId) {
            const gt = await fetch(
              `https://thumbnails.roblox.com/v1/games/icons?universeIds=${out.presence.universeId}&size=150x150&format=Png&isCircular=false`,
            );
            if (gt.ok) {
              const gj = (await gt.json()) as { data?: Array<{ imageUrl?: string }> };
              out.thumbnail.gameThumbnailUrl = gj.data?.[0]?.imageUrl ?? null;
            }
          }
        }
      } else if (!cookie) {
        out.error = "presence_unavailable";
      }
    } catch (e) {
      out.error = e instanceof Error ? e.message : "unknown_error";
    }

    return out;
  });
