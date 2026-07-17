# Payload: lo-b7ec — T7: Preview/canvas with original-vs-traced compare toggle

**Gate**: `compare_toggle_render_correctness == 1.0`

## Tests

- `test_previewCompare_holdPressed_showsOriginal` in `tests/components/Preview.test.tsx`
- `test_previewCompare_released_showsTracedResult` in `tests/components/Preview.test.tsx`

Pressing the toggle swaps the rendered image to original, releasing swaps back.

## References

- Spec: `status/specification.md` Goals — "at minimum a 'hold to see original' toggle over the preview"; side-by-side compare of two traced versions is a stretch goal, not required.
- Plan: `status/plan.md` "UI flow (step wizard)" step 3 (shared with T6).
- Depends on: `lo-e707` (T6) — renders whatever the tweak pipeline currently holds.
- Sibling: `src/steps/TraceStep.tsx` — this is the step the preview lives inside of.

## Context

Location: `src/components/Preview/*`. Feeds into T11's performance budget (first-traced-preview time).

## Failure notes
