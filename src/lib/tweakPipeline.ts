/**
 * Two-tier tweak pipeline (T6) — routes every tweak-panel change to either a
 * debounced Tracer Worker retrace (palette/smoothness/detail/contrast) or an
 * immediate, worker-free cheap edit (background). This is the authoritative
 * boundary from status/specification.md §5 "Worker message contract" and
 * status/plan.md "Data flow" steps 3-6: `params` sent to the worker is
 * exactly the four retrace fields; background never appears in a worker
 * request. Worker-agnostic by design — the actual worker call is injected —
 * so the routing/debounce logic is unit-testable without a real Worker.
 */
import type { TraceParams } from "./traceProtocol";

/** Background handling — see spec §5 local-storage contract. Cheap edit only, never retraces. */
export type BackgroundMode = "transparent" | "solid" | "removed";

/** Every value the tweak panel exposes: the four retrace params plus background. */
export interface TweakValues extends TraceParams {
  background: BackgroundMode;
}

/** The tweak panel's initial/fallback values. */
export const DEFAULT_TWEAK_VALUES: TweakValues = {
  paletteSize: "auto",
  smoothness: 50,
  detail: 50,
  contrast: 0,
  background: "transparent",
};

const RETRACE_KEYS = ["paletteSize", "smoothness", "detail", "contrast"] as const;

function retraceParamsChanged(a: TweakValues, b: TweakValues): boolean {
  return RETRACE_KEYS.some((key) => a[key] !== b[key]);
}

/** Narrows a full `TweakValues` snapshot to just the four fields the worker's
 * `TraceParams` cares about — shared so every call site (the debounced
 * pipeline here, the initial/retry trace, and the full-resolution export
 * trace) builds the worker request from the same field list. */
export function toTraceParams({
  paletteSize,
  smoothness,
  detail,
  contrast,
}: TweakValues): TraceParams {
  return { paletteSize, smoothness, detail, contrast };
}

export interface TweakPipelineCallbacks {
  /** Debounced; always a worker call. Receives only the four retrace params. */
  runRetrace: (params: TraceParams) => void;
  /** Immediate; never a worker call. Receives the full tweak values. */
  applyCheapEdit: (values: TweakValues) => void;
}

export interface TweakPipeline {
  /** Feed the panel's latest full value set. Routes + debounces internally. */
  update(values: TweakValues): void;
  /** Cancels any pending debounced retrace (e.g. on unmount). */
  dispose(): void;
}

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * `initial` is the pipeline's change-detection baseline, not a trigger — the
 * caller is responsible for the very first trace (e.g. on mount); this
 * pipeline only reacts to values that differ from what came before.
 */
export function createTweakPipeline(
  initial: TweakValues,
  callbacks: TweakPipelineCallbacks,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): TweakPipeline {
  let current = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    update(values: TweakValues): void {
      const retraceChanged = retraceParamsChanged(current, values);
      const backgroundChanged = current.background !== values.background;
      current = values;

      if (retraceChanged) {
        if (timer !== undefined) clearTimeout(timer);
        // Rapid changes collapse to one call: only the timer scheduled by the
        // LAST update before it fires ever runs, closing over that call's
        // (latest) values.
        timer = setTimeout(() => {
          timer = undefined;
          callbacks.runRetrace(toTraceParams(values));
        }, debounceMs);
      }
      if (backgroundChanged) {
        callbacks.applyCheapEdit(values);
      }
    },
    dispose(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

const BACKGROUND_RECT_MARKER = 'data-tweak-background="true"';
const BACKGROUND_RECT_REGEX = new RegExp(`<rect[^>]*${BACKGROUND_RECT_MARKER}[^>]*/>`);

/**
 * Cheap SVG-only background edit — mutates the already-traced SVG string
 * directly, never re-runs the tracer.
 *
 * NOTE: "transparent" and "removed" both render as no background rect —
 * a real "detected background removed" mode needs pixel-level background
 * detection in the tracer itself (out of scope here); upgrade this to a
 * distinct code path if/when that heuristic lands.
 */
export function applyBackground(svg: string, background: BackgroundMode): string {
  const stripped = svg.replace(BACKGROUND_RECT_REGEX, "");
  if (background !== "solid") return stripped;
  return stripped.replace(
    /<svg[^>]*>/,
    (openTag) =>
      `${openTag}<rect width="100%" height="100%" fill="#fff" ${BACKGROUND_RECT_MARKER}/>`,
  );
}
