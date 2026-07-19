/**
 * Tracer Worker entry point. Wires the message protocol (src/lib/traceProtocol.ts)
 * to a `Tracer` implementation, keeping tracing off the main thread (see
 * status/specification.md §5 "Worker message contract").
 *
 * T3 wires the real VTracer WASM engine (`createVtracerTracer`, see
 * ./vtracerTracer) behind the `Tracer` interface — the message shapes here
 * don't change. `stubTracer` is retained as a lightweight test double for the
 * protocol tests, which must not depend on the WASM module.
 *
 * The protocol logic (`handleTraceMessage`) is exported as a plain, testable
 * function decoupled from the raw `Worker`/`postMessage` globals, so it can be
 * unit-tested under jsdom without a real worker runtime. Only the bottom of
 * this file performs the actual `self.onmessage` wiring, guarded so it's a
 * no-op outside an actual dedicated-worker global scope (e.g. when this module
 * is imported from a test).
 */
import type { Tracer, TraceRequest, TraceResponse } from "../lib/traceProtocol";
import { createVtracerTracer } from "./vtracerTracer";

/** Minimal deterministic Tracer double for protocol tests (no WASM). */
export const stubTracer: Tracer = {
  trace(bitmap, _params) {
    void _params;
    const { width, height } = bitmap;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`;
    return Promise.resolve({ svg, pathCount: 0 });
  },
};

/**
 * Worker-side supersede guard: last-tweak-wins (src/lib/traceProtocol.ts's
 * `TraceDispatcher`) is enforced only on the main thread today, which drops
 * *stale responses* but still makes the worker spend the full ~1s tracing
 * every queued request, delaying the one result anybody actually wants. This
 * guard tracks the newest `requestId` the worker has SEEN (not a numeric
 * ordering — request ids aren't guaranteed sortable, e.g. the
 * `crypto.randomUUID()` case), so a request can be skipped once a newer one
 * has arrived before its expensive trace has started.
 */
export interface SupersedeGuard {
  /** Call as soon as a request is received, before deciding whether to trace it. */
  observe(requestId: string): void;
  /** True once `requestId` is no longer the newest request observed. */
  isSuperseded(requestId: string): boolean;
}

export function createSupersedeGuard(): SupersedeGuard {
  let latestRequestId: string | null = null;
  return {
    observe(requestId: string): void {
      latestRequestId = requestId;
    },
    isSuperseded(requestId: string): boolean {
      return requestId !== latestRequestId;
    },
  };
}

/**
 * Runs a single trace request against the given Tracer and returns the typed
 * response (success or error), or `null` if `isSuperseded` reports the
 * request is already stale — in which case nothing should be posted back (the
 * main-thread dispatcher would drop it anyway, see `acceptResponse`) and the
 * request's bitmap is released here since the tracer never gets to close it.
 * Pure orchestration — no worker globals — so it is directly unit-testable.
 */
export async function handleTraceMessage(
  request: TraceRequest,
  tracer: Tracer,
  isSuperseded?: (requestId: string) => boolean,
): Promise<TraceResponse | null> {
  if (isSuperseded?.(request.requestId)) {
    request.image.bitmap.close();
    return null;
  }
  const start = performance.now();
  try {
    const { svg, pathCount } = await tracer.trace(request.image.bitmap, request.params);
    if (isSuperseded?.(request.requestId)) return null;
    return {
      type: "trace-result",
      requestId: request.requestId,
      svg,
      pathCount,
      durationMs: performance.now() - start,
    };
  } catch (error) {
    return {
      type: "trace-error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Minimal shape of the dedicated-worker global scope this file needs. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<TraceRequest>) => void) | null;
  postMessage(message: TraceResponse): void;
}

// Feature-detect an actual dedicated-worker global scope (only present when
// this module is loaded as a real Worker entry point, not when imported by
// tests under jsdom). `importScripts` is a WorkerGlobalScope-only global.
const workerScope: WorkerScope | undefined =
  typeof self !== "undefined" && "importScripts" in self
    ? (self as unknown as WorkerScope)
    : undefined;

if (workerScope) {
  const tracer = createVtracerTracer();
  const guard = createSupersedeGuard();
  workerScope.onmessage = (event: MessageEvent<TraceRequest>) => {
    const request = event.data;
    guard.observe(request.requestId);
    void handleTraceMessage(request, tracer, guard.isSuperseded).then((response) => {
      if (response) workerScope.postMessage(response);
    });
  };
}
