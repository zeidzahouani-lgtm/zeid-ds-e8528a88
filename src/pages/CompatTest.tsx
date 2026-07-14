/**
 * Synthetic layout used by Playwright compatibility tests
 * (see tests/e2e/player-compat.spec.ts).
 *
 * The Player relies on three fragile primitives on legacy WebViews:
 *   1. Absolute/fixed positioning with `inset: 0` (or Tailwind `.inset-0`)
 *   2. `aspect-ratio` / `aspect-video`
 *   3. Full-viewport fixed overlays (loading / error / QR fallback)
 *
 * This page renders all three at a known viewport (1280x1800 in tests) with
 * stable `data-testid` selectors so the e2e tests can measure bounding boxes
 * and detect regressions of the legacy WebView compat layer.
 *
 * Route: /__compat-test  (public, no auth)
 */
export default function CompatTest() {
  return (
    <div
      data-testid="root"
      style={{ width: "100vw", height: "100vh", position: "relative", margin: 0, background: "#000" }}
    >
      {/* 1. Absolute + Tailwind .inset-0 → must fill the parent (relative root) */}
      <div
        data-testid="inset-tailwind"
        className="absolute inset-0"
        style={{ background: "rgba(255,0,0,0.4)" }}
      />

      {/* 2. Absolute + inline `inset: 0` shorthand → same expected box */}
      <div
        data-testid="inset-inline"
        style={{ position: "absolute", inset: 0, background: "rgba(0,255,0,0.4)" }}
      />

      {/* 3. Absolute + explicit longhand top/right/bottom/left → baseline */}
      <div
        data-testid="inset-longhand"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,255,0.4)" }}
      />

      {/* 4. Aspect-video 16:9 wrapper inside a 640px-wide container */}
      <div style={{ position: "absolute", top: 20, left: 20, width: 640 }}>
        <div
          data-testid="aspect-video"
          className="aspect-video"
          style={{ width: "100%", background: "#333" }}
        />
      </div>

      {/* 5. Fixed overlay filling the viewport (mimics loading/error screens) */}
      <div
        data-testid="fixed-overlay"
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)", zIndex: 50 }}
      >
        <span data-testid="fixed-overlay-label" style={{ color: "#fff" }}>overlay</span>
      </div>
    </div>
  );
}
