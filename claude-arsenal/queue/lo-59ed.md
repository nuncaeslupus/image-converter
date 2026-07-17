# Payload: lo-59ed — T2: Tracer Worker message protocol + stub Tracer implementation

**Gate**: `trace_protocol_round_trip_success_rate == 1.0`

## Tests

- `test_tracerWorker_validRequest_returnsTraceResult` in `tests/worker/tracerProtocol.test.ts` — a valid request always resolves a typed `trace-result`.
- `test_tracerWorker_staleRequestId_discardedByMainThread` in `tests/worker/tracerProtocol.test.ts` — a response whose `requestId` isn't the latest sent is dropped by the main thread (last-tweak-wins).

## References

- Spec: `status/specification.md §5` — Worker message contract (request/response JSON shapes, `requestId` semantics).
- Plan: `status/plan.md` "Implementation tasks" T2 row and "Data flow" steps 3-5.
- Sibling: `src/lib/wizard.ts` — existing pattern for a typed, framework-free `src/lib/*.ts` module in this repo.
- No real VTracer integration here — the `Tracer` interface implementation is a stub that echoes back a minimal valid SVG; T3 swaps in the real WASM engine behind the same interface.

## Context

Location: `src/worker/tracer.worker.ts`, `src/lib/traceProtocol.ts`. This is the load-bearing boundary that keeps tracing off the main thread — get the message shapes and the stale-`requestId` discard right here since T3, T6, T7, T8, T9, T11 all build on it.

## Failure notes
