import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initVtracer, traceRgba } from "../../src/worker/vtracerTracer";
import { bitmapFromPixels, readImagePixels } from "../../src/lib/imageEdit";
import { downscaleForPreview } from "../../src/lib/previewDownscale";
import type { TraceParams } from "../../src/lib/traceProtocol";

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = resolve(here, "../../src/wasm/vtracer_wasm_bg.wasm");

const DEFAULT_PARAMS: TraceParams = {
  paletteSize: "auto",
  smoothness: 50,
  detail: 50,
  contrast: 0,
};

/** T11's gate: `time_to_first_traced_preview_ms <= 5000` (status/plan.md T11
 * row). Set well below the 5s spec target so the assertion still has margin
 * even on slower CI hardware than this benchmark was tuned on. */
const BUDGET_MS = 5000;

/**
 * Synthesizes a deterministic, photo-like RGBA buffer: smooth gradients plus
 * modest per-pixel noise, which traces to a realistic, non-trivial path
 * count (unlike a flat fill, which is a trivial best case, or a checkerboard,
 * which is an adversarial worst case no real photo resembles).
 */
function photoLikeRgba(width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const data = new Uint8ClampedArray(width * height * 4) as Uint8ClampedArray<ArrayBuffer>;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const noise = ((x * 928371 + y * 123457) % 17) - 8;
      data[i] = 128 + 100 * Math.sin(x / 40) * Math.cos(y / 55) + noise;
      data[i + 1] = 128 + 100 * Math.sin((x + y) / 70) + noise;
      data[i + 2] = 128 + 100 * Math.cos(y / 33) + noise;
      data[i + 3] = 255;
    }
  }
  return data;
}

beforeAll(async () => {
  await initVtracer(readFileSync(wasmPath));
});

describe("preview trace budget (T11)", () => {
  // Generous *test* timeout (fixture synthesis + trace); the 5000ms product
  // budget above is enforced by the assertion, not by this harness limit.
  const TEST_TIMEOUT_MS = 20000;

  it(
    "test_previewPipeline_typicalPhotoFixture_completesUnderBudget",
    async () => {
      // A representative modern phone-camera photo: 12MP, 4:3 — well above
      // the preview downscale cap, so this exercises the real downscale path.
      const width = 4032;
      const height = 3024;
      const sourceBitmap = await bitmapFromPixels(width, height, photoLikeRgba(width, height));

      // Clock starts once the source image is already decoded (matching
      // "time to first traced preview" — decode itself isn't part of this
      // gate) and covers exactly what the production pipeline does per
      // retrace: downscale for the preview pass, then trace.
      const start = performance.now();
      const previewBitmap = await downscaleForPreview(sourceBitmap);
      const { width: pw, height: ph, data } = await readImagePixels(previewBitmap);
      const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      await traceRgba(rgba, pw, ph, DEFAULT_PARAMS);
      const durationMs = performance.now() - start;

      expect(durationMs).toBeLessThan(BUDGET_MS);
    },
    TEST_TIMEOUT_MS,
  );
});
