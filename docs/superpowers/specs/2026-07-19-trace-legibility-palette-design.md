# Trace legibility: literal-N palette, B&W, and param help

**Date:** 2026-07-19
**Status:** approved (design)

## Problem

Three issues on the Trace step, all reported by the user:

1. **B&W images trace with irregularities the original doesn't have.** A
   black-and-white caduceus, even at Smoothness 100 / Detail 0, comes out with
   ragged edges. Root cause: VTracer runs in `color` mode, so the antialiased
   gray fringe around the black shape is traced as extra thin color layers.
2. **The palette is opaque.** Chips (2/4/8/16/…) map to VTracer's
   `colorPrecision` (bits per channel), not to a literal color count, so "3"
   vs "4" is meaningless to a user and the actual colors are never shown.
3. **Smoothness / Detail / Contrast / Background are unexplained.**

## Design

### 1. "Colors" control = a palette list, each row showing its real colors

Replace the abstract palette chips with a vertical **radiogroup list** from
fewer→more colors, where each row previews that palette's *actual* colors
sampled from the user's image:

```
Colors
 ( ) B & W        ■
 ( ) 2 colors     ■■
 ( ) 3 colors     ■■■
 (•) 4 colors     ■■■■     ← selected
 ( ) 6 colors     ■■■■■■
 ( ) 8 colors     ■■■■■■■■
 ( ) 12 colors    ■■■■■■■■■■■■
 ( ) 16 colors    ■■■■■■■■■■■■■■■■
 ( ) Auto         (VTracer picks)
```

- **B & W (N=1)** → the image is split into two luminance classes at an **Otsu
  adaptive threshold** and the darker class is painted solid black on a
  transparent background (see `binarizeToBlack`), then traced. Otsu adapts to
  the image's own histogram, so faint dark-on-light content (light-gray text on
  a near-white background) stays black instead of being merged into the
  background the way VTracer's fixed threshold does. Direct fix for issue (1).
  Row swatch: a single black chip.
- **N=2..16** → the image is reduced to exactly N colors *before* tracing
  (see quantization below), then traced in `color` mode. Flat N-color input →
  ~N clean fills out, no fringe layers. **Selecting a row re-traces so the
  rendered image shows only those N colors** (the pre-quantization is what
  guarantees this, not a post-filter).
- **Auto** → unchanged: no pre-quantization, VTracer's own clustering at
  `colorPrecision` 6. The row shows the actual color count of the current Auto
  result (e.g. "21 colors", counted from the traced SVG's distinct fills via
  `countSvgColors`) while Auto is selected, and nothing otherwise.

Row swatches come from `medianCutPalette` (below) run per N on a small sample
of the baked image — cheap because it computes only the palette, never a
trace. Memoized on the baked image; recomputed when the image/transform
changes. These are a visual guide; the exact fills in the traced result derive
from the same algorithm on the full preview image, so they match closely.

`paletteSize` stays `number | "auto"` on `TraceParams`; the number's meaning
changes from "bits proxy" to "literal color count", and `1` now means binary.

VTracer has no "exactly N colors" knob, so N is enforced on our side by
pre-quantizing the pixels. `paletteSize` stays `number | "auto"` on
`TraceParams`; the number's meaning changes from "bits proxy" to "literal
color count", and `1` now means binary.

### 2. Median-cut pre-quantization (worker side)

New pure module `src/lib/quantize.ts`:

```ts
medianCutPalette(rgba: Uint8Array, n: number): Array<[number, number, number]>
quantizeRgba(rgba: Uint8Array, n: number): Uint8Array
binarizeToBlack(rgba: Uint8Array): Uint8Array
rgbToHex([r, g, b]): string
```

- `medianCutPalette` — the shared core. Bucket opaque pixels (skip `a === 0`)
  by coarse color to merge antialiasing noise, then cluster the **distinct
  buckets** by repeatedly splitting the box with the widest color spread at its
  bucket median — **population-independent**, so a large flat background can't
  devour the budget and a small distinct accent (a logo dot) claims a slot at
  low N. Each cluster's color is its **most-populous bucket's average** (a real
  dominant color), not the whole box's washed-out mean. Both the worker (to snap
  pixels) and the UI (row swatches) call this, so previews match the result.
- `quantizeRgba` — computes the palette, then snaps every opaque pixel to its
  nearest palette color (hard, **no dithering** — dithering adds speckle noise
  VTracer traces as paths). Alpha preserved per pixel; transparent pixels
  untouched; returns a new buffer (never mutates the input).
- `binarizeToBlack` — the N=1 path: Otsu threshold on luminance, darker class →
  opaque black, lighter class → transparent. New buffer, input untouched.
- Deterministic → unit-testable with fixed fixtures (the acceptance gate).

Wired into `traceRgba` (the tested pure core), which reduces the RGBA before
`convert_rgba`: `paletteSize === 1` → `binarizeToBlack`; a number `>= 2` →
`quantizeRgba`; `"auto"` → no reduction. VTracer therefore always runs in
`color` mode; `translateParams` only sets `colorPrecision` — `8` for a reduced
palette (so VTracer preserves it instead of merging), `6` for `"auto"`.

### 3. Per-row swatches (main thread, cheap)

`TraceStep` samples the baked image to a small RGBA buffer (draw to a capped
canvas, `getImageData`) and runs `medianCutPalette` for each N in the chip set,
memoized on the baked image. The resulting `Record<N, hex[]>` is passed to
`TweakPanel` as `palettePreviews`; each row renders its own swatches. Browser
only (guarded — no canvas under jsdom); the pure `medianCutPalette` is what the
tests exercise.

### 4. Inline one-line help

A `.hint` line under each control:

- **Colors** — "How many colors to keep. 1 is black & white."
- **Smoothness** — "Rounds off jagged edges."
- **Detail** — "Keeps small features and fine lines."
- **Contrast** — "Splits colors into more or fewer layers."
- **Background** — "Transparent, or solid white behind the shapes."

## Out of scope

- Per-chip swatch previews (show only the selected palette).
- Perceptual/k-means quantization or dithering (median-cut, hard snap).
- Any change to the two-tier retrace/cheap-edit routing — palette is a
  retrace param, exactly as today.

## Acceptance gate

- `medianCutPalette` returns up to N colors, is deterministic, and keeps a
  small distinct accent (area-independent) at low N (unit test).
- `quantizeRgba` reduces to ≤ N distinct colors, preserves alpha, and leaves
  the input buffer untouched (unit test).
- `binarizeToBlack` paints the darker class black / drops the lighter to
  transparent, and keeps faint mid-gray content against a near-white
  background via Otsu (unit test).
- `translateParams` always `color`; `colorPrecision` 8 for a reduced palette,
  6 for `"auto"` (existing range test still passes).
- Full suite green; `npm run lint` clean.
```

