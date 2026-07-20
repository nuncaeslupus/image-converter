/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/image-converter/" : "/",
  build: {
    // One HTML shell per language + page, so crawlers get each version at its
    // own URL (a client-side toggle can't change a crawler's view). Vite keeps
    // each input's directory in the output: es/index.html → dist/es/index.html
    // → served at /image-converter/es/. Language is read from the path at
    // runtime (see langFromPath).
    rollupOptions: {
      input: {
        main: "index.html",
        es: "es/index.html",
        faq: "faq/index.html",
        esFaq: "es/faq/index.html",
      },
    },
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // wasm isn't in workbox's default glob; the tracer won't work offline without it.
        globPatterns: ["**/*.{js,css,html,svg,wasm,png}"],
        // The SPA navigation fallback (index.html) otherwise swallows real
        // static files — a visitor whose SW is active who opens sitemap.xml /
        // robots.txt / a search-engine verification token gets the app shell
        // instead of the file. Every real page is a directory path (/, /es/,
        // /faq/…), so anything ending in a file extension is a static file:
        // deny it from the fallback so it resolves as itself (covers sitemap,
        // robots, and any engine's verification file — Google/Bing/Yandex/…).
        navigateFallbackDenylist: [/\.[a-z0-9]+$/i],
      },
      manifest: {
        name: "Halftone — Free Image to SVG Vectorizer",
        short_name: "Halftone",
        description:
          "Free, private image-to-SVG vectorizer that runs entirely in your browser. No ads, no upload, no sign-up.",
        theme_color: "#f2f5fa",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
}));
