import { describe, expect, it } from "vitest";
import { createTraceDispatcher, createTraceRequest } from "../../src/lib/traceProtocol";
import { handleTraceMessage, stubTracer } from "../../src/worker/tracer.worker";

function fakeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: () => {} } as unknown as ImageBitmap;
}

describe("tracer worker protocol", () => {
  it("test_tracerWorker_validRequest_returnsTraceResult", async () => {
    const request = createTraceRequest(
      { bitmap: fakeBitmap(10, 20), width: 10, height: 20 },
      { paletteSize: "auto", smoothness: 50, detail: 50, contrast: 0 },
    );

    const response = await handleTraceMessage(request, stubTracer);

    expect(response.type).toBe("trace-result");
    expect(response.requestId).toBe(request.requestId);
    if (response.type === "trace-result") {
      expect(response.svg.length).toBeGreaterThan(0);
      expect(typeof response.pathCount).toBe("number");
    }
  });

  it("test_tracerWorker_staleRequestId_discardedByMainThread", async () => {
    const dispatcher = createTraceDispatcher();

    // First request is sent, then immediately superseded by a second (rapid
    // slider drag). The worker resolves the FIRST (now-stale) request only
    // after the second has already been sent.
    const first = createTraceRequest(
      { bitmap: fakeBitmap(1, 1), width: 1, height: 1 },
      { paletteSize: 8, smoothness: 10, detail: 10, contrast: 0 },
    );
    dispatcher.registerSent(first.requestId);

    const second = createTraceRequest(
      { bitmap: fakeBitmap(1, 1), width: 1, height: 1 },
      { paletteSize: 8, smoothness: 90, detail: 90, contrast: 0 },
    );
    dispatcher.registerSent(second.requestId);

    const staleResponse = await handleTraceMessage(first, stubTracer);
    const freshResponse = await handleTraceMessage(second, stubTracer);

    const acceptedStale = dispatcher.acceptResponse(staleResponse);
    const acceptedFresh = dispatcher.acceptResponse(freshResponse);

    expect(acceptedStale).toBeNull();
    expect(acceptedFresh).not.toBeNull();
    expect(acceptedFresh?.requestId).toBe(second.requestId);
  });
});
