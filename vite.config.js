import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

import { appVersion } from "./scripts/version.mjs";

/* Read once, so every part of one build agrees about which build it is. */
const VERSION = appVersion();

/*
 * The same fact in two places, deliberately.
 *
 * __APP_VERSION__ is frozen into the JavaScript, so a browser running a
 * bundle reports the build that bundle came from — which, for an installed
 * app holding a precached copy, is not necessarily the build on the server.
 * version.json sits in dist and is read fresh by the server.
 *
 * The gap between the two is the useful part: it is how the app can tell
 * you a deploy landed but you are still looking at the old one.
 */
function emitVersion() {
  return {
    name: "taleb33-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(VERSION, null, 2) + "\n",
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(VERSION.commit),
    __BUILT_AT__: JSON.stringify(VERSION.builtAt),
  },

  /*
   * If you deploy to a subpath — e.g. codeberg.page/you/arabic-trainer —
   * set this to "/arabic-trainer/". For a root domain, leave it as "/".
   */
  base: "/",

  plugins: [
    react(),
    emitVersion(),
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
