import { describe, expect, it, vi } from "vitest";
import { createTraceDispatcher, createTraceRequest } from "../../src/lib/traceProtocol";
import {
  createSupersedeGuard,
  handleTraceMessage,
  stubTracer,
} from "../../src/worker/tracer.worker";

function fakeBitmap(width: number, height: number, close = () => {}): ImageBitmap {
  return { width, height, close } as unknown as ImageBitmap;
}

describe("tracer worker protocol", () => {
  it("test_tracerWorker_validRequest_returnsTraceResult", async () => {
    const request = createTraceRequest(
      { bitmap: fakeBitmap(10, 20), width: 10, height: 20 },
      { paletteSize: "auto", smoothness: 50, detail: 50, contrast: 0 },
    );

    const response = await handleTraceMessage(request, stubTracer);

    expect(response).not.toBeNull();
    expect(response?.type).toBe("trace-result");
    expect(response?.requestId).toBe(request.requestId);
    if (response?.type === "trace-result") {
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
    expect(staleResponse).not.toBeNull();
    expect(freshResponse).not.toBeNull();

    const acceptedStale = dispatcher.acceptResponse(staleResponse!);
    const acceptedFresh = dispatcher.acceptResponse(freshResponse!);

    expect(acceptedStale).toBeNull();
    expect(acceptedFresh).not.toBeNull();
    expect(acceptedFresh?.requestId).toBe(second.requestId);
  });

  describe("createSupersedeGuard", () => {
    it("test_supersedeGuard_onlyLatestObserved_isNotSuperseded", () => {
      const guard = createSupersedeGuard();
      guard.observe("req-1");
      guard.observe("req-2");

      expect(guard.isSuperseded("req-1")).toBe(true);
      expect(guard.isSuperseded("req-2")).toBe(false);
    });

    it("test_supersedeGuard_noRequestObservedYet_defaultsToSuperseded", () => {
      const guard = createSupersedeGuard();
      expect(guard.isSuperseded("req-1")).toBe(true);
    });
  });

  describe("handleTraceMessage supersede handling", () => {
    it("test_handleTraceMessage_supersededRequest_skipsTraceAndClosesBitmap", async () => {
      const close = vi.fn();
      const request = createTraceRequest(
        { bitmap: fakeBitmap(4, 4, close), width: 4, height: 4 },
        { paletteSize: "auto", smoothness: 50, detail: 50, contrast: 0 },
      );
      const traceSpy = vi.spyOn(stubTracer, "trace");

      const response = await handleTraceMessage(request, stubTracer, () => true);

      expect(response).toBeNull();
      expect(traceSpy).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalledTimes(1);
      traceSpy.mockRestore();
    });

    it("test_handleTraceMessage_notSuperseded_stillTraces", async () => {
      const request = createTraceRequest(
        { bitmap: fakeBitmap(4, 4), width: 4, height: 4 },
        { paletteSize: "auto", smoothness: 50, detail: 50, contrast: 0 },
      );

      const response = await handleTraceMessage(request, stubTracer, () => false);

      expect(response).not.toBeNull();
      expect(response?.type).toBe("trace-result");
    });
  });
});
