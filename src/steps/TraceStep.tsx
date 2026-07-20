import { useEffect, useRef, useState } from "preact/hooks";
import type { Wizard } from "../lib/wizard";
import { TweakPanel, PALETTE_OPTIONS } from "../components/TweakPanel/TweakPanel";
import { Preview } from "../components/Preview/Preview";
import {
  createTweakPipeline,
  applyBackground,
  toTraceParams,
  DEFAULT_TWEAK_VALUES,
  type TweakPipeline,
  type TweakValues,
} from "../lib/tweakPipeline";
import {
  createTraceDispatcher,
  createTraceRequest,
  isTraceResponse,
  type TraceParams,
} from "../lib/traceProtocol";
import { downscaleForPreview, BW_PREVIEW_MAX_DIMENSION } from "../lib/previewDownscale";
import { useBakedImage } from "../lib/useBakedImage";
import { medianCutPalette, rgbToHex, significantColorCount } from "../lib/quantize";
import { countSvgColors } from "../lib/svgExport";
import appStyles from "../App.module.css";
import styles from "./TraceStep.module.css";

const DEFAULT_VALUES: TweakValues = DEFAULT_TWEAK_VALUES;

// The color counts that get a swatch preview — derived from PALETTE_OPTIONS so
// the two can never drift (B&W and Auto render their own label, not swatches).
const PREVIEW_COUNTS = PALETTE_OPTIONS.filter((p): p is number => typeof p === "number" && p >= 2);

/** A 2D context on the widest-supported canvas — OffscreenCanvas where present,
 * else a plain <canvas> (older Safari / environments without OffscreenCanvas),
 * so the swatch sampling still works instead of being silently skipped. */
function get2dContext(
  w: number,
  h: number,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h).getContext("2d");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext("2d");
}

interface PaletteInfo {
  /** Real swatch colors per option count ("2".."16"). */
  previews: Record<string, string[]>;
  /** How many colors the image meaningfully has (caps the offered counts). */
  maxColors: number;
}

/**
 * Samples the image down to a small RGBA buffer and derives each palette
 * option's real colors via median cut — the same algorithm the worker uses to
 * quantize before tracing, so the swatches match the rendered result closely —
 * plus the image's significant color count. Cheap (palette only, no trace) and
 * computed once per baked image. Returns `undefined` where there's no canvas
 * (jsdom) so the panel just omits swatches.
 */
function computePaletteInfo(bitmap: ImageBitmap): PaletteInfo | undefined {
  const CAP = 64;
  const scale = Math.min(1, CAP / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  try {
    const ctx = get2dContext(w, h);
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const previews: Record<string, string[]> = {};
    for (const n of PREVIEW_COUNTS) {
      previews[String(n)] = medianCutPalette(rgba, n).map(rgbToHex);
    }
    return { previews, maxColors: significantColorCount(rgba) };
  } catch {
    return undefined;
  }
}

/**
 * Wizard step 3 — the live tweak panel driving the two-tier retrace/
 * cheap-edit pipeline (T6). Owns the Tracer Worker instance and wires it to
 * `tweakPipeline.ts`'s routing/debounce logic: retrace-affecting changes
 * (palette/smoothness/detail/contrast) call the worker (debounced,
 * last-value-wins via `createTraceDispatcher`); background changes never do
 * (see status/specification.md §5, status/plan.md "Data flow" steps 3-6).
 *
 * Tweak values and the traced SVG are lifted onto `wizard` (tweakValues/svg)
 * rather than living only in this component's local state: `App.tsx` mounts
 * exactly one step at a time, so navigating Trace -> Export -> Back
 * previously remounted this component from scratch, resetting tweaks to
 * defaults and re-tracing over the user's actual result. On mount, an
 * already-published `wizard.svg` is reused as-is (no re-trace); a fresh trace
 * only runs when there's nothing to reuse (first visit, or after an edit
 * invalidated it — see EditStep).
 */
export function TraceStep({ wizard }: { wizard: Wizard }) {
  const [values, setValues] = useState<TweakValues>(() => wizard.tweakValues ?? DEFAULT_VALUES);
  const [tracedSvg, setTracedSvg] = useState<string | null>(() => wizard.svg);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valuesRef = useRef(values);
  const rawSvgRef = useRef<string | null>(wizard.svg);
  const pipelineRef = useRef<TweakPipeline | null>(null);
  const dispatcherRef = useRef(createTraceDispatcher());
  const retryRef = useRef<() => void>(() => {});

  // The image to trace is the source with Edit's crop/rotate baked in — a
  // fresh upright bitmap, re-baked when the source or transform changes.
  const image = useBakedImage(wizard.image, wizard.transform);

  // Real per-palette swatches + significant color count for the Colors control,
  // sampled from the current baked image (recomputed only when it changes).
  const [paletteInfo, setPaletteInfo] = useState<PaletteInfo | undefined>(undefined);
  useEffect(() => {
    setPaletteInfo(image ? computePaletteInfo(image) : undefined);
  }, [image]);

  // Publish the current traced SVG up to the wizard so ExportStep (T9) reads
  // it. Only publish real results — the initial local state is seeded from
  // `wizard.svg` itself (never a bare `null`), so this never wipes a
  // previously published SVG on mount.
  useEffect(() => {
    if (tracedSvg !== null) {
      wizard.setSvg(tracedSvg);
    }
  }, [tracedSvg]);

  useEffect(() => {
    if (!image) return;
    const workingImage = image;

    const worker = new Worker(new URL("../worker/tracer.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isTraceResponse(event.data)) return;
      const response = dispatcherRef.current.acceptResponse(event.data);
      if (!response) return; // stale — superseded by a later request, discard (last-tweak-wins)

      setBusy(false);
      if (response.type === "trace-result") {
        rawSvgRef.current = response.svg;
        setError(null);
        setTracedSvg(applyBackground(response.svg, valuesRef.current.background));
      } else {
        setError(response.message);
      }
    };

    // The worker module can fail to load entirely (offline first visit, a
    // bad deploy path) — with only `onmessage` wired, no message ever
    // arrives and the UI is stuck on "Tracing…" forever with controls
    // disabled. `onerror`/`onmessageerror` make sure `busy` always clears and
    // the user gets an actionable error instead.
    worker.onerror = () => {
      setBusy(false);
      setError("The tracer failed to start. Please try again.");
    };
    worker.onmessageerror = () => {
      setBusy(false);
      setError("The tracer sent a response that couldn't be read. Please try again.");
    };

    async function runRetrace(params: TraceParams) {
      setBusy(true);
      try {
        // A fresh copy per retrace: the worker transfers (and closes) the
        // bitmap it receives, so the wizard's own working image must never be
        // transferred directly, or every later retrace would find it detached.
        // Downscaled to a bounded preview resolution before tracing (T11) —
        // tracing at full source resolution can blow the ~5s preview budget by
        // an order of magnitude on typical camera/phone photos. B&W is
        // pre-binarized to one color (few paths, cheap), so it uses a higher cap
        // for a crisp, precise contour instead of the softened 512 default.
        const cap = params.paletteSize === 1 ? BW_PREVIEW_MAX_DIMENSION : undefined;
        const bitmapCopy = await downscaleForPreview(await createImageBitmap(workingImage), cap);
        const request = createTraceRequest(
          { bitmap: bitmapCopy, width: bitmapCopy.width, height: bitmapCopy.height },
          params,
        );
        dispatcherRef.current.registerSent(request.requestId);
        worker.postMessage(request, [bitmapCopy]);
      } catch {
        // createImageBitmap/downscale can reject (closed bitmap, resource
        // pressure); without this the rejection escapes the void call and
        // `busy` sticks at true with the controls disabled forever.
        setBusy(false);
        setError("Couldn't prepare the image for tracing. Please try again.");
      }
    }

    retryRef.current = () => void runRetrace(toTraceParams(valuesRef.current));

    pipelineRef.current = createTweakPipeline(valuesRef.current, {
      runRetrace: (params) => void runRetrace(params),
      applyCheapEdit: (nextValues) => {
        if (rawSvgRef.current) {
          setTracedSvg(applyBackground(rawSvgRef.current, nextValues.background));
        }
      },
    });

    // Initial trace on mount — but only when there's nothing to reuse.
    // `wizard.svg` already holds a valid result for the current image unless
    // this is the first-ever visit or an edit invalidated it (EditStep sets
    // it to `null`); re-tracing unconditionally here would overwrite the
    // user's tweaked result with a fresh default-params trace on every
    // Trace <-> Export round trip.
    if (!wizard.svg) {
      void runRetrace(toTraceParams(valuesRef.current));
    }

    return () => {
      pipelineRef.current?.dispose();
      pipelineRef.current = null;
      worker.terminate();
    };
    // Re-runs only if the working image itself is replaced; intentionally
    // ignores `values`/callbacks, which are read via refs above.
  }, [image]);

  function handleChange(next: TweakValues) {
    valuesRef.current = next;
    setValues(next);
    wizard.setTweakValues(next);
    pipelineRef.current?.update(next);
  }

  function handleRetry() {
    retryRef.current();
  }

  if (!wizard.image) {
    return (
      <section>
        <p role="alert">No image to trace yet — go back and choose one first.</p>
      </section>
    );
  }

  return (
    <section className={styles.root}>
      <div className={styles.layout}>
        <div className={styles.previewCol}>
          {tracedSvg ? (
            <Preview
              title="Trace & Tweak"
              tracedSvg={tracedSvg}
              originalImage={image}
              busy={busy}
            />
          ) : (
            <div className={styles.loading} role={error ? "alert" : "status"}>
              {error ? (
                <div className={styles.initialError}>
                  <span className={styles.error}>{error}</span>
                  <button type="button" className={appStyles.btnPrimary} onClick={handleRetry}>
                    Try again
                  </button>
                </div>
              ) : (
                "Tracing…"
              )}
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <TweakPanel
            values={values}
            onChange={handleChange}
            palettePreviews={paletteInfo?.previews}
            maxColors={paletteInfo?.maxColors}
            autoColorCount={
              values.paletteSize === "auto" && tracedSvg ? countSvgColors(tracedSvg) : undefined
            }
          />
        </div>
      </div>
      {tracedSvg && error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
