# Non-destructive Edit: straighten-then-crop, rotation applied at trace

Date: 2026-07-19
Status: proposed (awaiting review)

## Goal

Make the Edit step simpler and more intuitive:

- **No "Apply" step, no "Unapplied" text.** Crop and rotate are always live.
- **Straighten-then-crop** — rotate a tilted photo to level it (grid overlay),
  then crop a straight (screen-axis-aligned) rectangle out of the rotated
  image. This is the standard phone-photo-editor flow.
- **Best pixels.** Rotation resamples exactly once, never cumulatively, no
  matter how much the user nudges the angle or round-trips Edit⇄Trace.
- Minimum controls and text: on-image rotate handle, `−/Fit/+` zoom,
  Undo/Redo/Reset, and just two readouts (angle, size).

## The transform model

Edit stops baking bitmaps. Instead it maintains a **pending, non-destructive
transform** on the wizard:

```ts
interface EditTransform {
  rotation: number;              // degrees, any value (90° taps just add ±90)
  crop: { x: number; y: number; w: number; h: number } | null; // normalized [0,1]
}
const IDENTITY: EditTransform = { rotation: 0, crop: null };
```

- `crop` is normalized to the **rotated bounding box** (fractions of its
  width/height), so it scales sensibly if the angle changes after cropping.
  `null` = full frame.
- The pixels handed to the tracer are computed **once, at trace time**:

  ```
  bakeTransform(source, t) = crop( rotate(source, t.rotation), t.crop )
  ```

  One rotation resample + a lossless crop. Because it always starts from the
  upright `source`, it is never cumulative and round-trips can't double-apply.

`rotate` grows the canvas to the rotated bounding box (transparent corners);
there is **no fit-to-frame** (dropped — the user crops the corners away
manually). `rotate(_, 0)` and `crop(_, null)` are pass-throughs, so an
untouched Edit hands the source through unchanged (still true today).

## Data-flow changes

Today `wizard.image` is a *baked* bitmap that Edit mutates, guarded by
`originalImage`/`imageIsOriginal`, an in-Editor bitmap history with eviction,
and unmount cleanup (the #31 lifecycle work). The non-destructive model
**replaces all of that** with the numeric transform:

| Piece | Before | After |
|---|---|---|
| `wizard.image` | baked working bitmap, mutated by Edit | **source** bitmap; only Upload replaces it |
| `wizard.originalImage`, `imageIsOriginal` | pristine copy for Reset | **removed** — Reset = transform → identity |
| Editor bitmap history + eviction + close-on-unmount | per-edit bitmaps | **removed** — replaced by a `{angle, crop}` snapshot stack (plain numbers) |
| `setImage` vs `replaceImage` split | needed for the two owners | simplified — Edit only writes `wizard.transform` |
| Trace/Export source | `wizard.image` directly | `bakeTransform(wizard.image, wizard.transform)`, memoized on `(image, transform)` |

`bakeTransform` returns a transient bitmap owned by the trace pipeline (closed
after use, same as today's per-retrace copies). `wizard.image` persists.
`wizard.transform` persists across steps (survives Edit⇄Trace⇄Edit), which is
what makes round-trips safe.

Trace and Export both bake before their existing preview-downscale / full-res
paths. `needsFullResRetrace` and the preview/export caps are unchanged; they
just operate on the baked bitmap's dimensions.

## Interaction design

**Stage (left column, full height):** shows the source rotated by
`transform.rotation` at natural scale. Transparent corners are visible when
tilted.

- **Rotate handle** — a small circular handle on a short stalk above the
  image's top-centre (Figma/Canva style). Drag it to orbit the image around
  its centre. **Shift** snaps the result to the nearest 45°; **Ctrl/Cmd** =
  free/fine (no snap). The handle is the top hit-priority target.
- **Grid overlay** — a rule-of-thirds grid drawn over the image while the
  rotate handle is being dragged (and optionally whenever `rotation ≠ 0`), to
  help level the horizon.
- **Crop frame** — a screen-axis-aligned rectangle with four corner handles,
  drawn over the rotated image; dragging a corner trims the frame. Stored
  normalized to the rotated bounding box. Always visible (no modality); the
  user levels first, then pulls the frame in.
- **Zoom/pan** — view-only magnifier of the stage (does not affect output).
  Drag the stage background to pan when zoomed in. Hit-priority below the
  handles.

**Controls (right column), minimal:**

- **Rotate** group: the `↶ / ↷` 90° taps (each adds ±90 to `rotation`) and the
  live **angle** readout. The old slider + fit-to-frame + Apply are gone.
- **Zoom** control: `− [Fit] +`. `Fit` is a real detent at zoom = 1 (the
  contain-fit; the user's "100%"); a subtle badge/outline marks the view as
  being exactly at Fit.
- **Size** readout: the baked output `W × H`.
- **History**: Undo / Redo / Reset.

Nothing says "Apply" and nothing appears/disappears to reflow text.

## Undo / Redo / Reset

History is a stack of `EditTransform` snapshots (just numbers — no bitmaps):

- Push a snapshot on: rotate-handle release, a 90° tap, or a crop-handle
  release.
- **Undo/Redo** move through the stack; the live stage reflects the current
  snapshot.
- **Reset** pushes `IDENTITY` (angle 0, crop null) — reachable back through
  Undo like any other step.

This removes all bitmap-lifecycle concerns from Edit (no eviction, no close),
because nothing is baked until trace.

## Reused vs new code

- **Reused:** `rotateImageArbitrary` and `cropImage` (their pixel math and the
  `edit_roundtrip_pixel_diff == 0` gate stay); the two-column layout, stage
  measurement/contain-fit, and zoom/pan from the current Editor.
- **New:** `bakeTransform(source, transform)` (compose rotate+crop, map the
  normalized crop to rotated-bitmap pixels); the rotate-handle pointer math
  (orbit angle from pointer vs. centre); the rule-of-thirds grid; the
  `EditTransform` snapshot history; `wizard.transform` state; the bake step in
  Trace/Export.
- **Removed:** the rotation slider + ticks + snapAngle-era plumbing, the
  fit-to-frame toggle, the Apply buttons + "Unapplied" hints, the Editor's
  bitmap history/eviction/unmount-close, and `wizard.originalImage` /
  `imageIsOriginal`.

## Testing

- `bakeTransform`: identity = pass-through; rotate-then-crop dimensions and a
  pixel-diff check on a known fixture; normalized-crop → pixel mapping.
- Transform snapshot history: undo/redo/reset navigation over `{angle, crop}`.
- Editor component: rotate handle updates `rotation`; Shift snaps to 45°; crop
  handle updates `crop`; grid shows while rotating; angle/size readouts.
- Integration: Trace/Export trace the baked bitmap (not the raw source); a
  transform set in Edit survives a Trace→Edit round trip without double-apply.

## Out of scope

- Arbitrary "crop → rotate → crop → rotate …" chains at multiple angles (needs
  a full transform stack). Straighten-then-crop is a single rotation + single
  crop; that covers the real workflow.
- Auto-fill straightening (image scales to keep a fixed frame full). We use
  natural-scale rotate + manual crop instead.

## Open questions

- Grid: rule-of-thirds only, or a denser fine grid while straightening?
- Show the grid only while dragging the handle, or whenever `rotation ≠ 0`?
- Rotate-handle default (no modifier): free 1° or a light snap? (Shift = hard
  45° snap, Ctrl/Cmd = free are fixed.)
