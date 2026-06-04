// Temporary permissive-typed re-export of the Supabase admin client.
// See ./client-typed.ts for why this exists. Once ./types is regenerated
// from a restored DB schema, remove the tsconfig paths entry that points here.

import { supabaseAdmin as realSupabaseAdmin } from "./client.server";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export const supabaseAdmin = realSupabaseAdmin as unknown as SupabaseClient<AnyDb>;
