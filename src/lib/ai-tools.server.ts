import { tool } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getNeokensApiKey, getNeokensChatCompletionsUrl } from "@/lib/neokens-config.server";

// Tools the AI can call mid-thought to:
//  - research the web
//  - read the user's live Studio workspace + stored project files
//  - search the Roblox catalog/toolbox (verified creators only by default)
//  - fetch terrain biome presets it can queue as actions
// Every tool is side-effect-free (read-only) so it's safe to expose to the model.

export type BloxSmithToolCtx = {
  projectId?: string | null;
  userId?: string | null;
  /**
   * Optional reference image (data URL) the user uploaded with their request.
   * When present, image-generating tools can use it to guide the design. If
   * absent, the model describes the reference in the `style` text instead.
   */
  referenceImageDataUrl?: string | null;
};

// ── Roblox asset search (shared helper) ────────────────────────────────
// Uses Roblox's toolbox-service for Models/Decals/Audio/Meshes/Animations/
// Plugins (where catalog API doesn't work), and falls back to the catalog
// API for wearables (Hats/Gear/Accessories/Faces).
const TOOLBOX_CATEGORY_MAP: Record<string, number> = {
  Models: 10,
  Decals: 13,
  Audio: 3,
  Meshes: 40,
  Animations: 24,
  Plugins: 38,
  All: 10,
};

const RBX_HEADERS = {
  "User-Agent": "Mozilla/5.0 BloxSmith/1.0",
  Accept: "application/json",
};

const UNSAFE_ASSET_TERMS = [
  "admin",
  "backdoor",
  "ban all",
  "bitcoin",
  "bypass",
  "cheat",
  "exploit",
  "free robux",
  "grabber",
  "hack",
  "infected",
  "infinite yield",
  "loadstring",
  "nsfw",
  "require",
  "script builder",
  "server destroyer",
  "virus",
  "xxx",
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "game",
  "generate",
  "make",
  "map",
  "me",
  "my",
  "of",
  "please",
  "roblox",
  "the",
  "to",
  "use",
  "with",
]);

function cleanPromptTerms(input: string, max = 5) {
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  return Array.from(new Set(words)).slice(0, max);
}

function safeAssetName(name: string, fallback = "ToolboxAsset") {
  const cleaned = (name || fallback).replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  return (cleaned || fallback).slice(0, 64);
}

function hasUnsafeAssetTerms(item: any) {
  const haystack =
    `${item?.name ?? ""} ${item?.description ?? ""} ${item?.creator ?? ""}`.toLowerCase();
  return UNSAFE_ASSET_TERMS.some((term) => haystack.includes(term));
}

function assetQualityScore(item: any, query: string, groupLabel = "") {
  const name = String(item?.name ?? "").toLowerCase();
  const creator = String(item?.creator ?? "").toLowerCase();
  const queryTerms = cleanPromptTerms(`${query} ${groupLabel}`, 8);
  const relevance = queryTerms.reduce((sum, term) => sum + (name.includes(term) ? 18 : 0), 0);
  const voteCount = Number(item?.voteCount ?? 0);
  const upVotePercent = Number(item?.upVotePercent ?? 0);
  const voteScore = Math.min(
    45,
    upVotePercent * Math.log10(voteCount + 1),
  );
  const favorites = Number(item?.favorites ?? 0);
  const favoriteScore = Math.min(30, Math.log10(favorites + 1) * 10);
  // Reward high-quality naming (descriptive names, not "Model" or "Part")
  const nameQuality = name.length > 8 && !/^(model|part|asset|thing|test|new|copy|old)$/i.test(name) ? 8 : 0;
  const trustScore = item?.verified || creator === "roblox" ? 25 : 0;
  const freeScore = (item?.price ?? 0) === 0 ? 20 : -100;
  const saleScore = item?.isForSale === false ? -20 : 0;
  const riskyPenalty = hasUnsafeAssetTerms(item) ? -250 : 0;
  // Penalize very low vote counts harder (likely low-quality or abandoned)
  const lowVotePenalty = voteCount < 3 ? -15 : 0;
  return relevance + voteScore + favoriteScore + nameQuality + trustScore + freeScore + saleScore + riskyPenalty + lowVotePenalty;
}

function dedupeAndRankAssets(
  items: any[],
  query: string,
  limit: number,
  groupLabel = "",
  usedIds?: Set<number>,
) {
  const seenNames = new Set<string>();
  const ranked = items
    .filter((item) => Number.isFinite(Number(item?.assetId)))
    .filter((item) => (item?.price ?? 0) === 0)
    .filter((item) => !hasUnsafeAssetTerms(item))
    .filter((item) => {
      const id = Number(item.assetId);
      if (usedIds?.has(id)) return false;
      const nameKey = String(item.name ?? "")
        .toLowerCase()
        .replace(/\s+\d+$/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (nameKey && seenNames.has(nameKey)) return false;
      if (nameKey) seenNames.add(nameKey);
      return true;
    })
    .map((item) => ({ ...item, qualityScore: assetQualityScore(item, query, groupLabel) }))
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
  return ranked.slice(0, limit);
}

type ToolboxPlanGroup = {
  label: string;
  category: string;
  queries: string[];
  parent: string;
  count: number;
};

function uniqueQueries(queries: string[]) {
  return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
}

function buildToolboxPlanGroups(prompt: string, requestedTypes: string[] = []): ToolboxPlanGroup[] {
  const lower = prompt.toLowerCase();
  const terms = cleanPromptTerms(prompt, 4);
  const theme = terms.length ? terms.join(" ") : "roblox";
  const requested = new Set(requestedTypes.map((t) => t.toLowerCase()));
  const groups: ToolboxPlanGroup[] = [];
  const add = (
    label: string,
    category: string,
    parent: string,
    count: number,
    queries: string[],
  ) => {
    if (
      requested.size &&
      !requested.has(label.toLowerCase()) &&
      !requested.has(category.toLowerCase())
    )
      return;
    groups.push({ label, category, parent, count, queries: uniqueQueries(queries) });
  };

  if (
    /\b(open[-\s]?world|city|town|roleplay|rp|street|downtown|police|wanted|apartment|garage|miami|beach)\b/.test(
      lower,
    )
  ) {
    add("Complete Map", "Models", "Workspace/Map/ToolboxMap", 2, [
      `${theme} city map`,
      "roleplay city map",
      "open world city map",
    ]);
    add("Roads", "Models", "Workspace/Map/Roads", 3, [
      `${theme} road kit`,
      "city road",
      "street road pack",
    ]);
    add("Buildings", "Models", "Workspace/Map/Buildings", 4, [
      `${theme} building`,
      "city building",
      "shop building",
    ]);
    add("Streetlights", "Models", "Workspace/Map/Decorations", 2, [
      "street light",
      "city lamp post",
    ]);
    add("Vehicles", "Models", "Workspace/Vehicles", 2, ["city car", "roblox vehicle car"]);
    add("Trees", "Models", "Workspace/Map/Nature", 2, ["city tree", "park tree"]);
    add("Signs", "Models", "Workspace/Map/Decorations", 2, ["street sign", "city sign"]);
    if (/\b(beach|miami|island|water|ocean|coast)\b/.test(lower)) {
      add("Beach", "Models", "Workspace/Map/Beach", 2, [
        "beach map kit",
        "ocean beach props",
        "palm tree beach",
      ]);
    }
    if (/\b(police|wanted|chase|crime)\b/.test(lower)) {
      add("Police", "Models", "Workspace/Map/Police", 2, [
        "police station",
        "police car",
        "police checkpoint",
      ]);
    }
  } else if (/\b(island|beach|ocean|coast|tropical)\b/.test(lower)) {
    add("Island Map", "Models", "Workspace/Map/ToolboxMap", 2, [
      `${theme} island map`,
      "tropical island map",
      "beach island",
    ]);
    add("Beach Props", "Models", "Workspace/Map/Beach", 3, [
      "palm tree beach",
      "beach props",
      "dock pier",
    ]);
    add("Nature", "Models", "Workspace/Map/Nature", 3, [
      "tropical tree pack",
      "rock pack",
      "waterfall",
    ]);
  } else if (/\b(racing|race|track|cars?|drift)\b/.test(lower)) {
    add("Race Track", "Models", "Workspace/Map/Track", 3, [
      `${theme} race track`,
      "racing track map",
      "road track kit",
    ]);
    add("Vehicles", "Models", "Workspace/Vehicles", 3, ["race car", "sports car", "go kart"]);
    add("Track Props", "Models", "Workspace/Map/Props", 3, [
      "race checkpoint",
      "finish line",
      "traffic cone",
    ]);
  } else if (/\b(military|army|base|bunker|fort|soldier)\b/.test(lower)) {
    add("Military Base", "Models", "Workspace/Map/ToolboxMap", 2, [
      `${theme} military base`,
      "army base map",
      "military bunker",
    ]);
    add("Base Props", "Models", "Workspace/Map/Props", 4, [
      "military crate",
      "watch tower",
      "barrier",
    ]);
    add("Vehicles", "Models", "Workspace/Vehicles", 2, ["military vehicle", "jeep"]);
  } else if (/\b(fantasy|rpg|castle|magic|medieval|adventure)\b/.test(lower)) {
    add("Fantasy Map", "Models", "Workspace/Map/ToolboxMap", 2, [
      `${theme} fantasy map`,
      "medieval village map",
      "castle map",
    ]);
    add("Landmarks", "Models", "Workspace/Map/Landmarks", 3, [
      "castle",
      "fantasy house",
      "medieval shop",
    ]);
    add("Nature", "Models", "Workspace/Map/Nature", 3, [
      "fantasy tree",
      "rock pack",
      "mushroom props",
    ]);
  } else if (/\b(simulator|clicker|rebirth|coins|gems|pet sim)\b/.test(lower)) {
    add("Pets", "Models", "ReplicatedStorage/Assets/Pets", 4, [
      `${theme} pet`,
      "simulator pet",
      "cute pet",
    ]);
    add("Coins", "Models", "Workspace/Interactables/Currency", 3, [
      "coin pickup",
      "gem pickup",
      "simulator coin",
    ]);
    add("Zones", "Models", "Workspace/Map/Zones", 3, [
      `${theme} zone`,
      "simulator zone",
      "portal gate",
    ]);
    add("Upgrades", "Models", "Workspace/Interactables/Upgrades", 2, [
      "upgrade station",
      "shop stand",
    ]);
    add("Tools", "Models", "StarterPack/Tools", 2, [`${theme} tool`, "simulator tool"]);
  } else if (/\b(obby|parkour|tower|lava)\b/.test(lower)) {
    add("Obby Kits", "Models", "Workspace/Map/Obby", 4, [
      `${theme} obby kit`,
      "obby obstacle",
      "parkour kit",
    ]);
    add("Checkpoints", "Models", "Workspace/Map/Checkpoints", 2, [
      "obby checkpoint",
      "checkpoint pad",
    ]);
    add("Hazards", "Models", "Workspace/Map/Hazards", 2, ["lava obstacle", "kill brick obstacle"]);
  } else if (/\b(tycoon|factory|dropper|conveyor)\b/.test(lower)) {
    add("Tycoon Kits", "Models", "Workspace/Map/Tycoon", 3, [
      `${theme} tycoon kit`,
      "tycoon dropper",
      "factory tycoon",
    ]);
    add("Droppers", "Models", "ServerStorage/Templates/Tycoon", 2, [
      "tycoon dropper",
      "ore dropper",
    ]);
    add("Buttons", "Models", "Workspace/Interactables/TycoonButtons", 2, [
      "tycoon button",
      "buy button",
    ]);
  } else if (/\b(horror|scary|monster|haunted)\b/.test(lower)) {
    add("Horror Map", "Models", "Workspace/Map", 2, [
      `${theme} horror map`,
      "haunted house",
      "abandoned school",
    ]);
    add("Props", "Models", "Workspace/Map/Decorations", 4, [
      "horror props",
      "creepy furniture",
      "broken lamp",
    ]);
    add("NPCs", "Models", "Workspace/NPCs", 2, ["monster npc", "zombie npc"]);
  } else {
    add("Map Pieces", "Models", "Workspace/Map", 3, [
      `${theme} map`,
      `${theme} build kit`,
      `${theme} environment`,
    ]);
    add("Props", "Models", "Workspace/Map/Props", 4, [
      `${theme} props`,
      `${theme} decoration`,
      "roblox props",
    ]);
    add("Tools", "Models", "StarterPack/Tools", 2, [`${theme} tool`, `${theme} weapon`]);
    add("NPCs", "Models", "Workspace/NPCs", 2, [`${theme} npc`, `${theme} character`]);
  }

  // ── Additional genre templates ────────────────────────────────────
  if (/\b(school|academy|classroom|campus|university)\b/.test(lower)) {
    add("School Building", "Models", "Workspace/Map/Buildings", 2, [
      `${theme} school building`,
      "school classroom",
      "campus building",
    ]);
    add("School Props", "Models", "Workspace/Map/Props", 3, [
      "school desk chair",
      "locker",
      "whiteboard",
      "school gym",
    ]);
  }
  if (/\b(hospital|medical|clinic|ambulance|doctor)\b/.test(lower)) {
    add("Hospital", "Models", "Workspace/Map/Buildings", 2, [
      "hospital building",
      "medical clinic",
    ]);
    add("Medical Props", "Models", "Workspace/Map/Props", 3, [
      "hospital bed",
      "ambulance",
      "medical equipment",
    ]);
  }
  if (/\b(space|astronaut|rocket|planet|moon|spacecraft|station)\b/.test(lower)) {
    add("Space Station", "Models", "Workspace/Map/ToolboxMap", 2, [
      `${theme} space station`,
      "space base",
      "sci-fi corridor",
    ]);
    add("Space Props", "Models", "Workspace/Map/Props", 3, [
      "space ship",
      "rocket",
      "planet",
      "space crate",
    ]);
  }
  if (/\b(underwater|ocean|submarine|coral|deep sea|aqua)\b/.test(lower)) {
    add("Underwater Base", "Models", "Workspace/Map/ToolboxMap", 2, [
      "underwater base",
      "submarine",
      "ocean dome",
    ]);
    add("Ocean Props", "Models", "Workspace/Map/Nature", 3, [
      "coral reef",
      "seaweed",
      "treasure chest underwater",
    ]);
  }
  if (/\b(jungle|safari|tropical forest|rainforest)\b/.test(lower)) {
    add("Jungle Map", "Models", "Workspace/Map/ToolboxMap", 2, [
      "jungle map",
      "tropical forest",
    ]);
    add("Jungle Props", "Models", "Workspace/Map/Nature", 3, [
      "jungle tree",
      "vine bridge",
      "jungle hut",
    ]);
  }
  if (/\b(winter|snow|christmas|frozen|ice|arctic|blizzard)\b/.test(lower)) {
    add("Winter Map", "Models", "Workspace/Map/ToolboxMap", 2, [
      "winter map",
      "snow map",
      "christmas village",
    ]);
    add("Winter Props", "Models", "Workspace/Map/Props", 3, [
      "snowman",
      "christmas tree",
      "ice cabin",
    ]);
  }
  if (/\b(desert|sand|wasteland|dune|oasis|pyramid|egypt)\b/.test(lower)) {
    add("Desert Map", "Models", "Workspace/Map/ToolboxMap", 2, [
      "desert map",
      "sand dune map",
      "pyramid temple",
    ]);
    add("Desert Props", "Models", "Workspace/Map/Props", 3, [
      "cactus",
      "oasis",
      "desert ruins",
    ]);
  }
  if (/\b(japanese|anime|sakura|torii|pagoda|japan|ninja|samurai)\b/.test(lower)) {
    add("Japanese Map", "Models", "Workspace/Map/ToolboxMap", 2, [
      "japanese village map",
      "anime town",
      "samurai castle",
    ]);
    add("Japanese Props", "Models", "Workspace/Map/Props", 3, [
      "torii gate",
      "cherry blossom tree",
      "pagoda",
    ]);
  }
  if (/\b(restaurant|cafe|bakery|kitchen|cooking|food|pizza|burger)\b/.test(lower)) {
    add("Restaurant", "Models", "Workspace/Map/Buildings", 2, [
      `${theme} restaurant`,
      "cafe building",
    ]);
    add("Kitchen Props", "Models", "Workspace/Map/Props", 3, [
      "kitchen counter",
      "dining table",
      "food props",
    ]);
  }
  if (/\b(farm|ranch|barn|crop|harvest|animal farm)\b/.test(lower)) {
    add("Farm Map", "Models", "Workspace/Map/ToolboxMap", 2, [
      "farm map",
      "ranch map",
    ]);
    add("Farm Props", "Models", "Workspace/Map/Props", 3, [
      "barn",
      "tractor",
      "hay bale",
      "farm fence",
    ]);
  }

  // ── Auto-add skybox for any map/world build ──────────────────────
  if (/\b(map|world|city|island|forest|desert|jungle|space|ocean|winter|horror|fantasy|village|town|beach)\b/.test(lower)) {
    add("Skybox", "Decals", "Lighting/Skybox", 1, [
      `${theme} skybox`,
      "roblox skybox",
      "sky decal",
    ]);
  }

  add("Ambient Audio", "Audio", "SoundService/Music", 1, [`${theme} music`, "ambient loop"]);
  add("UI Icons", "Decals", "ReplicatedStorage/Assets/Icons", 2, [
    `${theme} icon`,
    "coin icon",
    "button icon",
  ]);

  return groups.slice(0, 14);
}

export async function planRobloxToolboxAssets(opts: {
  prompt: string;
  assetTypes?: string[];
  maxPerGroup?: number;
  verifiedOnly?: boolean;
}) {
  const groups = buildToolboxPlanGroups(opts.prompt, opts.assetTypes ?? []);
  const usedIds = new Set<number>();
  const planned: any[] = [];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const wanted = Math.min(Math.max(opts.maxPerGroup ?? group.count, 1), group.count, 6);
    const candidates: any[] = [];
    for (const query of group.queries.slice(0, 3)) {
      const found = await searchRobloxAssets(query, group.category, Math.max(wanted * 3, 8), {
        freeOnly: true,
        verifiedOnly: opts.verifiedOnly,
      });
      candidates.push(...found.map((item) => ({ ...item, sourceQuery: query })));
    }
    const items = dedupeAndRankAssets(
      candidates,
      group.queries.join(" "),
      wanted,
      group.label,
      usedIds,
    );
    for (const item of items) usedIds.add(Number(item.assetId));

    const offset = (items.length - 1) * 11;
    const insertionActions = items.map((item, itemIndex) => ({
      type: group.category === "Audio" ? "sound" : "insert_toolbox_asset",
      assetId: item.assetId,
      name: safeAssetName(item.name, group.label.replace(/\s+/g, "")),
      parent: group.parent,
      position: [itemIndex * 22 - offset, group.category === "Audio" ? 0 : 4, groupIndex * 28],
      scanScripts: group.category === "Models",
      removeUnsafeScripts: group.category === "Models",
      removeScriptsFromDecorativeAssets: group.category === "Models",
      freeOnly: true,
      publicOnly: true,
      requiresApprovalIfScriptsFound: group.category === "Models",
      looped: group.category === "Audio" ? true : undefined,
      volume: group.category === "Audio" ? 0.35 : undefined,
      play: group.category === "Audio" ? false : undefined,
    }));

    planned.push({
      ...group,
      selectedCount: items.length,
      items,
      insertionActions,
      notes:
        items.length > 0
          ? "Selected varied free assets and prepared safe insertion actions."
          : "No safe free matches found for this group; generate a procedural fallback.",
    });
  }

  return {
    prompt: opts.prompt,
    rules: [
      "Use each assetId at most once unless the user explicitly asks for duplicates.",
      "Keep decorative model scripts stripped and scanned before insertion.",
      "Only deduct/build credits after Studio/plugin insertion succeeds.",
      "Create missing parent folders before insertion and place assets in their listed parent.",
    ],
    groupCount: planned.length,
    totalSelected: planned.reduce((sum, group) => sum + group.selectedCount, 0),
    groups: planned,
  };
}

async function batchToolboxDetails(ids: number[]): Promise<any[]> {
  if (ids.length === 0) return [];
  try {
    const r = await fetch(
      `https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${ids.join(",")}`,
      { headers: RBX_HEADERS },
    );
    if (!r.ok) return [];
    const j: any = await r.json();
    return (j.data ?? [])
      .map((row: any) => {
        if (!row?.asset) return null;
        const isFree = !!row.fiatProduct?.isFree;
        return {
          assetId: row.asset.id as number,
          name: (row.asset.name as string)?.trim() || `Asset ${row.asset.id}`,
          creator: row.creator?.name,
          creatorId: row.creator?.id,
          creatorType: row.creator?.type === 2 ? "Group" : "User",
          verified: !!row.creator?.isVerifiedCreator,
          assetType: row.asset?.typeId,
          price: isFree ? 0 : 1,
          isForSale: !!row.fiatProduct?.purchasable,
          upVotePercent: row.voting?.upVotePercent ?? 0,
          voteCount: row.voting?.voteCount ?? 0,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchAssetDetails(assetId: number) {
  const batch = await batchToolboxDetails([assetId]);
  if (batch[0]) return batch[0];
  try {
    const r = await fetch(`https://economy.roblox.com/v2/assets/${assetId}/details`, {
      headers: RBX_HEADERS,
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return {
      assetId,
      name: j.Name as string,
      creator: j.Creator?.Name as string,
      creatorId: j.Creator?.CreatorTargetId as number,
      creatorType: j.Creator?.CreatorType as string,
      verified: !!j.Creator?.HasVerifiedBadge || j.Creator?.CreatorTargetId === 1,
      assetType: j.AssetTypeId as number,
      price: (j.PriceInRobux ?? 0) as number,
      isForSale: !!j.IsForSale,
      isPublicDomain: !!j.IsPublicDomain,
    };
  } catch {
    return null;
  }
}

// Legacy free-model search — the SAME proven endpoint the website's Toolbox
// browse page uses. apis.roblox.com/toolbox-service is flaky/region-gated and
// often returns nothing, which is what leaves the map as empty folders. This
// fallback reliably returns real free Models/Decals/Audio/Meshes the plugin can
// load via game:GetObjects.
const LEGACY_SEARCH = "https://search.roblox.com/catalog/json";
const LEGACY_CAT: Record<string, number> = {
  Models: 6,
  Decals: 13,
  Audio: 9,
  Meshes: 40,
  Animations: 24,
  Plugins: 38,
  All: 6,
};
async function legacyAssetSearch(
  query: string,
  category: string,
  limit: number,
  freeOnly: boolean,
): Promise<any[]> {
  const cat = LEGACY_CAT[category] ?? LEGACY_CAT.Models;
  try {
    const params = new URLSearchParams({
      Category: String(cat),
      Keyword: query,
      ResultsPerPage: String(Math.min(Math.max(limit * 3, 20), 60)),
      PageNumber: "1",
      SortType: "0",
      IncludeNotForSale: "false",
    });
    const r = await fetch(`${LEGACY_SEARCH}?${params.toString()}`, { headers: RBX_HEADERS });
    if (!r.ok) return [];
    const raw = (await r.json()) as any;
    const arr = Array.isArray(raw) ? raw : [];
    let items = arr
      .map((a: any) => ({
        assetId: a.AssetId,
        name: (a.Name as string)?.trim() || `Asset ${a.AssetId}`,
        creator: a.Creator ?? "",
        verified: false,
        assetType: a.AssetTypeId,
        price: a.PriceInRobux ?? a.BestPrice ?? 0,
        isForSale: true,
        favorites: a.FavoriteCount ?? 0,
        upVotePercent: a.UpVotePercent ?? 0,
        voteCount: a.VoteCount ?? 0,
      }))
      .filter((i: any) => typeof i.assetId === "number");
    if (freeOnly) items = items.filter((i: any) => (i.price ?? 0) === 0);
    return items;
  } catch {
    return [];
  }
}

export async function searchRobloxAssets(
  query: string,
  category: string,
  limit: number,
  opts: { verifiedOnly?: boolean; freeOnly?: boolean } = {},
): Promise<any[]> {
  const freeOnly = opts.freeOnly !== false;
  const verifiedOnly = !!opts.verifiedOnly;

  const toolboxCat = TOOLBOX_CATEGORY_MAP[category];
  if (toolboxCat) {
    try {
      const fetchLimit = Math.min(30, Math.max(limit * 4, 20));
      const url = `https://apis.roblox.com/toolbox-service/v1/marketplace/${toolboxCat}?keyword=${encodeURIComponent(query)}&limit=${fetchLimit}`;
      const r = await fetch(url, { headers: RBX_HEADERS });
      const ids: number[] = r.ok
        ? ((await r.json()) as any).data
            ?.map((x: any) => x.id)
            .filter((n: any) => typeof n === "number") ?? []
        : [];
      if (ids.length > 0) {
        const detailIds = ids.slice(0, Math.min(ids.length, 20));
        let enriched = await batchToolboxDetails(detailIds);
        // Final safety net: if detail enrichment failed entirely, still return
        // bare ids so the AI can queue an insert. Roblox InsertService will
        // succeed for any free model regardless of metadata.
        if (enriched.length === 0) {
          enriched = detailIds.map((id) => ({
            assetId: id,
            name: `Asset ${id}`,
            creator: "",
            verified: false,
            price: 0,
            isForSale: true,
            upVotePercent: 0,
            voteCount: 0,
          }));
        }
        let items = enriched;
        if (freeOnly) items = items.filter((i) => (i.price ?? 0) === 0);
        if (verifiedOnly) items = items.filter((i) => i.verified === true);
        const ranked = dedupeAndRankAssets(items, query, limit);
        if (ranked.length > 0) return ranked;
      }
      // toolbox-service returned nothing usable — fall through to legacy.
    } catch {
      // fall through to legacy
    }
    // Reliable fallback: the same endpoint the website's browse page uses.
    let legacy = await legacyAssetSearch(query, category, limit, freeOnly);
    if (verifiedOnly) legacy = legacy.filter((i: any) => i.verified === true);
    return dedupeAndRankAssets(legacy, query, limit);
  }

  try {
    const url = `https://catalog.roblox.com/v1/search/items/details?Category=${encodeURIComponent(category)}&Keyword=${encodeURIComponent(query)}&Limit=30&SortType=Relevance`;
    const r = await fetch(url, {
      headers: { "User-Agent": "BloxSmith/1.0", Accept: "application/json" },
    });
    if (!r.ok) return [];
    const j: any = await r.json();
    let items = (j.data ?? []).map((x: any) => ({
      assetId: x.id,
      name: x.name,
      creator: x.creatorName,
      creatorId: x.creatorTargetId,
      creatorType: x.creatorType,
      verified: !!x.creatorHasVerifiedBadge || x.creatorTargetId === 1,
      assetType: x.assetType,
      price: x.price ?? 0,
      favorites: x.favoriteCount ?? 0,
    }));
    if (freeOnly) items = items.filter((i: any) => (i.price ?? 0) === 0);
    if (verifiedOnly) items = items.filter((i: any) => i.verified === true);
    return dedupeAndRankAssets(items, query, limit);
  } catch {
    return [];
  }
}

export const buildBloxSmithTools = (ctx: BloxSmithToolCtx = {}) => ({
  web_search: tool({
    description:
      "Search the public web (DuckDuckGo). Use for current Roblox API references, Luau docs, tutorials, game design patterns, free-model creator pages, anything you don't already know. Returns abstract + related topics.",
    inputSchema: z.object({
      query: z.string().min(2).max(200),
    }),
    execute: async ({ query }) => {
      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
          query,
        )}&format=json&no_html=1&no_redirect=1&t=bloxsmith`;
        const r = await fetch(url, { headers: { "User-Agent": "BloxSmith/1.0" } });
        if (!r.ok) return { error: `HTTP ${r.status}`, results: [] };
        const j: any = await r.json();
        const topics = (j.RelatedTopics ?? [])
          .flatMap((t: any) => (t.Topics ? t.Topics : [t]))
          .map((t: any) => ({ text: t.Text, url: t.FirstURL }))
          .filter((t: any) => t.text && t.url)
          .slice(0, 10);
        return {
          abstract: j.AbstractText || null,
          source: j.AbstractURL || null,
          definition: j.Definition || null,
          answer: j.Answer || null,
          results: topics,
        };
      } catch (e: any) {
        return { error: String(e?.message ?? e), results: [] };
      }
    },
  }),

  fetch_url: tool({
    description:
      "Fetch the raw text/HTML body of a URL (e.g. a create.roblox.com docs page). Returns up to 8000 chars. Use sparingly.",
    inputSchema: z.object({ url: z.string().url() }),
    execute: async ({ url }) => {
      try {
        const r = await fetch(url, {
          headers: { "User-Agent": "BloxSmith/1.0", Accept: "text/html,application/json,*/*" },
        });
        const text = await r.text();
        const cleaned = text
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return { status: r.status, body: cleaned.slice(0, 8000) };
      } catch (e: any) {
        return { error: String(e?.message ?? e) };
      }
    },
  }),

  roblox_docs_search: tool({
    description:
      "Search official Roblox Creator Hub / Engine API documentation for current Roblox APIs, services, Luau patterns, and best practices. Use this before answering or generating code when the prompt mentions an API, service, DataStore, remotes, MarketplaceService, UI, animation, pathfinding, terrain, or anything you are not completely certain about.",
    inputSchema: z.object({
      query: z.string().min(2).max(200),
      limit: z.number().int().min(1).max(8).default(5),
    }),
    strict: true,
    execute: async ({ query, limit }) => {
      const { searchRobloxDocs } = await import("./roblox-docs.server");
      const results = await searchRobloxDocs(query, limit);
      return { count: results.length, results };
    },
  }),

  // ── Realtime project awareness ──────────────────────────────────────
  list_project_files: tool({
    description:
      "List every file currently stored for THIS project (path, type, service location, size, last-updated). Call this BEFORE editing anything so you know what already exists and avoid duplicates.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.projectId) return { error: "no project context", files: [] };
      const { data, error } = await supabaseAdmin
        .from("project_files")
        .select("path,file_type,service_location,content,updated_at")
        .eq("project_id", ctx.projectId)
        .order("path", { ascending: true });
      if (error) return { error: error.message, files: [] };
      return {
        count: data?.length ?? 0,
        files: (data ?? []).map((f) => ({
          path: f.path,
          type: f.file_type,
          location: f.service_location,
          bytes: (f.content ?? "").length,
          updated_at: f.updated_at,
        })),
      };
    },
  }),

  read_project_file: tool({
    description:
      "Read the full source of ONE stored file by its exact path (from list_project_files). Use this before rewriting a script so you can preserve working logic and only change what's needed.",
    inputSchema: z.object({ path: z.string().min(1).max(500) }),
    execute: async ({ path }) => {
      if (!ctx.projectId) return { error: "no project context" };
      const { data, error } = await supabaseAdmin
        .from("project_files")
        .select("path,file_type,service_location,content,updated_at")
        .eq("project_id", ctx.projectId)
        .eq("path", path)
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "not found", path };
      return {
        path: data.path,
        type: data.file_type,
        location: data.service_location,
        updated_at: data.updated_at,
        content: data.content ?? "",
      };
    },
  }),

  read_workspace_context: tool({
    description:
      "Read the LATEST live snapshot of the user's Roblox Studio workspace (instance tree, place name, services, instance count). The Studio plugin pushes this on connect and every ~15s. Use it to reference real instance names instead of guessing.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.projectId) return { error: "no project context" };
      const { data, error } = await supabaseAdmin
        .from("plugin_context")
        .select("context,instance_count,updated_at")
        .eq("project_id", ctx.projectId)
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "no snapshot yet — studio plugin not connected" };
      return {
        instance_count: data.instance_count,
        updated_at: data.updated_at,
        context: data.context,
      };
    },
  }),

  // ── Roblox catalog (verified creators only by default) ──────────────
  roblox_asset_search: tool({
    description:
      "Search the Roblox Toolbox / Creator Store for FREE assets to insert. Returns real assetIds, names, creators, and quality scores. It filters risky names, removes duplicate-looking results, and defaults to free-only (price=0). Categories: Models, Decals, Audio, Meshes, Animations, Plugins (toolbox), or Hats/Gear/Accessories/Faces (catalog wearables). For maps/games with many needed objects, prefer roblox_toolbox_asset_plan first.",
    inputSchema: z.object({
      query: z.string().min(1).max(120),
      category: z
        .enum([
          "All",
          "Models",
          "Decals",
          "Audio",
          "Meshes",
          "Animations",
          "Gear",
          "Hats",
          "Plugins",
          "Accessories",
          "Faces",
        ])
        .default("Models"),
      limit: z.number().int().min(1).max(20).default(8),
      verifiedOnly: z
        .boolean()
        .default(false)
        .describe(
          "If true, only return assets from Roblox or verified-badge creators. Default false — most free toolbox models are made by ordinary users.",
        ),
    }),
    execute: async ({ query, category, limit, verifiedOnly }) => {
      const items = await searchRobloxAssets(query, category, limit, { verifiedOnly });
      return { count: items.length, verifiedOnly, items };
    },
  }),

  roblox_toolbox_asset_plan: tool({
    description:
      "Plan a varied Roblox Toolbox asset set for a full build prompt. Use this FIRST for maps, cities, simulators, tycoons, obbies, horror games, props, buildings, NPCs, tools, pets, vehicles, decorations, or any non-trivial visual build. It searches multiple targeted Toolbox queries, filters unsafe/paid/duplicate assets, groups results into correct Studio parents, and returns ready insert_toolbox_asset/sound actions.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(3)
        .max(800)
        .describe(
          "The user's full Roblox build request, e.g. 'build a city map' or 'make a coin simulator'.",
        ),
      assetTypes: z
        .array(z.string().min(2).max(40))
        .max(12)
        .default([])
        .describe(
          "Optional focus groups such as Roads, Buildings, Streetlights, Pets, Coins, Tools, NPCs, Props, Vehicles. Leave empty to infer from prompt.",
        ),
      maxPerGroup: z.number().int().min(1).max(6).default(3),
      verifiedOnly: z
        .boolean()
        .default(false)
        .describe("If true, restrict to verified/Roblox creators. This can reduce variety."),
    }),
    execute: async ({ prompt, assetTypes, maxPerGroup, verifiedOnly }) => {
      return planRobloxToolboxAssets({ prompt, assetTypes, maxPerGroup, verifiedOnly });
    },
  }),

  roblox_asset_thumbnail: tool({
    description:
      "Get the rendered thumbnail image URL for a Roblox assetId. Use to preview a free model/decal before inserting.",
    inputSchema: z.object({
      assetId: z.number().int().positive(),
      size: z.enum(["150x150", "420x420", "700x700"]).default("420x420"),
    }),
    execute: async ({ assetId, size }) => {
      try {
        const r = await fetch(
          `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=${size}&format=Png&isCircular=false`,
        );
        const j: any = await r.json();
        const item = (j.data ?? [])[0];
        return {
          assetId,
          imageUrl: item?.imageUrl ?? null,
          state: item?.state ?? null,
          rbxAssetUri: `rbxassetid://${assetId}`,
        };
      } catch (e: any) {
        return { error: String(e?.message ?? e) };
      }
    },
  }),

  roblox_asset_info: tool({
    description:
      "Get marketplace metadata for a Roblox assetId. Useful before queuing insertAsset to confirm it's safe & free.",
    inputSchema: z.object({ assetId: z.number().int().positive() }),
    execute: async ({ assetId }) => {
      try {
        const r = await fetch(`https://economy.roblox.com/v2/assets/${assetId}/details`, {
          headers: { "User-Agent": "BloxSmith/1.0", Accept: "application/json" },
        });
        if (!r.ok) return { error: `HTTP ${r.status}` };
        const j: any = await r.json();
        return {
          assetId,
          name: j.Name,
          description: (j.Description ?? "").slice(0, 600),
          assetType: j.AssetTypeId,
          creator: j.Creator?.Name,
          creatorHasVerifiedBadge: !!j.Creator?.HasVerifiedBadge,
          isForSale: j.IsForSale,
          price: j.PriceInRobux,
        };
      } catch (e: any) {
        return { error: String(e?.message ?? e) };
      }
    },
  }),

  // ── Terrain map presets ─────────────────────────────────────────────
  roblox_terrain_preset: tool({
    description:
      "Get a ready-to-queue terrain generation preset (forest, desert, island, city-flat, snow, mountains, plains, lava). Returns biome + bounds the AI should emit as a terrainGenerate action.",
    inputSchema: z.object({
      preset: z.enum([
        "forest",
        "desert",
        "island",
        "city-flat",
        "snow",
        "mountains",
        "plains",
        "lava",
      ]),
      size: z.enum(["small", "medium", "large"]).default("medium"),
    }),
    execute: async ({ preset, size }) => {
      const dims = { small: 256, medium: 512, large: 1024 }[size];
      const half = dims / 2;
      const biomes: Record<string, string[]> = {
        forest: ["Hills", "Plains", "Mountains"],
        desert: ["Dunes", "Canyons"],
        island: ["Water", "Plains", "Hills"],
        "city-flat": ["Plains"],
        snow: ["Arctic", "Mountains"],
        mountains: ["Mountains", "Canyons", "Hills"],
        plains: ["Plains", "Hills"],
        lava: ["Lavaflow", "Canyons"],
      };
      return {
        preset,
        size,
        instructions:
          "Emit a terrainClear action first, then a terrainGenerate action with these params. Optionally follow with a service action setting Lighting/Atmosphere to match the biome.",
        action_terrain_clear: { type: "terrainClear" },
        action_terrain_generate: {
          type: "terrainGenerate",
          position: { __t: "Vector3", x: 0, y: 0, z: 0 },
          size: { __t: "Vector3", x: dims, y: 256, z: dims },
          biomes: biomes[preset] ?? ["Plains"],
          biomeSize: 100,
          seed: Math.floor(Math.random() * 1_000_000),
        },
        recommended_spawn: { __t: "Vector3", x: 0, y: 60, z: 0 },
        bounds: { minX: -half, maxX: half, minZ: -half, maxZ: half },
      };
    },
  }),

  // ── MCP servers (let the AI manage the user's own MCP server list) ──
  list_mcp_servers: tool({
    description:
      "List the MCP (Model Context Protocol) servers the user has configured on their BloxSmith account. Returns name, URL, enabled flag, and last test status.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.userId) return { error: "not authenticated", servers: [] };
      const { data, error } = await supabaseAdmin
        .from("user_mcp_servers")
        .select("id,name,url,enabled,last_test_ok,last_test_error,tool_count,last_tested_at")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false });
      if (error) return { error: error.message, servers: [] };
      return { count: data?.length ?? 0, servers: data ?? [] };
    },
  }),

  add_mcp_server: tool({
    description:
      "Add a new MCP (Model Context Protocol) server to the user's BloxSmith account. Use this when the user asks you to 'add an MCP server', pastes an MCP server URL, or pastes a BloxSmith MCP token (starts with 'bsmcp_'). If the user gives ONLY a 'bsmcp_...' token with no URL, default to BloxSmith's own MCP server (name: 'BloxSmith', url: 'https://bloxsmith.pro/api/public/mcp'). auth_header is optional — pass either the raw token or the full 'Bearer xxx' value; this tool will prepend 'Bearer ' automatically when missing. After adding, tell the user it's configured and they can manage it at /mcp-servers.",
    inputSchema: z.object({
      name: z
        .string()
        .min(1)
        .max(80)
        .optional()
        .describe("Short friendly name. Defaults to 'BloxSmith' for bsmcp_ tokens."),
      url: z
        .string()
        .url()
        .optional()
        .describe(
          "Full MCP endpoint URL. Defaults to https://bloxsmith.pro/api/public/mcp for bsmcp_ tokens.",
        ),
      auth_header: z
        .string()
        .max(2000)
        .optional()
        .describe(
          "Optional token or Authorization header. 'Bearer ' is added automatically if missing.",
        ),
      token: z
        .string()
        .max(2000)
        .optional()
        .describe("Alias for auth_header — accepts a bare token like 'bsmcp_...'."),
    }),
    execute: async ({ name, url, auth_header, token }) => {
      if (!ctx.userId) return { error: "not authenticated" };
      let rawAuth = (auth_header ?? token ?? "").trim();
      const isBsmcp = rawAuth.replace(/^Bearer\s+/i, "").startsWith("bsmcp_");
      if (!url && isBsmcp) url = "https://bloxsmith.pro/api/public/mcp";
      if (!name && isBsmcp) name = "BloxSmith";
      if (!url)
        return { error: "Missing MCP server URL. Ask the user for the full https:// endpoint." };
      if (!name) return { error: "Missing name. Ask the user for a short label for this server." };
      if (!/^https:\/\//i.test(url)) return { error: "URL must start with https://" };
      if (rawAuth && !/^Bearer\s+/i.test(rawAuth) && !rawAuth.includes(" ")) {
        rawAuth = `Bearer ${rawAuth}`;
      }
      const { data: existing } = await supabaseAdmin
        .from("user_mcp_servers")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("url", url)
        .maybeSingle();
      if (existing) {
        if (rawAuth) {
          await supabaseAdmin
            .from("user_mcp_servers")
            .update({ enabled: true })
            .eq("id", existing.id)
            .eq("user_id", ctx.userId);
          await supabaseAdmin.rpc("set_mcp_auth_header" as any, {
            _server_id: existing.id,
            _value: rawAuth,
          });
          return {
            success: true,
            updated: true,
            id: existing.id,
            message: "Token updated on existing server.",
          };
        }
        return { error: "An MCP server with that URL is already added", id: existing.id };
      }
      const { data, error } = await supabaseAdmin
        .from("user_mcp_servers")
        .insert({
          user_id: ctx.userId,
          name: name.trim(),
          url: url.trim(),
          enabled: true,
        })
        .select("id,name,url,enabled")
        .single();
      if (error) return { error: error.message };
      if (rawAuth && data?.id) {
        await supabaseAdmin.rpc("set_mcp_auth_header" as any, {
          _server_id: data.id,
          _value: rawAuth,
        });
      }
      return {
        success: true,
        server: data,
        next: "Tell the user it was added and link them to /mcp-servers to test it.",
      };
    },
  }),

  update_mcp_server: tool({
    description:
      "Update an existing MCP server's token, name, url, or enabled state. Use this when the user provides a new bearer token / API key for a server they already added. Identify the server by id (from list_mcp_servers) or by matching url/name. 'Bearer ' is prepended automatically when missing.",
    inputSchema: z.object({
      id: z.string().uuid().optional(),
      match_url: z.string().url().optional().describe("Find the server by URL if id not provided."),
      match_name: z
        .string()
        .optional()
        .describe("Find the server by name (case-insensitive) if id and match_url not provided."),
      name: z.string().min(1).max(80).optional(),
      url: z.string().url().optional(),
      auth_header: z.string().max(2000).optional(),
      token: z.string().max(2000).optional(),
      enabled: z.boolean().optional(),
    }),
    execute: async ({ id, match_url, match_name, name, url, auth_header, token, enabled }) => {
      if (!ctx.userId) return { error: "not authenticated" };
      let targetId = id;
      if (!targetId) {
        let q = supabaseAdmin
          .from("user_mcp_servers")
          .select("id,name,url")
          .eq("user_id", ctx.userId);
        if (match_url) q = q.eq("url", match_url);
        const { data: rows } = await q;
        let row = rows?.[0];
        if (!row && match_name && rows) {
          row = rows.find((r: any) => r.name?.toLowerCase() === match_name.toLowerCase());
        }
        if (!row && rows && rows.length === 1) row = rows[0];
        if (!row)
          return {
            error: "Could not find a matching MCP server. Call list_mcp_servers and pass an id.",
          };
        targetId = row.id;
      }
      let rawAuth = (auth_header ?? token ?? "").trim();
      if (rawAuth && !/^Bearer\s+/i.test(rawAuth) && !rawAuth.includes(" ")) {
        rawAuth = `Bearer ${rawAuth}`;
      }
      const patch: any = { updated_at: new Date().toISOString() };
      if (name) patch.name = name.trim();
      if (url) patch.url = url.trim();
      if (typeof enabled === "boolean") patch.enabled = enabled;
      const { data, error } = await supabaseAdmin
        .from("user_mcp_servers")
        .update(patch)
        .eq("id", targetId)
        .eq("user_id", ctx.userId)
        .select("id,name,url,enabled")
        .single();
      if (error) return { error: error.message };
      if (rawAuth && targetId) {
        await supabaseAdmin.rpc("set_mcp_auth_header" as any, {
          _server_id: targetId,
          _value: rawAuth,
        });
      }
      return { success: true, server: data };
    },
  }),

  remove_mcp_server: tool({
    description:
      "Remove one of the user's MCP servers by its id (from list_mcp_servers). Confirm with the user before calling.",
    inputSchema: z.object({ id: z.string().uuid() }),
    execute: async ({ id }) => {
      if (!ctx.userId) return { error: "not authenticated" };
      const { error } = await supabaseAdmin
        .from("user_mcp_servers")
        .delete()
        .eq("user_id", ctx.userId)
        .eq("id", id);
      if (error) return { error: error.message };
      return { success: true };
    },
  }),

  // ── AI image generation (Google Gemini) ──────────────────────────────
  // Generates Roblox thumbnails, game icons, GUI artwork, decals, logos and
  // concept art using the site's OWN Google Gemini key, via the native
  // `:generateContent` endpoint. (The OpenAI-compatible /images/generations
  // route only works for Imagen models — the Gemini "Nano Banana" image
  // models must be called through generateContent.) The PNG is uploaded to
  // the public `generated-images` bucket and a URL is returned; the AI embeds
  // it as markdown so the user sees it inline in chat and can download it.
  //
  // Server config:
  //   GEMINI_API_KEY  (preferred)  — your Google Gemini API key, "the one you have".
  //                   Falls back to GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_API_KEY.
  //   GEMINI_IMAGE_MODEL (optional) — defaults to "gemini-2.5-flash-image".
  //                   Set to "gemini-3-pro-image-preview" for the sharpest
  //                   thumbnails / best in-image text, or
  //                   "gemini-3.1-flash-image-preview" for a faster, cheaper one.
  // If no Gemini key is set, it falls back to the old Lovable gateway so an
  // existing deployment keeps working until the Gemini key is added.
  generate_image: tool({
    description:
      "Generate a brand-new image — Roblox game thumbnail, game icon, GUI artwork, decal art, logo, badge, splash, banner, or loading screen — from a text prompt using Google Gemini. Pick aspectRatio '16:9' for game thumbnails/promo art, '1:1' for game icons and decals, '9:16' for portrait/mobile art. Returns a public URL. ALWAYS embed it in your reply as markdown: ![alt](url). Use for any 'make me a thumbnail / icon / logo / decal / artwork / poster' request. Do NOT use for Roblox toolbox lookups — use roblox_asset_search for existing catalog assets.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(3)
        .max(1500)
        .describe(
          "Detailed visual description: subject, style, mood, colors, framing, and any title/text to render in the image. Specific = better. e.g. 'Roblox tower defense game thumbnail: three cartoon heroes defending a glowing base from a robot horde, dramatic rim lighting, bold readable title TOWER SIEGE across the top, vibrant cyan and orange, high contrast'.",
        ),
      aspectRatio: z
        .enum(["16:9", "1:1", "9:16", "4:3", "3:4"])
        .default("16:9")
        .describe(
          "Image shape. '16:9' = Roblox game thumbnail / promo image (default). '1:1' = game icon or decal. '9:16' = portrait/mobile. '4:3' or '3:4' = misc.",
        ),
    }),
    execute: async ({ prompt, aspectRatio }) => {
      // Image generation runs on the site owner's Gemini key and costs real
      // money per call, so it must be gated. Require an authenticated user…
      if (!ctx.userId) {
        return { error: "Please sign in to generate images." };
      }
      const { checkTextSafeFor3D } = await import("./content-safety.server");
      const safety = checkTextSafeFor3D(prompt);
      if (!safety.safe) return { error: safety.reason };
      const { enforceAiUsageLimit, userBypassesAiLimit } = await import("./ai-usage-limits.server");
      const bypassesLimit = await userBypassesAiLimit(ctx.userId, supabaseAdmin);
      if (!bypassesLimit) {
        try {
          await enforceAiUsageLimit({
            userId: ctx.userId,
            supabase: supabaseAdmin,
            source: "chat_image",
            metadata: { aspectRatio, prompt: prompt.slice(0, 240) },
          });
        } catch (error) {
          return { error: error instanceof Error ? error.message : "Image limit reached." };
        }
      }
      // …and apply a simple per-user hourly cap. We count the user's own
      // recent uploads in the generated-images bucket (no extra table needed).
      // This check fails OPEN — if listing errors we allow the generation so a
      // transient storage hiccup never blocks a paying user.
      const HOURLY_LIMIT = Number(process.env.GEMINI_IMAGE_HOURLY_LIMIT || "2");
      if (!bypassesLimit && HOURLY_LIMIT > 0) {
        try {
          const { data: recent } = await supabaseAdmin.storage
            .from("generated-images")
            .list(ctx.userId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
          const cutoff = Date.now() - 60 * 60 * 1000;
          const lastHour = (recent ?? []).filter((o: any) => {
            const t = Date.parse(o?.created_at ?? o?.updated_at ?? "");
            return Number.isFinite(t) && t >= cutoff;
          }).length;
          if (lastHour >= HOURLY_LIMIT) {
            return {
              error: `You've reached the image limit (${HOURLY_LIMIT}/hour). Try again later.`,
            };
          }
        } catch {
          // fail open — never block generation on a listing error
        }
      }

      const ASPECT_HINTS: Record<string, string> = {
        "16:9": "Compose as a wide 16:9 landscape thumbnail.",
        "1:1": "Compose as a perfectly square 1:1 icon with the subject centered.",
        "9:16": "Compose as a tall 9:16 vertical/portrait image.",
        "4:3": "Compose as a 4:3 landscape image.",
        "3:4": "Compose as a 3:4 portrait image.",
      };
      const fullPrompt = `${prompt}\n\n${ASPECT_HINTS[aspectRatio] ?? ""}`.trim();

      // Shared upload + return helper for both the Gemini and fallback paths.
      const saveImage = async (bytes: Buffer, mime: string) => {
        const ext = /jpe?g/i.test(mime) ? "jpg" : "png";
        const filename = `${ctx.userId ?? "anon"}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("generated-images")
          .upload(filename, bytes, { contentType: mime || "image/png", upsert: false });
        if (upErr) return { error: `Could not save image: ${upErr.message}` };
        const { data: pub } = supabaseAdmin.storage.from("generated-images").getPublicUrl(filename);
        return {
          imageUrl: pub.publicUrl,
          aspectRatio,
          markdown: `![${prompt.slice(0, 80)}](${pub.publicUrl})`,
          downloadMarkdown: `[Download PNG](${pub.publicUrl})`,
          tip: "Embed `markdown` in your reply so the user sees the image inline. To use it in Roblox: download the PNG, then upload it in the Creator Dashboard / Studio Asset Manager (game thumbnails accept 16:9 up to 1920x1080; the game icon is 512x512). Uploaded decals/images become an assetId.",
        };
      };

      const neokensKey = getNeokensApiKey();

      if (neokensKey) {
        try {
          const r = await fetch(getNeokensChatCompletionsUrl(), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${neokensKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gemini-3.1-flash-image",
              messages: [{ role: "user", content: fullPrompt }],
            }),
            signal: AbortSignal.timeout(60_000),
          });
          if (r.ok) {
            const j: any = await r.json();
            const images = j?.choices?.[0]?.message?.images ?? [];
            const imgItem = images[0];
            const dataUrl = imgItem?.image_url?.url || imgItem?.url;

            if (dataUrl) {
              const comma = dataUrl.indexOf(",");
              if (comma >= 0) {
                const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
                const base64 = dataUrl.slice(comma + 1);

                return await saveImage(Buffer.from(base64, "base64"), mime);
              }
            }
          } else {
            const txt = await r.text().catch(() => "");
            console.error(`Neokens image generation API returned error (HTTP ${r.status}): ${txt}`);
          }
        } catch (e: any) {
          console.error("Neokens image generation error, trying direct Gemini fallback:", e);
        }
      }

      const geminiKey =
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GOOGLE_API_KEY;

      // ── Primary path: the site's own Google Gemini key ─────────────────
      if (geminiKey) {
        const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
        const generationConfig: any = { responseModalities: ["TEXT", "IMAGE"] };
        // imageConfig.aspectRatio is honored by the Gemini 3.x image models
        // (Nano Banana 2 / Pro). The 2.5 model ignores it and would 400 on
        // some fields, so we only attach it for gemini-3* and otherwise rely
        // on the textual aspect hint baked into the prompt.
        if (/gemini-3/.test(model)) {
          generationConfig.imageConfig = { aspectRatio };
        }
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: {
                "x-goog-api-key": geminiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
                generationConfig,
              }),
            },
          );
          if (!r.ok) {
            const txt = await r.text().catch(() => "");
            if (r.status === 429)
              return {
                error: "Gemini image generation is rate-limited right now. Try again in a moment.",
              };
            if (r.status === 400 && /billing|quota|FAILED_PRECONDITION/i.test(txt))
              return {
                error:
                  "Gemini rejected the request — the Gemini image models need a Google API key with billing enabled. Check the server's GEMINI_API_KEY.",
              };
            if (r.status === 401 || r.status === 403)
              return { error: "Gemini rejected the API key (check GEMINI_API_KEY on the server)." };
            return {
              error: `Gemini image generation failed (HTTP ${r.status}): ${txt.slice(0, 200)}`,
            };
          }
          const j: any = await r.json();
          const parts: any[] = j?.candidates?.[0]?.content?.parts ?? [];
          const imgPart = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
          const inline = imgPart?.inlineData ?? imgPart?.inline_data;
          if (!inline?.data) {
            const block =
              j?.promptFeedback?.blockReason ||
              j?.candidates?.[0]?.finishReason ||
              "no image returned";
            return {
              error: `Gemini did not return an image (${block}). Try rephrasing, or remove anything that might trip safety filters.`,
            };
          }
          return await saveImage(
            Buffer.from(inline.data, "base64"),
            inline.mimeType || inline.mime_type || "image/png",
          );
        } catch (e: any) {
          return { error: `Gemini image generation error: ${String(e?.message ?? e)}` };
        }
      }

      // ── Fallback path: Lovable AI Gateway (kept for back-compat) ───────
      const lovableKey = process.env.LOVABLE_API_KEY;
      if (!lovableKey)
        return {
          error:
            "Image generation is unavailable — set GEMINI_API_KEY (your Google Gemini key) on the server to enable thumbnail generation.",
        };
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: fullPrompt }],
            modalities: ["image", "text"],
          }),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          if (r.status === 429)
            return { error: "Image generation rate-limited. Try again in a moment." };
          if (r.status === 402) return { error: "Image generation credits exhausted." };
          return { error: `Image generation failed (HTTP ${r.status}): ${txt.slice(0, 200)}` };
        }
        const j: any = await r.json();
        const b64: string | undefined = j?.data?.[0]?.b64_json;
        if (!b64) return { error: "Image generation returned no image data." };
        return await saveImage(Buffer.from(b64, "base64"), "image/png");
      } catch (e: any) {
        return { error: String(e?.message ?? e) };
      }
    },
  }),

  // ── Clothing & accessory studio ─────────────────────────────────────
  // Generates Roblox CLASSIC clothing textures (shirts/pants) and T-Shirt
  // graphics end-to-end. For layered clothing and 3D accessories (hats, wings,
  // backpacks, etc.) it generates design/texture art and the model is expected
  // to pair it with a build spec — those are meshes, not textures, so we never
  // claim to have produced a ready-to-wear 3D item.
  generate_clothing: tool({
    description:
      "Generate a Roblox WEARABLE design. Use for shirts, pants, uniforms, outfits, T-shirts, and the texture/concept art for hoodies, jackets, and accessories (hats, glasses, masks, backpacks, chains, wings, hair, shoulder items). kind 'classic_shirt'/'classic_pants' produce upload-ready flat template textures; 'tshirt' produces a square torso graphic; 'layered_or_accessory' produces design/concept art for a 3D item (which the user must model/import as a mesh — explain this). Returns a public image URL; embed the returned markdown in your reply so the user sees the preview.",
    inputSchema: z.object({
      kind: z
        .enum(["classic_shirt", "classic_pants", "tshirt", "layered_or_accessory"])
        .describe(
          "classic_shirt/classic_pants = flat wrap texture; tshirt = square torso decal; layered_or_accessory = concept/texture art for a 3D mesh item.",
        ),
      style: z
        .string()
        .min(3)
        .max(900)
        .describe(
          "Full design description: garment/accessory type, colors, theme, motifs, mood. e.g. 'black and red cyber hoodie, neon circuit lines, techwear, glowing red trim'.",
        ),
    }),
    execute: async ({ kind, style }) => {
      if (!ctx.userId) return { error: "Please sign in to generate clothing." };
      const { checkImageHourlyLimit, generateImageFromPrompt } = await import("./image-gen.server");
      const limitErr = await checkImageHourlyLimit(ctx.userId);
      if (limitErr) return { error: limitErr };

      const { buildClothingImagePrompt } = await import("./roblox-clothing");
      // classic templates are tall-ish flat sheets; tshirt is square; accessory
      // concept art reads best square too.
      const aspectRatio = kind === "classic_shirt" || kind === "classic_pants" ? "1:1" : "1:1";
      const prompt = buildClothingImagePrompt(kind, style);

      // If the user uploaded a reference image, pass it to guide the design.
      let referenceImageBase64: string | undefined;
      let referenceMime: string | undefined;
      const ref = ctx.referenceImageDataUrl;
      if (ref && ref.startsWith("data:")) {
        const comma = ref.indexOf(",");
        if (comma > 0) {
          referenceMime = ref.slice(5, ref.indexOf(";"));
          referenceImageBase64 = ref.slice(comma + 1);
        }
      }

      const result = await generateImageFromPrompt({
        userId: ctx.userId ?? undefined,
        prompt,
        aspectRatio,
        referenceImageBase64,
        referenceMime,
        altText: `${kind.replace(/_/g, " ")}: ${style}`,
      });
      if ("error" in result) return result;

      const isClassic = kind === "classic_shirt" || kind === "classic_pants";
      const uploadTip = isClassic
        ? "Download the PNG, then in the Roblox Creator Dashboard go to Create → Avatar Items → Classic Clothing, upload it as a " +
          (kind === "classic_shirt" ? "Shirt" : "Pants") +
          ". Roblox wraps the template onto the avatar. Note: classic clothing uploads need a verified account/group and cost ~R$10."
        : kind === "tshirt"
          ? "Download the PNG and upload it as a Classic T-Shirt (Create → Avatar Items → Classic T-Shirt). It shows flat on the torso front."
          : "This is DESIGN ART for a 3D accessory, not a ready mesh. To make it wearable: model the shape in Blender (or import a base mesh), bring it into Studio via Avatar → Accessory Fitting Tool, set the correct Attachment (e.g. Hat → HatAttachment on the Head, back items → BodyBackAttachment), apply this art as its texture, then publish as an Accessory.";

      return {
        ...result,
        kind,
        isClassic,
        uploadTip,
        reminder:
          "Embed `markdown` in your reply so the user sees the preview, then give them the uploadTip steps.",
      };
    },
  }),
});
