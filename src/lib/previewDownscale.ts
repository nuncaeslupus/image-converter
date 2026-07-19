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

/** Long-edge cap for the color trace pass, in pixels. This is now the SINGLE
 * resolution used for both the Trace preview and the exported file — Export
 * reuses the preview SVG verbatim rather than re-tracing at full resolution, so
 * what you tweak is exactly what you download (no preview↔export mismatch).
 *
 * The cap is the ceiling that keeps even a worst-case noisy 12MP photo inside
 * the ~5s preview budget (`tests/perf/previewBudget.test.ts`): a full-color
 * trace's cost explodes super-linearly with resolution on noisy content (768
 * measured ~7.4s, 1024 ~20s — both would freeze the tab), so 640 is the
 * highest value with real headroom. Flat graphics trace far faster than this
 * bound, so they get the full benefit; a genuine photo is the pathological case
 * this guards. B&W is exempt — it's pre-binarized to one color and stays cheap
 * at {@link BW_PREVIEW_MAX_DIMENSION}. */
export const PREVIEW_MAX_DIMENSION = 640;

/** Long-edge cap for the black-&-white preview trace. B&W is pre-binarized to a
 * single color, so VTracer emits very few paths and tracing stays cheap even at
 * a much higher resolution than the full-color cap — which is what a crisp,
 * precise silhouette contour needs (the 512 cap softens edges into a wobble).
 * Colored palettes keep {@link PREVIEW_MAX_DIMENSION} for speed. */
export const BW_PREVIEW_MAX_DIMENSION = 1536;

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
