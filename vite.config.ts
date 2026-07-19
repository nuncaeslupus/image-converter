/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/image-converter/" : "/",
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      // wasm isn't in workbox's default glob; the tracer won't work offline without it.
      workbox: { globPatterns: ["**/*.{js,css,html,svg,wasm,png}"] },
      manifest: {
        name: "Halftone — raster to SVG converter",
        short_name: "Halftone",
        description:
          "Free, browser-based raster-to-SVG converter. Runs entirely client-side — your images never leave your device.",
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
