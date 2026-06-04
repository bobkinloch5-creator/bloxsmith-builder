import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isGeneratorOwner, spendCreditsAfterSuccess } from "./generator-credits.server";

const InputSchema = z.object({
  projectId: z.string().uuid().optional(),
  generationKind: z.enum(["model", "text", "animation"]).default("model"),
  inputMode: z.enum(["text", "image"]).default("text"),
  prompt: z.string().max(1024).default(""),
  imageDataUrl: z.string().max(11_500_000).optional(),
  modelType: z.string().max(48).default("prop"),
  robloxStyle: z.string().max(64).default("classic"),
  theme: z.string().max(64).default("neon"),
  material: z.string().max(64).default("plastic"),
  textureLook: z.string().max(64).default("clean"),
  primaryColor: z.string().max(24).default("#14f195"),
  secondaryColor: z.string().max(24).default("#0f172a"),
  textWords: z.string().max(80).default("BloxSmith"),
  textFont: z.string().max(48).default("GothamBlack"),
  textEffect: z.string().max(48).default("neon"),
  textAnimation: z.string().max(48).default("float"),
  textSize: z.number().min(1).max(30).default(8),
  animationType: z.string().max(48).default("idle"),
  animationTarget: z.string().max(48).default("character"),
  animationStyle: z.string().max(48).default("snappy"),
  animationEasing: z.string().max(48).default("sine"),
  animationBodyFocus: z.string().max(48).default("full body"),
  animationIntensity: z.number().min(0).max(100).default(55),
  animationDuration: z.number().min(0.25).max(30).default(2),
  animationLooped: z.boolean().default(true),
  quality: z.enum(["turbo", "standard", "detailed"]).default("turbo"),
  format: z.enum(["GLB", "OBJ", "FBX"]).default("GLB"),
  faceLimit: z.number().int().min(1000).max(50000).default(10000),
  texture: z.boolean().default(true),
  style: z.string().max(64).optional(),
  rigged: z.boolean().default(false),
  animateInPlace: z.boolean().default(false),
});

export type Generate3DResult =
  | {
      ok: true;
      fileUrl: string;
      previewGlbUrl?: string;
      format: "GLB" | "OBJ" | "FBX" | "LUA";
      renderedImageUrl?: string;
      creditsSpent: number;
      importTip: string;
      nextAvailable: string; // ISO date when they can generate again
      generationKind: "model" | "text" | "animation";
      studioScript?: string;
      studioScriptUrl?: string;
      studioFilePath?: string | null;
      settings?: Record<string, string | number | boolean | null>;
    }
  | { ok: false; error: string; nextAvailable?: string };

// Heavy credit cost — 3D generation is expensive. Owners/admins pay 0.
const MODEL_3D_CREDIT_COST = Number(process.env.MODEL_3D_CREDIT_COST || "25");
const TEXT_3D_CREDIT_COST = Number(process.env.TEXT_3D_CREDIT_COST || "10");
const ANIMATION_3D_CREDIT_COST = Number(process.env.ANIMATION_3D_CREDIT_COST || "12");

// One generation per rolling 7 days per user (owners/admins exempt).
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function costForKind(kind: "model" | "text" | "animation") {
  if (kind === "text") return TEXT_3D_CREDIT_COST;
  if (kind === "animation") return ANIMATION_3D_CREDIT_COST;
  return MODEL_3D_CREDIT_COST;
}

function cleanName(value: string, fallback = "BloxSmithAsset") {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
  return cleaned || fallback;
}

function buildModelPrompt(data: z.infer<typeof InputSchema>) {
  const base =
    data.prompt.trim() ||
    "Create a safe Roblox-ready 3D model from this reference image. Keep it clean, non-NSFW, game-friendly, and suitable for all ages.";
  const wantsGloss = data.textureLook === "glossy";
  const finish = wantsGloss
    ? "Material finish: subtle gloss only, never mirror-like; keep specular reflections soft."
    : "Material finish: MATTE, low-specular, fully non-glossy, no shiny highlights, no mirror reflections, no wet/plastic sheen. Use flat, painted-style PBR textures with roughness ~0.9 and metalness 0.";
  return [
    base,
    `Model type: ${data.modelType}.`,
    `Roblox style: ${data.robloxStyle}.`,
    `Theme: ${data.theme}.`,
    `Material look: ${data.material}. Texture style: ${data.textureLook}.`,
    finish,
    `Use primary color ${data.primaryColor} and secondary color ${data.secondaryColor}.`,
    "Make chunky readable shapes, game-ready proportions, no tiny fragile details, and a Roblox-friendly silhouette.",
  ].join(" ");
}

function build3DTextScript(data: z.infer<typeof InputSchema>) {
  const text = (data.textWords || data.prompt || "BloxSmith").trim().slice(0, 80);
  const modelName = cleanName(text, "BloxSmithText");
  return `-- BloxSmith 3D Text Generator
-- Paste into Roblox Studio Command Bar or run through the BloxSmith plugin.
local TweenService = game:GetService("TweenService")

local model = Instance.new("Model")
model.Name = "${modelName}_3DText"
model.Parent = workspace

local base = Instance.new("Part")
base.Name = "TextBackplate"
base.Anchored = true
base.Size = Vector3.new(${Math.max(8, text.length * 1.4).toFixed(1)}, ${data.textSize.toFixed(1)}, 0.45)
base.Position = Vector3.new(0, ${Math.max(4, data.textSize / 2).toFixed(1)}, 0)
base.Material = Enum.Material.${data.material === "metal" ? "Metal" : data.textEffect === "neon" ? "Neon" : "SmoothPlastic"}
base.Color = Color3.fromHex("${data.secondaryColor}")
base.Parent = model

local gui = Instance.new("SurfaceGui")
gui.Name = "TextSurface"
gui.Face = Enum.NormalId.Front
gui.AlwaysOnTop = false
gui.PixelsPerStud = 80
gui.Parent = base

local label = Instance.new("TextLabel")
label.Name = "Text"
label.BackgroundTransparency = 1
label.Size = UDim2.fromScale(1, 1)
label.Font = Enum.Font.${data.textFont}
label.Text = ${JSON.stringify(text)}
label.TextScaled = true
label.TextColor3 = Color3.fromHex("${data.primaryColor}")
label.TextStrokeTransparency = ${data.textEffect === "outline" ? "0.1" : "0.55"}
label.TextStrokeColor3 = Color3.fromHex("${data.secondaryColor}")
label.Parent = gui

local glow = Instance.new("PointLight")
glow.Name = "TextGlow"
glow.Color = Color3.fromHex("${data.primaryColor}")
glow.Brightness = ${data.textEffect === "neon" ? "3" : "1"}
glow.Range = ${data.textEffect === "neon" ? "18" : "10"}
glow.Parent = base

${data.textAnimation === "none" ? "" : `local tween = TweenService:Create(base, TweenInfo.new(2.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Position = base.Position + Vector3.new(0, 0.8, 0) })
tween:Play()`}

model.PrimaryPart = base
print("[BloxSmith] Inserted 3D text:", model.Name)
`;
}

function buildAnimationScript(data: z.infer<typeof InputSchema>) {
  const animationName = cleanName(`${data.animationType}_${data.animationTarget}`, "BloxSmithAnimation");
  const prompt = data.prompt.trim().replace(/\n/g, " ").slice(0, 500) || "Generated Roblox animation";
  const intensity = Math.max(0, Math.min(100, data.animationIntensity));
  const swing = Math.max(6, Math.round(10 + intensity * 0.55));
  const lift = Math.max(0.04, Number((0.04 + intensity / 420).toFixed(2)));
  const mainTime = Math.max(0.1, data.animationDuration * 0.5).toFixed(2);
  const style = data.animationStyle;
  const easing = data.animationEasing;
  const focus = data.animationBodyFocus;
  return `-- BloxSmith Simple Roblox Animation Blueprint
-- Description: ${prompt}
-- Target: ${data.animationTarget}; Type: ${data.animationType}; Style: ${style}; Focus: ${focus}
-- Duration: ${data.animationDuration}s; Looped: ${data.animationLooped}; Intensity: ${intensity}; Easing: ${easing}
--
-- This is intentionally simple: start pose -> main motion pose -> reset pose.
-- Simple animations are easier to recreate, publish, and test in Roblox Studio.
--
-- How to use:
-- 1. Keep this ModuleScript in ReplicatedStorage/GeneratedAnimations.
-- 2. Open Roblox Animation Editor on your R15/R6 rig.
-- 3. Recreate the three keyframes below, publish the animation, and copy the asset id.
-- 4. Paste the asset id into ControllerSnippet where it says PASTE_YOUR_UPLOADED_ANIMATION_ID.

local AnimationBlueprint = {}
AnimationBlueprint.Name = "${animationName}"
AnimationBlueprint.Target = "${data.animationTarget}"
AnimationBlueprint.Type = "${data.animationType}"
AnimationBlueprint.Style = "${style}"
AnimationBlueprint.Easing = "${easing}"
AnimationBlueprint.BodyFocus = "${focus}"
AnimationBlueprint.Intensity = ${intensity}
AnimationBlueprint.Duration = ${data.animationDuration}
AnimationBlueprint.Looped = ${data.animationLooped}
AnimationBlueprint.Prompt = ${JSON.stringify(prompt)}

AnimationBlueprint.Keyframes = {
  -- Start pose
  { Time = 0, Poses = { Root = CFrame.new(0, 0, 0), RightArm = CFrame.Angles(0, 0, 0), LeftArm = CFrame.Angles(0, 0, 0), Head = CFrame.Angles(0, 0, 0) } },
  -- Main readable motion pose
  { Time = ${mainTime}, Poses = { Root = CFrame.new(0, ${lift}, 0), RightArm = CFrame.Angles(math.rad(-${swing}), 0, math.rad(${Math.round(swing * 0.7)})), LeftArm = CFrame.Angles(math.rad(${Math.round(swing * 0.55)}), 0, math.rad(-${Math.round(swing * 0.45)})), Head = CFrame.Angles(math.rad(${Math.round(swing * 0.12)}), 0, 0) } },
  -- Reset pose
  { Time = ${data.animationDuration.toFixed(2)}, Poses = { Root = CFrame.new(0, 0, 0), RightArm = CFrame.Angles(0, 0, 0), LeftArm = CFrame.Angles(0, 0, 0), Head = CFrame.Angles(0, 0, 0) } },
}

AnimationBlueprint.ControllerSnippet = [[
local Players = game:GetService("Players")

local ANIMATION_ID = "rbxassetid://PASTE_YOUR_UPLOADED_ANIMATION_ID"

local function playOnCharacter(character)
  local humanoid = character:FindFirstChildOfClass("Humanoid")
  if not humanoid then return end
  local animator = humanoid:FindFirstChildOfClass("Animator") or Instance.new("Animator", humanoid)
  local animation = Instance.new("Animation")
  animation.AnimationId = ANIMATION_ID
  local track = animator:LoadAnimation(animation)
  track.Looped = ${data.animationLooped}
  track.Priority = Enum.AnimationPriority.Action
  track:Play(0.15)
end

Players.LocalPlayer.CharacterAdded:Connect(playOnCharacter)
if Players.LocalPlayer.Character then playOnCharacter(Players.LocalPlayer.Character) end
]]

function AnimationBlueprint:Instructions()
  return "Preview the motion on the website, recreate the three keyframes in Roblox Animation Editor, publish it, then paste the animation id into ControllerSnippet."
end

return AnimationBlueprint
`;
}

async function insertStudioFile(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  projectId: string | undefined,
  path: string,
  fileType: string,
  serviceLocation: string,
  content: string,
) {
  if (!projectId) return null;
  const { data: existing } = await supabase
    .from("project_files")
    .select("id")
    .eq("project_id", projectId)
    .eq("path", path)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await supabase
      .from("project_files")
      .update({ content, file_type: fileType, service_location: serviceLocation })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return path;
  }
  const { error } = await supabase.from("project_files").insert({
    project_id: projectId,
    path,
    file_type: fileType,
    service_location: serviceLocation,
    content,
  });
  if (error) throw new Error(error.message);
  return path;
}

export const generate3DModelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<Generate3DResult> => {
    const { userId, supabase } = context as {
      userId: string;
      supabase: import("@supabase/supabase-js").SupabaseClient;
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generate3DModel } = await import("./tripo3d.server");
    const { checkTextSafeFor3D, checkImageSafeFor3D } = await import("./content-safety.server");

    const safePrompt = data.prompt.trim();
    if (data.generationKind === "model" && data.inputMode === "text" && safePrompt.length < 3) {
      return { ok: false, error: "Describe the model you want in at least a few words." };
    }
    if (data.generationKind === "model" && data.inputMode === "image" && !data.imageDataUrl) {
      return { ok: false, error: "Upload a reference image for image-to-3D." };
    }
    const safetyText =
      data.generationKind === "text"
        ? `${data.textWords} ${safePrompt}`
        : data.generationKind === "animation"
          ? `${data.animationType} ${data.animationTarget} ${data.animationStyle} ${data.animationBodyFocus} ${safePrompt}`
          : buildModelPrompt(data);
    const textSafety = checkTextSafeFor3D(safetyText);
    if (!textSafety.safe) return { ok: false, error: textSafety.reason };
    if (data.generationKind === "model" && data.inputMode === "image" && data.imageDataUrl) {
      const imageSafety = await checkImageSafeFor3D(data.imageDataUrl);
      if (!imageSafety.safe) return { ok: false, error: imageSafety.reason };
    }

    const isOwner = await isGeneratorOwner(userId, supabase);
    const generationCost = costForKind(data.generationKind);

    // 1. Weekly limit — normal users get one successful 3D Studio run total
    // across text-to-3D, image-to-3D, 3D text, and animations every 7 days.
    if (!isOwner) {
      const since = new Date(Date.now() - WEEKLY_WINDOW_MS).toISOString();
      const { data: recent, error: cntErr } = await (supabaseAdmin as any)
        .from("model_generations_3d")
        .select("created_at,cooldown_unlock_at")
        .eq("user_id", userId)
        .eq("status", "success")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      // Fail closed on the limit (don't let a query error grant a free pass),
      // but allow through if the table simply isn't there yet.
      if (cntErr && !/does not exist|relation|schema cache/i.test(cntErr.message)) {
        return { ok: false, error: "Could not verify your weekly limit. Try again shortly." };
      }
      if (recent && recent.length > 0) {
        const last = new Date(recent[0].created_at).getTime();
        const next = recent[0].cooldown_unlock_at
          ? new Date(recent[0].cooldown_unlock_at)
          : new Date(last + WEEKLY_WINDOW_MS);
        return {
          ok: false,
          error:
            "You've used your weekly 3D Studio generation. Pick one per week: 3D model, image-to-3D, 3D text, or animation.",
          nextAvailable: next.toISOString(),
        };
      }
    }

    // 2. Pre-check credits so we don't run an expensive Tripo job the user
    //    can't pay for. (We still charge only AFTER success.)
    if (!isOwner) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .maybeSingle();
      const credits = Number(profile?.credits ?? 0);
      if (credits < generationCost) {
        return {
          ok: false,
          error: `This generation costs ${generationCost} credits. You have ${credits}. Buy more on the Pricing page.`,
        };
      }
    }

    const settings = {
      generationKind: data.generationKind,
      inputMode: data.inputMode,
      modelType: data.modelType,
      robloxStyle: data.robloxStyle,
      theme: data.theme,
      material: data.material,
      textureLook: data.textureLook,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      quality: data.quality,
      format: data.format,
      faceLimit: data.faceLimit,
      texture: data.texture,
      rigged: data.rigged,
      animateInPlace: data.animateInPlace,
      textWords: data.textWords,
      textFont: data.textFont,
      textEffect: data.textEffect,
      textAnimation: data.textAnimation,
      textSize: data.textSize,
      animationType: data.animationType,
      animationTarget: data.animationTarget,
      animationStyle: data.animationStyle,
      animationEasing: data.animationEasing,
      animationBodyFocus: data.animationBodyFocus,
      animationIntensity: data.animationIntensity,
      animationDuration: data.animationDuration,
      animationLooped: data.animationLooped,
    };

    let result:
      | Awaited<ReturnType<typeof generate3DModel>>
      | {
          ok: true;
          fileUrl: string;
          filePath: string;
          format: "LUA";
          previewGlbUrl?: string;
          tripoTaskId: string;
          renderedImageUrl?: string;
          studioScript: string;
        };
    let studioScript: string | undefined;
    let studioFilePath: string | null = null;

    if (data.generationKind === "model") {
      result = await generate3DModel({
        userId,
        prompt: buildModelPrompt(data),
        inputMode: data.inputMode,
        imageDataUrl: data.imageDataUrl ?? null,
        quality: data.quality,
        format: data.rigged && data.format === "OBJ" ? "FBX" : data.format,
        faceLimit: data.faceLimit,
        texture: data.texture,
        style: data.style ?? null,
        rigged: data.rigged,
        animateInPlace: data.animateInPlace,
      });
      // If the primary key failed and a fallback key is configured, retry with
      // it — but cap fallback usage at 3 successful runs per 7 days per user.
      if (!result.ok && process.env.TRIPO_FALLBACK_API_KEY) {
        const since = new Date(Date.now() - WEEKLY_WINDOW_MS).toISOString();
        const { count: fbCount } = await (supabaseAdmin as any)
          .from("model_generations_3d")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "success")
          .gte("created_at", since)
          .filter("settings->>used_fallback", "eq", "true");
        const fallbackUsed = Number(fbCount ?? 0);
        if (fallbackUsed < 3) {
          console.warn(
            `[generate3DModelFn] primary Tripo failed (${result.error}); retrying with fallback (${fallbackUsed}/3 used).`,
          );
          result = await generate3DModel({
            userId,
            prompt: buildModelPrompt(data),
            inputMode: data.inputMode,
            imageDataUrl: data.imageDataUrl ?? null,
            quality: data.quality,
            format: data.rigged && data.format === "OBJ" ? "FBX" : data.format,
            faceLimit: data.faceLimit,
            texture: data.texture,
            style: data.style ?? null,
            rigged: data.rigged,
            animateInPlace: data.animateInPlace,
            useFallbackKey: true,
          });
          if (result.ok) {
            (settings as any).used_fallback = true;
          }
        }
      }
      if (!result.ok) {
        return { ok: false, error: `${result.error} (No credits were charged.)` };
      }
      studioScript = `return {
  Name = ${JSON.stringify(cleanName(data.prompt || data.modelType, "GeneratedModel"))},
  Kind = "3DModel",
  ModelUrl = ${JSON.stringify(result.fileUrl)},
  PreviewUrl = ${JSON.stringify(result.previewGlbUrl ?? result.fileUrl)},
  Format = ${JSON.stringify(result.format)},
  ImportTip = "Download this file and import it with Roblox Studio Import 3D.",
}`;
      studioFilePath = await insertStudioFile(
        supabase,
        userId,
        data.projectId,
        `ReplicatedStorage/GeneratedAssets/${cleanName(data.prompt || data.modelType, "GeneratedModel")}Asset`,
        "ModuleScript",
        "ReplicatedStorage",
        studioScript,
      );
    } else {
      studioScript =
        data.generationKind === "text" ? build3DTextScript(data) : buildAnimationScript(data);
      const { storeGeneratedAssetFile } = await import("./tripo3d.server");
      const stored = await storeGeneratedAssetFile(
        userId,
        studioScript,
        "lua",
        "text/x-lua",
      );
      studioFilePath = await insertStudioFile(
        supabase,
        userId,
        data.projectId,
        data.generationKind === "text"
          ? `Workspace/GeneratedText/${cleanName(data.textWords, "BloxSmithText")}Builder`
          : `ReplicatedStorage/GeneratedAnimations/${cleanName(data.animationType, "BloxSmithAnimation")}Blueprint`,
        data.generationKind === "text" ? "Script" : "ModuleScript",
        data.generationKind === "text" ? "Workspace" : "ReplicatedStorage",
        studioScript,
      );
      result = {
        ok: true,
        fileUrl: stored.fileUrl,
        filePath: stored.filePath,
        format: "LUA",
        tripoTaskId: `${data.generationKind}-${Date.now()}`,
        studioScript,
      };
    }

    // 4. Charge credits only now that we have a real file.
    try {
      await spendCreditsAfterSuccess({
        supabase,
        userId,
        amount: generationCost,
        isOwner,
        insufficientMessage: "Not enough credits to complete generation.",
        reason: `${data.generationKind} generation: ${data.prompt.slice(0, 60)}`,
      });
    } catch (err) {
      // The file exists but charging failed — still record it so the weekly
      // limit is honored, and let the user have the file.
      console.warn("[generate3DModelFn] credit charge failed:", String(err).slice(0, 160));
    }

    // 5. Record the generation (drives the weekly limit + the user's history).
    await (supabaseAdmin as any).from("model_generations_3d").insert({
      user_id: userId,
      project_id: data.projectId ?? null,
      prompt: data.generationKind === "text" ? data.textWords : data.prompt,
      generation_type: data.generationKind,
      status: "success",
      tripo_task_id: result.tripoTaskId,
      file_path: result.filePath,
      file_url: result.fileUrl,
      format: result.format,
      credits_used: isOwner ? 0 : generationCost,
      settings,
      preview_url: "previewGlbUrl" in result ? result.previewGlbUrl ?? null : null,
      studio_file_path: studioFilePath,
      cooldown_unlock_at: new Date(Date.now() + WEEKLY_WINDOW_MS).toISOString(),
    });

    const nextAvailable = new Date(Date.now() + WEEKLY_WINDOW_MS).toISOString();

    return {
      ok: true,
      fileUrl: result.fileUrl,
      previewGlbUrl: result.previewGlbUrl,
      format: result.format,
      renderedImageUrl: result.renderedImageUrl,
      creditsSpent: isOwner ? 0 : generationCost,
      importTip:
        data.generationKind === "model"
          ? "Download the file, then in Roblox Studio open the 3D Importer (Avatar tab -> Import 3D) and select it. The mesh drops into your Workspace ready to position."
          : data.generationKind === "animation"
            ? "Download the Lua ModuleScript, put it in ReplicatedStorage/GeneratedAnimations, recreate the three simple keyframes in Roblox Animation Editor, publish the animation, then paste the uploaded animation id into the included ControllerSnippet."
            : "Download the Lua package or open the selected project in Studio with the BloxSmith plugin to insert this generated Roblox asset.",
      nextAvailable,
      generationKind: data.generationKind,
      studioScript,
      studioScriptUrl: result.fileUrl,
      studioFilePath,
      settings,
    };
  });

// Lightweight status check so the page can show the weekly lockout + ETA and
// the credit cost before the user attempts a generation.
export const get3DStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ generationKind: z.enum(["model", "text", "animation"]).default("model") }).parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      canGenerate: boolean;
      isOwner: boolean;
      credits: number;
      cost: number;
      nextAvailable: string | null;
      fallback: {
        configured: boolean;
        used: number;
        limit: number;
        remaining: number;
        nextReset: string | null;
      };
    }> => {
      const { userId, supabase } = context as {
        userId: string;
        supabase: import("@supabase/supabase-js").SupabaseClient;
      };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const isOwner = await isGeneratorOwner(userId, supabase);
      const cost = costForKind(data.generationKind);

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .maybeSingle();
      const credits = Number(profile?.credits ?? 0);

      const since = new Date(Date.now() - WEEKLY_WINDOW_MS).toISOString();

      // Fallback usage window — count successful runs in the last 7 days that
      // used the fallback key, and compute when the oldest one rolls off.
      const fallbackConfigured = !!process.env.TRIPO_FALLBACK_API_KEY;
      const { data: fbRows } = await (supabaseAdmin as any)
        .from("model_generations_3d")
        .select("created_at")
        .eq("user_id", userId)
        .eq("status", "success")
        .gte("created_at", since)
        .filter("settings->>used_fallback", "eq", "true")
        .order("created_at", { ascending: true });
      const fbUsed = Array.isArray(fbRows) ? fbRows.length : 0;
      const fbNextReset =
        fbUsed > 0 && fbRows?.[0]?.created_at
          ? new Date(new Date(fbRows[0].created_at).getTime() + WEEKLY_WINDOW_MS).toISOString()
          : null;
      const fallback = {
        configured: fallbackConfigured,
        used: fbUsed,
        limit: 3,
        remaining: Math.max(0, 3 - fbUsed),
        nextReset: fbNextReset,
      };

      if (isOwner) {
        return { canGenerate: true, isOwner, credits, cost: 0, nextAvailable: null, fallback };
      }

      const { data: recent } = await (supabaseAdmin as any)
        .from("model_generations_3d")
        .select("created_at,cooldown_unlock_at")
        .eq("user_id", userId)
        .eq("status", "success")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recent && recent.length > 0) {
        const next = recent[0].cooldown_unlock_at
          ? new Date(recent[0].cooldown_unlock_at)
          : new Date(new Date(recent[0].created_at).getTime() + WEEKLY_WINDOW_MS);
        return {
          canGenerate: false,
          isOwner,
          credits,
          cost,
          nextAvailable: next.toISOString(),
          fallback,
        };
      }
      return {
        canGenerate: true,
        isOwner,
        credits,
        cost,
        nextAvailable: null,
        fallback,
      };
    },
  );
