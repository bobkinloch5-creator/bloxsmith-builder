# BloxSmith — Make the AI "Know Everything About Roblox" (Round 4)

The "Roblox Docs Knowledge" panel shows **never run / 0 chunks**, which means the
AI's `roblox_docs_search` tool has nothing to search. The tool and the search UI
already exist and are wired into the AI — the index just was never built. Here's
why, and the three things needed to make it work.

## What the system does
It clones the **official `Roblox/creator-docs`** markdown, splits it into chunks,
embeds them (OpenAI `text-embedding-3-small`, 1536-dim) into a pgvector table, and
the AI semantically searches them during builds. So "knowing everything about
Roblox" = getting this index populated.

## Why it was stuck at 0 — three causes, all addressed

### 1. The database schema likely isn't applied in production (your recurring drift issue)
The index needs the `roblox_docs` + `roblox_docs_sync` tables, the pgvector
extension, an HNSW index, RLS, and the `match_roblox_docs` RPC. If those aren't in
prod, the very first sync step (creating the run row) fails and the panel stays at
"never run."

**Fix:** run **`sql/roblox_docs_knowledge.sql`** in Supabase → SQL Editor. It's
fully idempotent (safe to run repeatedly) and creates everything in one shot.

### 2. The GitHub repo-tree call was rate-limited (verified here)
`searchRobloxDocs`'s indexer lists the repo via `api.github.com`, which allows only
**60 requests/hour unauthenticated** — I hit a live `403 "API rate limit exceeded"`
testing it. On a serverless host that 403 kills the whole sync. (Raw file fetches
on `raw.githubusercontent.com` are NOT limited and work fine.)

**Fix (`roblox-docs.server.ts`):** the tree call now sends an optional
`GITHUB_TOKEN` (raises the limit to 5,000/hour) and, on a rate-limit 403, throws a
clear actionable message instead of a generic failure.
**Action:** add a `GITHUB_TOKEN` env var (a fine-grained PAT with public-repo read
is enough) on your host. Optional but strongly recommended — without it the sync
can intermittently 403.

### 3. Embedding failures were silently swallowed
If `LOVABLE_API_KEY` is unset/invalid, every file's embedding call failed, each was
caught and skipped, and the sync reported "complete" with **0 chunks** — no
explanation.

**Fix (`roblox-docs.server.ts`):** systemic errors (embedding/auth/rate-limit) now
stop the run and are written to `roblox_docs_sync.error`, so the panel shows the
real reason (e.g. "LOVABLE_API_KEY not set") instead of a silent zero.

## Also improved
- **Broader coverage** so the AI knows more of the engine: added animation,
  physics, characters, environment, audio/sound, art, tutorials, cloud, and
  publishing doc trees to the indexed set (on top of scripting, full engine
  reference, Luau, DataStore/cloud, UI, input, players, monetization).

## Files changed / added
| File | Change |
|---|---|
| `sql/roblox_docs_knowledge.sql` | **NEW** — idempotent schema to paste into Supabase SQL Editor |
| `src/lib/roblox-docs.server.ts` | GitHub token auth + clear rate-limit error, fatal-error surfacing, broader coverage |

## How to turn it on (in order)
1. **Run the SQL** (`sql/roblox_docs_knowledge.sql`) in Supabase → SQL Editor.
2. **Set env vars** on your host:
   - `LOVABLE_API_KEY` — required for embeddings (the panel already expects it).
   - `GITHUB_TOKEN` — recommended, avoids the 60/hr GitHub limit.
3. Deploy the updated `roblox-docs.server.ts`.
4. Open the admin panel → **Sync Docs Now**. It indexes in batches (the panel
   already loops to completion). Expect a few thousand chunks across the doc trees.
5. Test in the panel's **Test search** box (e.g. "RemoteEvent best practices") —
   you should get ranked doc hits. After that, the AI's `roblox_docs_search` tool
   returns real citations during builds.

## If the panel shows an error after this
It will now tell you which one:
- "GitHub API rate limit hit … set a GITHUB_TOKEN" → add the token.
- "LOVABLE_API_KEY not set" / "embed 401/403" → fix the embeddings key.
- "sync create failed: relation roblox_docs_sync does not exist" → the SQL didn't
  run; re-run `roblox_docs_knowledge.sql`.

## Verification done here
- `raw.githubusercontent.com` fetch of a real creator-docs file returned 200 (the
  per-file path works).
- `api.github.com` returned a live 403 rate-limit (confirming cause #2).
- `roblox-docs.server.ts` typechecks clean.
- The AI already registers and can call `roblox_docs_search`, so once the index is
  populated it's used automatically.
