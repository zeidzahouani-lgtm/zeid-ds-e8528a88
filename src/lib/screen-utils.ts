/**
 * Shared screen utility functions.
 * Centralises the "is this screen really online?" logic so every view agrees.
 */

/** A screen is considered stale (offline) if its heartbeat is older than this. */
export const HEARTBEAT_STALE_MS = 120_000; // 120s to reduce false offline on TV hardware

/**
 * Primary source of truth is heartbeat recency.
 * If heartbeat exists and is recent, screen is online even if `status` temporarily lags.
 */
export function isScreenReallyOnline(screen: {
  status?: string;
  player_heartbeat_at?: string | null;
}): boolean {
  const hb = screen.player_heartbeat_at;
  if (hb) {
    const age = Date.now() - new Date(hb).getTime();
    return age < HEARTBEAT_STALE_MS;
  }

  return screen.status === "online";
}
