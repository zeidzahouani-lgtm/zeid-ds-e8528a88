/**
 * Legacy WebView compatibility layer.
 *
 * Detects old Chromium/WebView (typically Android TV boxes stuck on Chrome 80,
 * e.g. X96Q_PRO1) and injects CSS shims for properties that were added after
 * Chrome 87 but that Tailwind / our inline styles rely on.
 *
 * Behaviour:
 *   - Automatic detection by default (UA + CSS.supports feature test).
 *   - A manual override stored in localStorage lets the operator force the
 *     mode ON or OFF from the Player diagnostic overlay:
 *       localStorage["sf.legacyCompat"] = "auto" | "on" | "off"
 *
 * Called once, as early as possible (from main.tsx).
 */

const LEGACY_STYLE_ID = "legacy-webview-shim";
const LEGACY_ATTR = "data-legacy-webview";
const OVERRIDE_KEY = "sf.legacyCompat";

export type LegacyCompatOverride = "auto" | "on" | "off";

export interface LegacyWebViewReport {
  isLegacy: boolean;
  chromiumMajor: number | null;
  reasons: string[];
  override: LegacyCompatOverride;
  autoDetected: boolean;
}

function detectChromiumMajor(): number | null {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const m = /Chrom(?:e|ium)\/(\d+)/.exec(ua);
  return m ? parseInt(m[1], 10) : null;
}

function supportsInsetShorthand(): boolean {
  try {
    if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
      return CSS.supports("inset", "0px");
    }
  } catch {}
  try {
    const el = document.createElement("div");
    el.style.setProperty("inset", "0px");
    return el.style.top === "0px" || el.style.getPropertyValue("inset") !== "";
  } catch {
    return true;
  }
}

function supportsFlexGap(): boolean {
  try {
    const test = document.createElement("div");
    test.style.display = "flex";
    test.style.flexDirection = "column";
    test.style.gap = "1px";
    test.appendChild(document.createElement("div"));
    test.appendChild(document.createElement("div"));
    test.style.position = "absolute";
    test.style.visibility = "hidden";
    document.body.appendChild(test);
    const supported = test.scrollHeight >= 3;
    document.body.removeChild(test);
    return supported;
  } catch {
    return true;
  }
}

export function getLegacyCompatOverride(): LegacyCompatOverride {
  // URL param wins over persisted preference. Useful for hermetic e2e tests
  // (e.g. Playwright) that don't want to pollute localStorage.
  try {
    if (typeof location !== "undefined" && location.search) {
      const p = new URLSearchParams(location.search).get("legacyCompat");
      if (p === "on" || p === "off" || p === "auto") return p;
    }
  } catch {}
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    if (v === "on" || v === "off" || v === "auto") return v;
  } catch {}
  return "auto";
}

/**
 * Persist the user's choice and re-apply the compat layer immediately.
 * Returns the fresh report so the UI can reflect the new state.
 */
export function setLegacyCompatOverride(mode: LegacyCompatOverride): LegacyWebViewReport {
  try {
    if (mode === "auto") localStorage.removeItem(OVERRIDE_KEY);
    else localStorage.setItem(OVERRIDE_KEY, mode);
  } catch {}
  return applyLegacyWebViewCompat();
}

function removeLegacyLayer() {
  document.documentElement.removeAttribute(LEGACY_ATTR);
  document.documentElement.removeAttribute("data-legacy-no-flex-gap");
  const existing = document.getElementById(LEGACY_STYLE_ID);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

function injectLegacyStylesheet() {
  if (document.getElementById(LEGACY_STYLE_ID)) return;
  const css = `
/* === Legacy WebView (Chromium < 87) compatibility shims ============= */
html[${LEGACY_ATTR}] .inset-0     { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
html[${LEGACY_ATTR}] .inset-x-0   { left: 0 !important; right: 0 !important; }
html[${LEGACY_ATTR}] .inset-y-0   { top: 0 !important; bottom: 0 !important; }
html[${LEGACY_ATTR}] .-inset-0    { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
html[${LEGACY_ATTR}] .inset-auto  { top: auto !important; right: auto !important; bottom: auto !important; left: auto !important; }

html[${LEGACY_ATTR}] .after\\:inset-0::after   { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
html[${LEGACY_ATTR}] .after\\:inset-y-0::after { top: 0 !important; bottom: 0 !important; }
html[${LEGACY_ATTR}] .after\\:inset-x-0::after { left: 0 !important; right: 0 !important; }
html[${LEGACY_ATTR}] .before\\:inset-0::before { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }

html[${LEGACY_ATTR}] .aspect-square { position: relative; height: 0; padding-bottom: 100%; }
html[${LEGACY_ATTR}] .aspect-video  { position: relative; height: 0; padding-bottom: 56.25%; }

html[${LEGACY_ATTR}] body,
html[${LEGACY_ATTR}] #root {
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
`;
  const style = document.createElement("style");
  style.id = LEGACY_STYLE_ID;
  style.setAttribute("data-generated-by", "legacy-webview-compat");
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}

/**
 * Detect + apply the compatibility layer. Safe to call multiple times.
 * Honours the manual override stored in localStorage.
 */
export function applyLegacyWebViewCompat(): LegacyWebViewReport {
  const report: LegacyWebViewReport = {
    isLegacy: false,
    chromiumMajor: null,
    reasons: [],
    override: "auto",
    autoDetected: false,
  };

  if (typeof document === "undefined") return report;

  const chromiumMajor = detectChromiumMajor();
  report.chromiumMajor = chromiumMajor;
  report.override = getLegacyCompatOverride();

  // Automatic detection
  let autoDetected = false;
  const autoReasons: string[] = [];
  if (chromiumMajor !== null && chromiumMajor < 87) {
    autoDetected = true;
    autoReasons.push(`chromium=${chromiumMajor}`);
  }
  if (!supportsInsetShorthand()) {
    autoDetected = true;
    if (!autoReasons.includes("no-inset")) autoReasons.push("no-inset");
  }
  report.autoDetected = autoDetected;

  // Resolve final decision from override + auto detection
  let enabled: boolean;
  if (report.override === "on") { enabled = true; report.reasons.push("manual=on"); }
  else if (report.override === "off") { enabled = false; report.reasons.push("manual=off"); }
  else { enabled = autoDetected; report.reasons.push(...autoReasons); }

  report.isLegacy = enabled;

  if (!enabled) {
    removeLegacyLayer();
    (window as any).__LEGACY_WEBVIEW__ = report;
    return report;
  }

  // Enable the layer
  document.documentElement.setAttribute(LEGACY_ATTR, "1");

  let flexGapSupported = true;
  try { flexGapSupported = supportsFlexGap(); } catch {}
  if (!flexGapSupported) {
    document.documentElement.setAttribute("data-legacy-no-flex-gap", "1");
    if (!report.reasons.includes("no-flex-gap")) report.reasons.push("no-flex-gap");
  } else {
    document.documentElement.removeAttribute("data-legacy-no-flex-gap");
  }

  injectLegacyStylesheet();
  (window as any).__LEGACY_WEBVIEW__ = report;

  try {
    // eslint-disable-next-line no-console
    console.info("[legacy-webview] compat mode ON:", report.reasons.join(", "));
  } catch {}

  return report;
}
