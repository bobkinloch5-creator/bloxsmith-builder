// Free Roblox asset browse/search.
// Models use the legacy search.roblox.com endpoint (Creator Store free-models flow)
// because catalog.roblox.com's Category=12 is avatar gear, not Studio models.
// Other categories use catalog.roblox.com with a separate thumbnail fetch.

const LEGACY = "https://search.roblox.com/catalog/json";
const CATALOG = "https://catalog.roblox.com/v1/search/items/details";
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
  );
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
  );
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

  // Models always go through the legacy endpoint — that's the real Creator Store free-models source.
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
