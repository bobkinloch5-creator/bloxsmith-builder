import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outDir = path.join(root, "public", "generator-option-previews");

const groups = {
  model: ["pet", "character", "weapon", "prop", "building", "vehicle", "simulator item", "map piece", "accessory", "tool"],
  style: ["chunky", "low-poly", "cartoon", "anime", "simulator", "obby", "tycoon", "realistic-lite"],
  theme: ["neon", "fantasy", "sci-fi", "city", "horror", "cute", "medieval", "pirate", "space", "premium"],
  material: ["plastic", "metal", "wood", "stone", "glass", "crystal", "fabric", "neon"],
  quality: ["turbo", "standard", "detailed"],
  format: ["GLB", "OBJ", "FBX"],
  texture: ["clean", "painted", "toy-like", "glossy", "matte", "pixel", "cel-shaded", "worn"],
  textFont: ["GothamBlack", "FredokaOne", "Bangers", "Cartoon", "Arcade", "SciFi"],
  textEffect: ["neon", "outline", "gold", "ice", "shadow"],
  textAnimation: ["float", "pulse", "spin", "bounce", "none"],
  animation: ["idle", "walk", "run", "attack", "emote", "dance", "pet", "npc", "tool", "jump"],
  motion: ["snappy", "smooth", "cartoony", "heroic", "scary", "cute", "robotic", "floaty"],
  easing: ["sine", "quad", "back", "elastic", "linear"],
  body: ["full body", "upper body", "arms", "legs", "head", "tool hand", "tail/pet"],
};

const palettes = [
  ["#14f195", "#0891b2", "#031612"],
  ["#f97316", "#fb7185", "#190704"],
  ["#8b5cf6", "#22d3ee", "#09051b"],
  ["#facc15", "#f59e0b", "#171000"],
  ["#38bdf8", "#2563eb", "#03101c"],
  ["#ef4444", "#7c2d12", "#190405"],
  ["#22c55e", "#84cc16", "#031407"],
  ["#e879f9", "#a855f7", "#16051b"],
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function titleCase(value) {
  return value.replace(/[-_/]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function hash(input) {
  let h = 2166136261;
  for (const char of input) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cube(x, y, size, color, accent = "#ffffff", opacity = 1) {
  const top = `M${x} ${y} L${x + size} ${y - size * 0.38} L${x + size * 2} ${y} L${x + size} ${y + size * 0.38} Z`;
  const left = `M${x} ${y} L${x + size} ${y + size * 0.38} L${x + size} ${y + size * 1.5} L${x} ${y + size * 1.08} Z`;
  const right = `M${x + size * 2} ${y} L${x + size} ${y + size * 0.38} L${x + size} ${y + size * 1.5} L${x + size * 2} ${y + size * 1.08} Z`;
  return `
    <g opacity="${opacity}">
      <path d="${top}" fill="${accent}" opacity="0.82"/>
      <path d="${left}" fill="${color}" opacity="0.98"/>
      <path d="${right}" fill="#020617" opacity="0.34"/>
      <path d="${top} ${left} ${right}" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
    </g>
  `;
}

function robloxBody(cx, cy, color, pose = "idle", scale = 1) {
  const lean = pose === "run" ? -12 : pose === "attack" ? 10 : pose === "dance" ? -6 : 0;
  const armL = pose === "dance" || pose === "emote" ? -78 : pose === "attack" ? 30 : pose === "walk" || pose === "run" ? -24 : -8;
  const armR = pose === "attack" ? -78 : pose === "dance" ? 68 : pose === "tool" ? -54 : pose === "walk" || pose === "run" ? 28 : 10;
  const legL = pose === "jump" ? -18 : pose === "run" ? 32 : pose === "walk" ? 18 : 0;
  const legR = pose === "jump" ? 18 : pose === "run" ? -28 : pose === "walk" ? -16 : 0;
  return `
    <g transform="translate(${cx} ${cy}) scale(${scale}) rotate(${lean})" stroke="#020617" stroke-opacity="0.5" stroke-width="3">
      <rect x="-30" y="-84" width="60" height="44" rx="10" fill="#ffd166"/>
      <rect x="-44" y="-38" width="88" height="72" rx="10" fill="${color}"/>
      <g transform="translate(-58 -28) rotate(${armL})"><rect x="-13" y="0" width="26" height="72" rx="9" fill="#ffd166"/></g>
      <g transform="translate(58 -28) rotate(${armR})"><rect x="-13" y="0" width="26" height="72" rx="9" fill="#ffd166"/></g>
      <g transform="translate(-25 34) rotate(${legL})"><rect x="-13" y="0" width="26" height="70" rx="8" fill="#2563eb"/></g>
      <g transform="translate(25 34) rotate(${legR})"><rect x="-13" y="0" width="26" height="70" rx="8" fill="#2563eb"/></g>
      <circle cx="-12" cy="-66" r="4" fill="#020617"/><circle cx="12" cy="-66" r="4" fill="#020617"/>
      <path d="M-13 -54 Q0 -44 14 -54" fill="none" stroke="#020617" stroke-width="4" stroke-linecap="round"/>
    </g>
  `;
}

function pet(cx, cy, color) {
  return `
    <g transform="translate(${cx} ${cy})" stroke="#020617" stroke-opacity="0.45" stroke-width="3">
      <rect x="-58" y="-36" width="116" height="74" rx="24" fill="${color}"/>
      <rect x="-74" y="-54" width="42" height="42" rx="14" fill="${color}"/>
      <rect x="32" y="-54" width="42" height="42" rx="14" fill="${color}"/>
      <circle cx="-23" cy="-2" r="7" fill="#020617"/><circle cx="23" cy="-2" r="7" fill="#020617"/>
      <path d="M-19 20 Q0 33 21 20" fill="none" stroke="#020617" stroke-width="5" stroke-linecap="round"/>
      <circle cx="-58" cy="44" r="13" fill="#facc15"/><circle cx="58" cy="44" r="13" fill="#facc15"/>
    </g>
  `;
}

function sword(cx, cy, accent) {
  return `
    <g transform="translate(${cx} ${cy}) rotate(-38)" stroke-linejoin="round">
      <rect x="-13" y="-92" width="26" height="152" rx="9" fill="#cbd5e1" stroke="#020617" stroke-width="4"/>
      <path d="M0 -132 L31 -86 L0 -96 L-31 -86 Z" fill="#e2e8f0" stroke="#020617" stroke-width="4"/>
      <rect x="-62" y="50" width="124" height="18" rx="8" fill="${accent}" stroke="#020617" stroke-width="4"/>
      <rect x="-16" y="66" width="32" height="62" rx="10" fill="#78350f" stroke="#020617" stroke-width="4"/>
    </g>
  `;
}

function subjectFor(group, item, colors) {
  const [accent, accent2] = colors;
  const key = `${group}:${item}`;
  switch (key) {
    case "model:pet": return pet(256, 132, accent);
    case "model:character": return robloxBody(256, 160, accent, "idle", 1.12);
    case "model:weapon": return sword(258, 145, accent);
    case "model:prop": return `${cube(178, 112, 58, "#a16207", accent)}${cube(278, 136, 36, "#64748b", accent2)}`;
    case "model:building": return `${cube(170, 104, 54, "#334155", "#38bdf8")}${cube(264, 84, 68, "#475569", "#22d3ee")}${cube(234, 158, 38, "#0f172a", "#facc15")}`;
    case "model:vehicle": return `<g>${cube(172, 134, 64, accent, "#60a5fa")}<circle cx="196" cy="215" r="24" fill="#020617"/><circle cx="324" cy="215" r="24" fill="#020617"/></g>`;
    case "model:simulator item": return `<g>${cube(178, 116, 48, "#facc15", "#fef08a")}<circle cx="314" cy="144" r="50" fill="${accent}" opacity=".85"/><text x="292" y="160" font-size="34" font-weight="900" fill="#020617">$</text></g>`;
    case "model:map piece": return `${cube(128, 142, 46, "#22c55e", "#86efac")}${cube(224, 108, 46, "#38bdf8", "#bae6fd")}${cube(320, 142, 46, "#f97316", "#fed7aa")}`;
    case "model:accessory": return `<g><circle cx="256" cy="140" r="70" fill="#ffd166"/><path d="M180 126 Q256 52 332 126 L314 146 Q256 96 198 146 Z" fill="${accent}" stroke="#020617" stroke-width="5"/><rect x="188" y="142" width="136" height="26" rx="13" fill="${accent2}" stroke="#020617" stroke-width="4"/></g>`;
    case "model:tool": return `<g transform="translate(256 145) rotate(-32)"><rect x="-18" y="-96" width="36" height="186" rx="12" fill="#92400e" stroke="#020617" stroke-width="5"/><rect x="-72" y="-116" width="144" height="48" rx="14" fill="#94a3b8" stroke="#020617" stroke-width="5"/></g>`;
    case "material:plastic": return `${cube(164, 104, 78, "#22c55e", "#bbf7d0")}<circle cx="328" cy="100" r="32" fill="#ffffff" opacity=".34"/>`;
    case "material:metal": return sword(256, 145, "#94a3b8");
    case "material:wood": return `<g>${cube(145, 130, 45, "#92400e", "#f59e0b")}${cube(236, 122, 45, "#78350f", "#d97706")}${cube(327, 130, 45, "#a16207", "#fbbf24")}</g>`;
    case "material:stone": return `<g>${cube(136, 150, 42, "#64748b", "#cbd5e1")}${cube(214, 116, 42, "#475569", "#94a3b8")}${cube(292, 150, 42, "#334155", "#e2e8f0")}</g>`;
    case "material:glass": return `<g><rect x="176" y="68" width="160" height="152" rx="16" fill="#67e8f9" opacity=".42" stroke="#cffafe" stroke-width="7"/><path d="M194 206 L320 80" stroke="#ffffff" stroke-opacity=".72" stroke-width="8"/></g>`;
    case "material:crystal": return `<g>${crystal(202, 166, "#22d3ee")}${crystal(260, 134, "#a78bfa")}${crystal(314, 172, "#38bdf8")}</g>`;
    case "material:fabric": return `<g><path d="M184 72 L184 226" stroke="#e2e8f0" stroke-width="10"/><path d="M194 78 C250 48 286 102 342 72 L342 158 C286 188 250 132 194 164 Z" fill="${accent}" stroke="#020617" stroke-width="5"/></g>`;
    case "material:neon": return neonSign("NEON", accent, accent2);
    case "theme:neon": return neonSign("NEON", "#22d3ee", "#f472b6");
    case "theme:fantasy": return castle("#8b5cf6", "#facc15");
    case "theme:sci-fi": return rover("#22d3ee");
    case "theme:city": return city("#38bdf8");
    case "theme:horror": return haunted();
    case "theme:cute": return pet(256, 135, "#f9a8d4");
    case "theme:medieval": return castle("#64748b", "#ef4444");
    case "theme:pirate": return `<g><path d="M142 190 Q256 238 370 190 L336 230 L176 230 Z" fill="#78350f"/><path d="M256 62 L256 190" stroke="#e2e8f0" stroke-width="8"/><path d="M264 74 L344 126 L264 170 Z" fill="#020617" stroke="#facc15" stroke-width="5"/></g>`;
    case "theme:space": return `<g><circle cx="272" cy="132" r="70" fill="#2563eb"/><ellipse cx="272" cy="132" rx="116" ry="28" fill="none" stroke="#a78bfa" stroke-width="10"/><path d="M170 196 L204 112 L236 196 Z" fill="#f97316" stroke="#020617" stroke-width="5"/></g>`;
    case "theme:premium": return `<g>${cube(178, 126, 66, "#ca8a04", "#fde68a")}<path d="M250 74 L276 116 L326 118 L286 150 L298 202 L250 174 L202 202 L214 150 L174 118 L224 116 Z" fill="#facc15" stroke="#020617" stroke-width="5"/></g>`;
    case "style:chunky": return `${cube(150, 112, 82, accent, "#bbf7d0")}<rect x="284" y="91" width="82" height="118" rx="22" fill="${accent2}" stroke="#020617" stroke-width="5"/>`;
    case "style:low-poly": return `<g><path d="M160 196 L242 72 L350 116 L384 210 L236 232 Z" fill="#38bdf8" stroke="#020617" stroke-width="5"/><path d="M242 72 L236 232 L350 116" fill="none" stroke="#e0f2fe" stroke-width="4" opacity=".75"/></g>`;
    case "style:cartoon": return pet(256, 135, "#fb7185");
    case "style:anime": return `<g>${robloxBody(256, 166, "#a78bfa", "emote", 1)}<path d="M214 76 Q256 22 300 76 Q274 64 256 88 Q238 64 214 76" fill="#0f172a"/></g>`;
    case "style:simulator": return subjectFor("model", "simulator item", colors);
    case "style:obby": return subjectFor("model", "map piece", colors);
    case "style:tycoon": return `${city("#22c55e")}<rect x="144" y="210" width="224" height="22" rx="11" fill="#475569"/>`;
    case "style:realistic-lite": return `<g>${cube(164, 116, 62, "#475569", "#fef3c7")}${cube(278, 126, 42, "#64748b", "#e2e8f0")}<circle cx="336" cy="80" r="30" fill="#facc15"/></g>`;
    case "quality:turbo": return `<g>${rover("#14f195")}<path d="M152 78 C248 32 322 42 390 82" stroke="#14f195" stroke-width="10" fill="none"/></g>`;
    case "quality:standard": return `${cube(176, 122, 60, "#38bdf8", "#bae6fd")}${cube(292, 142, 38, "#22c55e", "#bbf7d0")}`;
    case "quality:detailed": return `<g>${castle("#64748b", "#facc15")}<circle cx="188" cy="94" r="6" fill="#fef3c7"/><circle cx="324" cy="108" r="6" fill="#fef3c7"/></g>`;
    case "format:GLB": return `${cube(190, 100, 74, "#14f195", "#bbf7d0")}<text x="212" y="200" font-size="44" font-weight="900" fill="#020617">GLB</text>`;
    case "format:OBJ": return `${cube(190, 100, 74, "#f97316", "#fed7aa")}<text x="208" y="200" font-size="44" font-weight="900" fill="#020617">OBJ</text>`;
    case "format:FBX": return `${robloxBody(256, 150, "#8b5cf6", "idle", .8)}<text x="204" y="222" font-size="44" font-weight="900" fill="#e2e8f0">FBX</text>`;
    case "texture:clean": return `${cube(174, 106, 72, "#38bdf8", "#ffffff")}`;
    case "texture:painted": return `${cube(174, 106, 72, "#f97316", "#fef3c7")}<circle cx="324" cy="98" r="20" fill="#22c55e"/><circle cx="292" cy="174" r="17" fill="#8b5cf6"/>`;
    case "texture:toy-like": return pet(256, 135, "#22c55e");
    case "texture:glossy": return `${cube(172, 104, 76, "#0ea5e9", "#e0f2fe")}<path d="M218 87 L304 59" stroke="#ffffff" stroke-width="10" opacity=".72"/>`;
    case "texture:matte": return `${cube(172, 104, 76, "#64748b", "#94a3b8")}`;
    case "texture:pixel": return pixelMosaic();
    case "texture:cel-shaded": return `<g>${cube(172, 104, 76, "#facc15", "#fde68a")}<path d="M172 104 L248 75 L324 104" fill="none" stroke="#020617" stroke-width="9"/></g>`;
    case "texture:worn": return `${cube(172, 104, 76, "#92400e", "#d97706")}<path d="M210 134 L260 126 M232 174 L304 160" stroke="#020617" stroke-width="7" opacity=".55"/>`;
    case "textEffect:neon": return neonSign("TEXT", "#22d3ee", "#f472b6");
    case "textEffect:outline": return `<text x="154" y="166" font-size="66" font-weight="900" fill="#020617" stroke="#facc15" stroke-width="5">TEXT</text>`;
    case "textEffect:gold": return `<text x="154" y="166" font-size="66" font-weight="900" fill="#facc15" stroke="#78350f" stroke-width="4">GOLD</text>`;
    case "textEffect:ice": return `<text x="176" y="166" font-size="66" font-weight="900" fill="#bfdbfe" stroke="#38bdf8" stroke-width="4">ICE</text>`;
    case "textEffect:shadow": return `<text x="162" y="178" font-size="66" font-weight="900" fill="#020617" opacity=".8">TXT</text><text x="150" y="162" font-size="66" font-weight="900" fill="#e2e8f0">TXT</text>`;
    case "textAnimation:float": return `<g>${neonSign("FLOAT", accent, accent2)}<path d="M166 206 C218 176 294 232 350 196" stroke="${accent}" stroke-width="8" fill="none"/></g>`;
    case "textAnimation:pulse": return `<g><circle cx="256" cy="140" r="100" fill="${accent}" opacity=".16"/><circle cx="256" cy="140" r="64" fill="${accent}" opacity=".2"/>${neonSign("PULSE", accent, accent2)}</g>`;
    case "textAnimation:spin": return `<g>${neonSign("SPIN", accent, accent2)}<path d="M366 91 A92 92 0 1 1 158 184" stroke="${accent2}" stroke-width="9" fill="none"/></g>`;
    case "textAnimation:bounce": return `<g>${neonSign("BOUNCE", accent, accent2)}<circle cx="168" cy="214" r="10" fill="${accent}"/><circle cx="256" cy="224" r="10" fill="${accent}"/><circle cx="344" cy="210" r="10" fill="${accent}"/></g>`;
    case "textAnimation:none": return neonSign("STATIC", "#94a3b8", "#e2e8f0");
    case "textFont:GothamBlack": return fontPreview("Gotham", "#e2e8f0", "900");
    case "textFont:FredokaOne": return fontPreview("Round", "#f9a8d4", "900");
    case "textFont:Bangers": return fontPreview("Bang!", "#f97316", "900");
    case "textFont:Cartoon": return fontPreview("Toon", "#facc15", "900");
    case "textFont:Arcade": return pixelMosaic("ARCADE");
    case "textFont:SciFi": return neonSign("SCI-FI", "#22d3ee", "#8b5cf6");
    case "motion:snappy": return robloxBody(256, 160, accent, "attack", 1);
    case "motion:smooth": return robloxBody(256, 160, accent, "walk", 1);
    case "motion:cartoony": return pet(256, 135, "#fb7185");
    case "motion:heroic": return robloxBody(256, 160, "#facc15", "emote", 1);
    case "motion:scary": return haunted();
    case "motion:cute": return pet(256, 135, "#f9a8d4");
    case "motion:robotic": return robloxBody(256, 160, "#94a3b8", "idle", 1);
    case "motion:floaty": return `<g>${robloxBody(256, 144, accent, "jump", .92)}<ellipse cx="256" cy="234" rx="88" ry="18" fill="#020617" opacity=".45"/></g>`;
    case "easing:sine": return curve("M118 166 C176 74 236 74 294 166 C328 220 374 220 410 166", "#38bdf8");
    case "easing:quad": return curve("M118 204 C172 190 236 132 410 74", "#facc15");
    case "easing:back": return curve("M118 170 C176 224 184 70 410 86", "#f97316");
    case "easing:elastic": return curve("M112 156 C150 54 178 254 214 156 C254 54 278 254 318 156 C350 74 374 84 410 92", "#22c55e");
    case "easing:linear": return curve("M118 202 L410 78", "#94a3b8");
    case "body:full body": return robloxBody(256, 160, accent, "idle", 1.05);
    case "body:upper body": return `<g>${robloxBody(256, 184, accent, "emote", 1.15)}<rect x="126" y="184" width="260" height="78" fill="#020617"/></g>`;
    case "body:arms": return robloxBody(256, 160, accent, "emote", 1);
    case "body:legs": return robloxBody(256, 146, accent, "run", 1);
    case "body:head": return `<g><rect x="186" y="76" width="140" height="132" rx="24" fill="#ffd166" stroke="#020617" stroke-width="6"/><circle cx="226" cy="132" r="8" fill="#020617"/><circle cx="286" cy="132" r="8" fill="#020617"/><path d="M218 164 Q256 190 296 164" stroke="#020617" stroke-width="7" fill="none"/></g>`;
    case "body:tool hand": return `<g>${robloxBody(220, 168, accent, "tool", .82)}<g transform="translate(318 134) rotate(-30)"><rect x="-13" y="-66" width="26" height="132" rx="8" fill="#92400e"/><rect x="-44" y="-82" width="88" height="35" rx="10" fill="#94a3b8"/></g></g>`;
    case "body:tail/pet": return pet(256, 135, accent);
  }
  if (group === "animation") return robloxBody(256, 160, accent, item, 1);
  return `${cube(170, 110, 72, accent, accent2)}${cube(292, 140, 38, accent2, accent)}`;
}

function crystal(cx, cy, color) {
  return `<path d="M${cx} ${cy - 74} L${cx + 42} ${cy - 24} L${cx + 24} ${cy + 54} L${cx - 34} ${cy + 48} L${cx - 48} ${cy - 20} Z" fill="${color}" opacity=".88" stroke="#cffafe" stroke-width="4"/>`;
}

function neonSign(text, c1, c2) {
  return `
    <g filter="url(#softGlow)">
      <rect x="126" y="82" width="260" height="112" rx="24" fill="#020617" stroke="${c1}" stroke-width="5"/>
      <text x="256" y="156" font-size="${text.length > 5 ? 44 : 58}" font-weight="900" text-anchor="middle" fill="${c2}" stroke="${c1}" stroke-width="1.5">${escapeText(text)}</text>
    </g>
  `;
}

function castle(color, flag) {
  return `
    <g stroke="#020617" stroke-width="5">
      <rect x="152" y="118" width="208" height="104" rx="10" fill="${color}"/>
      <rect x="132" y="84" width="58" height="138" rx="10" fill="${color}"/>
      <rect x="322" y="84" width="58" height="138" rx="10" fill="${color}"/>
      <path d="M132 84 L160 52 L190 84 M322 84 L350 52 L380 84" fill="${color}"/>
      <path d="M256 76 L256 42 L324 66 L256 88 Z" fill="${flag}"/>
      <rect x="232" y="160" width="48" height="62" rx="22" fill="#020617" opacity=".72"/>
    </g>
  `;
}

function city(color) {
  return `
    <g stroke="#020617" stroke-width="5">
      <rect x="138" y="106" width="58" height="116" rx="8" fill="#334155"/>
      <rect x="212" y="70" width="72" height="152" rx="8" fill="#475569"/>
      <rect x="302" y="118" width="68" height="104" rx="8" fill="#1f2937"/>
      ${[156, 174, 232, 254, 322, 344].map((x) => `<rect x="${x}" y="132" width="10" height="16" fill="${color}"/>`).join("")}
    </g>
  `;
}

function rover(color) {
  return `
    <g stroke="#020617" stroke-width="5">
      <rect x="160" y="118" width="192" height="76" rx="18" fill="${color}"/>
      <rect x="218" y="82" width="80" height="48" rx="16" fill="#e0f2fe"/>
      <circle cx="194" cy="206" r="26" fill="#020617"/><circle cx="318" cy="206" r="26" fill="#020617"/>
      <circle cx="194" cy="206" r="12" fill="#64748b"/><circle cx="318" cy="206" r="12" fill="#64748b"/>
    </g>
  `;
}

function haunted() {
  return `
    <g stroke="#020617" stroke-width="5">
      <path d="M154 218 L154 108 L256 48 L358 108 L358 218 Z" fill="#111827"/>
      <path d="M214 218 L214 150 Q256 116 298 150 L298 218 Z" fill="#020617"/>
      <circle cx="220" cy="120" r="10" fill="#facc15"/><circle cx="292" cy="120" r="10" fill="#facc15"/>
      <path d="M174 98 L134 76 M338 98 L378 76" stroke="#7f1d1d" stroke-width="9"/>
    </g>
  `;
}

function pixelMosaic(text = "") {
  const squares = [];
  const colors = ["#22c55e", "#38bdf8", "#f97316", "#8b5cf6", "#facc15"];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      squares.push(`<rect x="${150 + col * 28}" y="${78 + row * 28}" width="24" height="24" fill="${colors[(row + col) % colors.length]}"/>`);
    }
  }
  return `<g>${squares.join("")}${text ? `<text x="256" y="238" font-size="36" font-weight="900" text-anchor="middle" fill="#e2e8f0">${text}</text>` : ""}</g>`;
}

function fontPreview(text, color, weight) {
  return `<text x="256" y="158" font-size="58" font-weight="${weight}" text-anchor="middle" fill="${color}" stroke="#020617" stroke-width="5">${escapeText(text)}</text>`;
}

function curve(d, color) {
  return `<g><path d="${d}" fill="none" stroke="#020617" stroke-width="20" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"/><circle cx="118" cy="202" r="15" fill="${color}"/><circle cx="410" cy="78" r="15" fill="${color}"/></g>`;
}

function svgFor(group, item, groupIndex, itemIndex) {
  const colors = palettes[(groupIndex + itemIndex) % palettes.length];
  const [accent, accent2, bg] = colors;
  const subject = subjectFor(group, item, colors);

  return Buffer.from(`
    <svg width="512" height="288" viewBox="0 0 512 288" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${bg}"/>
          <stop offset="0.56" stop-color="#020617"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0.42"/>
        </linearGradient>
        <radialGradient id="spot" cx="50%" cy="35%" r="62%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.2"/>
          <stop offset="0.36" stop-color="${accent2}" stop-opacity="0.18"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="${accent}" stroke-opacity="0.16" stroke-width="1"/>
        </pattern>
        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="premiumShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="18" stdDeviation="13" flood-color="#000000" flood-opacity="0.5"/>
          <feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="${accent}" flood-opacity="0.26"/>
        </filter>
      </defs>
      <rect width="512" height="288" fill="url(#bg)"/>
      <rect width="512" height="288" fill="url(#grid)"/>
      <rect width="512" height="288" fill="url(#spot)"/>
      <path d="M0 230 C92 198 164 238 254 206 C346 174 432 204 512 170 L512 288 L0 288 Z" fill="#020617" opacity="0.46"/>
      <ellipse cx="256" cy="232" rx="178" ry="28" fill="#000" opacity="0.34"/>
      <g filter="url(#premiumShadow)" transform="translate(256 136) scale(1.1) translate(-256 -136)">${subject}</g>
      <rect x="0" y="0" width="512" height="288" fill="#000" opacity="0.03"/>
      <rect x="0" y="0" width="512" height="288" fill="none" stroke="${accent}" stroke-opacity="0.24" stroke-width="3"/>
    </svg>
  `);
}

await fs.mkdir(outDir, { recursive: true });

let created = 0;
for (const [groupIndex, [group, items]] of Object.entries(groups).entries()) {
  for (const [itemIndex, item] of items.entries()) {
    const svg = svgFor(group, item, groupIndex, itemIndex);
    const output = path.join(outDir, `${group}-${slug(item)}.webp`);
    await sharp(svg).webp({ quality: 88 }).toFile(output);
    created += 1;
  }
}

console.log(`Created ${created} purpose-built Roblox-style option previews in ${path.relative(root, outDir)}`);
