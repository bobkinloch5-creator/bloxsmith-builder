// Free Roblox asset browse/search.
// Models use the legacy search.roblox.com endpoint (Creator Store free-models flow)
// because catalog.roblox.com's Category=12 is avatar gear, not Studio models.
// Other categories use catalog.roblox.com with a separate thumbnail fetch.

const LEGACY = "https://search.roblox.com/catalog/json";
const CATALOG = "https://catalog.roblox.com/v1/search/items/details";
const TOOLBOX = "https://apis.roblox.com/toolbox-service/v1";
const THUMBS = "https://thumbnails.roblox.com/v1/assets";

export type ToolboxCategory = "Models" | "Decals" | "Audio" | "Plugins" | "Meshes";

// catalog.roblox.com category numbers
const CATALOG_CAT: Record<Exclude<ToolboxCategory, "Models">, number> = {
  Decals: 11,
  Audio: 14,
  Plugins: 13,
  Meshes: 39,
};

// search.roblox.com legacy category numbers
const LEGACY_CAT: Record<ToolboxCategory, number> = {
  Models: 6,
  Decals: 13,
  Audio: 9,
  Plugins: 38,
  Meshes: 40,
};

const TOOLBOX_CAT: Record<ToolboxCategory, number> = {
  Models: 10,
  Decals: 13,
  Audio: 3,
  Plugins: 38,
  Meshes: 40,
};

export type SortType = "Relevance" | "MostFavorited" | "Bestselling" | "RecentlyUpdated";
const CATALOG_SORT: Record<SortType, string> = {
  Relevance: "3",
  MostFavorited: "1",
  Bestselling: "2",
  RecentlyUpdated: "5",
};
const LEGACY_SORT: Record<SortType, number> = {
  Relevance: 0,
  MostFavorited: 1,
  Bestselling: 2,
  RecentlyUpdated: 3,
};

export type ToolboxAsset = {
  id: number;
  name: string;
  creator: string;
  assetType: string;
  price: number;
  thumbnail: string | null;
  url: string;
  description?: string | null;
};

export type ToolboxPage = {
  results: ToolboxAsset[];
  cursor: string | null; // For Models we encode the next page number as a string
};

async function fetchThumbnails(ids: number[]): Promise<Record<number, string>> {
  if (!ids.length) return {};
  try {
    const url = `${THUMBS}?assetIds=${ids.join(",")}&size=420x420&format=Png&isCircular=false`;
    const res = await fetch(url, { headers: { "User-Agent": "BloxSmith/1.0" } });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      data?: Array<{ targetId: number; imageUrl: string | null; state: string }>;
    };
    const map: Record<number, string> = {};
    for (const t of json.data ?? []) {
      if (t.imageUrl && t.state === "Completed") map[t.targetId] = t.imageUrl;
    }
    return map;
  } catch {
    return {};
  }
}

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

function hasUnsafeTerms(item: Record<string, unknown>) {
  const haystack = `${item.Name ?? ""} ${item.name ?? ""} ${item.Description ?? ""} ${item.description ?? ""} ${item.Creator ?? ""} ${item.creatorName ?? ""}`.toLowerCase();
  return UNSAFE_ASSET_TERMS.some((term) => haystack.includes(term));
}

function assetTypeLabel(category: ToolboxCategory, row: any) {
  const objectType = row?.asset?.objectTypes?.find((value: unknown) => typeof value === "string");
  if (objectType) return objectType;
  const categoryPath = String(row?.asset?.categoryPath ?? "")
    .replace(/^3d__/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (categoryPath) return categoryPath.replace(/\b\w/g, (char) => char.toUpperCase());
  return category;
}

async function fetchToolboxDetails(ids: number[], category: ToolboxCategory): Promise<ToolboxAsset[]> {
  if (!ids.length) return [];
  const res = await fetch(`${TOOLBOX}/items/details?assetIds=${ids.join(",")}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 BloxSmith/1.0" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: any[] };
  const rows = json.data ?? [];
  const thumbs = await fetchThumbnails(ids);
  return rows
    .map((row) => {
      const asset = row?.asset;
      const creator = row?.creator;
      if (!asset || typeof asset.id !== "number") return null;
      const isFree = row?.fiatProduct?.isFree === true;
      const isPublic = asset.visibilityStatus == null || asset.visibilityStatus === 1;
      const isAvailable = row?.fiatProduct?.purchasable !== false;
      const metadata = {
        name: asset.name,
        description: asset.description,
        creatorName: creator?.name,
      };
      if (!isFree || !isPublic || !isAvailable || hasUnsafeTerms(metadata)) return null;
      const item: ToolboxAsset = {
        id: asset.id,
        name: String(asset.name ?? `Asset ${asset.id}`).trim(),
        creator: String(creator?.name ?? "Unknown creator"),
        assetType: assetTypeLabel(category, row),
        price: 0,
        thumbnail: thumbs[asset.id] ?? null,
        url: `https://create.roblox.com/store/asset/${asset.id}`,
        description:
          typeof asset.description === "string" && asset.description.trim()
            ? asset.description.trim().slice(0, 180)
            : null,
      };
      return item;
    })
    .filter((item): item is ToolboxAsset => !!item);
}

async function searchToolboxService(opts: {
  keyword?: string;
  category: ToolboxCategory;
  limit: number;
  cursor?: string;
}): Promise<ToolboxPage> {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(opts.limit * 2, opts.limit), 60)),
  });
  const kw = opts.keyword?.trim();
  if (kw) params.set("keyword", kw);
  if (opts.cursor) params.set("cursor", opts.cursor);

  const res = await fetch(`${TOOLBOX}/marketplace/${TOOLBOX_CAT[opts.category]}?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 BloxSmith/1.0" },
  });
  if (!res.ok) throw new Error(`Toolbox marketplace search failed (${res.status})`);
  const json = (await res.json()) as {
    data?: Array<{ id?: number }>;
    nextPageCursor?: string | null;
  };
  const ids = (json.data ?? [])
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number")
    .slice(0, Math.min(opts.limit * 2, 60));
  const results = (await fetchToolboxDetails(ids, opts.category)).slice(0, opts.limit);
  return {
    results,
    cursor: json.nextPageCursor ?? null,
  };
}

// Legacy free-models / decals / audio etc. — most reliable for Studio assets.
async function searchLegacy(opts: {
  keyword?: string;
  category: ToolboxCategory;
  limit: number;
  page: number;
  sort: SortType;
}): Promise<ToolboxPage> {
  const params = new URLSearchParams({
    Category: String(LEGACY_CAT[opts.category]),
    ResultsPerPage: String(opts.limit),
    PageNumber: String(Math.max(1, opts.page)),
    SortType: String(LEGACY_SORT[opts.sort]),
    IncludeNotForSale: "false",
  });
  const kw = opts.keyword?.trim();
  if (kw) params.set("Keyword", kw);

  const res = await fetch(`${LEGACY}?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "BloxSmith/1.0" },
  });
  if (!res.ok) throw new Error(`Toolbox search failed (${res.status})`);
  const raw = (await res.json()) as unknown;
  const arr = Array.isArray(raw) ? raw : [];
  const items = arr.filter(
    (a: { PriceInRobux?: number | null; BestPrice?: number }) =>
      (a.PriceInRobux ?? a.BestPrice ?? 0) === 0,
  ).filter((a: Record<string, unknown>) => !hasUnsafeTerms(a));
  // Legacy thumbnails are tiny — upgrade to 420x420 via the thumbnails service.
  const ids = items.map((a) => a.AssetId);
  const thumbs = await fetchThumbnails(ids);
  const next = items.length >= opts.limit ? String(opts.page + 1) : null;
  return {
    results: items.map((a) => ({
      id: a.AssetId,
      name: a.Name,
      creator: a.Creator,
      assetType: opts.category,
      price: 0,
      thumbnail: thumbs[a.AssetId] ?? a.ThumbnailUrl ?? null,
      url: `https://create.roblox.com/store/asset/${a.AssetId}`,
      description: typeof a.Description === "string" ? a.Description.slice(0, 180) : null,
    })),
    cursor: next,
  };
}

async function searchCatalog(opts: {
  keyword?: string;
  category: Exclude<ToolboxCategory, "Models">;
  limit: number;
  cursor?: string;
  sort: SortType;
}): Promise<ToolboxPage> {
  const params = new URLSearchParams({
    Category: String(CATALOG_CAT[opts.category]),
    Limit: String(Math.min(Math.max(opts.limit, 1), 30)),
    SortType: CATALOG_SORT[opts.sort],
    IncludeNotForSale: "false",
  });
  const kw = opts.keyword?.trim();
  if (kw) params.set("Keyword", kw);
  if (opts.cursor) params.set("Cursor", opts.cursor);

  const res = await fetch(`${CATALOG}?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "BloxSmith/1.0" },
  });
  if (!res.ok) throw new Error(`Catalog search failed (${res.status})`);
  const json = (await res.json()) as {
    data?: Array<{
      id: number;
      name: string;
      creatorName: string;
      itemType?: string;
      price: number | null;
      priceStatus?: string;
    }>;
    nextPageCursor?: string | null;
  };
  const raw = (json.data ?? []).filter(
    (a) => (a.price ?? 0) === 0 || a.priceStatus === "Free",
  ).filter((a) => !hasUnsafeTerms(a as unknown as Record<string, unknown>));
  const ids = raw.map((a) => a.id);
  const thumbs = await fetchThumbnails(ids);
  return {
    results: raw.map((a) => ({
      id: a.id,
      name: a.name,
      creator: a.creatorName,
      assetType: a.itemType ?? opts.category,
      price: 0,
      thumbnail: thumbs[a.id] ?? null,
      url: `https://create.roblox.com/store/asset/${a.id}`,
      description: null,
    })),
    cursor: json.nextPageCursor ?? null,
  };
}

export async function searchToolbox(opts: {
  keyword?: string;
  category?: ToolboxCategory;
  limit?: number;
  cursor?: string;
  sort?: SortType;
}): Promise<ToolboxPage> {
  const category = opts.category ?? "Models";
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 30);
  const sort = opts.sort ?? (opts.keyword ? "Relevance" : "MostFavorited");

  try {
    const page = await searchToolboxService({
      keyword: opts.keyword,
      category,
      limit,
      cursor: opts.cursor,
    });
    if (page.results.length > 0 || page.cursor) return page;
  } catch (e) {
    console.error("[toolbox] marketplace search failed, falling back:", e);
  }

  if (category === "Models") {
    const page = opts.cursor ? parseInt(opts.cursor, 10) || 1 : 1;
    try {
      return await searchLegacy({ keyword: opts.keyword, category, limit, page, sort });
    } catch (e) {
      // Last-ditch fallback so the page never crashes
      console.error("[toolbox] legacy search failed:", e);
      return { results: [], cursor: null };
    }
  }

  try {
    return await searchCatalog({ keyword: opts.keyword, category, limit, cursor: opts.cursor, sort });
  } catch (e) {
    // Fall back to legacy if the modern catalog endpoint refuses the request
    console.error("[toolbox] catalog search failed, falling back to legacy:", e);
    const page = opts.cursor ? parseInt(opts.cursor, 10) || 1 : 1;
    return searchLegacy({ keyword: opts.keyword, category, limit, page, sort });
  }
}
