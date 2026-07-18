import { useEffect, useRef, useState } from "preact/hooks";
import type { Wizard } from "../lib/wizard";
import { TweakPanel } from "../components/TweakPanel/TweakPanel";
import { Preview } from "../components/Preview/Preview";
import {
  createTweakPipeline,
  applyBackground,
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
import { downscaleForPreview } from "../lib/previewDownscale";
import { estimateSvg } from "../lib/svgExport";
import styles from "./TraceStep.module.css";

const DEFAULT_VALUES: TweakValues = DEFAULT_TWEAK_VALUES;

/**
 * Wizard step 3 — the live tweak panel driving the two-tier retrace/
 * cheap-edit pipeline (T6). Owns the Tracer Worker instance and wires it to
 * `tweakPipeline.ts`'s routing/debounce logic: retrace-affecting changes
 * (palette/smoothness/detail/contrast) call the worker (debounced,
 * last-value-wins via `createTraceDispatcher`); background changes never do
 * (see status/specification.md §5, status/plan.md "Data flow" steps 3-6).
 */
export function TraceStep({ wizard }: { wizard: Wizard }) {
  const [values, setValues] = useState<TweakValues>(DEFAULT_VALUES);
  const [tracedSvg, setTracedSvg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valuesRef = useRef(values);
  const rawSvgRef = useRef<string | null>(null);
  const pipelineRef = useRef<TweakPipeline | null>(null);
  const dispatcherRef = useRef(createTraceDispatcher());

  const image = wizard.image;

  // Publish the current traced SVG up to the wizard so ExportStep (T9) reads it.
  useEffect(() => {
    wizard.setSvg(tracedSvg);
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

    async function runRetrace(params: TraceParams) {
      setBusy(true);
      // A fresh copy per retrace: the worker transfers (and closes) the
      // bitmap it receives, so the wizard's own working image must never be
      // transferred directly, or every later retrace would find it detached.
      // Downscaled to a bounded preview resolution before tracing (T11) —
      // tracing at full source resolution can blow the ~5s preview budget by
      // an order of magnitude on typical camera/phone photos.
      const bitmapCopy = await downscaleForPreview(await createImageBitmap(workingImage));
      const request = createTraceRequest(
        { bitmap: bitmapCopy, width: bitmapCopy.width, height: bitmapCopy.height },
        params,
      );
      dispatcherRef.current.registerSent(request.requestId);
      worker.postMessage(request, [bitmapCopy]);
    }

    pipelineRef.current = createTweakPipeline(DEFAULT_VALUES, {
      runRetrace: (params) => void runRetrace(params),
      applyCheapEdit: (nextValues) => {
        if (rawSvgRef.current) {
          setTracedSvg(applyBackground(rawSvgRef.current, nextValues.background));
        }
      },
    });

    // Initial trace on mount, using the default values as the starting point.
    void runRetrace({
      paletteSize: DEFAULT_VALUES.paletteSize,
      smoothness: DEFAULT_VALUES.smoothness,
      detail: DEFAULT_VALUES.detail,
      contrast: DEFAULT_VALUES.contrast,
    });

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
    pipelineRef.current?.update(next);
  }

  if (!image) {
    return (
      <section>
        <p role="alert">No image to trace yet — go back and choose one first.</p>
      </section>
    );
  }

  const paletteLabel = values.paletteSize === "auto" ? "Auto" : String(values.paletteSize);
  const caption = tracedSvg
    ? (() => {
        const { bytes, pathCount } = estimateSvg(tracedSvg);
        const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
        return `${pathCount.toLocaleString()} paths · ~${size} · palette: ${paletteLabel}`;
      })()
    : `palette: ${paletteLabel}`;

  return (
    <section className={styles.root}>
      <div className={styles.layout}>
        <div className={styles.previewCol}>
          {tracedSvg ? (
            <Preview
              title="Trace & Tweak"
              tracedSvg={tracedSvg}
              originalImage={image}
              caption={caption}
            />
          ) : (
            <div className={styles.loading} role="status">
              {error ? <span className={styles.error}>{error}</span> : "Tracing…"}
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <TweakPanel values={values} onChange={handleChange} busy={busy} />
        </div>
      </div>
      {tracedSvg && busy && (
        <p className={styles.retracing} role="status">
          Retracing…
        </p>
      )}
      {tracedSvg && error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
