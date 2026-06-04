import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isGeneratorOwner } from "@/lib/generator-credits.server";
import { recordAiUsageEvent } from "@/lib/usage-events.server";
import {
  GAME_TEMPLATE_CATALOG,
  catalogTemplateBySlug,
  templateProjectFiles,
  type GameTemplateCatalogItem,
} from "@/lib/game-template-catalog";

type DbTemplate = {
  id?: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  thumbnail_url?: string | null;
  credits_cost: number;
  difficulty: GameTemplateCatalogItem["difficulty"] | string;
  features?: unknown;
  build_spec?: unknown;
  install_count?: number | null;
};

function normalizeTemplate(tpl: DbTemplate): GameTemplateCatalogItem {
  const fallback = catalogTemplateBySlug(tpl.slug);
  return {
    id: tpl.id ?? fallback?.id ?? `catalog-${tpl.slug}`,
    slug: tpl.slug,
    name: tpl.name,
    category: tpl.category,
    description: tpl.description,
    thumbnail_url: tpl.thumbnail_url ?? fallback?.thumbnail_url ?? "/template-previews/simulator.svg",
    credits_cost: Number(tpl.credits_cost ?? fallback?.credits_cost ?? 0),
    difficulty: (tpl.difficulty as GameTemplateCatalogItem["difficulty"]) ?? fallback?.difficulty ?? "easy",
    features: Array.isArray(tpl.features)
      ? (tpl.features as string[])
      : fallback?.features ?? [],
    build_spec:
      typeof tpl.build_spec === "object" && tpl.build_spec
        ? (tpl.build_spec as { prompt: string })
        : fallback?.build_spec ?? {
            prompt: `Build a polished Roblox ${tpl.category} game from the ${tpl.name} template.`,
          },
    install_count: Number(tpl.install_count ?? fallback?.install_count ?? 0),
    active: true,
  };
}

export const listTemplates = createServerFn({ method: "GET" }).handler(async () => {
  // Public catalog — read via the auth-middleware client (RLS allows anon SELECT on active rows
  // but we keep it authed to match other server fns); fallback to admin client if not signed in.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("templates")
    .select(
      "id,slug,name,category,description,thumbnail_url,credits_cost,difficulty,features,install_count",
    )
    .eq("active", true)
    .order("credits_cost", { ascending: false })
    .order("install_count", { ascending: false });
  const merged = new Map<string, GameTemplateCatalogItem>();
  for (const template of GAME_TEMPLATE_CATALOG) merged.set(template.slug, template);
  if (!error) {
    for (const template of (data ?? []) as DbTemplate[]) {
      merged.set(template.slug, normalizeTemplate(template));
    }
  }
  return {
    templates: Array.from(merged.values()).sort((a, b) => {
      if (b.credits_cost !== a.credits_cost) return b.credits_cost - a.credits_cost;
      return b.install_count - a.install_count;
    }),
  };
});

export const installTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        templateSlug: z.string().min(1).max(100),
        projectName: z.string().min(1).max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isOwner = await isGeneratorOwner(userId, supabase);

    const { data: dbTpl, error: tplErr } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("slug", data.templateSlug)
      .eq("active", true)
      .maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    const catalogTpl = catalogTemplateBySlug(data.templateSlug);
    const tpl = dbTpl ? normalizeTemplate(dbTpl as unknown as DbTemplate) : catalogTpl;
    if (!tpl) throw new Error("Template not found");
    const dbTemplateId = (dbTpl as { id?: string } | null)?.id;

    const cost = isOwner ? 0 : tpl.credits_cost;
    if (cost > 0) {
      const { data: profile, error: creditCheckErr } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .maybeSingle();
      if (creditCheckErr) throw new Error(creditCheckErr.message);
      if (!profile || Number(profile.credits ?? 0) < cost) {
        throw new Error("Not enough credits to build this template.");
      }
    }

    let createdProjectId: string | null = null;
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        name: data.projectName ?? tpl.name,
        game_type: tpl.category,
        description: tpl.description,
        status: "draft",
      })
      .select()
      .single();
    if (pErr || !project) throw new Error(pErr?.message ?? "Could not create project");
    createdProjectId = project.id;

    try {
      // Seed a build_plan from the template spec so the user lands in /project/$id with a plan ready to execute.
      const buildSpec = (tpl.build_spec ?? {}) as { prompt?: string };
      if (buildSpec.prompt) {
        const { error: planErr } = await supabase.from("build_plans").insert({
          project_id: project.id,
          user_id: userId,
          prompt: buildSpec.prompt,
          plan: {
            source: "template",
            template_slug: tpl.slug,
            features: tpl.features,
            plugin_required: true,
            inserts_full_structure: true,
          },
          status: "ready",
        });
        if (planErr) throw new Error(planErr.message);
      }

      const features = Array.isArray(tpl.features) ? tpl.features : [];
      if (features.length > 0) {
        const { error: taskErr } = await supabase.from("project_tasks").insert(
          features.map((title, i) => ({
            project_id: project.id,
            user_id: userId,
            title,
            kind: "feature",
            status: "todo",
            position: i,
          })),
        );
        if (taskErr) throw new Error(taskErr.message);
      }

      const files = templateProjectFiles(tpl);
      if (files.length > 0) {
        const { error: fileErr } = await supabase.from("project_files").insert(
          files.map((file) => ({
            project_id: project.id,
            path: file.path,
            file_type: file.file_type,
            service_location: file.service_location,
            content: file.content,
          })),
        );
        if (fileErr) throw new Error(fileErr.message);
      }

      if (cost > 0) {
        const { error: spendErr } = await supabase.rpc("spend_credits_atomic", {
          _amount: cost,
        });
        if (spendErr) throw new Error("Template built, but credit charge failed. No credits were deducted.");
      }

      if (dbTemplateId) {
        await supabaseAdmin.from("template_installs").insert({
          template_id: dbTemplateId,
          user_id: userId,
          project_id: project.id,
          credits_charged: cost,
        });
        await supabaseAdmin
          .from("templates")
          .update({ install_count: (tpl.install_count ?? 0) + 1 })
          .eq("id", dbTemplateId);
      }

      await recordAiUsageEvent({
        userId,
        source: "Template build",
        creditsUsed: cost,
        metadata: {
          template_slug: tpl.slug,
          template_name: tpl.name,
          project_id: project.id,
          seeded_files: files.length,
        },
      });
      await (supabaseAdmin as any).rpc("unlock_achievement", {
        _user_id: userId,
        _key: "template_first_build",
      });
      if (cost > 0) {
        await (supabaseAdmin as any).rpc("unlock_achievement", {
          _user_id: userId,
          _key: "template_premium_build",
        });
      }
      const categoryKey = `${tpl.category.toLowerCase()}_maker`.replace(/[^a-z0-9_]/g, "_");
      const mappedKey: Record<string, string> = {
        simulator_maker: "simulator_maker",
        obby_maker: "obby_architect",
        tycoon_maker: "tycoon_founder",
        pet_maker: "pet_engineer",
      };
      const achievementKey = mappedKey[categoryKey];
      if (achievementKey) {
        await (supabaseAdmin as any).rpc("unlock_achievement", {
          _user_id: userId,
          _key: achievementKey,
        });
      }
    } catch (err) {
      if (createdProjectId) {
        await supabaseAdmin.from("projects").delete().eq("id", createdProjectId);
      }
      throw err;
    }

    return { projectId: project.id, name: project.name };
  });
