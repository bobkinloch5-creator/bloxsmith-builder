// Temporary permissive re-export of Supabase Database types.
// See ./client-typed.ts for context. Remove the tsconfig paths entry
// pointing here once ./types regenerates from a restored schema.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tables<_T = unknown, _N = unknown> = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TablesInsert<_T = unknown, _N = unknown> = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TablesUpdate<_T = unknown, _N = unknown> = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Enums<_T = unknown, _N = unknown> = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CompositeTypes<_T = unknown, _N = unknown> = any;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
