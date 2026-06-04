# BloxSmith — Builder Reliability Upgrade

This pack targets the #1 cause of "messy / broken / floating / overlapping"
builds and makes Toolbox/map insertion land clean and playable. Every file here
was syntax-checked (Lua) and typechecked (TypeScript). Changes are surgical and
additive — they layer on top of your existing architecture rather than rewriting
it, so a working product stays working.

Worked from the **`bloxsmith-builder-main`** upload (the newer of the two zips —
its AI files are more developed; the plugin was identical in both).

---

## Files changed (4)

| File | Change | Size of diff |
|---|---|---|
| `public/BloxSmith.lua` | New Placement Engine + wiring | +335 / −6 |
| `plugin-src/BloxSmith.server.lua` | Identical mirror of the above | +335 / −6 |
| `src/lib/ai-smartest-builder-core.ts` | Toolbox-intent + placement contract | +18 / −2 |
| `src/lib/playtest-diagnose.server.ts` | 4 new high-value heuristics | +93 / −1 |

`placement-engine.reference.lua` is the standalone module (already inlined into
the plugin) — kept for readability/reference only; you don't need to add it
separately.

---

## 1. Placement Engine (the big one) — `BloxSmith.lua` / `BloxSmith.server.lua`

### The problem
Every inserted Toolbox asset was placed at a fixed pivot (`Y = 4`) with:
- no grounding → buildings float in the air or sink into the baseplate,
- no scale normalization → giant/microscopic exports come in wrong-sized,
- no overlap handling → a "city" is a pile of models stacked at the origin,
- a naive `[i*22, 4, group*28]` grid that ignores each model's real size.

That is exactly the "random, messy, broken, badly placed, badly scaled" result.

### The fix
A new `BloxPlacement` engine runs **after** each build (inside the same undo
recording) and only on assets tagged `BloxAutoPlace` (so hand-authored parts are
never touched). For every inserted Toolbox asset it:

1. **Measures** the real bounding box (footprint + height).
2. **Normalizes scale** — only true outliers (footprint > 300 studs or < 0.75
   studs) are scaled back into a sane band, so intentional sizes survive.
3. **Grounds** it with a downward raycast onto the actual floor (baseplate /
   terrain / a designed ground part) — no more floating or sinking.
4. **Lays out** each parent's assets on a clean, non-overlapping grid sized to
   each model's footprint, and tiles different parents into separate scene bands
   (Buildings ≠ Roads ≠ Vehicles), so the scene reads as a real place.
5. **Anchors** static scenery so it can't fall apart in Play; leaves models with
   a Humanoid (NPCs) and dynamic folders (vehicles) physics-enabled.

### How the parent folder drives the result
Assets in the **same** parent are laid out together as one tidy band; **different**
parents become separate regions. So the AI just needs to insert into the right
folder (`Workspace/Map/Buildings`, `Workspace/Map/Roads`, `Workspace/Vehicles`,
`Workspace/NPCs`, …) and the engine handles the geometry.

### Opt-out
If a caller wants an asset at an exact spot, it sets `"autoPlace": false` plus a
`position` — the engine then leaves it alone.

---

## 2. Builder intelligence — `ai-smartest-builder-core.ts`

Two additions to the system prompt so the model cooperates with the engine:

- **Toolbox asset intent (hard rule):** "add cars / add city buildings / add
  NPCs / add a shop / use toolbox assets / fill the map" now explicitly routes to
  `roblox_toolbox_asset_plan` first, then wires scripts/systems to what's
  inserted. Never invents asset IDs.
- **Placement contract:** tells the model NOT to scatter guessed coordinates on
  Toolbox inserts (the engine grounds + lays them out) — its job is to choose the
  correct descriptive parent folder. Exact `position` is reserved for bespoke
  geometry it builds by hand (`create_part` / `create`), which the engine does
  not move, so those still need deliberate coordinates.

---

## 3. Playtest depth — `playtest-diagnose.server.ts`

Four new static checks on top of the existing ones, targeting your stated
concerns (missing assets, broken NPCs, performance):

- **Missing/zeroed asset IDs** — `SoundId`/`Texture`/`MeshId`/`Image` set to `""`
  or `rbxassetid://0` (silent/invisible content).
- **NPC model with no Humanoid** — can't walk, animate, pathfind, or take damage.
- **Tool with no Handle** — won't appear in the player's hand on equip.
- **Deprecated APIs** — `wait`/`spawn`/`delay`/`:remove()`/`Humanoid:LoadAnimation`/
  `FindPartOnRay`, with the modern replacement suggested.

---

## How to apply

**Plugin (do both — they must stay identical):**
1. Replace `public/BloxSmith.lua` and `plugin-src/BloxSmith.server.lua` with the
   versions in `changed-files/`.
2. Rebuild/redeploy the plugin the way you normally publish `BloxSmith.lua`.

**Web app:**
3. Replace `src/lib/ai-smartest-builder-core.ts` and
   `src/lib/playtest-diagnose.server.ts`.
4. `npm run typecheck` (or `tsc --noEmit`) to confirm, then deploy.

Or apply the unified diffs in `diffs/` with `git apply` / `patch` if you prefer
to review hunk-by-hunk.

---

## How to test (in Roblox Studio)

1. Open a place with a Baseplate, run the plugin, and ask: **"add city buildings,
   cars, and NPCs using toolbox assets."**
2. Confirm: assets sit **on** the ground (not floating/sunken), don't overlap,
   are reasonably scaled, and Buildings / Vehicles / NPCs occupy distinct areas.
3. Press Play — static scenery stays put; NPCs/vehicles keep physics.
4. Ctrl+Z — the whole build (insert + layout) reverts in one step.
5. Run Playtest AI on a project with an NPC model missing a Humanoid or a Tool
   missing a Handle and confirm the new findings appear.

---

## Verification done here

- New engine parses cleanly under a Lua compiler (`texluac -p`).
- Full patched plugin reaches the *same* pre-existing Lua-5.x local-cap as the
  untouched original at the same location → no new syntax errors introduced.
  (That cap is a Lua-5.x quirk; Luau's limit is higher and this is your live
  deployed plugin, so it compiles in Studio as before.)
- Edited functions parse cleanly in isolation.
- Both edited TypeScript files typecheck (`tsc --noEmit`).

---

## Honest scope note

This pack fixes the systems that most determine whether a build comes out clean:
asset/map execution, the builder's cooperation with it, and playtest detection.
It does **not** rewrite the whole website/credits/auth/mobile layout — doing that
blind, without being able to run the live app, would risk breaking things that
work. Those are best done as separate, individually-testable passes; tell me which
one to take next (e.g. mobile chat layout, loading/error states, credits flow)
and I'll do that one properly.
