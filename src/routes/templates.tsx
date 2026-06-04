import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { Header } from "@/components/layout";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listTemplates, installTemplate } from "@/lib/templates.functions";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Download, Coins, Sparkles, Star, ShieldCheck, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { PluginStatus } from "@/components/PluginStatus";

export const Route = createFileRoute("/templates")({
  component: () => (<RequireAuth><TemplatesPage /></RequireAuth>),
  head: () => ({
    meta: [
      { title: "Template Store — BloxSmith" },
      {
        name: "description",
        content:
          "Browse ready-made Roblox starter kits: pet simulators, tycoons, obbies, tower defense, shops, admin panels and more. One-click install into Roblox Studio.",
      },
      { property: "og:title", content: "BloxSmith Template Store — Roblox Starter Kits" },
      {
        property: "og:description",
        content:
          "12+ production-ready Roblox systems. Clone into Studio in one click and start shipping.",
      },
      { property: "og:url", content: "https://bloxsmith.pro/templates" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/templates" }],
  }),
});

type Tpl = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  thumbnail_url: string | null;
  credits_cost: number;
  difficulty: string;
  features: string[];
  install_count: number;
};

function TemplatesPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(listTemplates);
  const install = useServerFn(installTemplate);
  const [cat, setCat] = useState<string>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => list(),
  });

  const installMut = useMutation({
    mutationFn: (slug: string) => install({ data: { templateSlug: slug } }),
    onSuccess: (res) => {
      toast.success(`Built ${res.name}`);
      nav({ to: "/project/$projectId", params: { projectId: res.projectId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const templates = (data?.templates ?? []) as Tpl[];
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(templates.map((t) => t.category)))],
    [templates],
  );
  const filtered = cat === "All" ? templates : templates.filter((t) => t.category === cat);
  const premiumCount = templates.filter((t) => t.credits_cost > 0).length;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="mb-8 rounded-2xl border border-border/60 bg-gradient-to-br from-surface/70 via-surface/30 to-background p-6 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-glow">
                <Star className="h-3.5 w-3.5" />
                Premium Roblox starter kits
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">
                Template <span className="gradient-text">Store</span>
              </h1>
              <p className="mt-2 text-muted-foreground max-w-2xl">
                Build polished Roblox game structures with credits. Each kit seeds scripts, UI,
                folders, tools, RemoteEvents, maps, tasks, and Studio-ready systems.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2">
                <div className="text-lg font-black">{templates.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Templates</div>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <div className="text-lg font-black text-amber-300">{premiumCount}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Premium</div>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <div className="text-lg font-black text-emerald-300">Safe</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Server auth</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-4 py-1.5 text-sm border transition ${
                cat === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.length === 0 && (
              <div className="col-span-full rounded-2xl border border-border/60 bg-surface/45 p-10 text-center">
                <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary-glow" />
                <h2 className="font-bold">No templates in this filter yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick another category. BloxSmith always includes starter kits even when the
                  Supabase catalog is empty.
                </p>
              </div>
            )}
            {filtered.map((t) => (
              <article
                key={t.id}
                className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 transition hover:-translate-y-0.5 ${
                  t.credits_cost > 0
                    ? "border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-surface/50 to-primary/10 shadow-[0_20px_70px_-54px_rgba(245,158,11,0.9)] hover:border-amber-400/45"
                    : "border-border/60 bg-surface/45 hover:border-primary/40"
                }`}
              >
                {t.credits_cost > 0 && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-primary to-fuchsia-400" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-primary-glow font-semibold">
                      {t.credits_cost > 0 ? <Wand2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {t.category}
                    </div>
                    <h2 className="font-bold text-lg leading-tight">{t.name}</h2>
                    </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      t.credits_cost === 0
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {t.credits_cost === 0 ? "Free" : `${t.credits_cost} credits`}
                  </span>
                </div>
                <div className="relative -mx-1 overflow-hidden rounded-xl border border-white/10 bg-background/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_40px_-28px_rgba(0,217,255,0.75)]">
                  <img
                    src={t.thumbnail_url ?? "/template-previews/simulator-real.webp"}
                    alt={`${t.name} preview`}
                    className="h-40 w-full object-cover saturate-[1.08] contrast-[1.04]"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/5" />
                  <div className="absolute bottom-2 left-2 rounded-full border border-black/20 bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                    Roblox game template
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    What it builds
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                  {(t.features ?? []).slice(0, 4).map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-primary-glow shrink-0" />
                      {f}
                    </li>
                  ))}
                  </ul>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Difficulty</div>
                    <div className="font-semibold capitalize">{t.difficulty}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Plugin</div>
                    <div className="font-semibold">Required</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                  <PluginStatus compact />
                  {user ? (
                    <button
                      onClick={() => installMut.mutate(t.slug)}
                      disabled={installMut.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {installMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : t.credits_cost === 0 ? (
                        <Download className="h-3.5 w-3.5" />
                      ) : (
                        <Coins className="h-3.5 w-3.5" />
                      )}
                      Build This Game
                    </button>
                  ) : (
                    <Link
                      to="/signup"
                      className="text-sm font-semibold text-primary-glow hover:underline"
                    >
                      Sign in to install
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
