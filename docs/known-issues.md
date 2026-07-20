# Known issues

## Color detection / display is wrong on photos (reported 2026-07-20)

**Symptom** (user screenshot, a face photo traced at "2 colors"): the result and
the per-row swatches come out **warm beige / tan + dark**, when the source is a
near-grayscale photo — the expected palette would be roughly white/gray + black,
not orange/beige. So both the traced colors and the swatch previews look tinted
wrong.

**Where to look**
- `src/lib/quantize.ts` — `medianCutPalette` / `buildBuckets`. The 5-bit coarse
  bucketing + box *mean* (via `dominantColor` → `bucketAverage`) may be averaging
  a spread of near-gray pixels into a tinted color, or the dominant bucket pick
  is landing on a warm cluster. Check whether a genuinely grayscale image yields
  neutral palette entries.
- `src/steps/TraceStep.tsx` — `computePaletteInfo` samples the baked image to a
  64px canvas via `get2dContext`/`getImageData`. Verify the sampled RGBA isn't
  being color-shifted (e.g. premultiplied-alpha / colorspace conversion on the
  OffscreenCanvas draw) before `medianCutPalette`.
- `src/worker/vtracerTracer.ts` — the actual trace quantizes the 640px preview
  (not the 64px sample); confirm both paths agree and neither introduces a cast.

**Hypotheses to test first**
1. Grayscale unit test: feed `medianCutPalette` a synthetic grayscale ramp and
   assert every returned color has R≈G≈B (no tint). If it fails, the bug is in
   quantize.ts (bucketing/averaging).
2. If quantize is neutral on synthetic input but the browser shows a tint, the
   cast is introduced by the canvas `getImageData` sampling — compare the sampled
   pixels against the source.

Not yet started — noted for a dedicated debugging pass.
