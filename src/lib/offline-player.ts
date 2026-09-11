/**
 * Offline support for players (écrans sans connexion permanente).
 *
 * - Registers the service worker that caches the app shell + media files.
 * - Persists the last known screen configuration (screen row, playlist,
 *   schedules, current media) so the player can start and keep playing
 *   without any network access.
 * - As soon as the network is back, the normal sync logic overwrites the
 *   snapshot with the fresh configuration.
 */

const SNAPSHOT_PREFIX = "player_offline_snapshot_";
const SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface OfflineSnapshot {
  savedAt: number;
  screen: any;
  playlist: any[];
  schedules: any[];
  media: any | null;
}

let swRegistration: ServiceWorkerRegistration | null = null;

export function registerPlayerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
  navigator.serviceWorker
    .register("/player-sw.js")
    .then((reg) => { swRegistration = reg; })
    .catch(() => {});
}

/** Ask the service worker to download & store media files for offline playback. */
export function precacheMedia(urls: (string | null | undefined)[]) {
  const clean = Array.from(new Set(urls.filter((u): u is string => !!u && u.indexOf("http") === 0)));
  if (clean.length === 0) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      const target = reg.active || swRegistration?.active || navigator.serviceWorker.controller;
      target?.postMessage({ type: "PRECACHE_MEDIA", urls: clean });
    })
    .catch(() => {});
}

export function saveSnapshot(screenKey: string, snapshot: Omit<OfflineSnapshot, "savedAt">) {
  if (!screenKey) return;
  try {
    localStorage.setItem(
      SNAPSHOT_PREFIX + screenKey,
      JSON.stringify({ ...snapshot, savedAt: Date.now() })
    );
  } catch (_) {
    // quota exceeded — offline snapshot is best-effort
  }
}

export function loadSnapshot(screenKey: string): OfflineSnapshot | null {
  if (!screenKey) return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_PREFIX + screenKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineSnapshot;
    if (!parsed?.screen) return null;
    if (Date.now() - (parsed.savedAt || 0) > SNAPSHOT_TTL_MS) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

/** Collect every media URL referenced by a playlist / schedules / single media. */
export function collectMediaUrls(playlist: any[], schedules: any[], media: any | null): string[] {
  const urls: string[] = [];
  (playlist || []).forEach((it) => { if (it?.media?.url) urls.push(it.media.url); });
  (schedules || []).forEach((s) => {
    if (s?.media?.url) urls.push(s.media.url);
    (s?.playlist_items || []).forEach((it: any) => { if (it?.media?.url) urls.push(it.media.url); });
  });
  if (media?.url) urls.push(media.url);
  return urls;
}
