import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "BLOX-";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function fetchRobloxUserIdByName(username: string): Promise<{
  id: number;
  name: string;
  displayName: string;
} | null> {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{ id: number; name: string; displayName: string }>;
  };
  const hit = json.data?.[0];
  return hit ? { id: hit.id, name: hit.name, displayName: hit.displayName } : null;
}

async function fetchRobloxUser(id: number): Promise<{
  description: string;
  name: string;
  displayName: string;
} | null> {
  const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
  if (!res.ok) return null;
  return (await res.json()) as { description: string; name: string; displayName: string };
}

async function fetchAvatarHeadshot(id: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ imageUrl?: string }> };
    return json.data?.[0]?.imageUrl ?? null;
  } catch {
    return null;
  }
}

export const startRobloxLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ username: z.string().min(3).max(20).regex(/^[A-Za-z0-9_]+$/) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const lookup = await fetchRobloxUserIdByName(data.username);
    if (!lookup) throw new Error("Roblox username not found");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("roblox_user_id", lookup.id)
      .neq("id", userId)
      .maybeSingle();
    if (existing) throw new Error("This Roblox account is already linked to another BloxSmith user.");

    const code = makeCode();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error } = await (supabaseAdmin as any)
      .from("private_user_data")
      .upsert(
        {
          user_id: userId,
          roblox_verification_code: code,
          roblox_verification_expires_at: expires,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    return {
      code,
      expiresAt: expires,
      robloxUserId: lookup.id,
      robloxUsername: lookup.name,
      robloxDisplayName: lookup.displayName,
      profileUrl: `https://www.roblox.com/users/${lookup.id}/profile`,
    };
  });

export const confirmRobloxLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ username: z.string().min(3).max(20).regex(/^[A-Za-z0-9_]+$/) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: privateRow, error: pErr } = await (supabaseAdmin as any)
      .from("private_user_data")
      .select("roblox_verification_code, roblox_verification_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const code = privateRow?.roblox_verification_code as string | undefined;
    if (!code) throw new Error("No pending verification. Start linking first.");
    if (
      privateRow?.roblox_verification_expires_at &&
      new Date(privateRow.roblox_verification_expires_at).getTime() < Date.now()
    ) {
      throw new Error("Verification code expired. Please start again.");
    }

    const lookup = await fetchRobloxUserIdByName(data.username);
    if (!lookup) throw new Error("Roblox username not found");

    const user = await fetchRobloxUser(lookup.id);
    if (!user) throw new Error("Could not fetch the Roblox profile. Try again in a moment.");

    if (!user.description || !user.description.includes(code)) {
      throw new Error(
        "Verification code not found in your Roblox profile description. Paste the code into your Roblox About section and try again.",
      );
    }

    const { data: dup } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("roblox_user_id", lookup.id)
      .neq("id", userId)
      .maybeSingle();
    if (dup) throw new Error("This Roblox account is already linked to another BloxSmith user.");

    const avatar = await fetchAvatarHeadshot(lookup.id);

    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .update({
        roblox_user_id: lookup.id,
        roblox_username: lookup.name,
        roblox_display_name: lookup.displayName,
        roblox_avatar_url: avatar,
        roblox_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (uErr) throw new Error(uErr.message);

    // Clear the verification code from private storage
    await (supabaseAdmin as any)
      .from("private_user_data")
      .update({
        roblox_verification_code: null,
        roblox_verification_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return {
      ok: true as const,
      robloxUserId: lookup.id,
      robloxUsername: lookup.name,
      robloxDisplayName: lookup.displayName,
      robloxAvatarUrl: avatar,
      profileUrl: `https://www.roblox.com/users/${lookup.id}/profile`,
    };
  });

export const unlinkRoblox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        roblox_user_id: null,
        roblox_username: null,
        roblox_display_name: null,
        roblox_avatar_url: null,
        roblox_verified_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any)
      .from("private_user_data")
      .update({
        roblox_verification_code: null,
        roblox_verification_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return { ok: true as const };
  });

export const getRobloxLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "roblox_user_id, roblox_username, roblox_display_name, roblox_avatar_url, roblox_verified_at",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.roblox_user_id) return { linked: false as const };
    return {
      linked: true as const,
      robloxUserId: Number(data.roblox_user_id),
      robloxUsername: data.roblox_username,
      robloxDisplayName: data.roblox_display_name,
      robloxAvatarUrl: data.roblox_avatar_url,
      verifiedAt: data.roblox_verified_at,
      profileUrl: `https://www.roblox.com/users/${data.roblox_user_id}/profile`,
    };
  });
