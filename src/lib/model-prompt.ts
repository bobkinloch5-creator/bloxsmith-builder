export type ModelPromptInput = {
  prompt: string;
  inputMode: "text" | "image";
  modelType?: string;
  robloxStyle?: string;
  theme?: string;
  material?: string;
  textureLook?: string;
  primaryColor?: string;
  secondaryColor?: string;
  useCustomColors?: boolean;
  rigged?: boolean;
  rigType?: string;
};

const PLAYTEST_SUFFIX = /\s*Include Roblox playtest readiness:[\s\S]*$/i;
const CHARACTER_INTENT =
  /\b(character|person|human|humanoid|pet|animal|creature|monster|mascot|npc|robot|android|face|eyes?|mouth|arms?|legs?|hands?|feet|tail)\b/i;
const CRYSTAL_INTENT = /\b(crystals?|gems?|gemstones?|quartz|amethyst)\b/i;
const CRYSTAL_SUBJECT_END = /\b(crystals?|gems?|gemstones?|quartz|amethyst)\s*$/i;
const CRYSTAL_FORMATION = /\b(cluster|formation|deposit|shards?|points?)\b/i;

function cleanSubject(prompt: string) {
  return prompt.replace(PLAYTEST_SUFFIX, "").trim();
}

function selected(value?: string) {
  const clean = value?.trim();
  return clean && clean.toLowerCase() !== "auto" ? clean : "";
}

function isCrystalFormation(subject: string) {
  return (
    CRYSTAL_INTENT.test(subject) &&
    (CRYSTAL_SUBJECT_END.test(subject) || CRYSTAL_FORMATION.test(subject))
  );
}

function subjectGuidance(subject: string) {
  if (isCrystalFormation(subject)) {
    return "Crystal shape: a natural cluster of separate prismatic points with sharp planar facets, angular edges, varied heights, and pointed tips; never a rounded cube or mascot.";
  }
  return "";
}

export function buildModelPrompt(data: ModelPromptInput) {
  const subject = cleanSubject(data.prompt);
  const base =
    data.inputMode === "image"
      ? subject
        ? `Recreate the reference object's subject exactly: ${subject}.`
        : "Recreate the main object in the reference image faithfully."
      : subject
        ? `Create exactly one standalone 3D asset: ${subject}.`
        : "Create one clean standalone 3D prop.";

  const allowsCharacterFeatures =
    CHARACTER_INTENT.test(subject) || ["character", "pet"].includes(selected(data.modelType));
  const identityRule = allowsCharacterFeatures
    ? "Preserve its defining anatomy, parts, proportions, silhouette, and requested expression."
    : "Object only: no face, eyes, mouth, limbs, body, or mascot features unless explicitly requested.";

  const wantsGloss = data.textureLook === "glossy";
  const finish = wantsGloss
    ? "Surface finish: clean with only a restrained satin sheen; never wet, mirror-like, or chrome."
    : "Matte clean finish: high roughness, zero metalness, no clearcoat, wet/plastic sheen, reflections, or baked-in highlights.";

  const hints: string[] = [];
  const modelType = selected(data.modelType);
  const robloxStyle = selected(data.robloxStyle);
  const theme = selected(data.theme);
  const material = selected(data.material);
  if (modelType) hints.push(`${modelType} asset`);
  if (robloxStyle) hints.push(`${robloxStyle} style`);
  if (theme) hints.push(`${theme} theme`);
  if (material) hints.push(`${material} material`);
  if (data.useCustomColors && data.primaryColor && data.secondaryColor) {
    hints.push(`main colors ${data.primaryColor} and ${data.secondaryColor}`);
  }

  const hintLine = hints.length
    ? `Optional appearance hints only: ${hints.join(", ")}. These hints must never replace, hybridize, or reinterpret the requested subject.`
    : "";
  const riggingGuidance =
    data.rigged && allowsCharacterFeatures
      ? `Animation-ready character geometry: show the complete ${selected(data.rigType) || "articulated"} body in a neutral balanced pose, with a symmetrical stance, clearly separated limbs, visible joints, and no fused arms, legs, wings, or tail.`
      : "";

  return [
    base,
    "Literal subject fidelity comes first. Make it unmistakably recognizable as the named subject, not a variation, hybrid, or unrelated object.",
    "For a short request, add only the subject's standard defining features; do not invent a theme or extra object.",
    subjectGuidance(subject),
    identityRule,
    "Use clean watertight game-ready geometry and preserve defining proportions, silhouette, edges, and details.",
    riggingGuidance,
    finish,
    hintLine,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildModelNegativePrompt(data: ModelPromptInput) {
  const subject = cleanSubject(data.prompt);
  const allowsCharacterFeatures =
    CHARACTER_INTENT.test(subject) || ["character", "pet"].includes(selected(data.modelType));
  const allowsGloss = data.textureLook === "glossy";
  const negatives = [
    "wrong subject",
    "unrelated object",
    "random hybrid",
    "extra objects",
    "deformed",
    "melted",
    "blobby",
    "text",
    "logo",
    "watermark",
  ];

  if (!allowsCharacterFeatures) {
    negatives.push("character", "pet", "mascot", "face", "eyes", "mouth", "arms", "legs");
  }
  if (!allowsGloss) {
    negatives.push("glossy", "shiny", "wet", "mirror", "chrome", "metallic reflections");
  }
  if (isCrystalFormation(subject)) {
    negatives.push("rounded cube", "soft blob", "toy creature");
  }

  return negatives.reduce((result, item) => {
    const next = result ? `${result}, ${item}` : item;
    return next.length <= 255 ? next : result;
  }, "");
}
