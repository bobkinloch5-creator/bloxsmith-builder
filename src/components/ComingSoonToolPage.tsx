import { Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Clock, Film, FileCode, Sparkles } from "lucide-react";
import { Header, Footer } from "@/components/layout";

export function ComingSoonToolPage({
  title,
  eyebrow,
  description,
}: {
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="mx-auto grid min-h-[70vh] w-full max-w-5xl place-items-center px-6 py-16">
        <div className="w-full rounded-2xl border border-border bg-surface/60 p-6 shadow-xl sm:p-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-300">
            <Clock className="h-3.5 w-3.5" />
            Coming Soon
          </div>
          <p className="text-sm font-semibold text-primary">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Link
              to="/dashboard"
              className="rounded-xl border border-primary/30 bg-primary/10 p-4 transition hover:bg-primary/15"
            >
              <Bot className="mb-3 h-5 w-5 text-primary" />
              <div className="font-bold">AI Chat</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Live now for planning, scripts, fixes, and Roblox project help.
              </p>
            </Link>
            <Link
              to="/video-generator"
              className="rounded-xl border border-border bg-background/50 p-4 transition hover:border-primary/40"
            >
              <Film className="mb-3 h-5 w-5 text-primary" />
              <div className="font-bold">Video Generator</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Still live for Roblox trailers, promos, and cutscenes.
              </p>
            </Link>
            <Link
              to="/script-doctor"
              className="rounded-xl border border-border bg-background/50 p-4 transition hover:border-primary/40"
            >
              <FileCode className="mb-3 h-5 w-5 text-primary" />
              <div className="font-bold">Script Doctor</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Still live for debugging, improving, and explaining Luau.
              </p>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              Open AI Chat
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/changelog"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-surface"
            >
              <Sparkles className="h-4 w-4" />
              View Updates
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
