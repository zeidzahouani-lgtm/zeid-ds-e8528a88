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
 *  2. status === 'online' AND heartbeat within ONLINE_STATUS_GRACE_MS → online
 *     (handles client clock skew where heartbeats look "stale").
 *  3. status === 'online' with no heartbeat at all → online (legacy screens).
 *  4. Otherwise → offline.
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
    // Trust DB status flag within a generous grace window to avoid false
    // "offline" caused by client clock skew.
    if (isStatusOnline && age < ONLINE_STATUS_GRACE_MS) return true;
    // If clock is way ahead (negative age), the heartbeat is "in the future"
    // from the client's POV — also treat as online when DB agrees.
    if (isStatusOnline && age < 0) return true;
    return false;
  }

  return isStatusOnline;
}
