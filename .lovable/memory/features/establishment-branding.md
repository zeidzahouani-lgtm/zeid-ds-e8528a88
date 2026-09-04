---
name: Establishment Branding
description: Custom brand colors must respect the active app theme — dark brand bg only in dark mode, light brand bg only in light mode
type: feature
---
Establishment branding (`useEstablishmentBranding.ts`) applies brand colors inline on `:root`.
**Rule:** the app theme always wins over `brand_bg_color`. Derive the background palette only when `brandIsDark === (theme === 'dark')`; otherwise skip the background override and keep the default theme palette. Primary/accent brand colors still apply in both modes.
**Why:** Marriott's dark brand bg turned the whole light-mode UI black and unreadable for non-admin users.
