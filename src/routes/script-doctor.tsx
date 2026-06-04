import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  CheckCircle2,
  FileCode2,
  Loader2,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout";
import { RequireAuth } from "@/components/RequireAuth";
import { PluginStatus } from "@/components/PluginStatus";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { fixErrorsWithAI } from "@/lib/ai.functions";

export const Route = createFileRoute("/script-doctor")({
  component: () => (
    <RequireAuth>
      <ScriptDoctorPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Script Doctor — AI Roblox Bug Fixer | BloxSmith" },
      {
        name: "description",
        content:
          "Paste Roblox Studio Output errors and let BloxSmith diagnose broken Luau scripts, prepare patches, and queue fixes for the Studio plugin.",
      },
    ],
  }),
});

type ProjectOption = {
  id: string;
  name: string;
  updated_at?: string | null;
};

type FixResult = {
  message: string;
  files: Array<{ path: string; file_type?: string; content?: string }>;
  actions: Array<{ type?: string; name?: string; parent?: string; path?: string }>;
  errors_found?: number;
  validation?: {
    errors?: Array<{ message: string; target?: string }>;
    warnings?: Array<{ message: string; target?: string }>;
  };
};

const SAMPLE_LOG = `14:32:18.221  ServerScriptService.CoinHandler:18: attempt to index nil with 'leaderstats'  -  Server
14:32:18.221  Stack Begin  -  Studio
14:32:18.222  Script 'ServerScriptService.CoinHandler', Line 18  -  Studio
14:32:18.222  Stack End  -  Studio`;

function ScriptDoctorPage() {
  const { user, profile, isOwner } = useAuth();
  const runFix = useServerFn(fixErrorsWithAI);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [logs, setLogs] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FixResult | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingProjects(true);
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load projects.");
        setProjects([]);
      } else {
        const rows = (data ?? []) as ProjectOption[];
        setProjects(rows);
        setProjectId((current) => current || rows[0]?.id || "");
      }
      setLoadingProjects(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projects, projectId],
  );
  const creditLabel = isOwner ? "Free for owner" : "2 credits + model tier";
  const canRun = !!projectId && logs.trim().length >= 4 && !busy;

  async function diagnose() {
    if (!canRun) return;
    setBusy(true);
    setResult(null);
    try {
      const output = (await runFix({ data: { projectId, logs } })) as FixResult;
      setResult(output);
      toast.success(
        `Prepared ${output.files?.length ?? 0} patch${output.files?.length === 1 ? "" : "es"}.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Script Doctor failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-6 rounded-2xl border border-border/60 bg-gradient-to-br from-surface/80 via-surface/35 to-background p-5 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-glow">
                <Stethoscope className="h-3.5 w-3.5" />
                AI Bug Fixer
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Script <span className="gradient-text">Doctor</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Paste Roblox Studio Output errors. BloxSmith reads your project files, checks live
                plugin context when available, rewrites the broken scripts, and queues fixes for
                Studio.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Badge icon={<Bug className="h-3.5 w-3.5" />} title="Finds" value="Errors" />
              <Badge icon={<FileCode2 className="h-3.5 w-3.5" />} title="Patches" value="Scripts" />
              <Badge icon={<PlugZap className="h-3.5 w-3.5" />} title="Studio" value="Plugin" />
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-2xl border border-border/60 bg-surface/45 p-4">
            <div className="mb-4 flex flex-col gap-3 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Wrench className="h-4 w-4 text-primary" />
                  Diagnose Studio Output
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select the project that owns the scripts, then paste the raw Output panel text.
                </p>
              </div>
              <PluginStatus compact />
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Project</span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  disabled={loadingProjects || projects.length === 0}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {loadingProjects ? (
                    <option>Loading projects...</option>
                  ) : projects.length === 0 ? (
                    <option>No projects yet</option>
                  ) : (
                    projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setLogs(SAMPLE_LOG)}
                className="h-10 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
              >
                Use example
              </button>
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Studio Output</span>
              <textarea
                value={logs}
                onChange={(event) => setLogs(event.target.value)}
                spellCheck={false}
                placeholder="Paste Roblox Studio Output errors here..."
                className="h-72 w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>

            <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                Cost: <span className="font-semibold text-foreground">{creditLabel}</span>
                {profile ? ` · Balance: ${profile.credits ?? 0} credits` : ""}
              </div>
              <button
                type="button"
                onClick={diagnose}
                disabled={!canRun}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
                {busy ? "Diagnosing..." : "Fix errors"}
              </button>
            </div>

            {projects.length === 0 && !loadingProjects ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Create a project first so Script Doctor has files to patch.
                <Link to="/dashboard" className="ml-2 font-bold text-amber-200 underline">
                  Go to Dashboard
                </Link>
              </div>
            ) : null}
          </section>

          <aside className="space-y-4">
            <InfoCard
              icon={<ShieldCheck className="h-4 w-4" />}
              title="What It Checks"
              items={[
                "Script path and line number",
                "Missing leaderstats or remotes",
                "Nil instance references",
                "Bad service paths",
                "Unsafe client/server logic",
              ]}
            />
            <InfoCard
              icon={<Sparkles className="h-4 w-4" />}
              title="Best Input"
              items={[
                "Raw Studio Output text",
                "Stack traces included",
                "Plugin synced project",
                "Recent project files saved",
              ]}
            />
            {selectedProject ? (
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-primary-glow">
                  Selected project
                </div>
                <div className="mt-1 font-semibold">{selectedProject.name}</div>
                <Link
                  to="/project/$projectId"
                  params={{ projectId: selectedProject.id }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary-glow hover:underline"
                >
                  Open project fixer <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : null}
          </aside>
        </div>

        {result ? <ResultPanel result={result} projectId={projectId} /> : null}
      </main>
    </div>
  );
}

function Badge({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="uppercase tracking-wide">{title}</span>
      </div>
      <div className="mt-1 font-black text-foreground">{value}</div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/35 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      <ul className="space-y-2 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary-glow" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultPanel({ result, projectId }: { result: FixResult; projectId: string }) {
  const validationErrors = result.validation?.errors ?? [];
  const validationWarnings = result.validation?.warnings ?? [];

  return (
    <section className="mt-5 rounded-2xl border border-border/60 bg-surface/45 p-4">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Script Doctor Result
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Prepared {result.files?.length ?? 0} file patch{result.files?.length === 1 ? "" : "es"} and{" "}
            {result.actions?.length ?? 0} Studio action{result.actions?.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          to="/project/$projectId"
          params={{ projectId }}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-bold text-primary-glow hover:bg-primary/15"
        >
          Open project <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-xl border border-border/60 bg-background/45 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Diagnosis
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {result.message || "Patch prepared."}
          </pre>
        </div>
        <div className="space-y-3">
          <MiniList
            title="Patched files"
            empty="No script files patched."
            items={(result.files ?? []).map((file) => file.path)}
          />
          <MiniList
            title="Queued actions"
            empty="No Studio actions queued."
            items={(result.actions ?? []).map(
              (action) => action.path || action.parent || action.name || action.type || "Action",
            )}
          />
          {validationErrors.length || validationWarnings.length ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Sync check
              </div>
              <div className="text-xs text-amber-100">
                {validationErrors.length} blocked · {validationWarnings.length} warning(s)
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MiniList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/45 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {items.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {items.slice(0, 8).map((item, index) => (
            <li key={`${item}-${index}`} className="truncate">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
