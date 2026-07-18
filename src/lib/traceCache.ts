/**
 * In-memory (session-lifetime) trace-result cache keyed by `(imageId, params)`
 * — see status/plan.md "Data flow" step 5. A cache hit returns the stored
 * result without re-invoking the tracer; any changed param is a miss. This is
 * separate from the worker's `requestId` last-wins discard (spec §5) — that
 * drops *stale* in-flight responses, this avoids re-tracing *identical* params.
 */
import type { TraceParams } from "./traceProtocol";

export interface TraceCacheResult {
  svg: string;
  pathCount: number;
}

function traceCacheKey(imageId: string, params: TraceParams): string {
  return `${imageId}:${params.paletteSize}:${params.smoothness}:${params.detail}:${params.contrast}`;
}

export interface TraceCache {
  get(imageId: string, params: TraceParams): TraceCacheResult | undefined;
  set(imageId: string, params: TraceParams, result: TraceCacheResult): void;
}

export function createTraceCache(): TraceCache {
  const store = new Map<string, TraceCacheResult>();
  return {
    get: (imageId, params) => store.get(traceCacheKey(imageId, params)),
    set: (imageId, params, result) => {
      store.set(traceCacheKey(imageId, params), result);
    },
  };
}

/**
 * Wraps a `(imageId, params) => Promise<result>` trace function with the
 * given cache: a hit resolves immediately without calling `trace`; a miss
 * calls it and stores the result.
 */
export function withTraceCache(
  cache: TraceCache,
  trace: (imageId: string, params: TraceParams) => Promise<TraceCacheResult>,
): (imageId: string, params: TraceParams) => Promise<TraceCacheResult> {
  return async (imageId, params) => {
    const cached = cache.get(imageId, params);
    if (cached) return cached;
    const result = await trace(imageId, params);
    cache.set(imageId, params, result);
    return result;
  };
}
