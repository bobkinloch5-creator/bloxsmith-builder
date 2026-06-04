import { createServerFn } from "@tanstack/react-start";
export type { SiteModelHealth, SiteModelHealthResponse } from "./ai-model-health.server";

export const getSiteModelHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { getSiteModelHealthSnapshot } = await import("./ai-model-health.server");
  return getSiteModelHealthSnapshot();
});
