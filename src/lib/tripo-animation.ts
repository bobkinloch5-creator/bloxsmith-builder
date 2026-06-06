export const MODEL_RIG_TYPES = [
  "auto",
  "biped",
  "quadruped",
  "hexapod",
  "octopod",
  "avian",
  "serpentine",
  "aquatic",
  "others",
] as const;

export const MODEL_ANIMATION_PRESETS = [
  "none",
  "idle",
  "walk",
  "run",
  "dive",
  "climb",
  "jump",
  "slash",
  "shoot",
  "hurt",
  "fall",
  "turn",
] as const;

export type ModelRigType = (typeof MODEL_RIG_TYPES)[number];
export type ModelAnimationPreset = (typeof MODEL_ANIMATION_PRESETS)[number];

export function isModelRigType(value: unknown): value is ModelRigType {
  return typeof value === "string" && (MODEL_RIG_TYPES as readonly string[]).includes(value);
}

export function buildTripoRigTask(originalModelTaskId: string, rigType: ModelRigType) {
  return {
    type: "animate_rig",
    original_model_task_id: originalModelTaskId,
    model_version: "v2.0-20250506",
    out_format: "glb",
    spec: rigType === "biped" ? "mixamo" : "tripo",
    ...(rigType === "auto" ? {} : { rig_type: rigType }),
  };
}

export function resolveTripoAnimation(
  animationPreset: Exclude<ModelAnimationPreset, "none">,
  rigType: ModelRigType,
) {
  if (animationPreset !== "walk") return `preset:${animationPreset}`;

  const walkAnimationByRig: Partial<Record<ModelRigType, string>> = {
    quadruped: "preset:quadruped:walk",
    hexapod: "preset:hexapod:walk",
    octopod: "preset:octopod:walk",
    serpentine: "preset:serpentine:march",
    aquatic: "preset:aquatic:march",
  };
  return walkAnimationByRig[rigType] ?? "preset:walk";
}

export function buildTripoAnimationTask(
  riggedModelTaskId: string,
  animationPreset: Exclude<ModelAnimationPreset, "none">,
  rigType: ModelRigType,
  animateInPlace: boolean,
) {
  return {
    type: "animate_retarget",
    original_model_task_id: riggedModelTaskId,
    animation: resolveTripoAnimation(animationPreset, rigType),
    out_format: "glb",
    bake_animation: true,
    export_with_geometry: true,
    animate_in_place: animateInPlace,
  };
}
