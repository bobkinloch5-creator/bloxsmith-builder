import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { Package } from "lucide-react";
import { ToolboxAssetPicker } from "@/components/ToolboxAssetPicker";

export const Route = createFileRoute("/toolbox")({
  component: ToolboxPage,
  head: () => ({
    meta: [
      { title: "Toolbox — Free Roblox Assets | BloxSmith" },
      {
        name: "description",
        content:
          "Browse safe free Roblox toolbox assets with thumbnails, creator names, filters, and asset IDs.",
      },
    ],
  }),
});

function ToolboxPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            Toolbox — Free Roblox Assets
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Search and preview real Roblox toolbox assets. In a project chat, use the same picker to
            add the exact selected asset directly to your Studio plugin queue.
          </p>
        </header>

        <ToolboxAssetPicker />
      </main>
      <Footer />
    </div>
  );
}
