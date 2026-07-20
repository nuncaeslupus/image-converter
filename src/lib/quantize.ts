/**
 * Color reduction for the "Colors" control — reduces an RGBA image to a literal
 * palette of N colors (or to black & white for N=1). VTracer has no "exactly N
 * colors" knob, so the count is enforced here, before the trace: the worker
 * snaps pixels with {@link quantizeRgba} / {@link binarizeToBlack}, and the
 * tweak panel draws each palette row's swatches with {@link medianCutPalette}.
 * One shared core, so the previewed colors match the traced result.
 *
 * Two deliberate choices, both driven by what a legible *vector* wants and by
 * how the palette reads to a user:
 *
 *  - **Population-independent clustering.** Classic median cut splits at the
 *    pixel-count median, so a large flat background devours the palette budget
 *    and small salient accents (a logo dot) don't get their own color until N
 *    is large. We cluster over *distinct* colors instead, so a small-but-
 *    distinct accent claims a slot early — "3 colors" on a mostly-white banner
 *    with a green dot yields black / green / gray, not three near-whites.
 *  - **Dominant real color per cluster, not the mean.** The mean of a cluster
 *    is a desaturated in-between color that may not exist in the image; we pick
 *    each cluster's most common actual color, so swatches stay punchy.
 *
 * Hard nearest-color snap, no dithering: dithering scatters near-color noise
 * that VTracer would trace as speckle paths, the opposite of the flat,
 * posterized regions a clean vector wants.
 */

export type Rgb = [number, number, number];

/**
 * Coarse color bucket: near-identical colors (e.g. an antialiased gradient's
 * many intermediate shades) collapse to one bucket so noise can't out-vote real
 * colors when clustering. `sum*`/`count` recover the bucket's average color and
 * weight.
 */
interface Bucket {
  sumR: number;
  sumG: number;
  sumB: number;
  count: number;
}

/** Bits kept per channel when bucketing (5 → 32 levels/channel). Coarse enough
 * to merge antialiasing noise, fine enough to keep a distinct accent apart. */
const BUCKET_BITS = 5;
const BUCKET_SHIFT = 8 - BUCKET_BITS;

function bucketAverage(b: Bucket): Rgb {
  return [Math.round(b.sumR / b.count), Math.round(b.sumG / b.count), Math.round(b.sumB / b.count)];
}

/** Buckets every opaque pixel by coarse color, accumulating a real average and
 * a pixel count per bucket. Transparent pixels (`a === 0`) are excluded — they
 * carry no color and would bias the palette toward black. */
function buildBuckets(rgba: Uint8Array): Bucket[] {
  const map = new Map<number, Bucket>();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const key =
      ((r >> BUCKET_SHIFT) << (BUCKET_BITS * 2)) |
      ((g >> BUCKET_SHIFT) << BUCKET_BITS) |
      (b >> BUCKET_SHIFT);
    const existing = map.get(key);
    if (existing) {
      existing.sumR += r;
      existing.sumG += g;
      existing.sumB += b;
      existing.count += 1;
    } else {
      map.set(key, { sumR: r, sumG: g, sumB: b, count: 1 });
    }
  }
  return [...map.values()];
}

/**
 * How many colors an image *meaningfully* has — the number of its most-common
 * color buckets needed to cover `coverage` of the opaque pixels. A black-on-
 * white icon reports 2 (two colors already cover ~99%); a photo or gradient
 * needs many buckets to reach the same coverage and reports a large number.
 * This separates "genuinely 2-3 colors" from "lots of colors, each thin"
 * far better than a flat per-color threshold, which undercounts rich images
 * (their colors are individually small) while still catching antialiasing
 * fringe on an icon (it's a tiny tail beyond the coverage cutoff). The Colors
 * control uses it to avoid offering more palette steps than an image can fill.
 */
export function significantColorCount(rgba: Uint8Array, coverage = 0.95): number {
  const counts = buildBuckets(rgba)
    .map((b) => b.count)
    .sort((a, b) => b - a);
  let total = 0;
  for (const c of counts) total += c;
  if (total === 0) return 0;
  const target = total * coverage;
  let acc = 0;
  let n = 0;
  for (const c of counts) {
    acc += c;
    n += 1;
    if (acc >= target) break;
  }
  return n;
}

/** Distinct opaque colors below which an image is treated as "flat" / pixel
 * art — the case where resampling (free-rotation smoothing) blends an otherwise
 * exact palette into spurious in-between colors. */
export const FLAT_COLOR_MAX = 32;

/**
 * Whether `rgba` uses few enough distinct opaque colors to be flat / pixel art.
 * Counts exact distinct RGB with an early exit at {@link FLAT_COLOR_MAX}, so a
 * photograph (thousands of colors) bails after a few pixels while genuine flat
 * art scans out to its true, small count. Fully transparent pixels are ignored.
 */
export function isFlatColorImage(
  rgba: Uint8Array | Uint8ClampedArray,
  maxColors = FLAT_COLOR_MAX,
): boolean {
  const seen = new Set<number>();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    seen.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
    if (seen.size > maxColors) return false;
  }
  return seen.size > 0;
}

function channelRange(buckets: Bucket[], channel: 0 | 1 | 2): number {
  let min = 255;
  let max = 0;
  for (const bucket of buckets) {
    const v = bucketAverage(bucket)[channel];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

function widestChannel(buckets: Bucket[]): { channel: 0 | 1 | 2; range: number } {
  const r = channelRange(buckets, 0);
  const g = channelRange(buckets, 1);
  const b = channelRange(buckets, 2);
  // Ties resolve R > G > B for a deterministic split (the gate needs a fixed
  // output for a fixed input).
  if (r >= g && r >= b) return { channel: 0, range: r };
  if (g >= b) return { channel: 1, range: g };
  return { channel: 2, range: b };
}

/** Each box's representative is its most-populous bucket's average — a real
 * dominant color from the image, not the whole box's washed-out mean. */
function dominantColor(buckets: Bucket[]): Rgb {
  let best = buckets[0];
  for (const bucket of buckets) {
    if (bucket.count > best.count) best = bucket;
  }
  return bucketAverage(best);
}

function luminance([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Up to N representative colors via population-independent median cut: cluster
 * the distinct color buckets by repeatedly splitting the box with the widest
 * color spread at its *bucket* median (each bucket counted once, so area
 * doesn't dominate), then take each box's dominant real color. Fewer distinct
 * colors than N yields fewer entries. Sorted dark→light for a tidy swatch ramp.
 */
export function medianCutPalette(rgba: Uint8Array, n: number): Rgb[] {
  const buckets = buildBuckets(rgba);
  if (buckets.length === 0) return [];
  const target = Math.max(1, Math.floor(n));
  let boxes: Bucket[][] = [buckets];

  while (boxes.length < target) {
    // Split the box with the largest single-channel spread; stop if none can
    // split further (every box is a single bucket).
    let best = -1;
    let bestRange = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const { range } = widestChannel(boxes[i]);
      if (range > bestRange) {
        bestRange = range;
        best = i;
      }
    }
    if (best === -1 || bestRange === 0) break;

    const box = boxes[best];
    const { channel } = widestChannel(box);
    const sorted = [...box].sort((a, b) => bucketAverage(a)[channel] - bucketAverage(b)[channel]);
    const mid = sorted.length >> 1;
    boxes = [
      ...boxes.slice(0, best),
      sorted.slice(0, mid),
      sorted.slice(mid),
      ...boxes.slice(best + 1),
    ];
  }

  return boxes.map(dominantColor).sort((a, b) => luminance(a) - luminance(b));
}

function nearest(palette: Rgb[], r: number, g: number, b: number): Rgb {
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const dr = c[0] - r;
    const dg = c[1] - g;
    const db = c[2] - b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/**
 * Returns a new RGBA buffer with every opaque pixel snapped to the nearest of
 * N median-cut palette colors. Alpha is preserved per pixel; fully transparent
 * pixels pass through untouched. The input buffer is never mutated.
 */
export function quantizeRgba(rgba: Uint8Array, n: number): Uint8Array {
  const palette = medianCutPalette(rgba, n);
  const out = new Uint8Array(rgba);
  if (palette.length === 0) return out;
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const [r, g, b] = nearest(palette, out[i], out[i + 1], out[i + 2]);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
  return out;
}

/**
 * Otsu's method: the luminance threshold that best separates the histogram into
 * two classes (maximizes between-class variance). Adapts to the image, unlike a
 * fixed 128 — a mostly-white image with light-gray text puts the threshold
 * between the white background peak and the text, so the text survives.
 */
function otsuThreshold(histogram: number[], total: number): number {
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * histogram[t];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = -1;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > maxVariance) {
      maxVariance = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Black & white (N=1): split opaque pixels into two luminance classes at an
 * Otsu threshold, paint the darker class solid black and drop the lighter class
 * to transparent. Dark-on-light line art / logos come out as a clean black
 * silhouette on transparent that keeps every shape — including faint ones a
 * fixed threshold would merge into the background. Returns a new buffer; the
 * input is not mutated.
 *
 * ponytail: assumes the subject is the darker class (the dark-on-light case).
 * A light subject on a dark background would invert; add an invert toggle if
 * that case ever matters.
 */
export function binarizeToBlack(rgba: Uint8Array): Uint8Array {
  const histogram = new Array(256).fill(0);
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const lum = Math.round(luminance([rgba[i], rgba[i + 1], rgba[i + 2]]));
    histogram[lum] += 1;
    total += 1;
  }
  const out = new Uint8Array(rgba);
  if (total === 0) return out;
  const threshold = otsuThreshold(histogram, total);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const lum = luminance([out[i], out[i + 1], out[i + 2]]);
    if (lum <= threshold) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
    } else {
      out[i + 3] = 0;
    }
  }
  return out;
}

/** `[r, g, b]` → `"#rrggbb"`. */
export function rgbToHex([r, g, b]: Rgb): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
