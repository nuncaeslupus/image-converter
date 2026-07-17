# Image Converter — Specification (annotated edition)

> Generated 2026-07-17. This is the specification with a **note slot** after every section. Read it in any Markdown app. To annotate, replace the `_(your notes…)_` placeholder under any section. When done, send the file back — notes are acted on.

---

# Specification

## Preamble & scope

> Seed for `status/specification.md`. `specify` owns sections 1–4 below.
> `design` later appends sections 5–6 (contracts, risks) — see
> `template-specification-tail.md` in the design skill. Keep the file
> committed; per-task scratch belongs in `tmp/`, never here.

**Date**: 2026-07-17
**Ticket / PR**: N/A — greenfield project
**Author**: nuncaeslupus

> **✎ Notes** · `SPEC · intro`
> _(your notes here — replace this line)_

## Goals & Non-Goals

**Goals (v1)**

- Convert a raster image (PNG, JPEG, WebP, GIF, or BMP) into a clean, editable SVG entirely in the browser — no upload to any server, no account, no cost to the user.
- Support two vectorization modes from the first release: **Silhouette** (single-color trace — logos, icons, line art) and **Multi-color** (posterized trace with a reduced palette — photos, illustrations).
- Let the user tweak the result live before exporting: palette / number of colors, smoothness (straight edges vs. curves), level of detail (speckle/noise filtering), and background handling (transparent / solid / removed).
- Make export flexible: download the `.svg` file, copy the raw markup, override the output size/viewBox, and see a size/path-count estimate before exporting.
- Be fast and light enough to run comfortably on a typical phone or laptop, and to be hosted for $0.
- Remember the user's last-used tweak settings across visits (on-device only).

**Non-goals (v1 — explicitly deferred)**

- Batch upload / processing multiple images at once.
- Named, savable presets (beyond remembering the single last-used configuration).
- Branding / product naming — left open for a later decision.
- Any AI-assisted vectorization — a possible future **premium** feature, not part of this spec.
- Conversion between other file formats (e.g. SVG→PNG, HEIC→JPEG) — this spec covers raster→SVG only; other conversions are a later phase, per the README's note that "other image format conversions could also be added."
- Any monetization, ads, or accounts — v1 is a plain free tool.

> **✎ Notes** · `SPEC › Goals & Non-Goals`
> _(your notes here — replace this line)_

## §1 Problem statement

People who need a quick vector (SVG) version of a logo, icon, or simple illustration are generally forced onto paid or account-gated web tools, or heavyweight desktop software, just to trace one image — and in doing so they hand their (sometimes private) image to a third-party server. There is no free, no-account, privacy-preserving tool that runs entirely on the user's own device, lets them see the traced result immediately, and gives them simple, live control over the trade-off between fidelity and simplicity (palette, smoothness, detail) before they export. This matters because the lack of such a tool pushes casual and budget-conscious users (hobbyists, small businesses, students) toward paid services for a task that modern browsers are fully capable of doing locally.

**Success criteria (measurable)**

- [ ] `network_requests_carrying_user_image_data == 0` — the uploaded image and the resulting SVG never leave the device at any point in the flow.
- [ ] `time_to_first_traced_preview <= ~5s` for a typical camera/phone-sized photo on mid-range consumer hardware (first-pass target; to be confirmed with real-device benchmarking during design/implementation).
- [ ] Adjusting a non-retrace tweak (background handling, output size/viewBox) updates the visible result with no perceptible delay (cheap SVG-only edit, never re-runs the tracer).
- [ ] Adjusting a retrace tweak (palette/color count, smoothness, detail) updates the preview within a few seconds and never freezes the rest of the UI while it runs.
- [ ] `signup_or_payment_steps_required_for_core_flow == 0` — upload, tweak, and export never require an account or payment.
- [ ] The tool functions with the network disconnected after the initial page load (condition that can't be reduced to a single number — judged by manually testing the full upload→tweak→export flow offline).

> **✎ Notes** · `SPEC §1`
> _(your notes here — replace this line)_

## §2 Systems & Impact

| System | Type | Role | Needs changes? | Impact | Severity |
|--------|------|------|----------------|--------|----------|
| Upload & input handling | Primary | Accepts a raster image (PNG/JPEG/WebP/GIF/BMP) via file picker or drag-and-drop and decodes it client-side | Yes (new) | Entry point for every session | High |
| Silhouette tracer | Primary | Produces a single-color vector trace of the image | Yes (new) | Core value for the logo/icon/line-art use case | High |
| Multi-color tracer | Primary | Produces a posterized, reduced-palette vector trace | Yes (new) | Core value for the photo/illustration use case | High |
| Live tweak panel | Primary | Exposes palette/color count, smoothness, detail, and background controls, and drives re-rendering | Yes (new) | Directly drives perceived quality and usability | High |
| Preview / canvas | Dependent | Shows original vs. traced result so the user can judge a tweak before exporting | Yes (new) | The user's main feedback loop | High |
| Export | Primary | Produces the downloadable `.svg`, clipboard copy, size/viewBox override, and a size/path-count estimate | Yes (new) | The deliverable the user came for | High |
| Local settings persistence | Dependent | Remembers the last-used tweak configuration on-device | Yes (new) | Convenience, not core function | Low |
| Hosting / delivery | Infrastructure | Serves the static site at $0 backend cost | Out of scope for this spec — see Reference section | Determines the cost model | Medium |

**Impact dimensions**: no persistent data is stored anywhere but the user's own browser (no data-loss/integrity risk); there is no API/backend to version; the main risk is client-side performance on large images or low-end devices; user-facing impact is the entire product; there is no deployment/operational surface beyond a static host; the risk of inaction is that this gap in free, private tooling simply continues.

> **✎ Notes** · `SPEC §2`
> _(your notes here — replace this line)_

## §3 Options



> **✎ Notes** · `SPEC §3`
> _(your notes here — replace this line)_

### Option A: Silhouette first, Multi-color as a fast-follow (Conservative)

- **Description**: v1 launches with only single-color tracing (logos/icons/line art); the posterized multi-color mode ships as a follow-up release once the tweak-panel UX is validated.
- **Scope**: Upload, one tracer mode, a smaller tweak panel (detail + smoothness + background — no palette control needed yet), preview, export.
- **Effort**: Small
- **Tradeoffs**: Faster to ship and validate the core loop, but the "multiple colors" half of the stated goal is missing at launch, and palette UI has to be retrofitted later.
- **Compatibility**: N/A (greenfield)

> **✎ Notes** · `SPEC › Option A: Silhouette first, Multi-color as a fast-follow (Conservative)`
> _(your notes here — replace this line)_

### Option B: Both modes together, one shared UI (Recommended)

- **Description**: v1 launches with Silhouette and Multi-color as a single mode toggle inside one shared UI (upload, preview, export, and tweak panel are all shared); the palette control is simply inert or hidden in Silhouette mode.
- **Scope**: Upload, both tracer modes, full tweak panel (palette, smoothness, detail, background), preview, export.
- **Effort**: Medium
- **Tradeoffs**: More surface area to build and test before first launch, but delivers the full stated goal ("silhouettes or multiple colors") in one release and avoids a later UI retrofit or fork.
- **Compatibility**: N/A (greenfield)

> **✎ Notes** · `SPEC › Option B: Both modes together, one shared UI (Recommended)`
> _(your notes here — replace this line)_

### Option C: Two separate top-level tools

- **Description**: Silhouette and Multi-color live as two distinct pages/routes, each with its own simpler, purpose-built UI rather than one shared tweak panel.
- **Scope**: Upload, both tracer modes, two separate tweak panels, two preview/export flows.
- **Effort**: Medium-Large
- **Tradeoffs**: Each UI can be more tailored and simpler on its own, but duplicates the upload/preview/export scaffolding, fragments the experience, and complicates any later "auto-detect best mode" feature.
- **Compatibility**: N/A (greenfield)

> **✎ Notes** · `SPEC › Option C: Two separate top-level tools`
> _(your notes here — replace this line)_

### Comparison

| | Option A | Option B | Option C |
|---|---|---|---|
| Effort | Small | Medium | Medium-Large |
| Risk | Low | Low-Medium | Medium |
| Completeness | Partial at launch | Full | Full |
| Compatibility | N/A | N/A | N/A |
| Maintenance | Low now, retrofit later | Low, single code path | Higher, two code paths |

> **✎ Notes** · `SPEC › Comparison`
> _(your notes here — replace this line)_

## §4 Recommendation

**Recommended option**: Option B — ship both modes together behind one shared UI. This matches the explicit product goal ("silhouettes or multiple colors") without deferring half the value to a later release, and keeps a single upload/preview/export/tweak-panel implementation rather than forking it (Option C) or retrofitting it (Option A) afterward.

**Immediate next action**: Hand this spec to the `design` phase to define the concrete technical contracts — the tracer engine integration, the two-tier tweak pipeline (which knobs retrace vs. which are cheap SVG-only edits), the Web Worker boundary, the hosting target, and the frontend approach — building on the direction already recorded in `README.md`'s "Agreed technical direction."

**Open questions**:
- [ ] Exact performance targets (first-trace time, retrace time) need real-device benchmarking during design/implementation rather than being fixed here.
- [ ] Product name/branding — deliberately left open for now.
- [ ] Project license (open source, and which license) — not yet decided.
- [ ] Whether "detail/speckle filtering" and "smoothness" end up as one combined control or two separate sliders is a design-phase concern, not a product-spec one.

> **✎ Notes** · `SPEC §4`
> _(your notes here — replace this line)_

## Future Phases (Not in v1)

- Batch upload/processing of multiple images with shared settings.
- Named, savable presets and/or conversion history.
- AI-assisted vectorization, potentially as a premium feature.
- Additional file-format conversions beyond raster→SVG.
- Branding, domain, and monetization-model decisions.

> **✎ Notes** · `SPEC › Future Phases (Not in v1)`
> _(your notes here — replace this line)_

## Reference: Prior Technical Direction (already agreed, out of scope for this spec)

Recorded in `README.md` → "Status": VTracer (Rust → WASM) as the primary tracer with optional Potrace for clean black-and-white output; 100% static hosting; a two-tier tweak pipeline (cheap SVG-only edits vs. tracer re-runs, cached by parameter set); tracing in a Web Worker with a downscaled preview for responsiveness; and a `bitmap → SVG` interface left open for a future AI tracer. This spec deliberately stayed technology-free per the product owner's request — the `design` phase should reconcile these existing decisions with the product requirements above.

> Sections 5–6 (contracts, risks) are appended by `design`.

> **✎ Notes** · `SPEC › Reference: Prior Technical Direction (already agreed, out of scope for this spec)`
> _(your notes here — replace this line)_

