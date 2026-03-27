/**
 * Shared screen utility functions.
 * Centralises the "is this screen really online?" logic so every view agrees.
 */

/** A screen is considered stale (offline) if its heartbeat is older than this. */
export const HEARTBEAT_STALE_MS = 60_000; // 60 seconds — generous for TV hardware

/**
 * Returns true only when the screen has status "online" AND a recent heartbeat.
 * Works with any object that has `status` and `player_heartbeat_at` fields.
 */
export function isScreenReallyOnline(screen: {
  status?: string;
  player_heartbeat_at?: string | null;
}): boolean {
  if (screen.status !== "online") return false;
  const hb = screen.player_heartbeat_at;
  if (!hb) return false;
  const age = Date.now() - new Date(hb).getTime();
  return age < HEARTBEAT_STALE_MS;
}
