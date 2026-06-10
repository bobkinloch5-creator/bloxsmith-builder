import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Package, Plus, Search, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";
import { searchToolboxFn } from "@/lib/toolbox.functions";
import { copyText } from "@/lib/copy";

const CATEGORIES = ["Models", "Decals", "Audio", "Plugins", "Meshes"] as const;
type Cat = (typeof CATEGORIES)[number];
const SORTS = ["MostFavorited", "Bestselling", "RecentlyUpdated", "Relevance"] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABEL: Record<Sort, string> = {
  MostFavorited: "Most Favorited",
  Bestselling: "Bestselling",
  RecentlyUpdated: "Recently Updated",
  Relevance: "Relevance",
};

const FILTERS = [
  { label: "Maps", query: "map kit", category: "Models" },
  { label: "Buildings", query: "building", category: "Models" },
  { label: "Weapons", query: "weapon sword", category: "Models" },
  { label: "Vehicles", query: "vehicle car", category: "Models" },
  { label: "NPCs", query: "npc character", category: "Models" },
  { label: "Pets", query: "pet simulator pet", category: "Models" },
  { label: "UI", query: "gui ui kit", category: "Models" },
  { label: "Scripts", query: "script system", category: "Models" },
  { label: "Terrain", query: "terrain nature", category: "Models" },
  { label: "Decorations", query: "decor props", category: "Models" },
  { label: "Obbies", query: "obby kit", category: "Models" },
  { label: "Tycoon", query: "tycoon kit", category: "Models" },
  { label: "Simulator", query: "simulator asset", category: "Models" },
] as const;

export type ToolboxPickerAsset = {
  id: number;
  name: string;
  creator: string;
  assetType: string;
  thumbnail: string | null;
  url: string;
  description?: string | null;
};

export function ToolboxAssetPicker({
  compact = false,
  onAdd,
}: {
  compact?: boolean;
  onAdd?: (asset: ToolboxPickerAsset) => Promise<void> | void;
}) {
  const search = useServerFn(searchToolboxFn);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("Models");
  const [sort, setSort] = useState<Sort>("MostFavorited");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [results, setResults] = useState<ToolboxPickerAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(
    async (reset: boolean, nextCursor?: string | null) => {
      if (reset) setBusy(true);
      else setLoadingMore(true);
      try {
        const res: any = await search({
          data: {
            keyword: q.trim() || undefined,
            category: cat,
            sort: q.trim() ? "Relevance" : sort,
            limit: compact ? 12 : 30,
            cursor: nextCursor ?? undefined,
          },
        });
        const newItems: ToolboxPickerAsset[] = res?.results ?? [];
        setResults((prev) => (reset ? newItems : [...prev, ...newItems]));
        setCursor(res?.cursor ?? null);
        setDone(true);
      } catch (e: any) {
        toast.error(e?.message ?? "Search failed");
      } finally {
        setBusy(false);
        setLoadingMore(false);
      }
    },
    [cat, compact, q, search, sort],
  );

  useEffect(() => {
    setResults([]);
    setCursor(null);
    setDone(false);
    load(true, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, sort]);

  const onSearch = () => {
    setResults([]);
    setCursor(null);
    setDone(false);
    load(true, null);
  };

  const applyFilter = async (filter: (typeof FILTERS)[number]) => {
    const category = filter.category as Cat;
    setCat(category);
    setQ(filter.query);
    setSort("Relevance");
    setBusy(true);
    setResults([]);
    setCursor(null);
    setDone(false);
    try {
      const res: any = await search({
        data: {
          keyword: filter.query,
          category,
          sort: "Relevance",
          limit: compact ? 12 : 30,
        },
      });
      setResults(res?.results ?? []);
      setCursor(res?.cursor ?? null);
      setDone(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Search failed");
    } finally {
      setBusy(false);
    }
  };

  const addAsset = async (asset: ToolboxPickerAsset) => {
    if (!onAdd || addingId) return;
    setAddingId(asset.id);
    try {
      await onAdd(asset);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface/35 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  cat === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-surface-elevated"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
            title="Sort"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() => void applyFilter(filter)}
              className="rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            placeholder={`Search safe free ${cat.toLowerCase()}...`}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onSearch}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Free public Roblox-compatible assets only. Risky names are filtered before display.
        </div>
      </section>

      {busy && results.length === 0 && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {done && !busy && results.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No safe free assets found. Try another keyword or category.
        </p>
      )}

      <div
        className={`grid gap-3 ${
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        }`}
      >
        {results.map((asset) => (
          <div
            key={asset.id}
            className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface/35"
          >
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="aspect-square overflow-hidden bg-surface-elevated grid place-items-center"
            >
              {asset.thumbnail ? (
                <img
                  src={asset.thumbnail}
                  alt={asset.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                />
              ) : (
                <Package className="h-8 w-8 text-muted-foreground" />
              )}
            </a>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <h3 className="line-clamp-2 text-sm font-semibold" title={asset.name}>
                {asset.name}
              </h3>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                by {asset.creator || "Unknown creator"}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary-glow">
                  {asset.assetType || cat}
                </span>
                <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-muted-foreground">
                  ID {asset.id}
                </span>
              </div>
              {asset.description && (
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {asset.description}
                </p>
              )}
              <div className="mt-auto flex gap-1.5 pt-2">
                {onAdd ? (
                  <button
                    type="button"
                    onClick={() => void addAsset(asset)}
                    disabled={addingId === asset.id}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {addingId === asset.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Add to Game
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void copyText(`rbxassetid://${asset.id}`, "Asset ID copied")}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-secondary px-2 py-1.5 text-xs font-semibold hover:bg-secondary/80"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy ID
                  </button>
                )}
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1.5 text-xs transition hover:bg-surface-elevated"
                  title="Open on Roblox"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cursor && results.length > 0 && (
        <div className="flex justify-center pb-2 pt-1">
          <button
            type="button"
            onClick={() => load(false, cursor)}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm hover:bg-surface-elevated disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
