// Roblox clothing & accessory domain knowledge.
//
// This encodes the *real* Roblox rules so the AI gives accurate, non-misleading
// guidance. The single most important truth here: text-to-image models produce
// 2D TEXTURE art, not 3D meshes. Classic shirts/pants ARE 2D textures, so they
// can be generated end-to-end. Layered clothing and 3D accessories (hats,
// wings, backpacks) are MESHES — we generate concept/texture art + a build
// spec, never a fake mesh.

export type ClothingKind = "classic_shirt" | "classic_pants" | "tshirt" | "layered_or_accessory";

// Official Roblox classic clothing template dimensions (the flat UV layout the
// avatar maps onto). Users paint inside these regions.
export const ROBLOX_CLASSIC_TEMPLATE = {
  width: 585,
  height: 559,
  note: "Roblox classic shirt/pants template is 585×559 px. The avatar wraps this flat texture onto the body — front, back, sides, arms/legs are laid out as connected panels.",
};

// T-shirts are just square decals shown on the torso front.
export const ROBLOX_TSHIRT = {
  recommended: "512x512",
  note: "A classic T-Shirt is a single square image (Decal) displayed flat on the torso front — NOT wrapped like a shirt. 512×512 is a good size.",
};

export const CLOTHING_KNOWLEDGE_PROMPT = `
## Roblox Clothing & Accessory Studio (how BloxSmith makes wearables)

You can help users create Roblox wearables. Be ACCURATE about what is a texture vs a mesh — never imply you produced a 3D mesh when you generated a 2D image.

### The core distinction (state this honestly when relevant)
- **Classic Shirt / Pants** = a single flat 2D TEXTURE (PNG) wrapped onto the avatar via Roblox's 585×559 template. You CAN generate these end-to-end with generate_clothing — the output PNG is upload-ready.
- **Classic T-Shirt** = a square Decal shown flat on the torso front (not wrapped). Also a 2D image you can generate.
- **Layered Clothing** (modern draping hoodies/jackets/dresses) and **3D Accessories** (hats, glasses, masks, backpacks, chains, wings, hair, shoulder items) = 3D MESHES. These require mesh modeling in Blender + Studio's Avatar Setup. You do NOT generate meshes. For these, generate concept/texture art + a clear build spec, and guide the user.

### When the user asks for a shirt / pants / uniform / classic outfit
1. Call generate_clothing with kind "classic_shirt" or "classic_pants" and a rich style description.
2. The tool returns a texture laid out for the Roblox template. Show it inline.
3. Tell them the upload path: Create → Avatar Items → Classic Clothing in the Creator Dashboard (or Studio Asset Manager), upload the PNG, and Roblox applies the template wrap. Mention the ~R$10 upload fee Roblox charges and that classic clothing requires a verified account / group.

### When the user asks for a hoodie / jacket / layered item / any accessory
1. Be upfront in ONE friendly sentence: these are 3D items, so you'll generate the design art + a build spec rather than a ready mesh.
2. Call generate_clothing with kind "tshirt" (for a wearable graphic) or use generate_image for pure concept art, AND give a build spec: silhouette, key shapes, attachment point (e.g. Hat → Head, Back accessory → use a Back attachment), recommended scale, and texture notes.
3. Point them to the real path: model in Blender (or buy/commission a base mesh), import via Studio → Avatar → Accessory Fitting Tool, set the Attachment, then publish as an Accessory. Offer to generate the texture/decal for that mesh.

### Outfit sets & ideas
- For "full outfit" / "clothing set" requests, generate the shirt AND pants as two coordinated textures, plus an accessory build spec to complete the look. Keep a consistent palette and theme across pieces.
- For "outfit ideas" (no generation), give 3-5 concrete themed concepts with palettes and the catalog items or generatable pieces that achieve each.

### Quality bar for generated clothing textures
- Bold, readable, game-appropriate; avoid tiny detail that blurs when wrapped on the low-res avatar.
- Respect the body layout: design for front torso, back, and sleeves as connected regions — not a single centered logo unless it's a T-Shirt.
- Honor the user's colors/theme exactly. "black and red cyber hoodie" = dark base, red accents, techwear/cyber motifs.
- Never produce real-world brand logos, copyrighted characters, or another creator's art. Original designs only.

### Safety
- Decline requests for clothing that depicts real brand IP, hateful/explicit imagery, or impersonates Roblox's own moderation/staff items.
`;

/**
 * Build the Gemini prompt for a clothing texture, given the kind and the user's
 * style description. For classic shirt/pants we instruct a template-style flat
 * layout; for t-shirt we instruct a centered square graphic.
 */
export function buildClothingImagePrompt(kind: ClothingKind, style: string): string {
  const cleanStyle = style.trim().slice(0, 900);
  if (kind === "classic_shirt") {
    return `Generate a Roblox CLASSIC SHIRT texture template image. This MUST be a flat 2D UV layout at approximately 585x559 pixel proportions.

The layout should show connected panels arranged exactly as a Roblox classic clothing template:
- TORSO FRONT panel (center-left area)
- TORSO BACK panel (center-right area)
- LEFT ARM panel (left side)
- RIGHT ARM panel (right side)
All panels must be connected and seamlessly transition where they meet.

CRITICAL RULES:
- This is a FLAT template layout, NOT a 3D render, NOT a photo, NOT a mannequin/avatar.
- Fill EVERY panel completely with the design so no blank/transparent skin shows through on the avatar.
- Use bold, clean, game-appropriate colors and patterns that will look good when wrapped on a blocky Roblox avatar.
- Keep details large enough to be visible at low resolution — avoid tiny intricate patterns that blur when wrapped.

Design theme: ${cleanStyle}

Original artwork only — no real-world brand logos, copyrighted characters, or other creators' art.`;
  }
  if (kind === "classic_pants") {
    return `Generate a Roblox CLASSIC PANTS texture template image. This MUST be a flat 2D UV layout at approximately 585x559 pixel proportions.

The layout should show connected panels arranged exactly as a Roblox classic pants template:
- LEFT LEG FRONT panel
- LEFT LEG BACK panel
- RIGHT LEG FRONT panel
- RIGHT LEG BACK panel
- HIP/WAIST connecting panels
All panels must be connected and seamlessly transition where they meet.

CRITICAL RULES:
- This is a FLAT template layout, NOT a 3D render, NOT a photo, NOT a mannequin/avatar.
- Fill EVERY panel completely so no blank/transparent skin shows through.
- Use bold, clean, game-appropriate colors and patterns.
- Keep details large enough to be visible at low resolution.

Design theme: ${cleanStyle}

Original artwork only — no real-world brand logos, copyrighted characters, or other creators' art.`;
  }
  if (kind === "tshirt") {
    return `Generate a Roblox T-SHIRT graphic: a single bold, centered square design (512x512 ideal proportions) on a clean background. This will be displayed flat on a Roblox avatar's torso front as a Decal.

CRITICAL RULES:
- This is a square image, NOT a template layout.
- Center the main design element with some padding.
- Use bold, high-contrast colors that pop on a game avatar.
- No 3D perspective, no mannequin, no avatar model.

Design theme: ${cleanStyle}

Original artwork only — no real-world brand logos, copyrighted characters, or other creators' art.`;
  }
  // layered_or_accessory — concept art + build spec
  return `Generate polished CONCEPT ART for a Roblox 3D accessory/layered clothing item. This is design reference art that a 3D modeler will use to build the item in Blender.

Show the item from multiple angles if possible (front + side + back), with:
- Clear silhouette and proportions suitable for a Roblox avatar (blocky/stylized, not realistic)
- Color palette callouts
- Key shape details and surface texture notes
- Scale reference relative to a Roblox character head/body

CRITICAL RULES:
- This is CONCEPT ART, not a ready-to-use texture or mesh.
- Make it look like a professional game asset design sheet.
- Use clean, well-lit presentation on a neutral background.

Design theme: ${cleanStyle}

Original artwork only — no real-world brand logos, copyrighted characters, or other creators' art.`;
}
