import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isOwnerOnlyModel } from "@/lib/ai-models";

const ProviderEnum = z.enum(["openai", "anthropic", "google", "groq", "neokens", "comet"]);

const SaveSettingsSchema = z.object({
  projectId: z.string().uuid(),
  mode: z.enum(["mcp", "api_key"]),
  provider: ProviderEnum.nullable().optional(),
  model: z.string().max(80).nullable().optional(),
});

const SaveKeySchema = z.object({
  provider: ProviderEnum,
  apiKey: z.string().min(8).max(400),
});

const ClearKeySchema = z.object({
  provider: ProviderEnum,
});

const GetSchema = z.object({
  projectId: z.string().uuid(),
});

// Owner OR collaborator access. Reading the AI config is allowed for any
// member; saving project AI settings (requireEdit) needs the owner or an
// "editor" collaborator. RLS already scopes this SELECT to project members.
async function assertProjectAccess(
  supabase: any,
  projectId: string,
  userId: string,
  opts: { requireEdit?: boolean } = {},
) {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id,user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !project) throw new Error("Project not found or unauthorized.");
  if (project.user_id === userId) return; // owner — full access

  const { data: collab } = await supabase
    .from("project_collaborators")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!collab) throw new Error("Project not found or unauthorized.");
  if (opts.requireEdit && collab.role !== "editor") {
    throw new Error(
      "You have view-only access to this project — only editors can change its AI settings.",
    );
  }
}

async function assertOwnerOnlyModelAccess(supabase: any, userId: string, model: string | null | undefined) {
  if (!isOwnerOnlyModel(model)) return;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) {
    throw new Error("Claude Fable 5 is restricted to Owner role accounts.");
  }
}

export const getProjectAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId } = data;
    await assertProjectAccess(supabase, projectId, userId);

    const [settingsRes, keysRes] = await Promise.all([
      supabase
        .from("project_ai_settings")
        .select("mode,provider,model,updated_at")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase.from("user_provider_keys").select("provider,label,updated_at").eq("user_id", userId),
    ]);

    const settings = settingsRes.data ?? {
      mode: "mcp",
      provider: null,
      model: null,
      updated_at: null,
    };
    if (isOwnerOnlyModel(settings.model)) {
      try {
        await assertOwnerOnlyModelAccess(supabase, userId, settings.model);
      } catch {
        settings.model = null;
      }
    }
    const keys = (keysRes.data ?? []).reduce(
      (acc: Record<string, { label: string | null; updatedAt: string }>, k: any) => {
        acc[k.provider] = { label: k.label, updatedAt: k.updated_at };
        return acc;
      },
      {} as Record<string, { label: string | null; updatedAt: string }>,
    );

    return { settings, keys };
  });

export const saveProjectAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProjectAccess(supabase, data.projectId, userId, { requireEdit: true });
    if (data.mode === "api_key") {
      await assertOwnerOnlyModelAccess(supabase, userId, data.model);
    }
    const payload = {
      project_id: data.projectId,
      user_id: userId,
      mode: data.mode,
      provider: data.mode === "api_key" ? (data.provider ?? null) : null,
      model: data.mode === "api_key" ? (data.model ?? null) : null,
    };

    const { error } = await supabase
      .from("project_ai_settings")
      .upsert(payload, { onConflict: "project_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveKeySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("set_provider_api_key" as any, {
      _provider: data.provider,
      _api_key: data.apiKey.trim(),
      _label: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClearKeySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("delete_provider_api_key" as any, {
      _provider: data.provider,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
