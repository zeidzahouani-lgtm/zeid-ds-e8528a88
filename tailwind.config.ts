import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.5" }],
        sm: ["0.9rem", { lineHeight: "1.55" }],
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.125rem", { lineHeight: "1.5" }],
        xl: ["1.25rem", { lineHeight: "1.4" }],
        "2xl": ["1.5rem", { lineHeight: "1.35" }],
        "3xl": ["1.875rem", { lineHeight: "1.3" }],
        "4xl": ["2.25rem", { lineHeight: "1.2" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        status: {
          online: "hsl(var(--status-online))",
          offline: "hsl(var(--status-offline))",
        },
        surface: {
          elevated: "hsl(var(--surface-elevated))",
        },
        neon: {
          cyan: "hsl(var(--accent))",
          violet: "hsl(var(--primary))",
          pink: "hsl(var(--accent))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      spacing: {
        "4.5": "1.125rem",
        "18": "4.5rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      boxShadow: {
        "soft": "0 1px 3px hsl(220 20% 50% / 0.06), 0 4px 16px hsl(220 20% 50% / 0.04)",
        "soft-md": "0 2px 8px hsl(220 20% 50% / 0.08), 0 8px 24px hsl(220 20% 50% / 0.05)",
        "soft-lg": "0 4px 12px hsl(220 20% 50% / 0.1), 0 16px 40px hsl(220 20% 50% / 0.06)",
        "neon-cyan": "0 0 16px hsl(174 55% 48% / 0.15), 0 0 32px hsl(174 55% 48% / 0.06)",
        "neon-violet": "0 0 16px hsl(210 85% 55% / 0.15), 0 0 32px hsl(210 85% 55% / 0.06)",
        "neon-pink": "0 0 16px hsl(174 55% 48% / 0.15), 0 0 32px hsl(174 55% 48% / 0.06)",
        "glass": "0 4px 24px hsl(220 20% 50% / 0.08), inset 0 1px 0 hsl(0 0% 100% / 0.5)",
        "glass-lg": "0 8px 32px hsl(220 20% 50% / 0.1), inset 0 1px 0 hsl(0 0% 100% / 0.5)",
        "glow-blue": "0 0 20px hsl(210 85% 55% / 0.18), 0 0 40px hsl(210 85% 55% / 0.08)",
        "glow-cyan": "0 0 20px hsl(174 60% 45% / 0.18), 0 0 40px hsl(174 60% 45% / 0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
