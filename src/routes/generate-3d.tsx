import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonToolPage } from "@/components/ComingSoonToolPage";

export const Route = createFileRoute("/generate-3d")({
  component: () => (
    <ComingSoonToolPage
      eyebrow="Model generation"
      title="3D Model Generation Is Coming Soon"
      description="BloxSmith model generation is being upgraded before it goes live again. AI Chat, Video Generator, and Script Doctor are still available while 3D models, model animation, and asset export workflows are prepared for a cleaner release."
    />
  ),
  head: () => ({
    meta: [
      { title: "AI 3D Model Generator for Roblox | BloxSmith" },
      {
        name: "description",
        content:
          "Generate Roblox-ready 3D models, 3D text, and custom animation blueprints with progress, ETA, previews, and Studio plugin support.",
      },
    ],
  }),
});
