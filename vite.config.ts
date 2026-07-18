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
      workbox: { globPatterns: ["**/*.{js,css,html,svg,wasm}"] },
      manifest: {
        name: "image-converter — raster to SVG",
        short_name: "image-converter",
        description: "Free, browser-based raster-to-SVG converter. Everything runs client-side.",
        theme_color: "#ffffff",
        icons: [],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
}));
