# Specification: Client-Side Raster-to-SVG Converter (v1)

> Seed for `status/specification.md`. `specify` owns sections 1–4 below.
> `design` later appends sections 5–6 (contracts, risks) — see
> `template-specification-tail.md` in the design skill. Keep the file
> committed; per-task scratch belongs in `tmp/`, never here.

**Date**: 2026-07-17
**Ticket / PR**: N/A — greenfield project
**Author**: nuncaeslupus

---

## Goals & Non-Goals

**Goals (v1)**

- Convert a raster image (PNG, JPEG, WebP, GIF, or BMP) into a clean, editable SVG entirely in the browser — no upload to any server, no account, no cost to the user.
- Support one tracer, one unified mode toggle: **Silhouette** is simply a palette of 1 color, **Multi-color** is the same tool with a larger palette — not two separate features. The UI offers quick shortcuts for common palette sizes (1, 2, 3, 4, 8, 16…) and can also choose a palette size automatically.
- Let the user tweak the result live before exporting: palette / number of colors, smoothness (straight edges vs. curves), level of detail (speckle/noise filtering), contrast (which can also be used deliberately — e.g. raising contrast to trace through/skip a faint watermark), and background handling (transparent / solid / removed).
- Let the user compare original vs. traced output before committing to a tweak — at minimum a "hold to see original" toggle over the preview; comparing two different traced versions side by side (e.g. two palette sizes) is a desirable stretch goal for v1, not a hard requirement.
- Provide basic image editing before tracing: crop, resize, and rotate. These must be quickly accessible and instantly recognizable in the UI — standard tool placement, standard icons, standard keyboard shortcuts — not buried in a menu.
- Make export flexible: download the `.svg` file, copy the raw markup, override the output size/viewBox, and see a size/path-count estimate before exporting.
- Be fast and light enough to run comfortably on a typical phone or laptop, and to be hosted for $0.
- Remember the user's last-used tweak settings across visits (on-device only).

**Non-goals (v1 — explicitly deferred)**

- Batch upload / processing multiple images at once.
- Named, savable presets/profiles (beyond remembering the single last-used configuration) — a strong future-phase candidate, plausibly tied to a future account/premium tier.
- Branding / product naming — left open for a later decision.
- Any AI-assisted vectorization — a possible future **premium** feature (also where a future API/account layer would live), not part of this spec.
- Conversion between other file formats (e.g. SVG→PNG, HEIC→JPEG) — this spec covers raster→SVG only; other conversions are a later phase, per the README's note that "other image format conversions could also be added."
- Any monetization, ads, or accounts — v1 is a plain free tool.

## 1. Problem statement

People who need a quick vector (SVG) version of a logo, icon, or simple illustration are generally forced onto paid or account-gated web tools, or heavyweight desktop software, just to trace one image — and in doing so they hand their (sometimes private) image to a third-party server. There is no free, no-account, privacy-preserving tool that runs entirely on the user's own device, lets them see the traced result immediately, and gives them simple, live control over the trade-off between fidelity and simplicity (palette, smoothness, detail) before they export. This matters because the lack of such a tool pushes casual and budget-conscious users (hobbyists, small businesses, students) toward paid services for a task that modern browsers are fully capable of doing locally.

**Success criteria (measurable)**

- [ ] `network_requests_carrying_user_image_data == 0` — the uploaded image and the resulting SVG never leave the device at any point in the flow.
- [ ] `time_to_first_traced_preview <= ~5s` for a typical camera/phone-sized photo on mid-range consumer hardware (first-pass target; to be confirmed with real-device benchmarking during design/implementation).
- [ ] Adjusting a non-retrace tweak (background handling, output size/viewBox) updates the visible result with no perceptible delay (cheap SVG-only edit, never re-runs the tracer).
- [ ] Adjusting a retrace tweak (palette/color count, smoothness, detail, contrast) updates the preview within a few seconds and never freezes the rest of the UI while it runs.
- [ ] `signup_or_payment_steps_required_for_core_flow == 0` — upload, tweak, and export never require an account or payment.
- [ ] The tool functions with the network disconnected after the initial page load (condition that can't be reduced to a single number — judged by manually testing the full upload→tweak→export flow offline).

## 2. Systems & Impact

| System | Type | Role | Needs changes? | Impact | Severity |
|--------|------|------|----------------|--------|----------|
| Upload & input handling | Primary | Accepts a raster image (PNG/JPEG/WebP/GIF/BMP) via file picker or drag-and-drop and decodes it client-side | Yes (new) | Entry point for every session | High |
| Vectorization tracer | Primary | One engine, driven by a palette-size parameter: size 1 is the "silhouette" case, larger sizes are the "multi-color/posterized" case | Yes (new) | Core value of the whole product | High |
| Basic image editing | Primary | Crop, resize, and rotate the source image before tracing, with prominent, standard-shortcut controls | Yes (new) | Users routinely need to frame/orient an image before vectorizing it | Medium |
| Live tweak panel | Primary | Exposes palette/color-count (with quick presets: 1, 2, 3, 4, 8, 16…), smoothness, detail, contrast, and background controls, and drives re-rendering | Yes (new) | Directly drives perceived quality and usability | High |
| Preview / canvas | Dependent | Shows original vs. traced result (at minimum a hold-to-compare toggle; comparing two traced versions is a stretch goal) so the user can judge a tweak before exporting | Yes (new) | The user's main feedback loop | High |
| Export | Primary | Produces the downloadable `.svg`, clipboard copy, size/viewBox override, and a size/path-count estimate | Yes (new) | The deliverable the user came for | High |
| Local settings persistence | Dependent | Remembers the last-used tweak configuration on-device; named save/load profiles deferred (see Non-goals) | Yes (new) | Convenience, not core function | Low |
| Hosting / delivery | Infrastructure | Serves the static site at $0 backend cost | Out of scope for this spec — see Reference section | Determines the cost model | Medium |

**Impact dimensions**: no persistent data is stored anywhere but the user's own browser (no data-loss/integrity risk); there is no API/backend to version; the main risk is client-side performance on large images or low-end devices; user-facing impact is the entire product; there is no deployment/operational surface beyond a static host; the risk of inaction is that this gap in free, private tooling simply continues.

## 3. Options

### Option A: Palette locked to 1 first, unlock the slider later (Conservative)

- **Description**: v1 ships the same single engine, but the palette-size control is locked to 1 (silhouette only) at launch; the palette slider/presets (2, 3, 4, 8, 16…) unlock in a follow-up release once the tweak-panel UX is validated.
- **Scope**: Upload, the tracer engine with palette fixed at 1, a smaller tweak panel (detail + smoothness + contrast + background — no palette control shown yet), preview, export.
- **Effort**: Small
- **Tradeoffs**: Faster to ship and validate the core loop, but the "multiple colors" half of the stated goal is missing at launch, and the palette control has to be un-hidden and tested later.
- **Compatibility**: N/A (greenfield)

### Option B: Both modes together, one shared UI (Recommended)

- **Description**: there is no separate "Silhouette tracer" and "Multi-color tracer" — it is one tool where Silhouette is just the palette set to 1 color. The palette control offers quick-select shortcuts for common sizes (1, 2, 3, 4, 8, 16…) plus an automatic mode that picks a reasonable size for the image; everything else (upload, preview, export, tweak panel) is fully shared.
- **Scope**: Upload, one tracer engine with a palette-size control (manual presets + automatic), full tweak panel (palette, smoothness, detail, contrast, background), preview, export.
- **Effort**: Medium
- **Tradeoffs**: More surface area to build and test before first launch, but delivers the full stated goal ("silhouettes or multiple colors") in one release and avoids a later UI retrofit or fork.
- **Compatibility**: N/A (greenfield)

### Option C: Two separate top-level entry points over the same engine

- **Description**: "Silhouette" and "Multi-color" live as two distinct pages/routes (same underlying tracer, palette size pre-set per page), each with its own simpler, purpose-built UI rather than one shared tweak panel.
- **Scope**: Upload, the shared tracer engine, two separate tweak panels, two preview/export flows.
- **Effort**: Medium-Large
- **Tradeoffs**: Each UI can be more tailored and simpler on its own, but duplicates the upload/preview/export scaffolding, fragments the experience, and complicates the "just move the palette slider" mental model.
- **Compatibility**: N/A (greenfield)

### Comparison

| | Option A | Option B | Option C |
|---|---|---|---|
| Effort | Small | Medium | Medium-Large |
| Risk | Low | Low-Medium | Medium |
| Completeness | Partial at launch | Full | Full |
| Compatibility | N/A | N/A | N/A |
| Maintenance | Low now, retrofit later | Low, single code path | Higher, two code paths |

## 4. Recommendation

**Recommended option**: Option B — one tracer engine, one shared UI, with palette size (including a silhouette-equivalent size of 1) as just another live tweak. This matches the explicit product goal ("silhouettes or multiple colors") without deferring half the value to a later release, and keeps a single upload/preview/export/tweak-panel implementation rather than forking it (Option C) or retrofitting it (Option A) afterward.

**Immediate next action**: Hand this spec to the `design` phase to define the concrete technical contracts — the tracer engine integration, the two-tier tweak pipeline (which knobs retrace vs. which are cheap SVG-only edits), the Web Worker boundary, the hosting target, and the frontend approach — building on the direction already recorded in `README.md`'s "Agreed technical direction."

**Open questions**:
- [ ] Exact performance targets (first-trace time, retrace time) need real-device benchmarking during design/implementation rather than being fixed here.
- [ ] Product name/branding — deliberately left open for now.
- [ ] Project license (open source, and which license) — not yet decided.
- [ ] Whether "detail/speckle filtering" and "smoothness" end up as one combined control or two separate sliders is a design-phase concern, not a product-spec one.

---

## Future Phases (Not in v1)

- Batch upload/processing of multiple images with shared settings.
- Named, savable presets and/or conversion history.
- AI-assisted vectorization, potentially as a premium feature.
- Additional file-format conversions beyond raster→SVG.
- Branding, domain, and monetization-model decisions.

## Reference: Prior Technical Direction (already agreed, out of scope for this spec)

Recorded in `README.md` → "Status": VTracer (Rust → WASM) as the primary tracer with optional Potrace for clean black-and-white output; 100% static hosting; a two-tier tweak pipeline (cheap SVG-only edits vs. tracer re-runs, cached by parameter set); tracing in a Web Worker with a downscaled preview for responsiveness; and a `bitmap → SVG` interface left open for a future AI tracer. This spec deliberately stayed technology-free per the product owner's request — the `design` phase should reconcile these existing decisions with the product requirements above.

## 5. Contracts

This is a client-only, static-hosted app — there is no HTTP API and no backend
database. The load-bearing "contracts" here are (a) the message protocol across
the Web Worker boundary that keeps tracing off the main thread, (b) the
`bitmap → SVG` tracer abstraction the README already commits to (so a future AI
tracer can be swapped in behind it), and (c) the local-storage schema for
remembered settings.

### Worker message contract (tracer boundary)

All tracing (VTracer WASM) runs inside a dedicated `tracer.worker.ts`. The main
thread never blocks on a trace.

**Request** (main → worker):
```json
{
  "type": "trace",
  "requestId": "uuid",
  "image": { "bitmap": "ImageBitmap (transferred)", "width": 0, "height": 0 },
  "params": {
    "paletteSize": "1-64 | \"auto\"",
    "smoothness": "0-100",
    "detail": "0-100",
    "contrast": "-100-100"
  }
}
```

**Response — success**:
```json
{
  "type": "trace-result",
  "requestId": "uuid",
  "svg": "<svg ...>...</svg>",
  "pathCount": 0,
  "durationMs": 0
}
```

**Response — error**:
```json
{ "type": "trace-error", "requestId": "uuid", "message": "string" }
```

- **Backwards compatible**: N/A (greenfield, single consumer of its own protocol).
- Every request carries a fresh `requestId`; a superseded in-flight request's
  response is discarded by the main thread (last-tweak-wins), which is what
  makes rapid slider drags safe without an explicit cancel message.
- `params` is the exact boundary between "cheap SVG-only edit" (never sent
  here — applied directly to the last `svg` string) and "retrace" (always sent
  here). Background handling and output size/viewBox never appear in `params`.

### Bitmap → SVG interface

```ts
interface Tracer {
  trace(bitmap: ImageBitmap, params: TraceParams): Promise<{ svg: string; pathCount: number }>;
}
```

VTracer-via-WASM is the v1 implementation of this interface, run inside the
worker. Keeping the worker protocol shaped around this interface (not around
VTracer's native parameter names) is what leaves room for a future AI tracer
implementation, per the README's stated direction — swapping the
implementation never touches the tweak panel or export code.

### Local storage contract

| Key | Shape | Written | Read |
|-----|-------|---------|------|
| `image-converter:last-settings:v1` | `{ paletteSize, smoothness, detail, contrast, background }` (tweak values only — never image data) | Debounced on any tweak change | On app load, to seed the tweak panel |

The `:v1` suffix is deliberate: a future shape change ships as `:v2` and falls
back to defaults on a missing/unparseable key, rather than migrating stored
data in place.

### Database migrations

| Service | Database | Change | Reversible | Forward-compatible |
|---------|----------|--------|------------|---------------------|
| N/A | N/A | No database in v1 — client-only, static hosting, `localStorage` only | N/A | N/A |

## 6. Risks & Validation

| Risk | Likelihood | Impact | Mitigation | Validation |
|------|-----------|--------|------------|------------|
| VTracer WASM bundle size/load time hurts the "fast and light" goal | Medium | Medium | Lazy-load the WASM module on first trace (not on initial page load); compress with `wasm-opt`; code-split it out of the main bundle | perf (bundle-size budget + load-time measurement) |
| Large images freeze the tab on low-end/mobile devices | Medium | High | Trace runs only in the Worker (never main thread); downscale to a preview resolution before tracing, full-resolution pass only on export; hard cap max input dimension | perf, manual (real low-end/mobile device) |
| Older/mobile browsers lack `OffscreenCanvas`, Worker-side WASM, or the Clipboard API | Low-Medium | Medium | Feature-detect and degrade gracefully (main-thread trace fallback with a spinner; download-only export when clipboard write is unavailable) | manual (cross-browser matrix) |
| VTracer's native parameters (e.g. `filter_speckle`, `corner_threshold`, `color_precision`) don't map intuitively to the product's "smoothness / detail / contrast" mental model | Medium | Medium | Build and unit-test an explicit translation layer between the product params and VTracer's native params, tuned by manual comparison against sample images | unit, manual |
| Automatic palette-size heuristic picks a poor size for some images (esp. photos) | Medium | Low | Ship it as a starting point the user can always override manually; iterate the heuristic post-launch against a sample corpus | manual (varied sample corpus) |
| Cache/debounce bug leaves the preview stale after a tweak (doesn't visibly update) | Low | Medium | Cache key is a hash of `(imageId, params)`; invalidated whenever the source image changes; regression-tested | unit |
| `localStorage` cleared or unavailable (private browsing, quota) loses remembered settings | Medium | Low | Fail silently to in-code defaults — never block or error the core flow | unit |

**Rollback plan**: the whole app is a single static bundle behind one hosting
target with no server state and no data migrations — "rollback" is redeploying
the previous build artifact. No risk above requires a data rollback plan.

> Sections 5–6 (contracts, risks) are appended by `design`.
