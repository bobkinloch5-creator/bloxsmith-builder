import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchToolbox, type ToolboxPage } from "@/lib/toolbox.server";

const CATEGORIES = ["Models", "Decals", "Audio", "Plugins", "Meshes"] as const;
const SORTS = ["Relevance", "MostFavorited", "Bestselling", "RecentlyUpdated"] as const;

export const searchToolboxFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        keyword: z.string().max(120).optional(),
        category: z.enum(CATEGORIES).optional(),
        limit: z.number().int().min(1).max(30).optional(),
        cursor: z.string().max(2048).optional(),
        sort: z.enum(SORTS).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ToolboxPage> => {
    try {
      return await searchToolbox(data);
    } catch (e: any) {
      console.error("toolbox search failed", e);
      return { results: [], cursor: null };
    }
  });
