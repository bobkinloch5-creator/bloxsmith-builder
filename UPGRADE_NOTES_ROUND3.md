# BloxSmith — Empty Folders / Toolbox Not Landing (Round 3)

You asked for "New York City with toolbox assets" and got a tree of **empty
folders** (Map/Buildings, Roads, Trees, Props, Zones, NPCs…) with nothing inside.
This round fixes the actual root cause — there were two bugs stacked on top of
each other.

## Why it happened

1. **The AI's asset search was returning nothing.** `searchRobloxAssets` (the
   function the AI uses to find Toolbox models) relied on a single endpoint —
   `apis.roblox.com/toolbox-service/v1/marketplace/...` — and if that returned
   nothing or errored, it returned an empty list. With no assets found, the
   build plan had zero `insert_toolbox_asset` actions, so nothing got inserted.
   (Your website's **browse** page worked because it uses a *different*, proven
   endpoint: `search.roblox.com/catalog/json`.)

2. **The plugin pre-created the whole folder skeleton anyway.** After any
   world-build action, the plugin called a helper that unconditionally created
   `Workspace/Map/{Buildings,Roads,Trees,Props,Zones}`, `NPCs`, `Interactables`,
   and `GeneratedAssets` — empty. On top of that, a *failed* insert still
   creates its parent folder (the folder is made before the asset load is
   attempted). Result: the exact empty tree in your screenshot.

## What's fixed

**A. The AI search now actually finds assets** (`src/lib/ai-tools.server.ts`).
`searchRobloxAssets` now falls back to the same `search.roblox.com/catalog/json`
endpoint your browse page uses whenever the primary endpoint returns nothing or
fails. This is the proven source of real free Models/Decals/Audio/Meshes the
plugin can load via `game:GetObjects`. So the plan gets real assetIds → real
insert actions → assets land in the folders.

**B. The plugin no longer leaves empty folders**
(`public/BloxSmith.lua` + `plugin-src/BloxSmith.server.lua`):
- Removed the speculative skeleton creation. Folders are now made on demand only
  when something is actually placed in them.
- Added `pruneEmptyBloxFolders()` that runs at the end of every build and removes
  any BloxSmith organizational folder (Map, Buildings, Roads, Trees, Props,
  Zones, NPCs, Vehicles, Interactables, GeneratedAssets, …) left with no
  children — including parents like `Map` that become empty after their
  subfolders are pruned. So even if a few inserts fail, you never see blank
  folders.

**C. Prompt reinforcement** (`src/lib/ai-smartest-builder-core.ts`).
Added a zero-asset fallback rule: if a Toolbox group comes back with 0 assets,
the AI must build that content from real Parts/Models or drop the group — never
emit a folder-only result.

Combined with the Round-1 Placement Engine, a successful build now: finds real
free assets → inserts them → grounds/scales/grid-lays them → prunes anything
empty. And with Round-2, the chat tells you exactly what landed.

## Files changed this round

| File | Change |
|---|---|
| `src/lib/ai-tools.server.ts` | Legacy `search.roblox.com` fallback for asset search |
| `public/BloxSmith.lua` | No empty skeleton + `pruneEmptyBloxFolders()` |
| `plugin-src/BloxSmith.server.lua` | Identical mirror |
| `src/lib/ai-smartest-builder-core.ts` | Zero-asset fallback rule |

> The diffs in `diffs/` are **cumulative** (they include Rounds 1–3 vs the
> original upload), and the files in `changed-files/` are the full current
> versions — they supersede the earlier rounds' copies.

## How to apply
Replace these files (or `git apply` the cumulative diffs), redeploy the plugin
the way you publish `BloxSmith.lua`, then `npm run typecheck` and deploy the web
app.

## How to test
1. Ask: **"make new york city with toolbox assets."**
2. You should now see real models inside Buildings / Roads / Props / etc., laid
   out on the ground — and **no** empty folders.
3. If a category genuinely has no free matches, that folder simply won't appear
   (instead of showing empty).
4. The chat recap (Round 2) will tell you how many assets actually landed.

## Verification done here
- Plugin parses past every edit (`texluac` reaches only the pre-existing Lua-5.x
  200-local cap, same as the untouched original — not a real-Studio issue).
- `ai-tools.server.ts` and `ai-smartest-builder-core.ts` typecheck clean; the
  edited UI files parse clean under esbuild.

## If it STILL shows empty after deploying
That would mean the Roblox search endpoints are blocked/region-gated from your
server, or the plugin isn't syncing the inserts. The Round-2 recap will now say
"0 assets" or list failures instead of staying silent — send me that and I'll
trace the insert round-trip (the `game:GetObjects` load path in the plugin) next.
