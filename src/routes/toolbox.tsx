import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchToolboxFn } from "@/lib/toolbox.functions";
import { Loader2, Search, Copy, ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/toolbox")({
  component: ToolboxPage,
  head: () => ({
    meta: [
      { title: "Toolbox — Free Roblox Assets | BloxSmith" },
      {
        name: "description",
        content:
          "Browse the entire free Roblox catalog — models, decals, audio, plugins, and meshes — with thumbnails. Copy asset IDs straight into Roblox Studio.",
      },
    ],
  }),
});

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

type Asset = {
  id: number;
  name: string;
  creator: string;
  assetType: string;
  thumbnail: string | null;
  url: string;
};

function ToolboxPage() {
  const search = useServerFn(searchToolboxFn);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("Models");
  const [sort, setSort] = useState<Sort>("MostFavorited");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [results, setResults] = useState<Asset[]>([]);
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
            limit: 30,
            cursor: nextCursor ?? undefined,
          },
        });
        const newItems: Asset[] = res?.results ?? [];
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
    [search, q, cat, sort],
  );

  // Auto-browse on category/sort change (no keyword needed)
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

  const copy = async (id: number) => {
    try {
      await navigator.clipboard.writeText(`rbxassetid://${id}`);
      toast.success(`Copied rbxassetid://${id}`);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            Toolbox — Free Roblox Assets
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse the entire public Roblox catalog. Copy{" "}
            <code className="bg-surface px-1 rounded">rbxassetid://</code> IDs or open the asset
            page to insert into Studio.
          </p>
        </header>

        <section className="glass rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex gap-2 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                    cat === c
                      ? "bg-primary text-primary-foreground border-primary"
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
              className="rounded-lg bg-surface border border-border px-2 py-1.5 text-xs"
              title="Sort"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder={`Search free ${cat.toLowerCase()}… (leave empty to browse)`}
              className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm"
            />
            <button
              onClick={onSearch}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
        </section>

        {busy && results.length === 0 && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {done && !busy && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No free assets found. Try another keyword or category.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {results.map((a) => (
            <div key={a.id} className="glass rounded-xl overflow-hidden flex flex-col group">
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="aspect-square bg-surface-elevated flex items-center justify-center overflow-hidden"
              >
                {a.thumbnail ? (
                  <img
                    src={a.thumbnail}
                    alt={a.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                  />
                ) : (
                  <Package className="w-8 h-8 text-muted-foreground" />
                )}
              </a>
              <div className="p-3 flex-1 flex flex-col gap-1">
                <div className="text-sm font-medium line-clamp-2" title={a.name}>
                  {a.name}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">by {a.creator}</div>
                <div className="text-[10px] text-muted-foreground/80">ID {a.id}</div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => copy(a.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-secondary px-2 py-1.5 text-xs hover:bg-secondary/80"
                  >
                    <Copy className="w-3 h-3" /> Copy ID
                  </button>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1.5 text-xs hover:bg-surface-elevated"
                    title="Open on Roblox"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {cursor && results.length > 0 && (
          <div className="flex justify-center pt-2 pb-8">
            <button
              onClick={() => load(false, cursor)}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm hover:bg-surface-elevated disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </>
              ) : (
                "Load more"
              )}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
