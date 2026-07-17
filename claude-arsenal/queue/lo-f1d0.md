# Payload: lo-f1d0 — T11: Performance pass (downscaled preview, max-dim cap, first-trace budget)

**Gate**: `time_to_first_traced_preview_ms <= 5000`

## Tests

- `test_previewPipeline_typicalPhotoFixture_completesUnderBudget` in `tests/perf/previewBudget.test.ts` — a representative camera/phone-sized fixture completes its first traced preview within budget on the CI runner's baseline hardware.

## References

- Spec: `status/specification.md §1` success criteria — `time_to_first_traced_preview <= ~5s`; §6 risk row on large images freezing the tab on low-end/mobile devices.
- Plan: `status/plan.md` "Data flow" step 4 — worker downscales for the live preview pass.
- Depends on: `lo-d4f4` (T3, real tracer to benchmark against) and `lo-b7ec` (T7, preview pipeline to tune).

## Context

Location: `src/lib/previewDownscale.ts`. Offline capability (also a spec §1 success criterion) is explicitly a manual validation item per the spec, not a unit-test gate — note it in this task's PR description as a manual check, don't try to force it into the numeric gate.

## Failure notes
