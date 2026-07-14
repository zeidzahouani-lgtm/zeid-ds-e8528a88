/**
 * Legacy WebView compatibility layer.
 *
 * Detects old Chromium/WebView (typically Android TV boxes stuck on Chrome 80,
 * e.g. X96Q_PRO1) and injects CSS shims for properties that were added after
 * Chrome 87 but that Tailwind / our inline styles rely on.
 *
 * Executed once, as early as possible (from main.tsx).
 */

const LEGACY_STYLE_ID = "legacy-webview-shim";
const LEGACY_ATTR = "data-legacy-webview";

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
  // Fallback feature test
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
    const supported = test.scrollHeight >= 3; // 2 zero-height children + 1px gap
    document.body.removeChild(test);
    return supported;
  } catch {
    return true;
  }
}

export interface LegacyWebViewReport {
  isLegacy: boolean;
  chromiumMajor: number | null;
  reasons: string[];
}

/**
 * Detect & apply the compatibility layer.
 * Safe to call multiple times; only runs once per document.
 */
export function applyLegacyWebViewCompat(): LegacyWebViewReport {
  const report: LegacyWebViewReport = {
    isLegacy: false,
    chromiumMajor: null,
    reasons: [],
  };

  if (typeof document === "undefined") return report;

  const chromiumMajor = detectChromiumMajor();
  report.chromiumMajor = chromiumMajor;

  if (chromiumMajor !== null && chromiumMajor < 87) {
    report.isLegacy = true;
    report.reasons.push(`chromium<${chromiumMajor}`);
  }
  if (!supportsInsetShorthand()) {
    report.isLegacy = true;
    if (!report.reasons.includes("no-inset")) report.reasons.push("no-inset");
  }

  if (!report.isLegacy) return report;

  // Mark the document so app code / dev tools can react.
  document.documentElement.setAttribute(LEGACY_ATTR, "1");

  // Optional: flex-gap fallback flag (only tested when legacy is already on)
  let flexGapSupported = true;
  try {
    flexGapSupported = supportsFlexGap();
  } catch {}
  if (!flexGapSupported) {
    document.documentElement.setAttribute("data-legacy-no-flex-gap", "1");
    report.reasons.push("no-flex-gap");
  }

  // Inject the shim stylesheet once.
  if (document.getElementById(LEGACY_STYLE_ID)) return report;

  const css = `
/* === Legacy WebView (Chromium < 87) compatibility shims ============= */
/* The 'inset' shorthand was added in Chrome 87. Tailwind's inset-0
   utilities emit 'inset: 0px' which is silently ignored on Chrome 80,
   collapsing every absolute/fixed overlay to 0x0. We restore them here. */
html[${LEGACY_ATTR}] .inset-0     { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
html[${LEGACY_ATTR}] .inset-x-0   { left: 0 !important; right: 0 !important; }
html[${LEGACY_ATTR}] .inset-y-0   { top: 0 !important; bottom: 0 !important; }
html[${LEGACY_ATTR}] .-inset-0    { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
html[${LEGACY_ATTR}] .inset-auto  { top: auto !important; right: auto !important; bottom: auto !important; left: auto !important; }

/* Some Radix / shadcn variants use ::after with inset shortcuts */
html[${LEGACY_ATTR}] .after\\:inset-0::after   { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
html[${LEGACY_ATTR}] .after\\:inset-y-0::after { top: 0 !important; bottom: 0 !important; }
html[${LEGACY_ATTR}] .after\\:inset-x-0::after { left: 0 !important; right: 0 !important; }
html[${LEGACY_ATTR}] .before\\:inset-0::before { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }

/* aspect-ratio (Chrome 88+) — provide a padding-hack fallback for the
   most common Tailwind ratios. Elements need position:relative + a child. */
html[${LEGACY_ATTR}] .aspect-square { position: relative; height: 0; padding-bottom: 100%; }
html[${LEGACY_ATTR}] .aspect-video  { position: relative; height: 0; padding-bottom: 56.25%; }

/* Force GPU compositing on the fullscreen player container to avoid
   sub-pixel gaps and repaint artifacts on old ARM WebViews. */
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

  // Expose for the diagnostic overlay
  (window as any).__LEGACY_WEBVIEW__ = report;

  // Console breadcrumb (kept minimal to avoid log spam on TV consoles)
  try {
    // eslint-disable-next-line no-console
    console.info("[legacy-webview] compat mode enabled:", report.reasons.join(", "));
  } catch {}

  return report;
}
