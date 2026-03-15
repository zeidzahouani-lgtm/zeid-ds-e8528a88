import { useEffect } from "react";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useEstablishmentSettings } from "@/hooks/useEstablishmentSettings";

/**
 * Applies establishment-specific branding (colors, font, logo) to the DOM
 * when a non-global-admin is connected to an establishment.
 */
export function useEstablishmentBranding() {
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();
  const { settings, getSetting } = useEstablishmentSettings(currentEstablishmentId);

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

    // Convert hex to HSL for CSS variables
    function hexToHsl(hex: string): string | null {
      if (!hex || !hex.startsWith("#")) return null;
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

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    }

    // Apply colors
    if (brandColor) {
      const hsl = hexToHsl(brandColor);
      if (hsl) {
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--ring", hsl);
        root.style.setProperty("--sidebar-primary", hsl);
        root.style.setProperty("--sidebar-ring", hsl);
        root.style.setProperty("--neon-cyan", hsl);
        root.style.setProperty("--neon-cyan-glow", hsl);
      }
    }

    if (accentColor) {
      const hsl = hexToHsl(accentColor);
      if (hsl) {
        root.style.setProperty("--accent", hsl);
        root.style.setProperty("--sidebar-accent", hsl);
        root.style.setProperty("--neon-violet", hsl);
        root.style.setProperty("--neon-violet-glow", hsl);
      }
    }

    if (bgColor) {
      const hsl = hexToHsl(bgColor);
      if (hsl) {
        root.style.setProperty("--background", hsl);
      }
    }

    if (textColor) {
      const hsl = hexToHsl(textColor);
      if (hsl) {
        root.style.setProperty("--foreground", hsl);
      }
    }

    // Apply font
    if (fontFamily) {
      // Load Google Font dynamically
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

    // Apply favicon
    if (faviconUrl) {
      let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = faviconUrl;
    }

    // Apply page title
    if (brandName) {
      document.title = `${brandName} — Dashboard`;
    }

    // Cleanup: reset to defaults when switching establishments
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-ring");
      root.style.removeProperty("--neon-cyan");
      root.style.removeProperty("--neon-cyan-glow");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--sidebar-accent");
      root.style.removeProperty("--neon-violet");
      root.style.removeProperty("--neon-violet-glow");
      root.style.removeProperty("--background");
      root.style.removeProperty("--foreground");
      root.style.removeProperty("--font-sans");
      document.body.style.fontFamily = "";
    };
  }, [settings, currentEstablishmentId, isGlobalAdmin, getSetting]);
}
