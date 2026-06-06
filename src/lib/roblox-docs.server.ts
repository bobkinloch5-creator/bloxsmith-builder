// Server-only helpers for the Roblox Docs knowledge base.
// Indexes Roblox/creator-docs markdown into pgvector and provides semantic search.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const EMBED_DIMS = 1536;
const CHUNK_CHARS = 1400;
const CHUNK_OVERLAP = 200;
const GH_REPO = "Roblox/creator-docs";
const GH_BRANCH = "main";
// Optional GitHub token. api.github.com allows only 60 requests/hour
// unauthenticated, so on a serverless host the repo-tree listing frequently
// 403s ("API rate limit exceeded") and the whole sync fails. A token raises the
// limit to 5,000/hour. Raw file fetches (raw.githubusercontent.com) are NOT
// rate-limited and need no token.
const GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

function ghApiHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": "BloxSmith-Docs-Sync",
    Accept: "application/vnd.github+json",
  };
  if (GH_TOKEN) h.Authorization = `Bearer ${GH_TOKEN}`;
  return h;
}

// Curated prefixes — covers Luau scripting, engine reference, services,
// DataStore, RemoteEvents, UI, MarketplaceService, plugins, tutorials, art,
// audio, physics, animation, characters, environment. Broad enough that the AI
// "knows" the engine, while keeping the chunk count manageable (a few thousand)
// instead of the whole ~50k-file tree.
const DEFAULT_INCLUDE_PREFIXES = [
  "content/en-us/scripting",
  "content/en-us/reference/engine/classes",
  "content/en-us/reference/engine/datatypes",
  "content/en-us/reference/engine/enums",
  "content/en-us/reference/engine/globals",
  "content/en-us/reference/engine/libraries",
  "content/en-us/luau",
  "content/en-us/cloud-services",
  "content/en-us/cloud",
  "content/en-us/projects/data-model",
  "content/en-us/projects/assets",
  "content/en-us/studio",
  "content/en-us/ui",
  "content/en-us/input",
  "content/en-us/players",
  "content/en-us/characters",
  "content/en-us/animation",
  "content/en-us/physics",
  "content/en-us/environment",
  "content/en-us/audio",
  "content/en-us/sound",
  "content/en-us/art",
  "content/en-us/tutorials",
  "content/en-us/production/monetization",
  "content/en-us/production/publishing",
];

export type DocsCitation = {
  id: string;
  title: string;
  section: string | null;
  source: "github" | "web";
  source_url: string;
  repo_path: string | null;
  similarity: number;
  snippet: string;
};

// ---------------- Embeddings ----------------

type EmbedItem = { embedding: number[]; index: number };

// Direct OpenAI model id (the Lovable gateway prefixes provider names).
const OPENAI_EMBED_MODEL = EMBED_MODEL.replace(/^openai\//, "");

// Calls the embeddings API for one string or a batch. Prefers the Lovable AI
// gateway; if that gateway is OUT OF CREDITS (HTTP 402 / payment_required) or
// otherwise fails, it transparently falls back through every OpenAI-compatible
// embedding provider that has a key configured — OpenAI, then CometAPI, then
// Neokens. All of them serve text-embedding-3-small at 1536 dims, which is the
// SAME vector space, so chunks stay mutually compatible no matter which
// provider produced them. This means the docs index works with the Comet /
// Neokens key that already powers chat — no Lovable top-up or new OpenAI key
// required. When NO provider can run, it throws a clear, actionable error.
const stripTrailingSlash = (u: string) => u.replace(/\/+$/, "");

async function callEmbeddings(input: string | string[]): Promise<EmbedItem[]> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const cometKey = process.env.COMETAPI_KEY || process.env.COMET_API_KEY;
  const cometBase = stripTrailingSlash(process.env.COMET_BASE_URL || "https://api.cometapi.com/v1");
  const neokensKey = process.env.NEOKENS_API_KEY || process.env.NEOKENS_KEY;
  const neokensBase = stripTrailingSlash(
    process.env.NEOKENS_BASE_URL || "https://api.quatarly.cloud/v1",
  );

  // One OpenAI-compatible /v1/embeddings call. Every gateway below proxies
  // text-embedding-3-small into the same 1536-dim space.
  const callDirect = async (label: string, url: string, key: string): Promise<EmbedItem[]> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input, dimensions: EMBED_DIMS }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${label} embeddings ${res.status}: ${body.slice(0, 200)}`);
    }
    return ((await res.json()) as { data: EmbedItem[] }).data;
  };

  // Ordered fallback chain of direct providers, using whatever keys exist.
  const directProviders: Array<{ label: string; url: string; key: string }> = [];
  if (openaiKey)
    directProviders.push({
      label: "OpenAI",
      url: "https://api.openai.com/v1/embeddings",
      key: openaiKey,
    });
  if (cometKey)
    directProviders.push({ label: "CometAPI", url: `${cometBase}/embeddings`, key: cometKey });
  if (neokensKey)
    directProviders.push({ label: "Neokens", url: `${neokensBase}/embeddings`, key: neokensKey });

  // Returns embeddings from the first provider that succeeds. Returns null only
  // when NO provider is configured; throws the last error if all configured
  // providers failed (so the caller surfaces a specific reason).
  const tryDirectProviders = async (): Promise<EmbedItem[] | null> => {
    if (directProviders.length === 0) return null;
    let lastErr: unknown = null;
    for (const p of directProviders) {
      try {
        return await callDirect(p.label, p.url, p.key);
      } catch (e) {
        lastErr = e;
        console.warn(
          `[roblox-docs] ${p.label} embeddings failed, trying next provider:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("all embedding providers failed");
  };

  // 1. Prefer the Lovable gateway when its key is present.
  if (lovableKey) {
    let lovableOk = false;
    let status = 0;
    let body = "";
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({ model: EMBED_MODEL, input, dimensions: EMBED_DIMS }),
      });
      status = res.status;
      if (res.ok) {
        lovableOk = true;
        return ((await res.json()) as { data: EmbedItem[] }).data;
      }
      body = await res.text().catch(() => "");
    } catch (e) {
      body = e instanceof Error ? e.message : String(e);
    }

    if (!lovableOk) {
      const outOfCredits =
        status === 402 || /payment_required|not enough credits|insufficient/i.test(body);

      // On ANY Lovable failure, fall back through the configured direct
      // providers (Comet/Neokens/OpenAI) before giving up.
      const fallback = await tryDirectProviders();
      if (fallback) {
        console.warn(
          `[roblox-docs] Lovable embeddings failed (${status || "network"}${
            outOfCredits ? ", out of credits" : ""
          }) — used a direct embedding provider instead.`,
        );
        return fallback;
      }

      if (outOfCredits) {
        throw new Error(
          `Embedding provider is out of credits (Lovable AI gateway returned ${status}). ` +
            `Fix it one of three ways: (a) top up your Lovable AI credits, (b) set OPENAI_API_KEY, or ` +
            `(c) set COMETAPI_KEY or NEOKENS_API_KEY — the docs sync will then embed via that gateway ` +
            `(text-embedding-3-small, 1536-dim, same vector space). Original: ${body.slice(0, 160)}`,
        );
      }
      throw new Error(`embeddings ${status}: ${body.slice(0, 200)}`);
    }
  }

  // 2. No Lovable key — use any configured direct provider.
  const direct = await tryDirectProviders();
  if (direct) return direct;

  throw new Error(
    "No embedding provider configured. Set LOVABLE_API_KEY, OPENAI_API_KEY, COMETAPI_KEY, or " +
      "NEOKENS_API_KEY to enable the Roblox docs index.",
  );
}

async function embed(text: string): Promise<number[]> {
  const data = await callEmbeddings(text);
  const vec = data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBED_DIMS) {
    throw new Error("invalid embedding response");
  }
  return vec;
}

// Batched embedding (the embeddings API accepts an array via `input`).
async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const data = await callEmbeddings(texts);
  const out: number[][] = Array(texts.length);
  for (const d of data) out[d.index] = d.embedding;
  return out;
}

// ---------------- Markdown chunking ----------------

function stripFrontMatter(md: string): { title?: string; body: string } {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { body: md };
  const fm = m[1];
  const titleMatch = fm.match(/^title:\s*"?([^"\n]+)"?/m);
  return { title: titleMatch?.[1]?.trim(), body: md.slice(m[0].length) };
}

function chunkMarkdown(
  body: string,
): { section: string | null; content: string }[] {
  // Split on h1/h2/h3 headings
  const parts = body.split(/\n(?=#{1,3}\s)/);
  const chunks: { section: string | null; content: string }[] = [];
  for (const part of parts) {
    const headingMatch = part.match(/^(#{1,3})\s+(.+?)\s*$/m);
    const section = headingMatch ? headingMatch[2].trim() : null;
    const text = part.trim();
    if (!text) continue;
    if (text.length <= CHUNK_CHARS) {
      chunks.push({ section, content: text });
      continue;
    }
    let i = 0;
    while (i < text.length) {
      const slice = text.slice(i, i + CHUNK_CHARS);
      chunks.push({ section, content: slice });
      i += CHUNK_CHARS - CHUNK_OVERLAP;
    }
  }
  return chunks.filter((c) => c.content.length >= 80);
}

// ---------------- GitHub fetch ----------------

type TreeEntry = { path: string; type: string; sha: string };

async function listRepoTree(): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${GH_REPO}/git/trees/${GH_BRANCH}?recursive=1`;
  const res = await fetch(url, { headers: ghApiHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const isRate =
      res.status === 403 &&
      (/rate limit/i.test(body) || res.headers.get("x-ratelimit-remaining") === "0");
    if (isRate) {
      throw new Error(
        GH_TOKEN
          ? "GitHub API rate limit hit even with a token — wait a few minutes and re-run."
          : "GitHub API rate limit hit (60/hour unauthenticated). Set a GITHUB_TOKEN env var to raise it to 5,000/hour, then re-run the sync.",
      );
    }
    throw new Error(`github tree ${res.status}: ${body.slice(0, 160)}`);
  }
  const json = (await res.json()) as { tree: TreeEntry[]; truncated?: boolean };
  if (json.truncated) {
    console.warn(
      "[roblox-docs] GitHub tree response was truncated — some files may be missing from this pass.",
    );
  }
  return (json.tree ?? []).filter((e) => e.type === "blob" && e.path.endsWith(".md"));
}

async function fetchFileRaw(path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${GH_REPO}/${GH_BRANCH}/${path}`;
  const res = await fetch(url, { headers: { "User-Agent": "BloxSmith-Docs-Sync" } });
  if (!res.ok) throw new Error(`raw ${res.status} ${path}`);
  return res.text();
}

function docUrlFor(path: string): string {
  // Convert "content/en-us/scripting/foo.md" -> https://create.roblox.com/docs/en-us/scripting/foo
  const cleaned = path.replace(/^content\//, "").replace(/\.md$/, "");
  return `https://create.roblox.com/docs/${cleaned}`;
}

// ---------------- Public API ----------------

export async function searchRobloxDocs(query: string, limit = 6): Promise<DocsCitation[]> {
  const q = query.trim();
  if (!q) return [];
  let vec: number[];
  try {
    vec = await embed(q);
  } catch (e) {
    console.warn("[roblox-docs] embed failed:", e instanceof Error ? e.message : e);
    return [];
  }
  const { data, error } = await (supabaseAdmin as any).rpc("match_roblox_docs", {
    query_embedding: vec,
    match_count: limit,
    min_similarity: 0.5,
  });
  if (error) {
    console.warn("[roblox-docs] match rpc failed:", error.message);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    section: r.section,
    source: r.source,
    source_url: r.source_url,
    repo_path: r.repo_path,
    similarity: Number(r.similarity ?? 0),
    snippet: String(r.content ?? "").slice(0, 280),
  }));
}

export function formatDocsForPrompt(cites: DocsCitation[]): string {
  if (!cites.length) return "";
  return [
    "ROBLOX DOCS REFERENCE (official creator-docs — cite by title when used):",
    ...cites.map(
      (c, i) =>
        `[${i + 1}] ${c.title}${c.section ? ` — ${c.section}` : ""} (${c.source_url})\n${c.snippet}`,
    ),
  ].join("\n\n");
}

export function formatDocsForCitation(cites: DocsCitation[]): string {
  if (!cites.length) return "";
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const c of cites) {
    const key = c.title + (c.section ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- [${c.title}${c.section ? ` — ${c.section}` : ""}](${c.source_url})`);
    if (lines.length >= 5) break;
  }
  return lines.length ? `\n\n**Roblox Docs Used:**\n${lines.join("\n")}` : "";
}

// ---------------- Sync ----------------

export type SyncProgress = {
  syncId: string;
  processed: number;
  total: number;
  skipped: number;
  done: boolean;
};

/**
 * Incremental sync from Roblox/creator-docs.
 * Processes up to `batchSize` new/changed files per call so the worker
 * doesn't time out. Returns progress; caller can re-invoke until done.
 */
export async function syncRobloxCreatorDocs(
  startedBy: string,
  opts: { batchSize?: number; resumeSyncId?: string } = {},
): Promise<SyncProgress> {
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 20, 40));

  // 1) Get the (or create) running sync row
  let syncId = opts.resumeSyncId ?? null;
  if (!syncId) {
    const { data: row, error } = await (supabaseAdmin as any)
      .from("roblox_docs_sync")
      .insert({ source: "github", status: "running", started_by: startedBy })
      .select("id")
      .single();
    if (error || !row) throw new Error(`sync create failed: ${error?.message ?? "unknown"}`);
    syncId = row.id as string;
  }

  // 2) List relevant files and figure out which need work
  const tree = await listRepoTree();
  const candidates = tree.filter((e) =>
    DEFAULT_INCLUDE_PREFIXES.some((p) => e.path.startsWith(p)),
  );

  // existing SHAs to skip unchanged files
  const { data: existing } = await (supabaseAdmin as any)
    .from("roblox_docs")
    .select("repo_path,sha")
    .eq("source", "github");
  const existingMap = new Map<string, string>();
  for (const r of (existing ?? []) as any[]) {
    if (r.repo_path && r.sha) existingMap.set(r.repo_path, r.sha);
  }
  const todo = candidates.filter((c) => existingMap.get(c.path) !== c.sha);

  // 3) Process this batch
  const batch = todo.slice(0, batchSize);
  let processedNow = 0;
  let fatalError: string | null = null;
  const isFatal = (msg: string) =>
    /embed|LOVABLE_API_KEY|unauthorized|401|403|invalid embedding|rate limit/i.test(msg);
  for (const entry of batch) {
    try {
      const md = await fetchFileRaw(entry.path);
      const { title: fmTitle, body } = stripFrontMatter(md);
      const title = fmTitle || entry.path.split("/").pop()!.replace(/\.md$/, "");
      const chunks = chunkMarkdown(body);
      if (!chunks.length) continue;

      // Embed in sub-batches of up to 16 chunks per API call
      const rowsToInsert: any[] = [];
      for (let i = 0; i < chunks.length; i += 16) {
        const slice = chunks.slice(i, i + 16);
        const vecs = await embedBatch(slice.map((c) => c.content));
        slice.forEach((c, j) => {
          rowsToInsert.push({
            source: "github",
            source_url: docUrlFor(entry.path),
            repo_path: entry.path,
            title,
            section: c.section,
            content: c.content,
            sha: entry.sha,
            model: EMBED_MODEL,
            embedding: vecs[j],
            token_count: Math.ceil(c.content.length / 4),
          });
        });
      }

      // Replace existing rows for this path
      await (supabaseAdmin as any).from("roblox_docs").delete().eq("repo_path", entry.path);
      const { error: insErr } = await (supabaseAdmin as any)
        .from("roblox_docs")
        .insert(rowsToInsert);
      if (insErr) throw new Error(insErr.message);
      processedNow += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[roblox-docs] skip ${entry.path}:`, msg);
      // Embedding / auth / rate-limit failures are systemic — every file will
      // fail the same way, so stop and report instead of silently indexing 0.
      if (isFatal(msg) && !fatalError) {
        fatalError = msg;
        break;
      }
    }
  }

  // If nothing indexed this batch because of a systemic (embedding/auth) error,
  // record it on the sync row so the panel shows WHY instead of a silent 0.
  if (processedNow === 0 && fatalError) {
    await (supabaseAdmin as any)
      .from("roblox_docs_sync")
      .update({
        status: "failed",
        error: fatalError.slice(0, 400),
        finished_at: new Date().toISOString(),
      })
      .eq("id", syncId);
    throw new Error(`Docs sync failed: ${fatalError}`);
  }

  const remaining = todo.length - batch.length;
  const done = remaining <= 0;

  // 4) Update sync row
  const { data: cur } = await (supabaseAdmin as any)
    .from("roblox_docs_sync")
    .select("processed,total,skipped")
    .eq("id", syncId)
    .single();
  const processedTotal = (cur?.processed ?? 0) + processedNow;
  const skippedTotal = (cur?.skipped ?? 0) + (batch.length - processedNow);
  await (supabaseAdmin as any)
    .from("roblox_docs_sync")
    .update({
      processed: processedTotal,
      total: candidates.length,
      skipped: skippedTotal,
      status: done ? "completed" : "running",
      finished_at: done ? new Date().toISOString() : null,
    })
    .eq("id", syncId);

  return {
    syncId: syncId!,
    processed: processedTotal,
    total: candidates.length,
    skipped: skippedTotal,
    done,
  };
}

export async function getLatestSync() {
  const { data } = await (supabaseAdmin as any)
    .from("roblox_docs_sync")
    .select("id,source,status,processed,total,skipped,error,started_at,finished_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { count } = await (supabaseAdmin as any)
    .from("roblox_docs")
    .select("id", { count: "exact", head: true });
  return { latest: data ?? null, indexedChunks: count ?? 0 };
}
