// --- Polyfills pour vieux WebViews Android (box TV Chrome 40-63) ---
// Chargés AVANT tout code React pour que les libs (Radix, framer-motion, etc.)
// trouvent bien ResizeObserver / IntersectionObserver au démarrage.
import "intersection-observer";
import { ResizeObserver as ResizeObserverPolyfill } from "@juggle/resize-observer";
if (typeof window !== "undefined" && typeof (window as any).ResizeObserver === "undefined") {
  (window as any).ResizeObserver = ResizeObserverPolyfill;
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyLegacyWebViewCompat } from "./lib/legacy-webview";

// Detect old Chromium/WebView (e.g. Android TV boxes stuck on Chrome 80)
// and inject CSS shims BEFORE React mounts, so the very first paint is correct.
applyLegacyWebViewCompat();

createRoot(document.getElementById("root")!).render(<App />);
