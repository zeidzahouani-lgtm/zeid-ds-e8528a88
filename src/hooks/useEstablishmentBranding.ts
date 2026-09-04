import { useEffect } from "react";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useEstablishmentSettings } from "@/hooks/useEstablishmentSettings";
import { useTheme } from "@/contexts/ThemeContext";

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const hslStr = (h: number, s: number, l: number) =>
  `${h} ${s}% ${Math.max(0, Math.min(100, l))}%`;

const BRAND_VARS = [
  "--primary", "--ring", "--sidebar-primary", "--sidebar-ring",
  "--accent", "--sidebar-accent",
  "--background", "--foreground",
  "--card", "--card-foreground", "--popover", "--popover-foreground",
  "--secondary", "--secondary-foreground",
  "--muted", "--muted-foreground",
  "--border", "--input",
  "--sidebar-background", "--sidebar-foreground", "--sidebar-border",
  "--gradient-start", "--gradient-end",
  "--font-sans",
];

/**
 * Applies establishment-specific branding (colors, font, logo) to the DOM
 * when a non-global-admin is connected to an establishment.
 *
 * Contrast-safe: when a custom background color is set, a full derived
 * palette (cards, popovers, borders, foreground) is generated from it so
 * fields never end up dark-on-dark or light-on-light, in either theme.
 * The palette is re-derived whenever the app theme changes.
 */
export function useEstablishmentBranding() {
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();
  const { settings, getSetting } = useEstablishmentSettings(currentEstablishmentId);
  const { theme } = useTheme();

  useEffect(() => {
    // Only apply for establishment users, not global admins
    if (isGlobalAdmin || !currentEstablishmentId || settings.length === 0) return;

    const root = document.documentElement;

    const brandColor = getSetting("brand_color");
    const accentColor = getSetting("brand_accent_color");
    const bgColor = getSetting("brand_bg_color");
    const textColor = getSetting("brand_text_color");
    const fontFamily = getSetting("brand_font");
    const faviconUrl = getSetting("brand_favicon_url");
    const brandName = getSetting("brand_name");

    // --- Primary / accent ---
    if (brandColor) {
      const c = hexToHsl(brandColor);
      if (c) {
        const hsl = hslStr(c.h, c.s, c.l);
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--ring", hsl);
        root.style.setProperty("--sidebar-primary", hsl);
        root.style.setProperty("--sidebar-ring", hsl);
        root.style.setProperty("--gradient-start", hsl);
      }
    }

    if (accentColor) {
      const c = hexToHsl(accentColor);
      if (c) {
        const hsl = hslStr(c.h, c.s, c.l);
        root.style.setProperty("--accent", hsl);
        root.style.setProperty("--sidebar-accent", hsl);
        root.style.setProperty("--gradient-end", hsl);
      }
    }

    // --- Background: derive a full contrast-safe palette ---
    if (bgColor) {
      const c = hexToHsl(bgColor);
      if (c) {
        const dark = c.l < 50;
        const fg = dark ? hslStr(220, 15, 93) : hslStr(222, 32, 12);
        const mutedFg = dark ? hslStr(220, 12, 66) : hslStr(220, 12, 42);
        const lift = (dl: number, ds = 0) =>
          hslStr(c.h, Math.max(0, c.s + ds), c.l + dl);

        root.style.setProperty("--background", hslStr(c.h, c.s, c.l));
        root.style.setProperty("--foreground", fg);
        root.style.setProperty("--card", lift(dark ? 4 : 3));
        root.style.setProperty("--card-foreground", fg);
        root.style.setProperty("--popover", lift(dark ? 5 : 4));
        root.style.setProperty("--popover-foreground", fg);
        root.style.setProperty("--secondary", lift(dark ? 7 : -3));
        root.style.setProperty("--secondary-foreground", fg);
        root.style.setProperty("--muted", lift(dark ? 5 : -2));
        root.style.setProperty("--muted-foreground", mutedFg);
        root.style.setProperty("--border", lift(dark ? 11 : -8));
        root.style.setProperty("--input", lift(dark ? 11 : -8));
        root.style.setProperty("--sidebar-background", lift(dark ? -2 : 2));
        root.style.setProperty("--sidebar-foreground", dark ? hslStr(220, 14, 78) : hslStr(220, 22, 32));
        root.style.setProperty("--sidebar-border", lift(dark ? 7 : -6));

        // Custom text color only if it keeps enough contrast vs the card color
        const t = textColor ? hexToHsl(textColor) : null;
        if (t) {
          const cardL = dark ? c.l + 4 : c.l + 3;
          if (Math.abs(t.l - cardL) >= 45) {
            root.style.setProperty("--foreground", hslStr(t.h, t.s, t.l));
            root.style.setProperty("--card-foreground", hslStr(t.h, t.s, t.l));
            root.style.setProperty("--popover-foreground", hslStr(t.h, t.s, t.l));
          }
        }
      }
    }

    // --- Font ---
    if (fontFamily) {
      const linkId = "est-brand-font";
      let link = document.getElementById(linkId) as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700&display=swap`;
      root.style.setProperty("--font-sans", `"${fontFamily}", sans-serif`);
      document.body.style.fontFamily = `"${fontFamily}", sans-serif`;
    }

    // --- Favicon ---
    if (faviconUrl) {
      let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = faviconUrl;
    }

    // --- Page title ---
    if (brandName) {
      document.title = `${brandName} — Dashboard`;
    }

    // Cleanup: reset all overrides when switching establishments / unmounting
    return () => {
      for (const v of BRAND_VARS) root.style.removeProperty(v);
      document.body.style.fontFamily = "";
    };
    // theme is a dependency: palette is re-derived on light/dark toggle
  }, [settings, currentEstablishmentId, isGlobalAdmin, getSetting, theme]);
}
