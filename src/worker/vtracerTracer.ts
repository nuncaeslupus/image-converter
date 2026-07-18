/**
 * Real VTracer engine behind the {@link Tracer} interface (T3). Wraps the
 * vendored WASM build in src/wasm (compiled from vtracer-wasm/, the `vtracer`
 * Rust crate + wasm-bindgen) and the product->native param translation.
 *
 * The browser-only pixel extraction (ImageBitmap -> RGBA via OffscreenCanvas)
 * is kept separate from {@link traceRgba}, the pure core that takes raw RGBA.
 * Tests drive `traceRgba` directly with decoded fixture bytes, so the trace
 * path is exercised without a real canvas (jsdom has no rendering backend).
 */
import initWasm, { convert_rgba, type InitInput } from "../wasm/vtracer_wasm.js";
import { translateParams } from "../lib/paramTranslation";
import type { Tracer, TraceParams } from "../lib/traceProtocol";

let initPromise: Promise<unknown> | null = null;

/**
 * Initializes the VTracer WASM module exactly once (idempotent). In the browser
 * worker, call with no argument — Vite resolves the sibling `.wasm` asset URL.
 * In Node/tests, pass the wasm bytes (or a compiled module) explicitly, since
 * the default fetch-by-URL path has no server to hit.
 */
export function initVtracer(input?: InitInput): Promise<unknown> {
  if (!initPromise) {
    initPromise = input === undefined ? initWasm() : initWasm({ module_or_path: input });
  }
  return initPromise;
}

function countPaths(svg: string): number {
  return (svg.match(/<path[\s/>]/g) ?? []).length;
}

/**
 * Pure trace over a raw RGBA buffer — the testable core. Ensures the WASM is
 * initialized, translates the product params to a native VTracer config, and
 * returns the SVG plus its path count.
 */
export async function traceRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  params: TraceParams,
): Promise<{ svg: string; pathCount: number }> {
  await initVtracer();
  const c = translateParams(params);
  const svg = convert_rgba(
    rgba,
    width,
    height,
    c.colorMode,
    c.hierarchical,
    c.mode,
    c.filterSpeckle,
    c.colorPrecision,
    c.layerDifference,
    c.cornerThreshold,
    c.lengthThreshold,
    c.spliceThreshold,
    c.maxIterations,
    c.pathPrecision,
  );
  return { svg, pathCount: countPaths(svg) };
}

/** Reads an ImageBitmap's pixels back out as RGBA (browser only). */
function bitmapToRgba(bitmap: ImageBitmap): {
  rgba: Uint8Array;
  width: number;
  height: number;
} {
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get a 2D canvas context to read image pixels.");
  }
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width, height };
}

/**
 * The production Tracer: extract pixels from the ImageBitmap, then delegate to
 * the pure {@link traceRgba} core.
 */
export function createVtracerTracer(): Tracer {
  return {
    trace(bitmap, params) {
      const { rgba, width, height } = bitmapToRgba(bitmap);
      return traceRgba(rgba, width, height, params);
    },
  };
}
