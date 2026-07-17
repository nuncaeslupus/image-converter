# Plan: Client-Side Raster-to-SVG Converter (v1)

> Seed for `status/plan.md`. `design` creates it from the technical
> solution and the task split. Pairs with `status/specification.md`
> (problem, options, contracts, risks); `execution` works the task table
> and updates each task's status as it goes.

**Date**: 2026-07-17
**Specification**: `status/specification.md`
**Author**: nuncaeslupus

---

## Technical solution

### Architecture overview

A single-page, client-only static app — no backend, no accounts, no database.
The app has three layers:

1. **Main thread (UI)** — upload, crop/resize/rotate editing, the tweak panel,
   preview/compare, and export. Owns all DOM and user interaction.
2. **Tracer Worker** — a dedicated Web Worker hosting the VTracer WASM module
   behind the `Tracer` interface (see spec §5). Receives a bitmap + params,
   returns an SVG string. Never touches the DOM.
3. **Local persistence** — `localStorage` only, storing the last-used tweak
   settings (never image data). No server, no sync.

Everything ships as one static bundle (HTML/CSS/JS/WASM) deployable to any
static host, per the spec's $0-hosting goal.

### Data flow

1. User selects/drops an image → main thread decodes it (`createImageBitmap`)
   directly from the file — never uploaded anywhere.
2. User optionally crops/resizes/rotates on a canvas → produces an edited
   `ImageBitmap` that replaces the working source image.
3. The working bitmap + current `TraceParams` (palette size, smoothness,
   detail, contrast) are posted to the Tracer Worker (bitmap transferred, not
   copied).
4. The worker downscales for the live preview pass, runs VTracer WASM, and
   returns `{ svg, pathCount, durationMs }`, tagged with the `requestId` of
   the request that triggered it.
5. The main thread discards any response whose `requestId` isn't the latest
   one it sent (last-tweak-wins under rapid slider drags), renders the
   surviving SVG in the preview, and caches it keyed by `hash(imageId, params)`.
6. Non-retrace tweaks (background handling, output size/viewBox) mutate the
   cached SVG string directly on the main thread — the worker is never called
   for these.
7. Tweak values (not images) are debounced into `localStorage` on change.
8. Export takes the current SVG string, applies any size/viewBox override,
   computes a byte-size/path-count estimate, and offers download (Blob +
   `<a download>`) and clipboard copy (`navigator.clipboard.writeText`).

No step in this pipeline makes a network request carrying image data — the
whole flow satisfies the spec's `network_requests_carrying_user_image_data == 0`
success criterion by construction.

### UI flow (step wizard)

The user-facing flow is a **single-page wizard**, not separate routed pages:
one bundle, one URL, step transitions are component/state changes only — no
router dependency, no re-derivation of the in-memory image across navigation.

1. **Upload** — file picker / drag-and-drop, client-side decode (T4).
2. **Edit** — optional crop/resize/rotate on the decoded bitmap; skippable,
   defaults straight to Trace & Tweak (T5).
3. **Trace & Tweak** — palette/smoothness/detail/contrast/background controls
   driving the two-tier retrace pipeline, with the original-vs-traced compare
   preview (T6, T7).
4. **Export** — download `.svg`, copy markup, size/viewBox override, size/path
   estimate (T9).

Back/forward between steps is in-memory state, not browser history — there is
no per-step URL to bookmark or share, which is an accepted tradeoff for a flow
that takes seconds end-to-end. Revisit this decision only if usage data shows
people need to resume or share a specific step.

### State changes

| Service | Database | Change | Description |
|---------|----------|--------|-------------|
| Browser `localStorage` | N/A (no DB) | CREATE/UPDATE | `image-converter:last-settings:v1` — last-used tweak values only (see spec §5) |

No server-side or database state exists in v1.

### Technology choices

| Choice | Justification |
|--------|--------------|
| Vite + TypeScript | Fast static-site build with first-class TS and WASM asset handling; zero-config output deployable as a plain static bundle |
| Preact | Component model at a fraction of React's bundle weight — keeps the initial payload small, which matters directly for the "fast and light on a phone" goal |
| VTracer (Rust) → WASM via `wasm-pack`, run in a Web Worker | Already the agreed direction in `README.md`; running it off the main thread is required to meet the "never freezes the UI" success criterion |
| Plain CSS Modules (no CSS-in-JS runtime) | Avoids a styling runtime cost on top of an already WASM-heavy bundle |
| No state-management library | App state is small and single-page; Preact's built-in hooks/signals are sufficient, and a library would be unjustified weight |
| `localStorage` directly (no wrapper lib) | Single small key, versioned suffix (`:v1`) handles future shape changes — a persistence library would be overhead for one key |
| Vitest + `@testing-library/preact` | Matches the Vite toolchain; fast unit/component tests without a separate runner |
| GitHub Pages (via GitHub Actions on push to `main`) | Repo already lives on GitHub; zero extra service to provision, satisfies the $0-hosting goal. Swappable later — the build output is a plain static bundle with no host-specific code |

### Out of scope

- Any backend, API, or account/auth system.
- Batch upload / multi-image processing.
- Named, savable presets beyond the single last-used configuration.
- AI-assisted vectorization (future premium feature, behind the same `Tracer` interface).
- Non-SVG conversion targets (SVG→PNG, HEIC→JPEG, etc.).
- Branding, licensing, and monetization decisions (tracked as open questions in the spec).

---

## Implementation tasks

The **Gate** column is required: a measurable acceptance condition `<metric> <op> <threshold>` (ops `< <= > >= == !=`), derived from the spec's success criteria — the objective pass/fail for the task, not just "tests pass." The `gate-check` skill defines the grammar.

| T# | Description | Service | Size | Depends | Gate | Tests |
|----|-------------|---------|------|---------|------|-------|
| T1 | Vite + TypeScript static-site scaffold; builds to a deployable `dist/` with no server code | frontend | S | — | `build_exit_code == 0` | `test_viteBuild_defaultConfig_producesDistIndex` in `tests/build.test.ts` — running the production build exits 0 and writes `dist/index.html` |
| T2 | Tracer Worker message protocol (typed request/response, `requestId` last-wins discard) with a stub `Tracer` implementation | frontend | M | T1 | `trace_protocol_round_trip_success_rate == 1.0` | `test_tracerWorker_validRequest_returnsTraceResult` and `test_tracerWorker_staleRequestId_discardedByMainThread` in `tests/worker/tracerProtocol.test.ts` — a valid request always resolves a typed result; a superseded requestId's response is dropped |
| T3 | Integrate VTracer WASM (`wasm-pack` build) into the Tracer Worker, replacing the stub; parameter-translation layer from product params (palette/smoothness/detail/contrast) to VTracer's native params | frontend | L | T2 | `trace_success_rate_on_sample_corpus >= 0.95` | `test_vtracerWorker_sampleImages_returnsNonEmptySvg` and `test_paramTranslation_productParams_mapsToValidVtracerConfig` in `tests/worker/vtracer.test.ts` — every fixture in the sample corpus traces without error; product params always translate to an in-range VTracer config |
| T4 | Upload & input handling: file picker + drag-and-drop, client-side decode for PNG/JPEG/WebP/GIF/BMP | frontend | M | T1 | `supported_format_decode_success_rate == 1.0` | `test_decodeImage_supportedFormats_returnsImageBitmap` and `test_decodeImage_unsupportedFile_rejectsWithError` in `tests/lib/imageDecode.test.ts` — each of PNG/JPEG/WebP/GIF/BMP fixtures decodes to an `ImageBitmap`; a non-image file rejects with a typed error |
| T5 | Basic image editing: crop, resize, rotate, with standard tool placement/icons/shortcuts | frontend | M | T4 | `edit_roundtrip_pixel_diff_max == 0` | `test_cropImage_boundingBox_matchesExpectedPixels`, `test_rotateImage_90Degrees_swapsDimensions`, `test_resizeImage_targetDimensions_matchesOutputDimensions` in `tests/lib/imageEdit.test.ts` — each op on a fixed synthetic fixture matches its deterministically-expected output |
| T6 | Live tweak panel (palette presets + auto, smoothness, detail, contrast, background) driving the two-tier retrace/cheap-edit pipeline | frontend | L | T3, T5 | `tweak_pipeline_routing_accuracy == 1.0` | `test_tweakPipeline_paletteChange_triggersWorkerRetrace`, `test_tweakPipeline_backgroundChange_skipsWorkerCall`, `test_tweakPipeline_rapidChanges_debouncedToLastValue` in `tests/lib/tweakPipeline.test.ts` — retrace params always call the worker, non-retrace params never do, rapid changes collapse to one call |
| T7 | Preview/canvas with original-vs-traced compare (hold-to-compare toggle) | frontend | M | T6 | `compare_toggle_render_correctness == 1.0` | `test_previewCompare_holdPressed_showsOriginal`, `test_previewCompare_released_showsTracedResult` in `tests/components/Preview.test.tsx` — pressing the toggle swaps the rendered image to original, releasing swaps back |
| T8 | Trace-result caching by `(imageId, params)` | frontend | S | T6 | `cache_hit_rate_on_repeated_params == 1.0` | `test_traceCache_repeatedParams_returnsCachedResultWithoutWorkerCall`, `test_traceCache_changedParams_missesCache` in `tests/lib/traceCache.test.ts` — identical params within a session skip the worker; any changed param misses |
| T9 | Export: download `.svg`, copy markup, size/viewBox override, size/path-count estimate | frontend | M | T6, T8 | `export_output_valid_svg_rate == 1.0` | `test_exportSvg_download_producesValidSvgBlob`, `test_exportSvg_copyToClipboard_writesFullMarkup`, `test_exportSvg_viewBoxOverride_appliesWithoutRetrace` in `tests/lib/svgExport.test.ts` — exported output always parses as valid SVG; clipboard write matches the rendered markup; a viewBox override never triggers a worker call |
| T10 | Local settings persistence (`localStorage`, tweak values only, `:v1` key) | frontend | S | T6 | `settings_restore_round_trip_success_rate == 1.0` | `test_settingsStore_saveThenLoad_returnsSameConfig`, `test_settingsStore_corruptedOrMissingStorage_fallsBackToDefaults` in `tests/lib/settingsStore.test.ts` — a saved config round-trips exactly; missing/corrupt storage never throws and falls back to defaults |
| T11 | Performance pass: downscaled preview resolution, max-input-dimension cap, first-trace time budget | frontend | M | T3, T7 | `time_to_first_traced_preview_ms <= 5000` | `test_previewPipeline_typicalPhotoFixture_completesUnderBudget` in `tests/perf/previewBudget.test.ts` — a representative camera/phone-sized fixture completes its first traced preview within budget on the CI runner's baseline hardware |
| T12 | Static hosting deploy pipeline (GitHub Actions → GitHub Pages) | infra | S | T1 | `deployed_site_status_code == 200` | Manual/smoke gate — no unit test; `gate_run.sh` verifies via a recorded `curl -o /dev/null -w '%{http_code}'` against the deployed URL after each deploy |

**Status legend**: ☐ not started · ◐ in progress · ☑ merged

☐ T1 · ☐ T2 · ☐ T3 · ☐ T4 · ☐ T5 · ☐ T6 · ☐ T7 · ☐ T8 · ☐ T9 · ☐ T10 · ☐ T11 · ☐ T12

**Merge order**: T1 first; then T2 and T4 in parallel; then T3 (needs T2) and T5 (needs T4) in parallel; then T6; then T7, T8, T10 in parallel; then T9 (needs T8); then T11. T12 can land any time after T1, in parallel with the rest.

**Branch pattern**: `plan-creation-T<N>-description` from the default branch

## Evidence log

`execution` appends one row per task as it lands (RED → GREEN → RECORD): the measured value, the exact command that produced it, the commit SHA, and the environment provenance. `review` / `ship` audit this table; `gate-check`'s `run_gate.py` reads it. A gated task is not "done" until its row is complete and the measured value meets the gate.

| T# | Gate | Measured | Command | SHA | Env | Date |
|----|------|----------|---------|-----|-----|------|

### Dependency graph

```
T1 ──┬─> T2 ──> T3 ──┐
     ├─> T4 ──> T5 ──┴─> T6 ──┬─> T7 ──┐
     │                        ├─> T8 ──┼─> T9
     │                        └─> T10  │
     │                                 T11 (needs T3, T7)
     └─> T12
```

---

## Sign-off

- [ ] Design reviewed by second engineer
- [ ] Contracts agreed with consuming services
- [ ] Migration strategy validated
- [ ] Ready for execution
