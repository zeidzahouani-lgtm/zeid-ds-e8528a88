import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "lovable:chunk-reloaded";

/**
 * React.lazy with resilience against stale chunks after a new deploy.
 * Retries the dynamic import once, then forces a single hard reload.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      // Second chance: the network may simply have blipped.
      try {
        return await factory();
      } catch {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // Never resolves; the page is reloading.
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      }
    }
  });
}
