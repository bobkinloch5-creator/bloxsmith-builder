import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import crypto from "crypto";

const Schema = z.object({
  fingerprint: z.string().min(8).max(100000),
});

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getClientIp(req: Request): string | null {
  const h = req.headers;
  const candidates = [
    h.get("cf-connecting-ip"),
    h.get("x-real-ip"),
    h.get("x-forwarded-for")?.split(",")[0]?.trim(),
  ].filter(Boolean) as string[];
  return candidates[0] ?? null;
}

/**
 * Records this auth session's device fingerprint + IP. If either already
 * belongs to a DIFFERENT user account, the new (just-signed-in) account
 * is deleted and an error is thrown — enforcing 1 account per user.
 */
export const recordAndEnforceSingleAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const req = getRequest();
    const userAgent = req.headers.get("user-agent") ?? null;
    const ip = getClientIp(req);
    const fingerprint_hash = sha256(data.fingerprint);
    const ip_hash = ip ? sha256(ip) : null;

    // Look for any OTHER user owning this fingerprint or IP.
    const orFilter = ip_hash
      ? `fingerprint_hash.eq.${fingerprint_hash},ip_hash.eq.${ip_hash}`
      : `fingerprint_hash.eq.${fingerprint_hash}`;

    const { data: conflicts } = await supabaseAdmin
      .from("account_fingerprints")
      .select("user_id, fingerprint_hash, ip_hash")
      .or(orFilter)
      .neq("user_id", userId)
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      const other = conflicts[0];
      // Check if the original account still exists & isn't banned.
      const { data: otherProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, banned")
        .eq("id", other.user_id)
        .maybeSingle();

      if (otherProfile && !otherProfile.banned) {
        // Delete the duplicate auth user we just created/logged into.
        try {
          await supabaseAdmin.from("profiles").delete().eq("id", userId);
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch {
          /* best-effort */
        }
        throw new Error(
          "Multiple accounts are not allowed. This device/network already has an account. Please sign in to your original account.",
        );
      }
    }

    // Record/refresh this user's fingerprint.
    await supabaseAdmin.from("account_fingerprints").upsert(
      {
        user_id: userId,
        fingerprint_hash,
        ip_hash,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,fingerprint_hash" },
    );

    return { ok: true };
  });
