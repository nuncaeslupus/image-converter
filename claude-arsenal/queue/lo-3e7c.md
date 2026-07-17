# Payload: lo-3e7c — T10: Local settings persistence (localStorage last-used tweak values)

**Gate**: `settings_restore_round_trip_success_rate == 1.0`

## Tests

- `test_settingsStore_saveThenLoad_returnsSameConfig` in `tests/lib/settingsStore.test.ts`
- `test_settingsStore_corruptedOrMissingStorage_fallsBackToDefaults` in `tests/lib/settingsStore.test.ts`

A saved config round-trips exactly; missing/corrupt storage never throws and falls back to defaults.

## References

- Spec: `status/specification.md §5` Local storage contract — key `image-converter:last-settings:v1`, tweak values only, never image data.
- Plan: `status/plan.md` "State changes" table.
- Depends on: `lo-e707` (T6) — persists the tweak values T6 owns.

## Context

Location: `src/lib/settingsStore.ts`. Small (Size S) — a good candidate to parallelize alongside T7/T8 once T6 lands.

## Failure notes
