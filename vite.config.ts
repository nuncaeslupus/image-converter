/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/image-converter/" : "/",
  plugins: [preact()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
}));
