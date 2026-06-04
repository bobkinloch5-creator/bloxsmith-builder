import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import {
  Award,
  Box,
  Bot,
  CheckCircle,
  Clock,
  CreditCard,
  Film,
  FileCode,
  Flag,
  Gift,
  Globe2,
  Image as ImageIcon,
  Languages,
  Library,
  LayoutDashboard,
  Link2Off,
  Mail,
  Menu,
  MessageSquare,
  Music,
  Palette,
  Play,
  Rocket,
  ScrollText,
  Server,
  ShieldCheck,
  Shirt,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

const tagStyles = {
  ai: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  tools: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  backend: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  security: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  plugin: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ui: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  integrations: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export const changelogItems = [
  {
    version: "v3.9.1",
    date: "June 2, 2026",
    title: "New AI Models, Video Pricing & Screenshot Builds",
    description:
      "BloxSmith now has more Comet model choices, clearer credit pricing, charged Playtest verification, and a new Screenshot to Game workflow for turning reference images into playable Roblox starters.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "More Comet Models",
        detail:
          "Added grok-4.20-0309-reasoning, kimi-k2.6, glm-5.1, gemini-3.1-flash-lite-preview, qwen3.5-397b-a17b, deepseek-v3.2, and gemini-3-pro-preview with configured labels, routing, and credit multipliers.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: ImageIcon,
        title: "Screenshot to Game",
        detail:
          "Project chat now has a Screenshot to Game tool: upload a game reference image and BloxSmith preloads a vision-build prompt to create a Roblox-safe playable starter with map geometry, lighting, UI, scripts, and a Play-mode checklist.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Updated Credit Pricing",
        detail:
          "Video generation now uses per-model pricing: Grok Imagine Video costs 90 credits, Sora 2 Pro costs 100 credits, and Veo 3.1 costs 120 credits. AI Playtest now charges for scan, apply, and verify steps.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Clock,
        title: "Header Clock Fix",
        detail:
          "Fixed the duplicate responsive header clock issue so only the correct clock is visible for the current screen size.",
      },
    ],
  },
  {
    version: "v3.9.0",
    date: "June 1, 2026",
    title: "AI Roblox Video Generator",
    description:
      "Turn text prompts into cinematic Roblox trailers and cutscenes with the new AI Video Generator — movie-style presets, a 3D rendering preview, live progress, and one-click downloads.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Film,
        title: "AI Video Generator",
        detail:
          "Generate cinematic Roblox game trailers and cutscenes from a text prompt using the CometAPI Sora backend, with 720p/1080p quality and clips from 4 to 15 seconds.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Roblox Movie Presets",
        detail:
          "One-click presets for Tycoon Trailer, Obby Showcase, Horror Teaser, Simulator Promo, RPG Cinematic, Racing Promo, Tower Defense, and Anime Battle styles fill the prompt with a strong starting point.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Play,
        title: "3D Preview, Progress & Download",
        detail:
          "An animated 3D rotating-reel preview plays while the clip renders, with a live progress bar, percentage, and ETA. Finished videos play in-page and download with one click. Optional image-to-video lets you animate a still image.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: Clock,
        title: "Once-A-Week, Premium Pricing",
        detail:
          "Video generation is limited to 1 per user per week (clearly labelled with a countdown to the next unlock) and now uses per-model pricing. Owners and staff bypass both limits.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Menu,
        title: "Header Layout Fix",
        detail:
          "Fixed the desktop header where nav links overlapped the clock, Discord button, and account controls. The live clock now only shows on very wide screens and the nav can no longer collide with the right-side controls.",
      },
    ],
  },
  {
    version: "v3.8.8",
    date: "May 31, 2026",
    title: "BloxSmith AI Gateway, Chat Images & Usage Protection",
    description:
      "BloxSmith AI now has a safer Comet-compatible gateway setup, tighter usage timers, AI memory, playtest QA, and text-to-image generation directly inside project chat.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Sparkles,
        title: "Roblox VFX Support Expanded",
        detail:
          "BloxSmith AI now treats particle effects, trails, beams, highlights, lights, smoke/fire, reward bursts, hit sparks, weather, auras, muzzle flashes, and reusable ReplicatedStorage/VFX helpers as first-class Roblox build pieces.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Safer Game Preservation",
        detail:
          "Studio sync validation now blocks broad AI-generated deletes and terrain clears before they can remove useful project work, forcing additive changes and clearly named new folders instead.",
      },
      {
        category: "Performance",
        tagColor: tagStyles.backend,
        icon: Zap,
        title: "Lighter Chat Loading",
        detail:
          "The site now lazy-loads Global Chat, delays the floating chat on non-chat pages, skips the ripple layer on heavy workspaces, and trims initial chat payloads for better responsiveness.",
      },
      {
        category: "Audio",
        tagColor: tagStyles.tools,
        icon: Music,
        title: "Music Gen Coming Soon",
        detail:
          "Browse now includes a lightweight Music Gen preview marked Coming soon. Roblox-ready music generation is planned but remains disabled for now.",
      },
      {
        category: "Clothing",
        tagColor: tagStyles.ui,
        icon: Shirt,
        title: "Full-Surface Clothing Preview Drag",
        detail:
          "The 3D clothing preview can now be dragged from the whole preview panel, including the top overlay area, while keeping preview controls and buttons responsive.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Smarter Build Reasoning",
        detail:
          "BloxSmith now injects a smart build router into generation requests, giving the AI clearer intent detection, dependency order, Studio context, tool strategy, validation focus, and better full-quality routing for complex Roblox builds.",
      },
      {
        category: "Projects",
        tagColor: tagStyles.tools,
        icon: Users,
        title: "Project Collaboration Returns",
        detail:
          "Project owners can add collaborators by BloxSmith username again, with teams capped at 5 people total and credits kept separate for each teammate.",
      },
      {
        category: "Chat",
        tagColor: tagStyles.ui,
        icon: MessageSquare,
        title: "Private Project Team Chat",
        detail:
          "Project members now have a private Team Chat inside the project editor, protected by project-member access rules so only the owner and collaborators can read or post.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "BloxSmith AI Model Gateway",
        detail:
          "Added BloxSmith AI as a protected site-wide provider with budget-first models, `gpt-5.5-all`, DeepSeek, Grok, Gemini, Qwen, MiniMax, Claude options, model descriptions, credit multipliers, web-search badges, and Thinking labels.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Strict Normal-User AI Limits",
        detail:
          "Normal users are limited to 8 AI requests per 24 hours, 1 premium GPT use per 24 hours, 1 Claude Opus use per 24 hours, and 2 chat image generations per hour by default. Owners, admins, and moderators bypass limits for testing.",
      },
      {
        category: "Images",
        tagColor: tagStyles.tools,
        icon: ImageIcon,
        title: "Text-To-Image In AI Chat",
        detail:
          "Project chat can now generate images from prompts, render them inline as polished preview cards, and provide one-click PNG downloads with server-side prompt safety checks.",
      },
      {
        category: "Memory",
        tagColor: tagStyles.backend,
        icon: Server,
        title: "AI Memory & Playtest QA",
        detail:
          "Added a visible project AI Memory panel plus an AI Playtest shortcut that performs deeper Roblox QA and queues safe fixes when possible.",
      },
      {
        category: "Playtest",
        tagColor: tagStyles.tools,
        icon: Play,
        title: "Playtest Apply Fixes Repair",
        detail:
          "Playtest mode now has deterministic repair actions for missing remotes, missing folders, script-placement moves, unwired UI buttons, and diagnostic notes, so approved findings still apply when the AI action converter returns empty output.",
      },
      {
        category: "Animation",
        tagColor: tagStyles.ui,
        icon: Film,
        title: "Simpler Roblox Animation Creator",
        detail:
          "Animation mode now starts with simple presets, plain usage steps, a clearer live demo-rig preview, and smaller three-keyframe blueprints that are easier to recreate in Roblox Animation Editor.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: LayoutDashboard,
        title: "Always-Visible Generated UI",
        detail:
          "Generated ScreenGuis now insert enabled with a high DisplayOrder, visible GuiObjects, z-index defaults, and a small visibility guard LocalScript so menus, HUDs, and panels are much harder to accidentally hide.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "More Roblox UI Types & Background Variety",
        detail:
          "Main-menu generation now treats backgrounds as full-screen ScreenGui layers, and the UI generator supports more categories like title screens, pause menus, crafting, skill trees, battle passes, map voting, dialogue, and notifications with prompt-specific 2D background layers.",
      },
      {
        category: "Config",
        tagColor: tagStyles.integrations,
        icon: Globe2,
        title: "CometAPI Environment Support",
        detail:
          "The server now accepts Comet's `COMETAPI_KEY` name, keeps `COMET_API_KEY` as a backwards-compatible alias, and routes Comet-compatible text and image requests through `https://api.cometapi.com/v1`.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Zap,
        title: "Model Route Failover",
        detail:
          "BloxSmith AI no longer defaults to the unavailable `gpt-5.4-nano` channel. Chat, prompt improve, and build retries now fail over through stable BloxSmith AI routes using Comet's real model IDs, then Neokens or Groq when configured.",
      },
      {
        category: "Chat",
        tagColor: tagStyles.ui,
        icon: MessageSquare,
        title: "Global Chat Refresh Fix",
        detail:
          "Global Chat now reloads the newest saved messages first, so recent messages remain visible after refreshing instead of looking like they were deleted.",
      },
    ],
  },
  {
    version: "v3.8.7",
    date: "May 31, 2026",
    title: "Weekly 3D Studio Limits & Safer Visual Controls",
    description:
      "The 3D Studio now clearly enforces one weekly generation choice for normal users while giving staff unlimited testing access.",
    updates: [
      {
        category: "3D",
        tagColor: tagStyles.tools,
        icon: Clock,
        title: "One Weekly 3D Studio Generation",
        detail:
          "Normal users can use one successful generation every 7 days across text-to-3D, image-to-3D, 3D text, or animations. Owners, admins, and moderators can generate without that weekly lock.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Box,
        title: "Unique Roblox Visual Options",
        detail:
          "Every model style, animation type, easing, motion style, body focus, material, quality, format, texture, and 3D text control now uses a purpose-built Roblox-style image tile that matches the option instead of repeated scenery.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Stronger Generator Safety Checks",
        detail:
          "3D Studio prompt moderation now catches more unsafe terms and bypass spellings before any model, image-to-3D, text, or animation generation can run.",
      },
    ],
  },
  {
    version: "v3.8.6",
    date: "May 31, 2026",
    title: "Roblox Animation Previews & Discount Codes",
    description:
      "The 3D studio now uses real visual choices and a Roblox-style animation preview, and checkout supports owner-created limited-time discount codes.",
    updates: [
      {
        category: "3D",
        tagColor: tagStyles.tools,
        icon: Box,
        title: "Real Visual Generator Choices",
        detail:
          "Model type and theme controls now show real Roblox-style preview images instead of text-only pills, making the generator easier to scan.",
      },
      {
        category: "Animation",
        tagColor: tagStyles.ui,
        icon: Play,
        title: "Roblox Demo Rig Preview",
        detail:
          "Animation mode now previews every animation type on a blocky Roblox-style demo character with live loop, speed, and intensity changes.",
      },
      {
        category: "Payments",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Purchase Discount Codes",
        detail:
          "Owners can create limited-use, expiring checkout discount codes from the admin panel, and buyers can apply them on credit pack or custom checkout pages.",
      },
    ],
  },
  {
    version: "v3.8.5",
    date: "May 31, 2026",
    title: "3D Studio Animation Creator",
    description:
      "The 3D generator now feels more like a Roblox creation studio, with custom animation prompts, clearer progress, and better controls for model, text, and animation assets.",
    updates: [
      {
        category: "3D",
        tagColor: tagStyles.tools,
        icon: Box,
        title: "Custom Animation Prompts",
        detail:
          "Animation mode now lets creators write their own motion prompt and tune type, target, style, body focus, easing, loop, duration, and intensity before exporting a Roblox blueprint.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "Better Generator Studio UI",
        detail:
          "Model, text, and animation generation now share a cleaner studio layout with mode cards, mobile-friendly controls, richer previews, and clearer output panels.",
      },
      {
        category: "Progress",
        tagColor: tagStyles.backend,
        icon: Clock,
        title: "Progress Bar and ETA",
        detail:
          "Generation now shows estimated time, elapsed time, remaining ETA, and step-by-step progress so users know what is happening while assets are being built.",
      },
      {
        category: "Roblox",
        tagColor: tagStyles.tools,
        icon: Palette,
        title: "Animation-Ready Exports",
        detail:
          "Rigged model generation now exposes animation-ready export settings, while animation packages include keyframe metadata and a controller snippet for Roblox Studio.",
      },
    ],
  },
  {
    version: "v3.8.4",
    date: "May 31, 2026",
    title: "AI Timeout Recovery & Model Cleanup",
    description:
      "AI builds now handle provider timeouts more kindly and avoid legacy model ids that can fail upstream.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Removed Legacy GPT-5.5 Default",
        detail:
          "The model picker now defaults to Gemini Flash and maps old gpt-5.5, gpt-5.4, and gpt-5.3-codex project settings onto current supported GPT-5.2 ids.",
      },
      {
        category: "Reliability",
        tagColor: tagStyles.backend,
        icon: Clock,
        title: "Timeouts Refund Cleanly",
        detail:
          "If an AI provider times out before finishing, the user gets a clear retry message and the run is marked as no-charge instead of surfacing a scary server generation error.",
      },
      {
        category: "Credits",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Saved Model Repair Migration",
        detail:
          "Added a Supabase cleanup migration that updates saved legacy Neokens model ids to supported GPT-5.2 equivalents.",
      },
    ],
  },
  {
    version: "v3.8.3",
    date: "May 31, 2026",
    title: "Private Project Picker & Plugin Access",
    description:
      "Project sync lists now only show projects the signed-in user owns or was explicitly invited to collaborate on.",
    updates: [
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Private Sync Project Lists",
        detail:
          "The plugin setup wizard now filters projects by owner and collaborator access instead of showing every project visible through broader public policies.",
      },
      {
        category: "Plugin",
        tagColor: tagStyles.plugin,
        icon: Rocket,
        title: "Studio Token Access Checks",
        detail:
          "Roblox Studio plugin auth, sync, snapshot, context, organize, report, and error routes now verify project access before returning or writing project data.",
      },
      {
        category: "Account",
        tagColor: tagStyles.backend,
        icon: LayoutDashboard,
        title: "Accurate Project Counts",
        detail:
          "Account stats now count only the user's own projects, keeping dashboard and profile totals private and accurate.",
      },
    ],
  },
  {
    version: "v3.8.2",
    date: "May 31, 2026",
    title: "Custom Chat Emotes & Reaction Packs",
    description:
      "Global Chat and DMs now have a much larger BloxSmith emote system with BloxBot, builder, Roblox, status, reaction, and fun packs users can personalize.",
    updates: [
      {
        category: "Chat",
        tagColor: tagStyles.ui,
        icon: MessageSquare,
        title: "Categorized Emote Picker",
        detail:
          "Added searchable BloxSmith emote categories for BloxBot, Roblox builds, builder tools, statuses, reactions, and fun chat moments.",
      },
      {
        category: "Chat",
        tagColor: tagStyles.ui,
        icon: Bot,
        title: "More BloxBot Emotes",
        detail:
          "Expanded BloxBot tokens with wave, think, build, win, oof, happy, cool, love, fire, party, and GG options.",
      },
      {
        category: "Customization",
        tagColor: tagStyles.tools,
        icon: Palette,
        title: "Custom Quick Reactions",
        detail:
          "Chat preferences now let users choose their own quick reaction bar using regular emoji or BloxSmith tokens like :blox_happy:, :tycoon:, and :script:.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "Custom Emote Rendering",
        detail:
          "Custom image and token emotes now render inside messages, DM markdown, quick reaction buttons, and reaction pills with smoother animated styling.",
      },
    ],
  },
  {
    version: "v3.8.1",
    date: "May 31, 2026",
    title: "MCP & Provider Secret Vault Migration",
    description:
      "MCP authorization headers and provider API keys now flow through encrypted vault storage instead of removed database columns.",
    updates: [
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Encrypted MCP Auth Storage",
        detail:
          "MCP server authorization headers are saved, removed, and resolved server-side through encrypted vault secrets.",
      },
      {
        category: "Integrations",
        tagColor: tagStyles.integrations,
        icon: Server,
        title: "MCP UI Schema Cleanup",
        detail:
          "The MCP server pages no longer select or insert the dropped auth_header column, preventing stale schema errors after migration.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: Wrench,
        title: "Provider Key Vault Reads",
        detail:
          "Provider API key save, clear, and gateway resolution paths now use vault-backed secrets instead of the old api_key column.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: CheckCircle,
        title: "Migration Backfill",
        detail:
          "Added a migration that moves legacy MCP auth headers and provider API keys into vault secrets before dropping the old columns.",
      },
    ],
  },
  {
    version: "v3.8.0",
    date: "May 31, 2026",
    title: "AI Model Status & Availability",
    description:
      "The AI model picker now shows live availability so users can see which models are online, which are temporarily down, and avoid selecting models that are not working.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Green/Red Model Indicators",
        detail:
          "Added green lights for available models and red lights for temporarily unavailable models directly in the AI model picker.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Link2Off,
        title: "Down Models Are Disabled",
        detail:
          "Models marked down are now disabled in the picker so users cannot accidentally choose a broken or unavailable model.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Server,
        title: "Clear Down-State Labels",
        detail:
          "The picker now labels availability problems as temporarily down, provider down, timed out, rate limited, auth failed, model unavailable, or not configured.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: Clock,
        title: "Automatic Health Refresh",
        detail:
          "Model availability refreshes every 30 seconds from recent provider health events so the UI can recover when a model comes back online.",
      },
      {
        category: "Reliability",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Saved Model Fallback Protection",
        detail:
          "If a project already has a saved Neokens model that is currently down, server-side AI routing now tries an available site model instead of sending the request to a known-bad model.",
      },
      {
        category: "Admin",
        tagColor: tagStyles.backend,
        icon: CheckCircle,
        title: "Diagnostics Feed Model Health",
        detail:
          "Admin model diagnostics now record their pass/fail results into provider health events, allowing successful checks to bring models back online.",
      },
      {
        category: "Reliability",
        tagColor: tagStyles.security,
        icon: Wrench,
        title: "Smarter Disable Rules",
        detail:
          "Prompt-specific context, tool, or JSON failures no longer globally disable a model; only provider-style outages and availability problems mark a model down.",
      },
    ],
  },
  {
    version: "v3.7.0",
    date: "May 30, 2026",
    title: "Smarter Roblox Toolbox Asset Planning",
    description:
      "BloxSmith now searches the Roblox Toolbox with a real asset plan so generated maps and games use varied free assets instead of repeating the same object.",
    updates: [
      {
        category: "Toolbox",
        tagColor: tagStyles.tools,
        icon: Library,
        title: "Full Build Asset Plans",
        detail:
          "Added a Toolbox planner that searches multiple focused categories for cities, simulators, obbies, tycoons, horror maps, props, NPCs, vehicles, tools, decorations, UI icons, and audio.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Less Repetition, Better Variety",
        detail:
          "The builder now avoids duplicate asset IDs and duplicate-looking names, then groups selected assets into the correct Roblox Studio folders before insertion.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Safer Free Asset Filtering",
        detail:
          "Toolbox searches now filter risky asset names, prefer free public assets, keep decorative model script scanning enabled, and strip unsafe scripts before Studio insertion.",
      },
    ],
  },
  {
    version: "v3.6.0",
    date: "May 30, 2026",
    title: "Custom 3D Generator Studio",
    description:
      "The 3D Model Generator is now a fuller Roblox asset studio with custom model settings, 3D text, animation blueprints, live cooldown timers, and safer PayPal transaction submission.",
    updates: [
      {
        category: "3D",
        tagColor: tagStyles.tools,
        icon: Box,
        title: "Custom 3D Model Controls",
        detail:
          "Users can choose model type, Roblox style, theme, material, texture look, colors, quality, format, polygon budget, textures, and rigged exports before generating.",
      },
      {
        category: "3D",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "3D Text & Animation Modes",
        detail:
          "Added customizable Roblox-ready 3D text packages and animation blueprint packages for idle, walk, run, attack, emote, dance, pet, NPC, and tool animations.",
      },
      {
        category: "Account",
        tagColor: tagStyles.backend,
        icon: Clock,
        title: "Live Weekly Cooldown Timer",
        detail:
          "The 3D generator now shows time remaining, unlock time, a disabled generate button, and automatic unlock once the Supabase-saved cooldown expires.",
      },
      {
        category: "Payments",
        tagColor: tagStyles.security,
        icon: CreditCard,
        title: "Safer PayPal Transaction ID Flow",
        detail:
          "Checkout now submits PayPal transaction IDs through a server-side RPC with duplicate transaction protection so credits are added after verified approval.",
      },
    ],
  },
  {
    version: "v3.5.0",
    date: "May 30, 2026",
    title: "Game Template Store & Moderator Panel",
    description:
      "The template store now has real Roblox game starters instead of an empty section, and moderators have a safer dashboard with strict limits, email resend tools, and audit logging.",
    updates: [
      {
        category: "Templates",
        tagColor: tagStyles.tools,
        icon: Library,
        title: "Roblox Game Template Catalog",
        detail:
          "Added simulator, obby, tycoon, pet, mining, sword fighting, racing, roleplay, horror, and tower defense templates with preview images, credit costs, difficulty, build details, and plugin status.",
      },
      {
        category: "Plugin",
        tagColor: tagStyles.plugin,
        icon: FileCode,
        title: "Studio-Ready Template Builds",
        detail:
          "Build This Game now seeds projects with scripts, UI, config modules, RemoteEvents, tools, tasks, and build plans so the Roblox Studio plugin has a full structure to insert.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Safe Moderator Role",
        detail:
          "Added a migration that safely enables the moderator enum, plus a separate Moderator Panel with no admin promotion, demotion, owner/admin targeting, or unlimited credit powers.",
      },
      {
        category: "Account",
        tagColor: tagStyles.backend,
        icon: Mail,
        title: "Resend Confirmation Tools",
        detail:
          "Admins and moderators can resend signup confirmation emails for users whose email is still unconfirmed, with each action logged for owner review.",
      },
    ],
  },
  {
    version: "v3.4.0",
    date: "May 30, 2026",
    title: "UI Generator Reliability, Builder Polish & AI Replica Fixes",
    description:
      "The Roblox UI Generator is faster, more reliable, and much better-looking. Generations now fall back to complete Roblox ScreenGui specs instead of empty output, the page has a cleaner builder workspace, generated templates now use more premium styling, Global Chat now explains rules and consequences, and image-based building replicas are more reliable.",
    updates: [
      {
        category: "3D",
        tagColor: tagStyles.tools,
        icon: Box,
        title: "3D Model Generator Website Feature",
        detail:
          "The 3D tool is now clearly presented as BloxSmith's 3D Model Generator for Roblox text-to-3D and image-to-3D assets, with onboarding and navigation pointing users to it directly.",
      },
      {
        category: "Account",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Roblox-Style Profile Themes",
        detail:
          "Profiles now include more animated background themes: futuristic, simulator, obby, tycoon, anime, fantasy, city, neon, dark, and premium-style looks.",
      },
      {
        category: "Account",
        tagColor: tagStyles.security,
        icon: Award,
        title: "Earnable Badge Milestones",
        detail:
          "Badges now unlock from onboarding, site usage, asset generation, 3D model creation, UI generation, image generation, clothing, invites, Discord, project milestones, premium/credits, and account roles.",
      },
      {
        category: "Account",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Saved Onboarding Tour",
        detail:
          "New users now get a full account-saved onboarding tour with feature highlights, tooltips, progress steps, mobile-friendly layout, and a completion reward badge/free credits.",
      },
      {
        category: "Account",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Profile Badges & Role Labels",
        detail:
          "Profile menus and public popovers now show owner/admin/mod role labels and earned role badges, while locked badges like Founder, Staff, Moderator, and Verified can only come from real account roles.",
      },
      {
        category: "Account",
        tagColor: tagStyles.ui,
        icon: ImageIcon,
        title: "Real Decoration Images",
        detail:
          "Avatar decorations now use local image assets for crowns, halos, wings, auras, hats, visors, goggles, seasonal pieces, and premium animated effects instead of relying on emoji-only artwork.",
      },
      {
        category: "Account",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Animated Avatar Decorations",
        detail:
          "Profile customization now includes more premium animated decorations like cosmic crowns, plasma halos, royal wings, orbit effects, star showers, glitch frames, flame and lightning auras, crystal spikes, coin crowns, and builder goggles.",
      },
      {
        category: "Account",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "Profile Card Colors & Effects",
        detail:
          "Users can now choose a separate public profile card color and animated card effects including soft glow, aurora edge, premium shine, scanline, starfield, and pixel rain.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Library,
        title: "Premium Credit Templates",
        detail:
          "The Template Store now includes premium credit-costing Roblox kits for anime RPG hubs, pet simulator hatcheries, tycoons, battle passes, trading plazas, and moderation suites.",
      },
      {
        category: "Account",
        tagColor: tagStyles.integrations,
        icon: Award,
        title: "Earned Profile Badges",
        detail:
          "Profiles now show earned badge progress based on activity, projects, credits, Discord perks, and owner/staff status, with Discord-style badge visuals.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Shirt,
        title: "Better Clothing Avatar Preview",
        detail:
          "The Roblox clothing preview now renders layered tops, hoodies, pants, hats, face items, back accessories, neck items, and waist accessories as wearable 3D shapes instead of stamping every item onto the torso.",
      },
      {
        category: "Account",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "AI Usage Graph Fix",
        detail:
          "AI usage now records successful generators and template installs, including owner/free runs, and the account graph fills from usage events or credit transactions instead of staying blank.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Zap,
        title: "No More Empty UI Output",
        detail:
          'Fixed the generator path that could sit on loading and then show "No output generated." Slow or empty AI responses now fall back to a complete deterministic ScreenGui so users still get a usable Roblox UI.',
      },
      {
        category: "Performance",
        tagColor: tagStyles.backend,
        icon: Zap,
        title: "Faster UI Generation",
        detail:
          "Replaced long 90-second AI waits with a short timeout and reduced the loading animation timing, so the generator responds faster and fails over cleanly instead of feeling stuck.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: LayoutDashboard,
        title: "Cleaner Generator Workspace",
        detail:
          "The /ui-generator page now has a compact builder header, generation stats, cleaner template tiles, stronger style controls, a better preview toolbar, and a grid-backed device preview frame.",
      },
      {
        category: "Account",
        tagColor: tagStyles.integrations,
        icon: MessageSquare,
        title: "Resend Signup Confirmation",
        detail:
          "Signup now includes a resend confirmation email action for users who created an account but never received the verification message.",
      },
      {
        category: "3D",
        tagColor: tagStyles.tools,
        icon: Box,
        title: "Image to 3D, Rigged Export & Safety",
        detail:
          "The 3D generator now supports safe reference-image uploads, server-side NSFW checks, and Tripo rigged / animation-ready export controls with FBX-friendly settings.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Fancier Generated Roblox UIs",
        detail:
          "Generated fallback templates now look more premium with layered panels, header glow, status badges, gradients, stronger action buttons, thicker strokes, and clearer hierarchy.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Library,
        title: "Manual Save to UI Library",
        detail:
          "Generated previews now have a visible Save to Library action, so users can keep a generated UI even if the automatic save path did not return a saved generation id.",
      },
      {
        category: "Community",
        tagColor: tagStyles.security,
        icon: ScrollText,
        title: "Global Chat Rules Panel",
        detail:
          "Global Chat now has a dedicated rules panel and /rules command covering respect, spam, scams, unsafe links, privacy, staff directions, and what happens when rules are broken.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Building Replica Reliability",
        detail:
          "Image-based building replica prompts now route through stronger vision handling, get longer generation time, and fall back to a complete Roblox-scale building model instead of an empty folder.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Owner-Only Admin Role Changes",
        detail:
          "Admin promotion and demotion is now locked to owner accounts at the database policy, RPC, admin page, and Global Chat command layers.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Moderator Role & Credit Guards",
        detail:
          "Owners can now assign a Moderator role for Global Chat actions without giving admin dashboard or credit powers. Manual credit adjustments are owner-only, direct profile credit edits are blocked, and refund checks are stricter.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Palette,
        title: "Spin Wheel Template Upgrade",
        detail:
          "Spin Wheel output now renders as a more circular layered wheel with glow, reward badges, pointer marker, prize panel, upgraded spin button, RemoteEvent, LocalScript, and ServerScript.",
      },
    ],
  },
  {
    version: "v3.3.0",
    date: "May 30, 2026",
    title: "Achievements, Perks, Gallery & Community Polish",
    description:
      "Big community update: a full achievements & leveling system with free credits for chatting, a clean image-only Gallery, follow/report on every profile, server-side link blocking, a custom bot avatar, automatic 7-day chat retention, and a mobile-friendly pass across the app.",
    updates: [
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Award,
        title: "Achievements, Badges & Levels",
        detail:
          "New /achievements page with an XP bar, your current level, and badges across Chat, Level, Gallery, and Social categories. Unlocking a badge instantly drops bonus credits + XP into your account.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Gift,
        title: "+2 Free Credits Every 10 Messages",
        detail:
          "Stay active in Community Chat and BloxSmith automatically tops your balance: every 10 messages you send = +2 credits, tracked server-side and logged in your credit history. Mentioned on the dashboard and the achievements page.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: ImageIcon,
        title: "Image-Only Gallery",
        detail:
          "New /gallery feed for sharing Roblox screenshots. Image-only uploads up to 6 MB, caption moderation, likes, and one-click follow on the creator's profile. Clean by default — no links, no NSFW.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Users,
        title: "Follow & Profile Actions",
        detail:
          "Click any name in chat or gallery to open the profile popover with live follower count, Follow / Unfollow, and friend / DM shortcuts.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: Flag,
        title: "Report System",
        detail:
          "Every profile and gallery post can be reported with a reason. Reports queue into the admin moderation panel alongside chat reports.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: Link2Off,
        title: "Link Blocker in Chat",
        detail:
          'Server-side regex blocks http(s)://, www., common TLDs (.com / .gg / .net …) and Discord invites in every channel. A friendly "Links aren\'t allowed" toast replaces the silent failure.',
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: MessageSquare,
        title: "Channels: Announcements, Help & More",
        detail:
          "Community Chat now has multiple channels (General, Announcements, Help, Showcase, Off-topic) with per-role posting rules and a slim channel sidebar.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Bot,
        title: "BloxBot Got a Face",
        detail:
          "The in-chat assistant now shows a custom BloxBot avatar with a primary-color ring instead of the generic robot icon.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: Trash2,
        title: "7-Day Chat Retention",
        detail:
          "A scheduled job runs hourly to purge global chat messages, reactions, and project chat older than 7 days, keeping the database lean and conversations fresh.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Smartphone,
        title: "Mobile Polish",
        detail:
          "Browse header, stat cards, chat composer and gallery grids all reflow cleanly at 390-430 px. No more overflowing numbers or clipped titles on phones.",
      },
    ],
  },
  {
    version: "v3.2.0",
    date: "May 30, 2026",
    title: "Global Chat 2.0 — Customization, Reactions & Moderation",
    description:
      "A major Global Chat upgrade: per-user preferences, emoji reactions, @mentions with autocomplete, replies, image uploads, markdown, online/typing indicators, pinned messages, and a full moderation suite with reports, blocked words, AI auto-mod, warnings, and an audit log.",
    updates: [
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Fully Customizable Chat",
        detail:
          "New settings panel (gear icon) lets every user pick their font size, density (compact/cozy/comfy), sound on/off, notification mode (off / mentions / all), and a personal accent color. Name color, message gradient, and chat icon are still set from your profile.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "Reactions, Replies, Mentions & Markdown",
        detail:
          "Hover any message to react with emoji, reply/quote it, or open the action menu. Type @ to autocomplete people you've seen in chat; mentioning you triggers a ping. Messages support **bold**, *italic*, `code`, and auto-linked URLs.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "Images, Presence & Typing",
        detail:
          'Upload images up to 5 MB straight into chat. See who\'s online via the Users chip in the header, and watch a live "typing…" indicator when others are mid-message. Pinned messages (admin only) sit at the top of the conversation.',
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Full Moderation Suite",
        detail:
          "Anyone can report a message (admins get a queue). Admins now have a Shield panel with three tabs: Reports, Blocked Words (live profanity list with severity), and an Audit log of every mute, unmute, delete, pin, and warning. New per-message actions: pin, warn, delete, mute (5m/1h/permanent), unmute.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "AI Auto-Moderation & Anti-Spam",
        detail:
          "Every message is screened by an AI moderator (Lovable AI gateway) for slurs, threats, and harassment, plus a server-side duplicate-message check, ALL-CAPS detection, and the admin-managed blocked words list. Slow mode and rate limits still apply.",
      },
    ],
  },
  {
    version: "v3.1.1",
    date: "May 30, 2026",
    title: "Auth Stability & Console Noise Cleanup",
    description:
      "Stops the 401 spam from /auth/v1/user when you're logged out or your session has expired, rotates the AI gateway key behind Sign in with Google to fix the \"Invalid API key\" toast, and keeps audio gesture-gated so Chrome doesn't warn about AudioContext.",
    updates: [
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Clean Session Handling",
        detail:
          "On load we now validate the cached session with the Auth server. If the token is expired, revoked, or the account was removed, we sign you out cleanly instead of letting protected requests 401 in a loop. Logged-out visitors no longer trigger /auth/v1/user calls at all.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: ShieldCheck,
        title: "Google Sign-In API Key Refreshed",
        detail:
          'Rotated the Lovable AI gateway key powering the Google OAuth broker so the "Invalid API key" toast that appeared for some users when clicking Sign in with Google is resolved.',
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Audio Stays Quiet Until You Interact",
        detail:
          'Confirmed sound effects only initialize after a real user gesture (click/tap/key), so Chrome\'s "AudioContext was not allowed to start" warning no longer appears on first load.',
      },
    ],
  },
  {
    version: "v3.1.0",
    date: "May 30, 2026",
    title: "Community Lockdown, Chat Customization & Real UI Previews",
    description:
      "Community and browse areas are now members-only, with proper redirects and a clean login gate. Chat got gradient names, message colors, and preset icons. The UI Generator now renders real AI image previews. Plus a sweep of bug fixes across auth, themes, AI Help, payments, and the Roblox plugin pipeline.",
    updates: [
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Browse & Community Pages Now Require Login",
        detail:
          'Showcase, Showcase detail, Templates, Ideas, Project editor, and Clothing Studio all now require an account. Logged-out visitors see a clean "Please log in to view and interact with community content" gate and are redirected to /login with a return path so they land back where they were after signing in. Private projects stay private — only published showcase entries appear in browse, backed by RLS on the database.',
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Interaction Guardrails",
        detail:
          "Likes, comments, follows, friends, messages, remixing, and publishing are all gated behind authentication on both the UI and the backend. RLS policies remain the source of truth so the data is protected even if the UI is bypassed.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Chat Name & Message Customization",
        detail:
          "Personalize how you appear in Global Chat: choose a solid color or up to a 4-stop gradient for your name and message text, and pick from a curated set of clean preset icons (Sparkles, Crown, Rocket, and more). Live preview in Account → Chat Style.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Real Image Previews in UI Generator",
        detail:
          "The UI Generator now renders a real AI image preview alongside the Luau code, streaming partial images as it generates so you can see the design come together. Regenerate any time from the Image tab.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "AI Help & Global Chat Visibility Fixes",
        detail:
          "Fixed layout issues that hid the AI Help launcher and Global Chat on certain pages. Both now appear consistently across the app once signed in.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Payments & Manual Verification Improvements",
        detail:
          "Cleaner approval/rejection flow for manual PayPal verification, with credits granted atomically and tracked in the credit ledger.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Auth & OAuth Polish",
        detail:
          "Hardened Google sign-in via the Lovable broker, fixed the OAuth callback route, and tightened login redirect handling so deep links survive a sign-in round trip.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Theme Consistency Sweep",
        detail:
          "Resolved theme inconsistencies on browse, account, and tool pages — every surface now uses the design tokens in both light and dark mode.",
      },
      {
        category: "Plugin",
        tagColor: tagStyles.plugin,
        icon: FileCode,
        title: "Roblox Plugin Insertion Fixes",
        detail:
          "Hardened the Bloxsmith Studio plugin pipeline so UI Generator output and template scripts insert reliably into the active place.",
      },
    ],
  },
  {
    version: "v3.0.0",
    date: "May 29, 2026",
    title: "Toolbox Overhaul, Stay-Signed-In & UI Generator",
    description:
      "A big release focused on the Roblox creator workflow: a rebuilt free-asset Toolbox that pulls real Studio models, a brand-new AI Roblox UI/GUI Generator, smarter session handling with a stay-signed-in option, and account privacy controls.",
    updates: [
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Roblox UI / GUI Generator",
        detail:
          "A new /ui-generator page generates full ScreenGuis (gamepass shops, dev product shops, main menus, loading screens, inventories, trading, daily rewards, codes, leaderboards, HUDs and more) with a live desktop + mobile preview, editable Luau code, and one-click insert into Roblox Studio via the Bloxsmith plugin.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Wrench,
        title: "Toolbox Rebuilt on Real Creator Store Data",
        detail:
          "Free Models now pull directly from the live Roblox Creator Store catalog (not avatar gear), so searches actually return Studio-usable assets. Decals, Audio, Plugins and Meshes use the modern catalog endpoint, every result shows a hi-res thumbnail, and pagination/sort/categories all work end-to-end. Each card links straight to create.roblox.com/store/asset/<id>.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Stay Signed In + 30-Minute Idle Auto-Logout",
        detail:
          "Login now has a Stay signed in toggle. When on, sessions persist across browser restarts. When off, you're automatically signed out after 30 minutes of real inactivity for safety on shared devices.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Hide My Email Privacy Toggle",
        detail:
          "A new account setting masks your email address in the profile UI (showing only the first letter and domain) so screenshots and screen-shares don't leak it.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Credit-Aware Model Picker",
        detail:
          "The AI model picker now shows a per-message credit cost for every model and a short description of what it's best at in Roblox workflows, so you can pick cheaper models for routine tweaks and premium ones for hard scripts.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Menu,
        title: "Draggable Help Chat",
        detail:
          "The floating AI help chat can now be dragged anywhere on screen and remembers its position.",
      },
    ],
  },
  {
    version: "v2.9.0",
    date: "May 28, 2026",
    title: "Image & Clothing Generator Overhaul",
    description:
      "A focused update fixing and polishing the creative tools: faster, more reliable image and clothing generation on Gemini, correct credit handling, a 3D clothing preview, and better downloads.",
    updates: [
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Palette,
        title: "Clothing Generator Repaired",
        detail:
          "The clothing studio now generates upload-ready Roblox shirt, pants, T-shirt, and accessory textures reliably through the Gemini image pipeline, with clearer upload guidance for each garment type.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Image Generator on Gemini",
        detail:
          "The AI image generator now runs entirely on Gemini image models with a single key, defaults to the newest fast model, and adds one-tap Roblox asset presets for thumbnails, game icons, HUD/UI graphics, textures, gamepass banners, and decals.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Wrench,
        title: "3D Clothing Preview",
        detail:
          "Generated clothing can now be previewed in an interactive 3D view that wraps the texture onto a rotating avatar, alongside the flat texture view, so you can sanity-check colors and placement before uploading.",
      },
      {
        category: "Credits",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Credits Only Charged on Success",
        detail:
          "Clothing and image generations now charge credits only when a generation succeeds. Failed or timed-out generations are automatically refunded, so a failure never costs you credits.",
      },
      {
        category: "Performance",
        tagColor: tagStyles.backend,
        icon: Zap,
        title: "Faster, No More Hanging Generations",
        detail:
          "Image requests now have a hard timeout, so a slow or stuck request fails cleanly with a retry message instead of leaving you on an endless spinner. Loading states show real step-by-step progress.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: CheckCircle,
        title: "Reliable Downloads",
        detail:
          "Download buttons for generated clothing and images now save the file directly instead of occasionally opening it in a new tab.",
      },
    ],
  },
  {
    version: "v2.8.0",
    date: "May 28, 2026",
    title: "Roblox AI Brain, Mobile Navigation & Stability Upgrade",
    description:
      "A major reliability and AI-quality update focused on making BloxSmith better at building real Roblox games, easier to use on mobile, and safer across important pages.",
    updates: [
      {
        category: "AI Brain",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Roblox Docs Knowledge Mandate",
        detail:
          "Expanded the AI guidance so BloxSmith acts like it knows Roblox Creator Hub, Luau, Engine APIs, DataStores, MarketplaceService, TeleportService, PathfindingService, UI, animation, physics, lighting, terrain, plugins, and secure multiplayer patterns.",
      },
      {
        category: "Game Types",
        tagColor: tagStyles.ai,
        icon: Sparkles,
        title: "Any Roblox Game Type Support",
        detail:
          "Added stronger instructions for tycoons, FPS games, RPGs, simulators, obbies, horror, racing, tower defense, fighting, pet games, roleplay, city games, dungeons, quests, shops, inventories, crafting, vehicles, pets, teams, rounds, and more.",
      },
      {
        category: "Real Assets",
        tagColor: tagStyles.tools,
        icon: Play,
        title: "Real Studio Builds Over Tiny Demos",
        detail:
          "BloxSmith is now guided to build playable vertical slices with real maps/assets, UI, sounds, scripts, RemoteEvents, folders, saving when needed, and Studio edit-mode visibility instead of tiny placeholder builds.",
      },
      {
        category: "Mobile",
        tagColor: tagStyles.ui,
        icon: Menu,
        title: "Hamburger Menu Removed on Mobile",
        detail:
          "Replaced the mobile hamburger menu with a mobile-only horizontal scroll navbar so users can quickly access Home, Build, Plugin, Credits, Templates, Docs, Ideas, MCP, FAQ, 3D, and Discord.",
      },
      {
        category: "Themes",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Better Mobile Theme Switcher",
        detail:
          "Theme switching now opens a phone-friendly panel with bigger tap targets, a close button, overlay, scroll lock, and cleaner mobile spacing while keeping desktop controls working normally.",
      },
      {
        category: "Languages",
        tagColor: tagStyles.ui,
        icon: Languages,
        title: "Better Mobile Language Switcher",
        detail:
          "Language switching now opens a mobile-friendly panel with popular languages first, more languages below, bigger tap targets, a close button, overlay, and page scroll lock while choosing a language.",
      },
      {
        category: "Help Chat",
        tagColor: tagStyles.backend,
        icon: Globe2,
        title: "Desktop Help Chat Reliability",
        detail:
          "Improved the public help chat route with model fallbacks, Groq fallback support, safe local answers, timeouts, rate limiting, and better help for plugin setup, credits, MCP, docs, and BloxSmith info.",
      },
      {
        category: "Admin",
        tagColor: tagStyles.backend,
        icon: LayoutDashboard,
        title: "Safer Admin Page",
        detail:
          "Rebuilt the admin page into a safer overview with login/admin messages, safe counts for users/projects/generations/pending payments, recent users, mobile-friendly scrolling tables, and fewer crash points.",
      },
      {
        category: "Stability",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Emergency Assistant Route Recovery",
        detail:
          "Restored the assistant execute route with safe JSON responses and fallback Studio actions so broken AI gateway calls do not crash pages or project sync flows.",
      },
    ],
  },
  {
    version: "v2.7.0",
    date: "May 28, 2026",
    title: "Premium Homepage, Mobile UX & Creator Conversion Upgrade",
    description:
      "A major homepage and mobile-friendly update focused on making BloxSmith easier to understand, more trustworthy for Roblox creators, and stronger at converting visitors into builders.",
    updates: [
      {
        category: "Homepage",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "What BloxSmith Can Make",
        detail:
          "Added clear sections for maps, Luau scripts, game systems, GUIs, VFX, sounds, toolbox assets, NPCs, thumbnails, icons, decals, and Roblox-ready game art.",
      },
      {
        category: "Prompts",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Example Prompt Section",
        detail:
          "Added example prompts for tycoons, simulators, obbies, horror systems, racing lobbies, shop GUIs, and other Roblox builds so users know what to ask.",
      },
      {
        category: "Plugin",
        tagColor: tagStyles.plugin,
        icon: Play,
        title: "Roblox Studio Plugin Preview",
        detail:
          "Added plugin preview content explaining account connection, Studio sync, correct service placement, project scans, error fixing, and toolbox asset insertion.",
      },
      {
        category: "Credits",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Clearer Credit Info",
        detail:
          "Added clearer credit copy explaining starter credits, daily credits, pay-as-you-go packs, and what credits are used for.",
      },
      {
        category: "Mobile",
        tagColor: tagStyles.ui,
        icon: Smartphone,
        title: "Homepage Mobile Improvements",
        detail:
          "Improved mobile hero sizing, button layout, comparison table scrolling, help chat sizing, and phone-friendly navigation spacing.",
      },
    ],
  },
  {
    version: "v2.6.0",
    date: "May 28, 2026",
    title: "Security, Speed & AI Gateway Upgrade",
    description:
      "A stability and safety release for the website, AI chat, model gateway, plugin organizer, and image generation workflow.",
    updates: [
      {
        category: "Performance",
        tagColor: tagStyles.backend,
        icon: Zap,
        title: "Smoother AI Chat Performance",
        detail:
          "Assistant messages were optimized so long chats re-render less and project pages feel smoother.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Safer Provider Keys",
        detail:
          "Server AI providers and model tests now rely on environment variables instead of embedded fallback keys.",
      },
      {
        category: "AI Gateway",
        tagColor: tagStyles.integrations,
        icon: Server,
        title: "Cleaner Provider Routing",
        detail:
          "Improved routing and fallback behavior for Groq, Neokens, Gemini, OpenAI-compatible, and Claude-style providers.",
      },
    ],
  },
  {
    version: "v2.5.0",
    date: "May 27, 2026",
    title: "Full Roblox Creation Assistant",
    description:
      "BloxSmith AI evolved from a script generator into a complete Roblox build assistant for maps, GUIs, tools, VFX, systems, and Studio placement.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Wrench,
        title: "Build Modes Added",
        detail:
          "Added stronger generation support for animations, VFX, game systems, procedural builds, toolbox finding, and finish-my-game workflows.",
      },
      {
        category: "Placement",
        tagColor: tagStyles.backend,
        icon: FileCode,
        title: "Correct Studio Service Placement",
        detail:
          "Generated items are guided toward Workspace, ServerScriptService, ReplicatedStorage, StarterGui, StarterPack, Lighting, SoundService, Teams, and clean folders.",
      },
    ],
  },
];

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  head: () => ({
    meta: [
      { title: "Changelog — BloxSmith" },
      {
        name: "description",
        content:
          "Stay updated with the latest BloxSmith releases, AI upgrades, plugin changes, security fixes, mobile improvements, and Roblox builder updates.",
      },
      { property: "og:title", content: "Changelog — BloxSmith" },
      {
        property: "og:description",
        content: "Latest BloxSmith releases, features, security updates, and fixes.",
      },
      { property: "og:url", content: "https://bloxsmith.pro/changelog" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/changelog" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "BloxSmith Changelog",
          url: "https://bloxsmith.pro/changelog",
          blogPost: changelogItems.slice(0, 4).map((item) => ({
            "@type": "BlogPosting",
            headline: item.title,
            description: item.description,
            datePublished: item.date,
            author: { "@type": "Organization", name: "BloxSmith" },
            url: `https://bloxsmith.pro/changelog#${item.version.replace(/\./g, "-")}`,
          })),
        }),
      },
    ],
  }),
});

function ChangelogPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-4">
            <Sparkles className="h-3 w-3 text-primary-glow" /> BloxSmith updates
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            What's <span className="gradient-text">New</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg">
            Follow the latest website upgrades, AI improvements, Roblox Studio plugin changes,
            mobile fixes, security updates, and platform changelogs.
          </p>
        </div>

        <h2 className="sr-only">Release timeline</h2>
        <div className="space-y-16 relative before:absolute before:inset-0 before:left-4 sm:before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border/60 before:h-full">
          {changelogItems.map((item) => (
            <div
              id={item.version.replace(/\./g, "-")}
              key={item.version}
              className="relative flex flex-col sm:flex-row items-start sm:gap-12 group scroll-mt-24"
            >
              <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-surface border-2 border-primary grid place-items-center z-10 shadow-lg group-hover:scale-110 transition-transform">
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>

              <div className="pl-12 sm:pl-0 sm:w-1/2 sm:text-right pt-1.5 flex sm:flex-col items-baseline sm:items-end gap-2 justify-start">
                <span className="text-xl sm:text-2xl font-black text-foreground">
                  {item.version}
                </span>
                <span className="text-xs font-semibold text-muted-foreground/80 bg-surface px-2.5 py-1 rounded-full border border-border">
                  {item.date}
                </span>
              </div>

              <div className="pl-12 sm:pl-0 sm:w-1/2 mt-4 sm:mt-0">
                <div className="glass rounded-2xl p-6 sm:p-8 hover:border-primary/30 transition-all duration-300">
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2 text-foreground/90">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {item.description}
                  </p>

                  <div className="space-y-6">
                    {item.updates.map((upd, uIdx) => {
                      const Icon = upd.icon;
                      return (
                        <div key={uIdx} className="flex gap-4 items-start">
                          <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-glow">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">
                                {upd.title}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${upd.tagColor}`}
                              >
                                {upd.category}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {upd.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center glass rounded-2xl p-8 max-w-xl mx-auto">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-glow mb-4">
            <Palette className="h-5 w-5" />
          </div>
          <h4 className="text-lg font-bold">Have suggestions or issues?</h4>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            BloxSmith is updated often to improve Roblox development workflows, plugin reliability,
            AI generation quality, mobile UX, and security.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              to="/plugin"
              className="text-xs font-semibold text-primary hover:text-primary-glow underline"
            >
              Download Latest Plugin
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              to="/docs"
              className="text-xs font-semibold text-primary hover:text-primary-glow underline"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
