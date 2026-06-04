import { createFileRoute, redirect } from "@tanstack/react-router";

// The standalone /workspace chat has been removed — it was a duplicate of the
// real AI builder chat inside /project/$projectId. Redirect visitors to the
// dashboard so they can open (or create) a project and use the full execution-
// capable AI chat that actually builds into Roblox Studio.
export const Route = createFileRoute("/workspace")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "AI Workspace — BloxSmith" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
