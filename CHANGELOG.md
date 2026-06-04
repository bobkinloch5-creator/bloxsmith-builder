# BloxSmith Changelog

## Latest Updates

### AI Models, Video Pricing & Playtest Credits

- Added the `LAUNCH10` launch promo: a copyable header banner advertises 10% bonus credits through June 10, 2026, checkout previews the extra credits, and approved payment requests grant the bonus.
- Fixed Neokens model tests for providers that return SSE chunks instead of plain JSON, including GPT 5.5 and Claude Opus thinking routes.
- Tightened the Comet Qwen 3.5 397B health-check prompt so the model returns visible text instead of spending the tiny test on hidden reasoning.
- Added a Screenshot to Game tool in the project AI composer: upload a game screenshot and BloxSmith preloads a vision-build prompt to create a Roblox-safe playable starter inspired by the image.
- Expanded AI vision instructions so screenshot-to-game requests analyze the visible genre, map layout, lighting, UI/HUD, props, mechanics, and build real Studio actions instead of only describing the picture.
- Added new BloxSmith AI / Comet model choices: `grok-4.20-0309-reasoning`, `kimi-k2.6`, `glm-5.1`, `gemini-3.1-flash-lite-preview`, `qwen3.5-397b-a17b`, `deepseek-v3.2`, and `gemini-3-pro-preview`.
- Added Comet model mappings, descriptions, credit multipliers, tool labels, and reasoning/profile hints so the new text models show correctly in the picker and route through the provider layer.
- Added a video model dropdown for `sora-2-pro`, `veo3.1`, and `grok-imagine-video`.
- Replaced flat video pricing with per-model video pricing: Sora 2 Pro costs 100 credits, Veo 3.1 costs 120 credits, and Grok Imagine Video costs 90 credits.
- Updated video rate-limit previews and server-side billing so the selected video model's cost is the cost checked, deducted, and recorded.
- Added Playtest verification billing so AI Playtest now deducts credits for scan, apply, and verify steps.
- Updated the Playtest panel to show scan/apply/verify prices before users run the workflow.
- Added `docs/CREDIT_PRICING.md` with active AI model credit multipliers, calculated action costs, video model prices, Playtest costs, and legacy model aliases.
- Updated the public Pricing page credit breakdown with current model multipliers, corrected Fix pricing, video model prices, and Playtest step prices.

### AI Video Generator (CometAPI / Seedance)

- Added a dedicated AI Video Generator that turns text prompts into cinematic Roblox trailers and cutscenes via the CometAPI Seedance backend.
- Added Roblox-themed movie-style presets (Tycoon Trailer, Obby Showcase, Horror Teaser, Simulator Promo, RPG Cinematic, Racing Promo, Tower Defense, Anime Battle) that one-click fill the prompt.
- Added an animated 3D rotating-reel preview that plays while the clip renders, plus a live progress bar with a percentage and an ETA countdown.
- Added an in-page video player and a one-click Download button for finished clips.
- Added optional image-to-video: upload a still image to animate instead of pure text-to-video.
- Added length options from 4 to 15 seconds and 720p / 1080p quality.
- Gated video generation to 1 per user per week (clearly labelled in the UI with a countdown to the next unlock) and added per-model pricing, with owners/staff bypassing both limits.
- Surfaced the Video Generator in the Browse dropdown and the mobile navigation.

### Navigation & Header Layout

- Fixed the desktop header where navigation links overlapped the clock, Discord button, and account controls.
- Hid the live header clock except on very wide screens and constrained the nav so it can no longer collide with the right-side controls.
- Trimmed the inline primary links and kept the full set inside the Browse dropdown.

### VFX, Game Safety & Performance

- Expanded BloxSmith AI build rules so Roblox effects are first-class: particles, trails, beams, lights, highlights, smoke/fire, reward bursts, hit sparks, weather, portal glows, auras, muzzle flashes, sound cues, and reusable `ReplicatedStorage/VFX` helpers.
- Hardened Studio sync validation so AI-generated broad deletes and terrain clears are blocked before they can remove useful work from a project.
- Improved site responsiveness by lazy-loading Global Chat bundles, delaying the floating chat on non-chat pages, disabling the ripple layer on heavier workspaces, and reducing initial chat payload sizes.
- Added a lightweight Music Gen card to Browse marked as Coming soon; music generation is announced but not enabled yet.
- Improved clothing 3D previews so users can drag from the full preview surface, including the top overlay area, while keeping toolbar buttons clickable.
- Wired the smart builder core into live AI generation so BloxSmith now adds intent detection, dependency planning, Studio context, tool strategy, and self-check focus to every build request.

### Project Collaboration & Private Team Chat

- Re-added project collaboration controls on the project editor so owners can add BloxSmith teammates by username.
- Limited teams to 5 people total: 1 project owner plus up to 4 collaborators.
- Kept credits separate for every teammate; collaboration grants project access only and does not pool AI/image/3D credits.
- Re-enabled private project Team Chat for project members, backed by project-member RLS so only the owner and collaborators can read/post.
- Added a database trigger to enforce collaborator limits and prevent owners from adding themselves as collaborators.

### Playtest Apply Fixes & Premium UI Variety

- Forced generated Roblox UI to insert visibly by default with `ScreenGui.Enabled = true`, high `DisplayOrder`, visible GuiObjects, and a small visibility guard LocalScript.
- Added z-index defaults during UI spec normalization so generated overlays, panels, labels, and buttons do not accidentally hide behind their own backgrounds.
- Fixed Playtest mode so approved QA findings no longer fail with "Couldn't turn the plan into Studio actions" when the AI action converter returns empty output.
- Added deterministic Playtest repair actions for missing remotes/folders, script-placement moves, unwired UI buttons, and safe diagnostic notes so Roblox Studio receives useful actions even during provider failures.
- Expanded the Roblox UI generator with more UI types including title screens, pause menus, crafting, skill trees, battle passes, map voting, dialogue, and notification UIs.
- Added prompt-specific 2D background layers and layout variation to deterministic UI generation so menu/HUD/shop/dialogue requests do not all reuse the same centered panel.
- Improved UI generation instructions so Roblox menu backgrounds stay inside ScreenGui layers and can vary across space, city, fantasy, lava, icy, cyber, simulator, obby, tycoon, and premium themes.

### BloxSmith AI Gateway, Budget Models & AI Timer

- Added BloxSmith AI as a protected site-wide gateway with budget-first model routing and Neokens kept as a fallback.
- Added cheaper BloxSmith AI model choices, premium Claude Opus/Sonnet options, and model credit multipliers so expensive models cost more credits while budget models cost less.
- Added more Roblox-ready BloxSmith AI models including DeepSeek V4 Flash/Pro, MiniMax-M2.7, Qwen 3.6/3.7, Grok 4.3, Gemini 3.5 Flash, and Gemini 3.1 Pro.
- Made Claude Opus 4.8 a very expensive protected model with a separate daily cap for normal users.
- Disabled the project chat/build composer when the daily AI timer is used up so users cannot type messages that cannot be sent.
- Marked web-search-capable models in the picker so users know which BloxSmith AI models can call web search, fetch URLs, Roblox docs, and toolbox tools.
- Marked deeper Thinking-capable models in the picker so users know which models are better for architecture, debugging, QA, and multi-file Roblox builds.
- Simplified the 3D Studio into a prompt-first flow with Advanced controls collapsed by default, plus an AI playtest-readiness option for Roblox import QA.
- Added an AI Playtest shortcut in the project chat that runs a deep QA-style inspection over the current Roblox project and queues safe fixes when possible.
- Added a visible project AI Memory panel so users can review, add, and forget persistent memories used by future chat, plans, fixes, and builds.
- Added `gpt-5.5-all` as a premium BloxSmith AI option with web, tools, thinking support, a clear Roblox-focused description, and a high credit multiplier.
- Tightened normal-user AI protection to 8 requests per 24 hours by default, 1 premium GPT use per 24 hours, and 1 Claude Opus use per 24 hours, while owner/admin/moderator accounts still bypass limits for testing.
- Tightened image generation safety by blocking unsafe prompts/reference images server-side and limiting normal users to one image variation per request.
- Enabled text-to-image generation directly inside project AI chat, with inline preview cards, one-click PNG downloads, server-side prompt safety, and a strict normal-user image hourly cap.
- Configured BloxSmith AI to accept Comet's `COMETAPI_KEY` env var name, keep `COMET_API_KEY` as an alias, and route Comet-compatible text/image requests through `https://api.cometapi.com/v1`.
- Changed the default BloxSmith AI route away from the unavailable `gpt-5.4-nano` channel and added automatic failover across stable BloxSmith AI, Neokens, and Groq routes when a model channel is down.
- Fixed build-generation fallback requests so BloxSmith AI sends Comet's real dashed model IDs instead of UI display names, preventing 400 errors during fallback retries.
- Fixed Global Chat refresh loading so the newest messages stay visible after reloading instead of falling back to the oldest 200 saved messages.
- Added BloxSmith AI image model choices for the image generator, including Nano Banana 2 and GPT Image 2 options.
- Added a 24-hour AI usage timer and server-side request limit for normal users, with owner/admin/moderator bypass.
- Added Supabase migration support for BloxSmith AI provider settings and the new AI rate-limit event table.
- Added safe environment documentation for `COMETAPI_KEY`, `COMET_API_KEY`, `COMET_BASE_URL`, and daily AI limit settings.
- Updated the project usage indicator to show the 24-hour timer with AM/PM reset time.
- Simplified the 3D Studio animation creator with preset motions, clearer website previews, plain-language usage steps, and smaller three-keyframe Roblox animation blueprints.
- Fixed main-menu generation guidance so requested backgrounds are built as full-screen ScreenGui background layers instead of accidental Workspace parts or selected 3D blocks.

### MCP & Provider Secret Vault Migration

- Removed stale UI and server references to the dropped `user_mcp_servers.auth_header` column.
- Removed provider API key reads/writes from the dropped `user_provider_keys.api_key` column.
- Added server-side MCP add/remove functions so optional MCP authorization headers are stored in the encrypted vault instead of being written from the browser.
- Updated MCP health checks and MCP tool loading to resolve authorization headers from the vault.
- Updated user provider-key save, clear, and AI gateway resolution paths to use vault-backed secrets.
- Added a database migration that backfills old `auth_header` and `api_key` values into vault secrets before dropping the legacy columns.
- Regenerated the local Supabase TypeScript contract for the dropped secret columns.
- Verified the changes with TypeScript and a production build.

### AI Model Status & Availability

- Added green/red availability indicators to the AI model picker so users can immediately see which models are online and which are temporarily down.
- Disabled models that are currently marked down so users cannot select a broken or unavailable AI model by mistake.
- Added clear down-state labels such as Temporarily down, Provider down, Timed out, Rate limited, Auth failed, Model unavailable, and Not configured.
- Added automatic model health polling in the picker so availability refreshes every 30 seconds while users are working.
- Added server-side model health snapshots using recent AI provider events so the UI reflects real model failures and recoveries.
- Added fallback protection for saved project settings so if a saved Neokens model is down, the server tries an available site model instead of sending the request to a known-bad model.
- Updated admin model diagnostics so test results are recorded into provider health events, letting successful checks bring models back online.
- Kept user prompt/context/tool/JSON-specific failures from globally disabling a model, so only provider-style outages or availability problems mark a model down.
- Verified the changed files with TypeScript, targeted ESLint, and a production build.

### 3D Model Generator, Profile Themes & Onboarding

- Renamed and surfaced the 3D tool as a clear **3D Model Generator** website feature for Roblox text-to-3D and image-to-3D assets.
- Added new animated Roblox-style profile backgrounds including futuristic, simulator, tycoon, anime, fantasy, city, neon, dark, and premium themes.
- Added more earnable profile badges for onboarding, asset generation, 3D model creation, UI generation, image generation, clothing, invites, project milestones, and credit milestones.
- Rebuilt onboarding into a saved account tour with feature highlights, tooltips, progress steps, mobile-friendly layout, and a completion reward badge/free-credit grant.
- Added Supabase persistence for onboarding progress, completion, reward claiming, profile themes, and earned badge unlocks.

### Profile Badges & Role Labels

- Added owner/admin/moderator role labels and earned role badges to the account dropdown and public profile popover.
- Made profile badge saving safer by preventing users from self-selecting locked badges like Founder, Staff, Moderator, or Verified unless their account role earns them.
- Updated profile customization previews and the account profile badge list so earned role badges and selected display badges show together.

### Avatar Decoration Images

- Replaced emoji-only avatar decoration artwork with local image assets for crowns, halos, wings, rings, auras, hats, goggles, visors, and seasonal decorations.
- Kept animated premium motion effects while making the visible decoration previews and public profile overlays render from real image files.

### Profile Decoration & Card Effects

- Added premium animated avatar decorations including cosmic crowns, plasma halos, royal wings, orbit effects, star showers, glitch frames, flame/lightning auras, crystal spikes, coin crowns, and builder goggles.
- Added profile card color customization so users can tint their public profile card separately from their accent color.
- Added animated profile card effects including soft glow, aurora edge, premium shine, scanline, starfield, and pixel rain.
- Added new banner effects for comet trails, glowing runes, and spotlight overlays.
- Updated public profile cards so saved card colors and effects show in the Global Chat profile popover.

### Premium Templates, Avatar Preview & Usage Analytics

- Added premium credit-costing Roblox templates for RPG hubs, pet simulator hatcheries, tycoons, battle passes, trading plazas, and moderation suites.
- Upgraded the Browse menu and Template Store so premium templates are easier to find and show credit cost clearly.
- Added earned profile badge progress based on activity, projects, credits, Discord perks, and owner/staff status.
- Improved the Roblox clothing 3D preview so hoodies, layered clothing, accessories, and pants render as separate wearable shapes instead of flat shirt decals.
- Added explicit AI usage event logging for generators and template installs, including owner/free runs that do not spend credits.
- Improved the account usage dashboard so the graph always renders and fills from either usage events or credit transactions.
- Made UI Generator template tiles more premium with Pro labels, credit cost badges, and clearer descriptions.

### Signup Email & 3D Generator Safety

- Added a Resend confirmation email action on signup for users who did not receive their email.
- Added Image to 3D mode to the 3D generator with PNG/JPG/WEBP uploads and image preview.
- Added server-side NSFW safety checks for 3D text prompts and image uploads before Tripo generation starts.
- Added rigged / animation-ready Tripo export controls with FBX-friendly settings and in-place animation export support.

### UI Generator Reliability & Polish

- Fixed the UI Generator getting stuck and ending with "No output generated."
- Added a complete deterministic ScreenGui fallback so slow or empty AI responses still return usable Roblox UI.
- Shortened the visible generation wait so the page feels faster.
- Polished the `/ui-generator` page with a cleaner builder header, compact stats, better template tiles, stronger style controls, and an upgraded preview frame.
- Added a visible Save to Library action so generated previews can be saved even if automatic saving did not return a generation id.
- Made generated UI templates fancier with layered panels, gradients, header glow, badges, thicker strokes, stronger buttons, and clearer Roblox-style hierarchy.
- Upgraded Spin Wheel output into a more circular premium wheel with glow, reward badges, pointer marker, prize panel, spin button, RemoteEvent, LocalScript, and ServerScript.

### Global Chat Rules

- Added a Global Chat rules panel that explains respect, spam, scams, unsafe links, privacy, clean content, and staff direction rules.
- Updated `/rules` to open the rules panel and explain what happens after rule breaks.
- Clarified moderation consequences including blocked/removed messages, warnings, timeouts/mutes, and account restrictions for serious abuse.

### AI Building Replicas

- Improved image-based 1-to-1 building replica prompts so they use stronger vision routing and a longer client wait window.
- Added a complete Roblox-scale building replica fallback with floors, facade, roof, windows, trim, balcony, lights, spawn, and ground instead of an empty folder.
- Broadened build intent and asset-tool detection so visual build requests get richer actions more consistently.

### Admin Security

- Locked admin role promotion/demotion to owner accounts only.
- Updated database role policies, the `admin_set_role` RPC, the admin page, and the Global Chat `/role` command so regular admins cannot make other users admin.
- Added an owner-managed Moderator role for Global Chat moderation without admin/dashboard credit permissions.
- Locked manual credit adjustments to owners, protected profile credit fields from direct client edits, and tightened refund RPC checks so users cannot call refunds to mint credits.

### Profile Fixes

- Fixed profile settings not saving correctly.
- Added a stronger fallback save system for display name, bio, and studio specialty.
- Profile details now save into the profile table and auth metadata when needed.
- Profile data refreshes after saving so users see the newest info right away.

### Credit Deduction

- Tightened credit deduction for AI image generation.
- Tightened credit deduction for Roblox clothing generation.
- Added fallback credit charging if the Supabase credit RPC is missing or not working.
- Added credit transaction logging for successful paid generations.
- Owners/admins can still generate without being charged.

### Profile Customization

- Added real profile picture/avatar uploads inside the user profile page.
- Added profile banner uploads so users can customize their account with a wide cover image.
- Added Roblox-style generated avatars for users who do not upload a profile picture.
- Profile pictures now display as the user icon in the website header/account menu.

### AI Model Guide

- Added a Roblox AI model guide on AI/model areas of the website.
- The guide explains what each model is best used for when building Roblox games.

### Profile Security

- Added two-factor authentication setup directly inside the user profile/account area.
- Added Change Password inside profile settings.
- Login now supports accounts that require 2FA verification.

### AI Models

- Removed Gemini Pro from the selectable model list.
- Kept Gemini Flash as the fast fallback model.

### Chat Helper

- Repositioned the AI Help chat assistant properly across the site.

### Themes

- Added the official BloxSmith branded neon theme/background into the theme system.
