# Payload: lo-d4f4 — T3: Integrate VTracer WASM into Tracer Worker + param translation layer

**Gate**: `trace_success_rate_on_sample_corpus >= 0.95`

## Tests

- `test_vtracerWorker_sampleImages_returnsNonEmptySvg` in `tests/worker/vtracer.test.ts` — every fixture in the sample corpus traces without error.
- `test_paramTranslation_productParams_mapsToValidVtracerConfig` in `tests/worker/vtracer.test.ts` — product params (palette/smoothness/detail/contrast) always translate to an in-range VTracer config.

## References

- Spec: `status/specification.md §5` — the `Tracer` interface (`bitmap → SVG`) VTracer implements; §6 risk row on VTracer-native-param mapping.
- Plan: `status/plan.md` "Technology choices" — VTracer (Rust) → WASM via `wasm-pack`, run in the Worker.
- Depends on: `lo-59ed` (T2) — replaces its stub `Tracer` implementation behind the same worker message protocol; do not change the protocol shape.
- Sample fixtures: reuse/extend the corpus added for T4 (`tests/fixtures/`).

## Context

Location: `src/wasm/` (vendored `wasm-pack` build output), `src/worker/tracer.worker.ts`, `src/lib/paramTranslation.ts`. This is the highest-risk task in the plan (Size L) — expect real iteration on the wasm-pack build step and on tuning the product-param-to-VTracer-param mapping against sample images (spec §6 risk row).

## Failure notes
