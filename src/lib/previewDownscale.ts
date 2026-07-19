/**
 * Preview-pass downscaling (T11 — see status/plan.md "Data flow" step 4 and
 * status/specification.md §6 risk row on large images freezing the tab).
 *
 * VTracer's cost scales with pixel count, so tracing a full-resolution
 * camera/phone photo (often 8-48MP) blows the `time_to_first_traced_preview
 * <= ~5s` budget by an order of magnitude. Capping the long edge before the
 * trace keeps every retrace comfortably inside budget, reusing the existing,
 * already-tested `resizeImage` from `imageEdit.ts` rather than a new resize
 * implementation.
 */
import { resizeImage } from "./imageEdit";

/** Long-edge cap for the trace pass, in pixels. Benchmarked against the real
 * VTracer WASM engine (`tests/perf/previewBudget.test.ts`) to trace in under
 * 1s even on dense/noisy content — comfortable margin under the 5s budget
 * once CI-hardware slowdown and decode/worker round-trip overhead are added.
 * (768 measured ~2x too close to budget on CI; 512 roughly halves the traced
 * pixel count and restores real headroom — also directly narrows the §6 risk
 * of large images freezing the tab on low-end/mobile devices.) */
export const PREVIEW_MAX_DIMENSION = 512;

/** Long-edge cap for the one-off full-resolution export trace (ExportStep). Far
 * above the preview cap, so any realistic photo still exports at (near-)source
 * resolution, but bounds the worst case: an unbounded trace of a 100MP source
 * allocates hundreds of MB of RGBA in the worker and can OOM/hang the tab. The
 * 25MB input cap does not bound pixel dimensions, so this is the real ceiling. */
export const EXPORT_MAX_DIMENSION = 4096;

/** Computes the aspect-ratio-preserving size for `width`x`height` capped to
 * `maxDimension` on its longest edge. No-op (returns the input unchanged)
 * when already within the cap. */
function computeDownscaledDimensions(
  width: number,
  height: number,
  maxDimension: number = PREVIEW_MAX_DIMENSION,
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Whether a `width`x`height` source needs a separate full-resolution export
 * trace (T-full-res-export). When the source's long edge is already within
 * the preview cap, the preview trace already ran at full resolution, so
 * re-tracing for export would just repeat the same work.
 */
export function needsFullResRetrace(
  width: number,
  height: number,
  maxDimension: number = PREVIEW_MAX_DIMENSION,
): boolean {
  return Math.max(width, height) > maxDimension;
}

/** Downscales `bitmap` to fit within `maxDimension` on its longest edge,
 * preserving aspect ratio. A no-op that returns `bitmap` unchanged when it is
 * already within the cap (the common case for icons/small images). Closes
 * the input bitmap when it does replace it, matching `imageEdit.ts`'s
 * "caller owns the returned bitmap" convention. */
export async function downscaleForPreview(
  bitmap: ImageBitmap,
  maxDimension: number = PREVIEW_MAX_DIMENSION,
): Promise<ImageBitmap> {
  const target = computeDownscaledDimensions(bitmap.width, bitmap.height, maxDimension);
  if (target.width === bitmap.width && target.height === bitmap.height) {
    return bitmap;
  }
  const resized = await resizeImage(bitmap, target.width, target.height);
  bitmap.close();
  return resized;
}
