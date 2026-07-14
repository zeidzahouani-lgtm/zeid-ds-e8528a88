# Player compatibility e2e tests

Playwright suite that guards the Player against CSS regressions on legacy
WebViews (Android TV boxes stuck on Chromium 80, e.g. X96Q_PRO1).

## What it covers

The `/__compat-test` route renders the three primitives the Player relies on:

1. `position: absolute; inset: 0` — shorthand + Tailwind `.inset-0` + longhand
2. `.aspect-video` (16:9)
3. `position: fixed` full-viewport overlays

Each primitive is verified in two modes:

- **Modern** (`?legacyCompat=off`) — the compat layer is disabled and native CSS
  must fill the box.
- **Legacy forced ON** (`?legacyCompat=on`) — the compat layer from
  `src/lib/legacy-webview.ts` must remap `.inset-0` and `.aspect-video` to
  legacy-safe longhand / `padding-bottom` and still yield the same bounding box.

A regression here = a black or broken Player screen on old Android boxes.

## Running

```bash
npm run dev            # Vite on :8080
npm run test:e2e       # runs the suite
npm run test:e2e:ui    # Playwright inspector
```

Point at a preinstalled Chromium (e.g. CI / sandbox where
`npx playwright install` isn't available):

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome npm run test:e2e
```

Point at a deployed environment:

```bash
PLAYWRIGHT_BASE_URL=https://preview.example.com npm run test:e2e
```

## Extending

Add a new fragile primitive to `src/pages/CompatTest.tsx` with a stable
`data-testid`, then add measurement assertions in
`tests/e2e/player-compat.spec.ts` for both modes.
