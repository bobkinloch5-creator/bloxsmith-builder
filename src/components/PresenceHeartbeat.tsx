import { usePresenceHeartbeat } from "@/lib/presence";

/** Invisible component — pings update_presence every minute while the tab is visible. */
export function PresenceHeartbeat() {
  usePresenceHeartbeat();
  return null;
}
