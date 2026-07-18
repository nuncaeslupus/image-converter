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

/** Long-edge cap for the trace pass, in pixels. Benchmarked to trace in well
 * under 1s even on dense/noisy content, leaving comfortable margin under the
 * 5s budget for decode + worker round-trip overhead. */
export const PREVIEW_MAX_DIMENSION = 768;

/** Computes the aspect-ratio-preserving size for `width`x`height` capped to
 * `maxDimension` on its longest edge. No-op (returns the input unchanged)
 * when already within the cap. */
export function computeDownscaledDimensions(
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
