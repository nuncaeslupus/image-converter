/**
 * Translates the product-facing {@link TraceParams} (paletteSize / smoothness /
 * detail / contrast — the four sliders in the tweak panel) into VTracer's native
 * converter config (see status/specification.md §6 risk row on param mapping).
 *
 * The product params are deliberately abstract so the UI never leaks VTracer's
 * vocabulary; this module is the single place that knows how each slider maps to
 * a native VTracer knob, and every output is clamped into VTracer's valid range
 * so a bad slider value can never produce an out-of-range config.
 */
import type { TraceParams } from "./traceProtocol";

/** VTracer's native converter config, matching `convert_rgba` in src/wasm. */
export interface VtracerConfig {
  colorMode: "color" | "binary";
  hierarchical: "stacked" | "cutout";
  mode: "spline" | "polygon" | "none";
  /** color bits per channel, 1-8 */
  colorPrecision: number;
  /** speckle filter size (px), >= 0 */
  filterSpeckle: number;
  /** min color diff between layers, 0-256 */
  layerDifference: number;
  /** corner detection angle (deg), 0-180 */
  cornerThreshold: number;
  /** min path segment length, >= 3.5 */
  lengthThreshold: number;
  /** spline splice angle (deg), 0-180 */
  spliceThreshold: number;
  /** curve-fitting iterations, >= 1 */
  maxIterations: number;
  /** SVG coordinate decimal places, 1-8 */
  pathPrecision: number;
}

/** Inclusive [min, max] bounds VTracer accepts for each numeric config field. */
export const VTRACER_RANGES = {
  colorPrecision: [1, 8],
  filterSpeckle: [0, 16],
  layerDifference: [0, 256],
  cornerThreshold: [0, 180],
  lengthThreshold: [3.5, 10],
  spliceThreshold: [0, 180],
  maxIterations: [1, 100],
  pathPrecision: [1, 8],
} as const;

function clampRound(value: number, [min, max]: readonly [number, number]): number {
  const rounded = Math.round(value);
  // A malformed/NaN slider value must not reach the WASM module; fall back to
  // the range floor rather than propagating NaN.
  return Number.isNaN(rounded) ? min : Math.min(max, Math.max(min, rounded));
}

/** Maps the four product sliders to a fully-valid native VTracer config. */
export function translateParams(params: TraceParams): VtracerConfig {
  const { paletteSize, smoothness, detail, contrast } = params;

  // paletteSize is now a LITERAL color count enforced by pre-quantizing the
  // RGBA before the trace (see lib/quantize.ts + traceRgba), not a VTracer
  // knob. This function only reflects that upstream choice into colorMode /
  // colorPrecision:
  //   1     -> binary mode: one thresholded black silhouette (the B&W case).
  //   >= 2  -> color mode at max precision (8), so VTracer preserves the
  //            already-reduced N-color palette instead of merging it further.
  //   auto  -> color mode at VTracer's default 6 bits, no pre-quantization.
  const isBinary = paletteSize === 1;
  const colorMode = isBinary ? "binary" : "color";
  const colorPrecision = paletteSize === "auto" ? 6 : isBinary ? 6 : 8;

  // Higher detail keeps smaller specks (lower filter) and finer coordinates.
  const filterSpeckle = clampRound(((100 - detail) / 100) * 16, VTRACER_RANGES.filterSpeckle);
  const pathPrecision = clampRound(1 + (detail / 100) * 7, VTRACER_RANGES.pathPrecision);

  // Higher smoothness treats wider angles as smooth (fewer corners).
  const cornerThreshold = clampRound((smoothness / 100) * 180, VTRACER_RANGES.cornerThreshold);

  // Contrast centers on VTracer's default layer difference (16) and widens/
  // narrows layer separation: higher contrast -> finer layers.
  const layerDifference = clampRound(16 - (contrast / 100) * 16, VTRACER_RANGES.layerDifference);

  return {
    colorMode,
    hierarchical: "stacked",
    mode: "spline",
    colorPrecision,
    filterSpeckle,
    layerDifference,
    cornerThreshold,
    lengthThreshold: 4.0,
    spliceThreshold: 45,
    maxIterations: 10,
    pathPrecision,
  };
}
