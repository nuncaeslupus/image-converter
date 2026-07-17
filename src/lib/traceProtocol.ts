/**
 * Message protocol for the Tracer Worker boundary (see status/specification.md
 * §5 "Worker message contract"). This module is the single source of truth for
 * the request/response shapes shared by the worker (src/worker/tracer.worker.ts)
 * and the main thread. It is plain TS, no framework coupling — see
 * src/lib/wizard.ts for the sibling pattern this follows.
 */

/** 1-64, or "auto" to let the tracer choose. */
export type PaletteSize = number | "auto";

export interface TraceParams {
  paletteSize: PaletteSize;
  /** 0-100 */
  smoothness: number;
  /** 0-100 */
  detail: number;
  /** -100-100 */
  contrast: number;
}

export interface TraceImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** main -> worker */
export interface TraceRequest {
  type: "trace";
  requestId: string;
  image: TraceImage;
  params: TraceParams;
}

/** worker -> main, success */
export interface TraceResultResponse {
  type: "trace-result";
  requestId: string;
  svg: string;
  pathCount: number;
  durationMs: number;
}

/** worker -> main, failure */
export interface TraceErrorResponse {
  type: "trace-error";
  requestId: string;
  message: string;
}

export type TraceResponse = TraceResultResponse | TraceErrorResponse;

/**
 * The bitmap -> SVG abstraction the worker drives. VTracer-via-WASM is the v1
 * implementation (see T3); keeping the protocol shaped around this interface,
 * not around VTracer's native params, leaves room for a future AI tracer to be
 * swapped in later without touching the tweak panel or export code.
 */
export interface Tracer {
  trace(bitmap: ImageBitmap, params: TraceParams): Promise<{ svg: string; pathCount: number }>;
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers/jsdom).
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Builds a fresh `trace` request with a new requestId. */
export function createTraceRequest(image: TraceImage, params: TraceParams): TraceRequest {
  return { type: "trace", requestId: generateRequestId(), image, params };
}

/** Narrows an arbitrary worker message to a well-typed TraceResponse. */
export function isTraceResponse(value: unknown): value is TraceResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.requestId !== "string") return false;
  if (candidate.type === "trace-result") {
    return (
      typeof candidate.svg === "string" &&
      typeof candidate.pathCount === "number" &&
      typeof candidate.durationMs === "number"
    );
  }
  if (candidate.type === "trace-error") {
    return typeof candidate.message === "string";
  }
  return false;
}

/**
 * Main-thread-side helper that tracks the latest sent requestId and discards
 * any incoming response that doesn't match it. This is what makes rapid slider
 * drags ("last-tweak-wins") safe without an explicit cancel message — the
 * worker itself never needs to know a request was superseded.
 */
export interface TraceDispatcher {
  /** Call when a request is sent to the worker, before/at postMessage time. */
  registerSent(requestId: string): void;
  /**
   * Given an incoming response, returns it unchanged if its requestId matches
   * the latest sent request, or `null` if it is stale and should be dropped.
   */
  acceptResponse<T extends TraceResponse>(response: T): T | null;
}

export function createTraceDispatcher(): TraceDispatcher {
  let latestRequestId: string | null = null;

  return {
    registerSent(requestId: string): void {
      latestRequestId = requestId;
    },
    acceptResponse<T extends TraceResponse>(response: T): T | null {
      return response.requestId === latestRequestId ? response : null;
    },
  };
}
