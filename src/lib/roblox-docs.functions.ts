import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  searchRobloxDocs,
  syncRobloxCreatorDocs,
  getLatestSync,
  type DocsCitation,
} from "@/lib/roblox-docs.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("owner")) {
    throw new Error("Admins only");
  }
}

export const searchRobloxDocsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ query: z.string().min(1).max(500), limit: z.number().int().min(1).max(12).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ results: DocsCitation[] }> => {
    const results = await searchRobloxDocs(data.query, data.limit ?? 6);
    return { results };
  });

export const syncRobloxDocsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        batchSize: z.number().int().min(1).max(40).optional(),
        resumeSyncId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const progress = await syncRobloxCreatorDocs(userId, data);
    return progress;
  });

export const getRobloxDocsStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return getLatestSync();
  });
