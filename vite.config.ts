import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Register the service worker ourselves (see src/main.tsx) so we can
      // also show an inline "online / offline" status in the app.
      injectRegister: null,
      includeAssets: [
        "favicon.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        name: "آکادمی ایلیت | Elite AI Academy",
        short_name: "آکادمی ایلیت",
        description:
          "مسیر تعاملی یادگیری هوش مصنوعی — درس‌های ویدئویی و متنی، تمرین، آزمون، کوییز و کامیونیتی",
        lang: "fa",
        dir: "rtl",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        theme_color: "#FFFFFF",
        background_color: "#F2F3F5",
        categories: ["education", "productivity"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Everything the app shell needs — JS/CSS (which embed the full text of
        // every lesson), fonts and icons — is precached, so the whole learning
        // path works offline once visited at least once.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Paid videos stream through the signed-URL edge function — never cache.
            urlPattern: /supabase\.co\/.*/i,
            handler: "NetworkOnly",
          },
          {
            // Demo lesson video: available offline after first play.
            urlPattern: /demo-lesson\.mp4$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "eaa-videos",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // keep the dev server free of service-worker caching
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
