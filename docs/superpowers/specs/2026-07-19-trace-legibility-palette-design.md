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

- **B & W (N=1)** → VTracer `binary` mode: one thresholded silhouette, the
  sharpest result. Direct fix for issue (1). Row swatch: a single black chip.
- **N=2..16** → the image is reduced to exactly N colors *before* tracing
  (see quantization below), then traced in `color` mode. Flat N-color input →
  ~N clean fills out, no fringe layers. **Selecting a row re-traces so the
  rendered image shows only those N colors** (the pre-quantization is what
  guarantees this, not a post-filter).
- **Auto** → unchanged: no pre-quantization, VTracer's own clustering at
  `colorPrecision` 6. No swatches (label reads "VTracer picks").

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
rgbToHex([r, g, b]): string
```

- `medianCutPalette` — the shared core. Build a color box over all **opaque**
  pixels (skip `a === 0`), recursively split the box with the widest RGB range
  at its median until there are `n` boxes, return each box's mean color. This
  is what both the worker (to snap pixels) and the UI (to draw row swatches)
  call.
- `quantizeRgba` — computes the palette, then snaps every opaque pixel to its
  nearest palette color (hard, **no dithering** — dithering adds speckle noise
  VTracer traces as paths). Alpha preserved per pixel; transparent pixels
  untouched; returns a new buffer (never mutates the input).
- Deterministic → unit-testable with a fixed fixture (the acceptance gate).

Wired into `traceRgba` (the tested pure core): when
`typeof paletteSize === "number" && paletteSize >= 2`, quantize the RGBA
before `convert_rgba`. `paletteSize === 1` skips quantization (binary mode
thresholds itself). `translateParams` sets:

- `paletteSize === 1` → `colorMode: "binary"`.
- `paletteSize >= 2` → `colorMode: "color"`, `colorPrecision: 8` (max, so
  VTracer preserves the already-reduced palette instead of merging it).
- `"auto"` → `colorMode: "color"`, `colorPrecision: 6` (today's behavior).

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

- `medianCutPalette` returns exactly N colors for a multi-color fixture and is
  deterministic (unit test).
- `quantizeRgba` reduces a known multi-color fixture to ≤ N distinct colors,
  preserves alpha, and leaves the input buffer untouched (unit test).
- `translateParams`: `paletteSize 1` → `binary`; `>= 2` → `color` +
  `colorPrecision 8`; `"auto"` → `color` + `colorPrecision 6` (unit test).
- Full suite green; `npm run lint` clean.
```

