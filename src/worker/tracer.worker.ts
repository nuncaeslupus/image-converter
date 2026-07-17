/**
 * Tracer Worker entry point. Wires the message protocol (src/lib/traceProtocol.ts)
 * to a `Tracer` implementation, keeping tracing off the main thread (see
 * status/specification.md §5 "Worker message contract").
 *
 * T2 ships a stub Tracer that echoes back a minimal valid SVG so the protocol
 * can be exercised end-to-end. T3 swaps this for the real VTracer WASM engine
 * behind the same `Tracer` interface — the message shapes here don't change.
 *
 * The protocol logic (`handleTraceMessage`, `stubTracer`) is exported as plain,
 * testable functions decoupled from the raw `Worker`/`postMessage` globals, so
 * it can be unit-tested under jsdom without a real worker runtime. Only the
 * bottom of this file performs the actual `self.onmessage` wiring, guarded so
 * it's a no-op outside an actual dedicated-worker global scope (e.g. when this
 * module is imported from a test).
 */
import type { Tracer, TraceRequest, TraceResponse } from "../lib/traceProtocol";

/** Stub Tracer: returns a minimal valid SVG sized to the bitmap. Real VTracer integration lands in T3. */
export const stubTracer: Tracer = {
  trace(bitmap, _params) {
    void _params;
    const { width, height } = bitmap;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`;
    return Promise.resolve({ svg, pathCount: 0 });
  },
};

/**
 * Runs a single trace request against the given Tracer and returns the typed
 * response (success or error). Pure orchestration — no worker globals — so it
 * is directly unit-testable.
 */
export async function handleTraceMessage(
  request: TraceRequest,
  tracer: Tracer,
): Promise<TraceResponse> {
  const start = performance.now();
  try {
    const { svg, pathCount } = await tracer.trace(request.image.bitmap, request.params);
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
  workerScope.onmessage = (event: MessageEvent<TraceRequest>) => {
    void handleTraceMessage(event.data, stubTracer).then((response) =>
      workerScope.postMessage(response),
    );
  };
}
