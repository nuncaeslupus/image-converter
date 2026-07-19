/**
 * Median-cut color quantization — reduces an RGBA image to a literal palette of
 * N colors. VTracer has no "exactly N colors" knob (its `colorPrecision` is
 * bits-per-channel, a coarse richness scale), so the "Colors" control enforces
 * an exact count by pre-quantizing the pixels here, before the trace. The
 * worker snaps pixels with {@link quantizeRgba}; the tweak panel draws each
 * palette row's swatches with {@link medianCutPalette}. Both share one core so
 * the previewed colors match the traced result.
 *
 * Hard nearest-color snap, no dithering: dithering scatters near-color noise
 * that VTracer would trace as speckle paths, the opposite of the flat,
 * posterized regions a clean vector wants.
 */

export type Rgb = [number, number, number];

interface Box {
  /** Indices into the opaque-pixel color list this box covers. */
  colors: Rgb[];
}

function widestChannel(colors: Rgb[]): { channel: 0 | 1 | 2; range: number } {
  let rMin = 255,
    gMin = 255,
    bMin = 255,
    rMax = 0,
    gMax = 0,
    bMax = 0;
  for (const [r, g, b] of colors) {
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    if (g < gMin) gMin = g;
    if (g > gMax) gMax = g;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
  }
  const ranges: [number, number] = [rMax - rMin, gMax - gMin];
  const bRange = bMax - bMin;
  // Pick the channel with the largest spread; ties resolve R > G > B for
  // determinism (the acceptance gate needs a fixed output for a fixed input).
  if (ranges[0] >= ranges[1] && ranges[0] >= bRange) return { channel: 0, range: ranges[0] };
  if (ranges[1] >= bRange) return { channel: 1, range: ranges[1] };
  return { channel: 2, range: bRange };
}

function meanColor(colors: Rgb[]): Rgb {
  let r = 0,
    g = 0,
    b = 0;
  for (const c of colors) {
    r += c[0];
    g += c[1];
    b += c[2];
  }
  const n = colors.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Collects every opaque pixel's RGB (alpha === 0 excluded — transparent
 * pixels have no meaningful color and would bias the palette toward black). */
function opaqueColors(rgba: Uint8Array): Rgb[] {
  const colors: Rgb[] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    colors.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  return colors;
}

/**
 * Returns up to N representative colors via median cut: start with one box over
 * all opaque colors, repeatedly split the box whose widest channel has the
 * largest spread at that channel's median, until N boxes (or no box can split
 * further), then take each box's mean color. Fewer than N unique colors in the
 * image yields fewer than N palette entries.
 */
export function medianCutPalette(rgba: Uint8Array, n: number): Rgb[] {
  const colors = opaqueColors(rgba);
  if (colors.length === 0) return [];
  const target = Math.max(1, Math.floor(n));
  let boxes: Box[] = [{ colors }];

  while (boxes.length < target) {
    // Split the box with the largest single-channel spread; if none can split
    // (all boxes are a single color), stop early.
    let best = -1;
    let bestRange = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].colors.length < 2) continue;
      const { range } = widestChannel(boxes[i].colors);
      if (range > bestRange) {
        bestRange = range;
        best = i;
      }
    }
    if (best === -1 || bestRange === 0) break;

    const box = boxes[best];
    const { channel } = widestChannel(box.colors);
    const sorted = [...box.colors].sort((a, b) => a[channel] - b[channel]);
    const mid = sorted.length >> 1;
    boxes = [
      ...boxes.slice(0, best),
      { colors: sorted.slice(0, mid) },
      { colors: sorted.slice(mid) },
      ...boxes.slice(best + 1),
    ];
  }

  return boxes.map((box) => meanColor(box.colors));
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

/** `[r, g, b]` → `"#rrggbb"`. */
export function rgbToHex([r, g, b]: Rgb): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
