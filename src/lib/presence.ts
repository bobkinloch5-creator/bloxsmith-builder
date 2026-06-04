// Lightweight presence heartbeat. Pings the `update_presence` RPC every minute
// while the tab is visible, so other users can see when someone was last active.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const HEARTBEAT_MS = 60_000;

export function usePresenceHeartbeat() {
  const { user, profile } = useAuth();
  useEffect(() => {
    if (!user) return;
    if ((profile as any)?.presence_enabled === false) return;

    let cancelled = false;
    const ping = async () => {
      if (cancelled || document.hidden) return;
      try {
        await (supabase as any).rpc("update_presence", { _status: null, _activity: null });
      } catch {
        /* silent */
      }
    };
    ping();
    const id = window.setInterval(ping, HEARTBEAT_MS);
    const onVisible = () => {
      if (!document.hidden) ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, (profile as any)?.presence_enabled]);
}

export function presenceFromProfile(p: {
  presence_enabled?: boolean | null;
  presence_status?: string | null;
  last_seen_at?: string | null;
}): { dot: string; label: string; ring: string } {
  if (!p?.presence_enabled || p?.presence_status === "invisible") {
    return { dot: "bg-zinc-500", label: "Offline", ring: "ring-zinc-500/40" };
  }
  const last = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
  const ageMin = (Date.now() - last) / 60_000;
  if (!last || ageMin > 10) {
    return { dot: "bg-zinc-500", label: "Offline", ring: "ring-zinc-500/40" };
  }
  if (p.presence_status === "dnd") {
    return { dot: "bg-rose-500", label: "Do not disturb", ring: "ring-rose-500/40" };
  }
  if (p.presence_status === "idle" || ageMin > 3) {
    return { dot: "bg-amber-400", label: "Idle", ring: "ring-amber-400/40" };
  }
  return { dot: "bg-emerald-500", label: "Online", ring: "ring-emerald-500/40" };
}
