import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  generateUISpec,
  specToPluginPayload,
  UI_CATEGORIES,
  UI_STYLES,
  UISpecSchema,
  type UISpec,
} from "@/lib/ui-generator.server";
import { isGeneratorOwner } from "@/lib/generator-credits.server";
import { recordAiUsageEvent } from "@/lib/usage-events.server";

export const UI_GEN_CREDIT_COST = 5;

const Color = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

const GenerateInput = z.object({
  category: z.enum(UI_CATEGORIES),
  style: z.enum(UI_STYLES),
  prompt: z.string().min(1).max(2000),
  title: z.string().max(80).optional(),
  primaryColor: Color.optional(),
  accentColor: Color.optional(),
  bgColor: Color.optional(),
  projectId: z.string().uuid().optional(),
});

async function trySpend(supabase: any, amount: number) {
  const { error } = await supabase.rpc("spend_credits_atomic", { _amount: amount });
  return error;
}
async function tryRefund(supabase: any, amount: number, reason: string) {
  try {
    await supabase.rpc("refund_credits", { _amount: amount, _reason: reason });
  } catch (e) {
    console.error("[ui-gen] refund failed:", e);
  }
}

export const generateRobloxUIFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isOwner = await isGeneratorOwner(userId, supabase);

    const spendErr = await trySpend(supabase, UI_GEN_CREDIT_COST);
    if (spendErr) {
      const msg = (spendErr.message || "").toLowerCase();
      if (msg.includes("insufficient") || msg.includes("not enough")) {
        throw new Error(`Not enough credits — UI generation costs ${UI_GEN_CREDIT_COST} credits.`);
      }
      throw new Error(spendErr.message || "Could not charge credits.");
    }

    let spec: UISpec;
    try {
      spec = await generateUISpec({
        category: data.category,
        style: data.style,
        prompt: data.prompt,
        title: data.title,
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
        bgColor: data.bgColor,
      });
    } catch (err: any) {
      await tryRefund(supabase, UI_GEN_CREDIT_COST, "ui_generator_failed");
      throw new Error(err?.message || "UI generation failed. Try again.");
    }

    const { actions, files } = specToPluginPayload(spec);
    await recordAiUsageEvent({
      userId,
      source: "UI Generator",
      creditsUsed: isOwner ? 0 : UI_GEN_CREDIT_COST,
      model: "BloxSmith UI Generator",
      metadata: { category: data.category, style: data.style },
    });

    // Save to the user's UI library
    let savedId: string | null = null;
    try {
      const { data: saved, error: insErr } = await supabase
        .from("ui_generations")
        .insert({
          user_id: userId,
          project_id: data.projectId ?? null,
          title: spec.title,
          category: data.category,
          style: data.style,
          prompt: data.prompt,
          spec,
          actions,
          files,
        })
        .select("id")
        .single();
      if (insErr) console.warn("[ui-gen] save failed:", insErr.message);
      else savedId = saved?.id ?? null;
    } catch (e) {
      console.warn("[ui-gen] save threw:", e);
    }

    return {
      id: savedId,
      spec,
      actions,
      files,
      creditsCharged: UI_GEN_CREDIT_COST,
    };
  });

const ListInput = z.object({ limit: z.number().int().min(1).max(50).default(30) }).default({ limit: 30 });

const SaveGenerationInput = z.object({
  category: z.enum(UI_CATEGORIES),
  style: z.enum(UI_STYLES),
  prompt: z.string().max(2000).optional(),
  title: z.string().max(80).optional(),
  projectId: z.string().uuid().optional(),
  spec: UISpecSchema,
  actions: z.array(z.any()).min(1),
  files: z.array(z.any()).default([]),
});

export const saveUIGenerationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveGenerationInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.projectId) {
      const { data: project, error } = await supabase
        .from("projects")
        .select("id,user_id")
        .eq("id", data.projectId)
        .maybeSingle();
      if (error || !project) throw new Error("Project not found.");
      if (project.user_id !== userId) throw new Error("You don't own this project.");
    }

    const { data: saved, error } = await supabase
      .from("ui_generations")
      .insert({
        user_id: userId,
        project_id: data.projectId ?? null,
        title: data.title?.trim() || data.spec.title,
        category: data.category,
        style: data.style,
        prompt: data.prompt ?? "",
        spec: data.spec,
        actions: data.actions,
        files: data.files,
      })
      .select("id,title,category,style,created_at")
      .single();

    if (error) throw new Error(`Could not save UI generation: ${error.message}`);
    return { item: saved };
  });

export const listUIGenerationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("ui_generations")
      .select("id,title,category,style,thumbnail_url,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const getUIGenerationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ui_generations")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found.");
    return row;
  });

export const deleteUIGenerationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ui_generations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const InsertInput = z.object({
  projectId: z.string().uuid(),
  generationId: z.string().uuid().optional(),
  actions: z.array(z.any()).optional(),
});

// Enqueues the generated actions into plugin_actions so the Studio plugin picks them up on the next sync.
export const insertUIIntoStudioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InsertInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id,user_id,name")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr || !project) throw new Error("Project not found.");
    if (project.user_id !== userId) throw new Error("You don't own this project.");

    let actions = data.actions ?? null;
    if (!actions && data.generationId) {
      const { data: row, error } = await supabase
        .from("ui_generations")
        .select("actions")
        .eq("id", data.generationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !row) throw new Error("UI generation not found.");
      actions = (row.actions as any[]) ?? [];
    }
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new Error("Nothing to insert — empty action list.");
    }

    const rows = actions.map((a) => ({
      project_id: data.projectId,
      user_id: userId,
      action_type: String(a?.type ?? "create"),
      payload: a,
      status: "pending" as const,
    }));

    const { error: insErr } = await supabase.from("plugin_actions").insert(rows);
    if (insErr) throw new Error(`Could not queue Studio actions: ${insErr.message}`);

    return { queued: rows.length, projectName: project.name };
  });
