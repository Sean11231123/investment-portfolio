import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.NODE_ENV === "production" ? "/investment-portfolio/" : "/";
const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default defineConfig({
  // If the repository name is different, update this base path.
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["pwa-icon.svg"],
      manifest: {
        name: "Investment Portfolio",
        short_name: "Portfolio",
        description: "Local-first investment portfolio tracker",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          {
            src: "pwa-icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: new RegExp(`${escapedBase}data/.*\\.json$`),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "portfolio-static-data",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
});