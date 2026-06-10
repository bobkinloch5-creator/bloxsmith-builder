import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Box,
  Building2,
  Car,
  Copy,
  ExternalLink,
  Gamepad2,
  Gem,
  Home,
  Loader2,
  Map,
  Mountain,
  Package,
  PawPrint,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trees,
} from "lucide-react";
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
  { label: "Maps", query: "roblox map kit", category: "Models", icon: Map },
  { label: "City", query: "city map buildings road", category: "Models", icon: Building2 },
  { label: "Buildings", query: "building house shop", category: "Models", icon: Building2 },
  { label: "Houses", query: "house furniture interior", category: "Models", icon: Home },
  { label: "Weapons", query: "weapon sword tool", category: "Models", icon: Swords },
  { label: "Vehicles", query: "vehicle car racing", category: "Models", icon: Car },
  { label: "NPCs", query: "npc character rig", category: "Models", icon: Bot },
  { label: "Pets", query: "pet simulator pet", category: "Models", icon: PawPrint },
  { label: "UI Kits", query: "gui ui kit", category: "Models", icon: Gamepad2 },
  { label: "Obbies", query: "obby kit checkpoint", category: "Models", icon: Sparkles },
  { label: "Tycoon", query: "tycoon kit buttons dropper", category: "Models", icon: Box },
  { label: "Simulator", query: "simulator coins gems pets", category: "Models", icon: Gem },
  { label: "Decorations", query: "decor props furniture", category: "Models", icon: Package },
  { label: "Terrain", query: "terrain nature rocks", category: "Models", icon: Mountain },
  { label: "Trees", query: "trees forest nature", category: "Models", icon: Trees },
  { label: "Roads", query: "road street sidewalk pack", category: "Models", icon: Map },
  { label: "Scripts", query: "script system", category: "Models", icon: Gamepad2 },
  { label: "Decals", query: "roblox icon decal", category: "Decals", icon: Sparkles },
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

  const wrapClass = compact ? "space-y-2.5" : "space-y-4";
  const controlClass = compact
    ? "space-y-2 rounded-xl border border-border/60 bg-surface/55 p-2 shadow-sm ring-1 ring-white/[0.03]"
    : "space-y-3 rounded-2xl border border-border/60 bg-surface/55 p-3 shadow-sm ring-1 ring-white/[0.03] sm:p-4";
  const categoryButtonClass = (active: boolean) =>
    `rounded-full border font-semibold transition ${
      compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
    } ${
      active
        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
        : "border-border/70 bg-background/40 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
    }`;

  return (
    <div className={wrapClass}>
      <section className={controlClass}>
        {onAdd && !compact && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Here are some assets I found for your game. Pick which ones you want me to add,
                then press <span className="font-semibold text-foreground">Add to Game</span>.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={categoryButtonClass(cat === c)}
              >
                {c}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className={`rounded-lg border border-border/70 bg-background/70 text-foreground ${
              compact ? "px-2 py-1 text-[11px]" : "px-2 py-1.5 text-xs"
            }`}
            title="Sort"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FILTERS.map((filter) => {
            const FilterIcon = filter.icon;
            return (
              <button
                key={filter.label}
                type="button"
                onClick={() => void applyFilter(filter)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/50 font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground ${
                  compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
                }`}
              >
                <FilterIcon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            placeholder={`Search safe free ${cat.toLowerCase()}...`}
            className={`min-w-0 flex-1 rounded-xl border border-border/70 bg-background/70 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10 ${
              compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
            }`}
          />
          <button
            type="button"
            onClick={onSearch}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 ${
              compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Free public Roblox-compatible assets only. Risky names are filtered before display and the plugin scans selected models.
          </div>
        )}
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
          compact
            ? "grid-cols-2 md:grid-cols-3 2xl:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        }`}
      >
        {results.map((asset) => (
          <div
            key={asset.id}
            className={`group flex min-w-0 flex-col overflow-hidden border border-border/60 bg-surface/55 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/10 ${
              compact ? "rounded-xl" : "rounded-2xl"
            }`}
          >
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className={`${compact ? "h-20 sm:h-24" : "aspect-square"} grid place-items-center overflow-hidden bg-surface-elevated`}
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
            <div className={`flex flex-1 flex-col ${compact ? "gap-1 p-2" : "gap-1.5 p-3"}`}>
              <h3
                className={`${compact ? "line-clamp-1 text-xs" : "line-clamp-2 text-sm"} font-semibold`}
                title={asset.name}
              >
                {asset.name}
              </h3>
              <p className={`${compact ? "text-[10px]" : "text-xs"} line-clamp-1 text-muted-foreground`}>
                by {asset.creator || "Unknown creator"}
              </p>
              <div className={`flex flex-wrap gap-1 ${compact ? "" : "pt-1"}`}>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary-glow">
                  {asset.assetType || cat}
                </span>
                {!compact && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    Free public
                  </span>
                )}
                <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  ID {asset.id}
                </span>
              </div>
              {asset.description && !compact && (
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {asset.description}
                </p>
              )}
              <div className={`mt-auto flex gap-1.5 ${compact ? "pt-1" : "pt-2"}`}>
                {onAdd ? (
                  <button
                    type="button"
                    onClick={() => void addAsset(asset)}
                    disabled={addingId === asset.id}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 ${
                      compact ? "py-1.5 text-[11px]" : "py-2 text-xs"
                    }`}
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
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-2 font-semibold hover:bg-secondary/80 ${
                      compact ? "py-1.5 text-[11px]" : "py-2 text-xs"
                    }`}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy ID
                  </button>
                )}
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center rounded-lg border border-border px-2 text-xs transition hover:bg-surface-elevated ${
                    compact ? "py-1.5" : "py-2"
                  }`}
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
