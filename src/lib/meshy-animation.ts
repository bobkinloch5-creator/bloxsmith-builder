import type { ModelAnimationPreset } from "./tripo-animation";

export const MESHY_ANIMATION_PRESETS = [
  "none",
  "idle",
  "walk",
  "run",
  "jump",
  "slash",
  "shoot",
  "hurt",
  "fall",
] as const satisfies readonly ModelAnimationPreset[];

export type MeshyAnimationPreset = (typeof MESHY_ANIMATION_PRESETS)[number];

const MESHY_ACTION_IDS: Record<Exclude<MeshyAnimationPreset, "none">, number> = {
  idle: 0,
  walk: 30,
  run: 14,
  jump: 86,
  slash: 97,
  shoot: 104,
  hurt: 178,
  fall: 183,
};

export function isMeshyAnimationPreset(value: unknown): value is MeshyAnimationPreset {
  return (
    typeof value === "string" && (MESHY_ANIMATION_PRESETS as readonly string[]).includes(value)
  );
}

export function buildMeshyRigTask(inputTaskId: string) {
  return {
    input_task_id: inputTaskId,
    height_meters: 1.7,
  };
}

export function buildMeshyAnimationTask(
  rigTaskId: string,
  animationPreset: Exclude<MeshyAnimationPreset, "none">,
) {
  return {
    rig_task_id: rigTaskId,
    action_id: MESHY_ACTION_IDS[animationPreset],
  };
}
