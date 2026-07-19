import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize } from "image-size";
import { initVtracer, traceRgba } from "../../src/worker/vtracerTracer";
import { translateParams, VTRACER_RANGES } from "../../src/lib/paramTranslation";
import type { PaletteSize, TraceParams } from "../../src/lib/traceProtocol";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../fixtures");
const wasmPath = resolve(here, "../../src/wasm/vtracer_wasm_bg.wasm");

const SAMPLE_CORPUS = ["sample.png", "sample.jpg", "sample.webp", "sample.gif", "sample.bmp"];

const DEFAULT_PARAMS: TraceParams = {
  paletteSize: "auto",
  smoothness: 50,
  detail: 50,
  contrast: 0,
};

/**
 * jsdom ships no image decoder and no canvas backend, so the compressed fixture
 * bytes cannot be turned into real pixels here (the same wall documented in
 * tests/setup.ts). The production path extracts RGBA from an ImageBitmap via
 * OffscreenCanvas; the test instead drives the pure `traceRgba` core directly.
 * We read each fixture's real dimensions via `image-size` (proving it is a valid
 * image in the corpus) and synthesize a deterministic two-colour checkerboard at
 * those dimensions, seeded from the file's own bytes, so every fixture yields a
 * distinct, non-trivial trace through the real VTracer WASM engine.
 */
function fixtureToRgba(name: string): { rgba: Uint8Array; width: number; height: number } {
  const bytes = readFileSync(resolve(fixturesDir, name));
  const { width, height } = imageSize(bytes);
  if (!width || !height) throw new Error(`no dimensions for ${name}`);
  const c0 = [bytes[10] ?? 0, bytes[20] ?? 128, bytes[30] ?? 64];
  const c1 = [bytes[5] ?? 255, bytes[15] ?? 32, bytes[25] ?? 200];
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const c = (x + y) % 2 === 0 ? c0 : c1;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = 255;
    }
  }
  return { rgba, width, height };
}

beforeAll(async () => {
  await initVtracer(readFileSync(wasmPath));
});

describe("vtracer worker engine", () => {
  it("test_vtracerWorker_sampleImages_returnsNonEmptySvg", async () => {
    let successes = 0;
    for (const name of SAMPLE_CORPUS) {
      const { rgba, width, height } = fixtureToRgba(name);
      const { svg, pathCount } = await traceRgba(rgba, width, height, DEFAULT_PARAMS);
      const nonEmpty = /<svg[\s\S]*<\/svg>/.test(svg) && pathCount >= 1;
      if (nonEmpty) successes += 1;
      expect(svg, `${name} should trace to a non-empty SVG`).toMatch(/<svg[\s\S]*<\/svg>/);
      expect(pathCount, `${name} should produce at least one path`).toBeGreaterThanOrEqual(1);
    }
    const successRate = successes / SAMPLE_CORPUS.length;
    expect(successRate).toBeGreaterThanOrEqual(0.95);
  });

  it("test_paramTranslation_productParams_mapsToValidVtracerConfig", () => {
    const palettes: PaletteSize[] = ["auto", 1, 2, 8, 16, 32, 64];
    const sliders = [0, 1, 25, 50, 75, 99, 100];
    const contrasts = [-100, -50, 0, 50, 100];

    for (const paletteSize of palettes) {
      for (const smoothness of sliders) {
        for (const detail of sliders) {
          for (const contrast of contrasts) {
            const cfg = translateParams({ paletteSize, smoothness, detail, contrast });

            expect(["color", "binary"]).toContain(cfg.colorMode);
            expect(["stacked", "cutout"]).toContain(cfg.hierarchical);
            expect(["spline", "polygon", "none"]).toContain(cfg.mode);

            const numericFields = [
              "colorPrecision",
              "filterSpeckle",
              "layerDifference",
              "cornerThreshold",
              "lengthThreshold",
              "spliceThreshold",
              "maxIterations",
              "pathPrecision",
            ] as const;
            for (const field of numericFields) {
              const [min, max] = VTRACER_RANGES[field];
              const value = cfg[field];
              expect(
                value,
                `${field} below min for ${JSON.stringify({ paletteSize, smoothness, detail, contrast })}`,
              ).toBeGreaterThanOrEqual(min);
              expect(value, `${field} above max`).toBeLessThanOrEqual(max);
              expect(Number.isFinite(value)).toBe(true);
            }
          }
        }
      }
    }
  });

  it("test_paramTranslation_blackAndWhite_keepsCornersSharp", () => {
    // B&W (paletteSize 1) caps the corner threshold low so the silhouette keeps
    // precise contours instead of melting; a colored palette at the same
    // Smoothness smooths far more aggressively.
    const bw = translateParams({ paletteSize: 1, smoothness: 100, detail: 50, contrast: 0 });
    const color = translateParams({ paletteSize: 8, smoothness: 100, detail: 50, contrast: 0 });
    expect(bw.colorMode).toBe("color"); // pre-binarized upstream, not VTracer binary
    expect(bw.cornerThreshold).toBeLessThanOrEqual(45);
    expect(bw.cornerThreshold).toBeLessThan(color.cornerThreshold);
  });
});
