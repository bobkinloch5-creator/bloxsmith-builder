# BloxSmith "Lemonade-grade" Polish Pass

A focused major overhaul across four tracks. I'll ship it in sequenced batches so the preview stays working between each one.

## 1. UI/UX polish — Roblox Studio vibe

Goal: feels like a playful pro tool, not a generic SaaS.

- New design tokens in `src/styles.css`: punchier primary (Roblox-red-ish OKLCH), high-contrast surfaces, neon accent for AI states, deeper shadow + glow tokens, bigger radii on cards (`--radius: 1rem`), block-builder grid background utility.
- Bold display font for headings (Sora already loaded — bump weight + tracking), playful badges + chips.
- Landing page (`src/routes/index.tsx`): new hero with animated grid + floating "blocks", clearer 3-step "Describe → Build → Sync" section, template showcase carousel, social proof + CTA. SEO meta refreshed.
- Dashboard + project workspace: tighter header, color-coded status pills (Building / Synced / Error), nicer empty states, sticky bottom prompt bar polish.
- Buttons: add a `studio` variant (gradient + soft shadow + tap squish).

## 2. AI build quality

Goal: every prompt ships a real, playable vertical slice.

- Tighten system prompt in `src/lib/ai-smartest-builder-core.ts`:
  - Stronger "no empty folders / no placeholders / no procedural unless asked" enforcement with explicit refusal templates.
  - Required output contract per genre (spawn, core loop, UI, persistence, at least one map area).
  - Self-check pass: model must list what it shipped and verify each item is non-placeholder before responding "done".
- Server-side validator in `src/lib/sync-validation.ts` (already exists): extend to flag empty Folders, scripts under N chars, scripts with only comments, duplicate-named junk parts. Block sync + show fix-up panel.
- Show the validation summary in `SyncValidationDrawer` with one-click "Ask AI to fix" that re-prompts with the failure list.

## 3. Performance & speed

- Audit `src/routes/__root.tsx` and split: lazy-load `RobloxModelExplainer`, `PresenceHeartbeat`, `MfaSessionGuard`, `ClickRipple` behind idle callback (GlobalChat already lazy).
- Preload LCP hero image via per-route `head().links` on `index.tsx`.
- Convert any oversized PNG hero/showcase assets to WebP imports.
- Add `defaultPreloadStaleTime` tune + ensure project workspace route uses `ensureQueryData` (not effect-based fetch) — quick audit + fix on the top 3 routes.
- Replace any remaining `h-screen` with `h-dvh` for mobile.

## 4. Reliability & bugs

- Fix the noisy console: `Unknown message type: RESET_BLANK_CHECK` warning — add a no-op handler in the postMessage listener.
- Add error boundaries on `project.$projectId.tsx`, `generate-3d.tsx`, `ui-generator.tsx` with a retry that calls `router.invalidate()` + `reset()`.
- Toast standardisation: every server-fn catch surfaces a `toast.error` with the actual message, not a generic one.
- Roblox publish: friendlier 401/403/404 hints already exist — extend to surface in the Publish dialog instead of throwing raw.
- Credits: confirm `spend_credits_atomic` fallback path doesn't double-charge (read-through of `generator-credits.server.ts`).

## Technical details

- All color changes go through `src/styles.css` tokens — no hardcoded colors in components.
- New `studio` button variant added to `src/components/ui/button.tsx` via `cva`.
- Lazy-loading uses `React.lazy` + `requestIdleCallback` fallback already in `__root.tsx`.
- No DB migrations needed.
- No new dependencies expected (Sora + Manrope already loaded, OKLCH supported).

## Sequencing (so preview never breaks)

1. Design tokens + button variant + landing hero (visible win, isolated).
2. Dashboard + workspace polish + lazy-load root chrome.
3. AI prompt hardening + sync validator extension.
4. Reliability sweep (error boundaries, toast, console warning, publish hints).

I'll report after each batch so you can steer.