// Server-side helpers for user-uploaded profile media (custom backgrounds, etc.)
// The upload itself happens client-side via the authenticated Supabase client
// against the `profile-media` storage bucket. These server fns persist the
// resulting public URL onto the user's profile and delete old files when the
// user replaces or removes their custom background.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const setCustomBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z.string().url().max(4096).nullable(),
        previousPath: z.string().max(512).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await (supabase as any).rpc("ensure_my_profile");
    const patch: Record<string, unknown> = {
      custom_background_url: data.url,
    };
    if (data.url) patch.profile_background = "custom";
    const { error } = await (supabase as any).from("profiles").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);

    // Best-effort cleanup of previous file (only the user's own folder is allowed).
    if (data.previousPath && data.previousPath.startsWith(`${userId}/`)) {
      await (supabase as any).storage.from("profile-media").remove([data.previousPath]);
    }
    return { ok: true };
  });

export const moderateProfileBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().max(11_500_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { checkImageSafeFor3D } = await import("./content-safety.server");
    const verdict = await checkImageSafeFor3D(data.dataUrl);
    if (!verdict.safe) throw new Error(verdict.reason);
    return { ok: true };
  });
