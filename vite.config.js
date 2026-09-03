import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  /*
   * If you deploy to a subpath — e.g. codeberg.page/you/arabic-trainer —
   * set this to "/arabic-trainer/". For a root domain, leave it as "/".
   */
  base: "/",

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-512.png"],
      manifest: {
        name: "Taleb33",
        short_name: "Taleb33",
        description: "Spaced repetition for language learning.",
        theme_color: "#141A2A",
        background_color: "#141A2A",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Everything is static, so cache the lot and run fully offline.
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        // Never let the offline shell answer a sync request.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
