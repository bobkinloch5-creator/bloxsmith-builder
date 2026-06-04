// Temporary permissive-typed re-export of the auth middleware.
// See ./client-typed.ts for why this exists.
//
// The original middleware injects a strictly-typed Supabase client into
// context. While the generated Database type is empty, we re-export the
// middleware untouched at runtime but cast the inferred middleware type so
// downstream `context.supabase` resolves to a permissive client.

import { requireSupabaseAuth as realRequireSupabaseAuth } from "./auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireSupabaseAuth = realRequireSupabaseAuth as any;
