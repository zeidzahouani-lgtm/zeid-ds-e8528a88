import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";

const LEGACY_BROWSER_TARGET = "es2015";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    target: LEGACY_BROWSER_TARGET,
    cssTarget: "chrome49",
  },
  esbuild: {
    target: LEGACY_BROWSER_TARGET,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Génère un bundle secondaire (nomodule) polyfillé pour les vieux
    // WebViews Android (box TV bloquées sur Android 4.4 - 6, Chrome 40 - 55).
    // Le navigateur moderne charge le bundle module, le vieux charge le legacy.
    legacy({
      targets: [
        "Android >= 4.4",
        "Chrome >= 40",
        "Safari >= 10",
        "Firefox >= 45",
        "ie >= 11",
      ],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
    esbuildOptions: {
      target: LEGACY_BROWSER_TARGET,
    },
  },
}));
