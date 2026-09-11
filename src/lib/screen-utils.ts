/**
 * Shared screen utility functions.
 * Centralises the "is this screen really online?" logic so every view agrees.
 */

/**
 * A screen is considered stale (offline) if its heartbeat is older than this.
 * Players send a heartbeat every 5s, so 30s = ~6 missed beats: fast detection
 * while still tolerating short network hiccups on TV hardware.
 */
export const HEARTBEAT_STALE_MS = 30_000;

/**
 * Returns true if the screen should be considered online.
 *
 * Logic:
 *  1. Recent heartbeat (< HEARTBEAT_STALE_MS) → online.
 *  2. Heartbeat "in the future" (client clock behind) + DB status online → online.
 *  3. No heartbeat at all → fall back to the DB status (legacy screens).
 *  4. Otherwise → offline (stale heartbeat wins over a stale DB status flag).
 */
export function isScreenReallyOnline(screen: {
  status?: string;
  player_heartbeat_at?: string | null;
}): boolean {
  const hb = screen.player_heartbeat_at;
  const isStatusOnline = screen.status === "online";

  if (hb) {
    const age = Date.now() - new Date(hb).getTime();
    if (age < HEARTBEAT_STALE_MS) return true;
    // Clock skew: heartbeat timestamp ahead of the local clock.
    if (age < 0 && isStatusOnline) return true;
    return false;
  }

  return isStatusOnline;
}
