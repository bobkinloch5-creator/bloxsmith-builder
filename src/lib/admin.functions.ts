import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    const isAdmin = (roles ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "owner",
    );

    if (!isAdmin) {
      throw new Error("Forbidden");
    }

    return { isAdmin: true };
  });

// Server-side credit adjustment that does NOT depend on the admin_adjust_credits
// SQL RPC (which can 409 on a drifted credit_transactions schema). It runs the
// balance update with the service-role client and writes the ledger row
// best-effort, so the buttons work even before the SQL repair is applied.
export type AdminAdjustCreditsResult =
  | { ok: true; credits: number }
  | { ok: false; error: string };

export const adminAdjustCreditsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z
          .number()
          .int()
          .refine((n) => n !== 0 && Math.abs(n) <= 1_000_000, "invalid_credit_amount"),
        reason: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AdminAdjustCreditsResult> => {
    const { supabase, userId } = context as {
      supabase: import("@supabase/supabase-js").SupabaseClient;
      userId: string;
    };

    // Authorize against the CALLER's own roles (RLS lets users read their own).
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const privileged = (roles ?? []).some(
      (r: { role: string }) => r.role === "owner" || r.role === "admin",
    );
    if (!privileged) {
      return { ok: false, error: "Only an owner or admin can adjust credits." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: readErr } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", data.userId)
      .maybeSingle();
    if (readErr) return { ok: false, error: readErr.message };
    if (!profile) return { ok: false, error: "User profile not found." };

    const current = Number((profile as { credits: number | null }).credits ?? 0);
    const next = Math.max(0, current + data.amount);

    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({ credits: next, updated_at: new Date().toISOString() })
      .eq("id", data.userId);
    if (updErr) return { ok: false, error: updErr.message };

    // Best-effort ledger entry — a credit_transactions schema mismatch must
    // never undo the balance change (this is what caused the 409).
    const { error: ledgerErr } = await (supabaseAdmin as any)
      .from("credit_transactions")
      .insert({
        user_id: data.userId,
        amount: data.amount,
        balance: next,
        reason: (data.reason && data.reason.trim()) || "owner adjust",
      });
    if (ledgerErr) {
      console.warn("[adminAdjustCreditsFn] ledger insert skipped:", ledgerErr.message);
    }

    return { ok: true, credits: next };
  });
