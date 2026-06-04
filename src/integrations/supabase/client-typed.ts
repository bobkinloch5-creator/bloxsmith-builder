// Temporary permissive-typed re-export of the Supabase browser client.
//
// The generated `Database` type in ./types is currently empty (schema has not
// been re-applied to Cloud yet), which makes every `.from("table")` resolve
// to `never` and breaks the build across ~90 files. This wrapper re-exports
// the real client cast through a permissive type so call sites typecheck
// while preserving full runtime behavior.
//
// Once migrations are restored and ./types is regenerated, remove the
// `paths` entry in tsconfig.json that redirects to this file and call sites
// will get strict generated types back automatically.

import { supabase as realSupabase } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

// `any`-typed Database surface: any table name, any row shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export const supabase = realSupabase as unknown as SupabaseClient<AnyDb>;
