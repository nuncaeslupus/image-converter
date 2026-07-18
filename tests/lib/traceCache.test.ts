import { describe, expect, it, vi } from "vitest";
import { createTraceCache, withTraceCache } from "../../src/lib/traceCache";
import type { TraceParams } from "../../src/lib/traceProtocol";

const PARAMS: TraceParams = { paletteSize: 4, smoothness: 50, detail: 50, contrast: 0 };
const RESULT = { svg: "<svg/>", pathCount: 3 };

describe("traceCache", () => {
  it("test_traceCache_repeatedParams_returnsCachedResultWithoutWorkerCall", async () => {
    const trace = vi.fn().mockResolvedValue(RESULT);
    const cachedTrace = withTraceCache(createTraceCache(), trace);

    const first = await cachedTrace("image-1", PARAMS);
    const second = await cachedTrace("image-1", PARAMS);

    expect(trace).toHaveBeenCalledTimes(1);
    expect(first).toEqual(RESULT);
    expect(second).toEqual(RESULT);
  });

  it("test_traceCache_changedParams_missesCache", async () => {
    const trace = vi.fn().mockResolvedValue(RESULT);
    const cachedTrace = withTraceCache(createTraceCache(), trace);

    await cachedTrace("image-1", PARAMS);
    await cachedTrace("image-1", { ...PARAMS, smoothness: 60 });

    expect(trace).toHaveBeenCalledTimes(2);
  });
});
