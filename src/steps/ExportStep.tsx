import { useEffect, useRef, useState } from "preact/hooks";
import type { Wizard } from "../lib/wizard";
import { Export } from "../components/Export/Export";
import { svgDownloadName } from "../lib/svgExport";
import { Preview } from "../components/Preview/Preview";
import { DEFAULT_TWEAK_VALUES, applyBackground, toTraceParams } from "../lib/tweakPipeline";
import { createTraceDispatcher, createTraceRequest, isTraceResponse } from "../lib/traceProtocol";
import {
  downscaleForPreview,
  needsFullResRetrace,
  EXPORT_MAX_DIMENSION,
} from "../lib/previewDownscale";
import { useBakedImage } from "../lib/useBakedImage";
import styles from "./ExportStep.module.css";

const FULL_RES_FAILURE_NOTICE =
  "Couldn't prepare a full-resolution export — this download/copy is at preview resolution.";

/**
 * Wizard step 4 — download/copy/viewBox override/size estimate (T9).
 *
 * Every trace up to this point (Trace & Tweak, T6) ran on a downscaled
 * preview copy of the source image (see previewDownscale.ts) to keep
 * tweaking snappy — which means the SVG in `wizard.svg` has preview-only
 * geometry. On mount, this step runs ONE additional full-resolution trace of
 * `wizard.image` with the user's final tweak values so what actually gets
 * downloaded/copied matches the source resolution, not the 512px preview
 * cap (bounded by EXPORT_MAX_DIMENSION so an enormous source can't OOM the
 * worker). Skipped entirely when the source is already within the preview cap
 * (the preview trace already ran at full resolution). The preview SVG is shown
 * immediately and stays in use — with a small status line — until the
 * full-res trace finishes; on failure it's the permanent fallback.
 */
export function ExportStep({ wizard }: { wizard: Wizard }) {
  const previewSvg = wizard.svg;
  // Full-res source with Edit's crop/rotate baked in (transformed dimensions).
  const image = useBakedImage(wizard.image, wizard.transform);
  const tweakValues = wizard.tweakValues;

  const [fullResSvg, setFullResSvg] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [fullResNotice, setFullResNotice] = useState<string | null>(null);
  const dispatcherRef = useRef(createTraceDispatcher());

  useEffect(() => {
    setFullResSvg(null);
    setFullResNotice(null);
    setPreparing(false);

    if (!image || !previewSvg) return;
    if (!needsFullResRetrace(image.width, image.height)) return;

    let cancelled = false;
    setPreparing(true);

    const worker = new Worker(new URL("../worker/tracer.worker.ts", import.meta.url), {
      type: "module",
    });

    function failWithNotice() {
      if (cancelled) return;
      setPreparing(false);
      setFullResNotice(FULL_RES_FAILURE_NOTICE);
    }

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isTraceResponse(event.data)) return;
      const response = dispatcherRef.current.acceptResponse(event.data);
      if (!response) return;
      if (cancelled) return;

      setPreparing(false);
      if (response.type === "trace-result") {
        // The preview pipeline applies the background as a post-trace SVG
        // edit (applyBackground); the raw worker result doesn't include it,
        // so the full-res export must apply it too or a "solid" background
        // would silently disappear from the downloaded file.
        const background = (tweakValues ?? DEFAULT_TWEAK_VALUES).background;
        setFullResSvg(applyBackground(response.svg, background));
        setFullResNotice(null);
      } else {
        setFullResNotice(FULL_RES_FAILURE_NOTICE);
      }
    };

    // Same worker-load-failure guard as TraceStep (finding D): without these,
    // a worker that never loads (offline, bad deploy path) would leave
    // `preparing` stuck forever with no fallback ever shown.
    worker.onerror = failWithNotice;
    worker.onmessageerror = failWithNotice;

    const params = toTraceParams(tweakValues ?? DEFAULT_TWEAK_VALUES);

    void (async () => {
      try {
        // Clone rather than transfer `wizard.image` itself — the worker
        // transfers (and closes) whatever bitmap it receives, and the wizard's
        // working image must stay usable afterwards (e.g. if the user goes
        // Back to Trace/Edit again). Capped at EXPORT_MAX_DIMENSION: a no-op for
        // any realistic source (so the export stays full-resolution), but bounds
        // the worker's RGBA allocation on a pathologically large image.
        const bitmapCopy = await downscaleForPreview(
          await createImageBitmap(image),
          EXPORT_MAX_DIMENSION,
        );
        if (cancelled) {
          bitmapCopy.close();
          return;
        }
        const request = createTraceRequest(
          { bitmap: bitmapCopy, width: bitmapCopy.width, height: bitmapCopy.height },
          params,
        );
        dispatcherRef.current.registerSent(request.requestId);
        worker.postMessage(request, [bitmapCopy]);
      } catch {
        // createImageBitmap can reject (closed/detached bitmap, resource
        // pressure); without this the rejection escapes the void IIFE and
        // `preparing` sticks at true with no fallback ever shown.
        failWithNotice();
      }
    })();

    return () => {
      cancelled = true;
      worker.terminate();
    };
    // Re-runs only when its actual inputs change; while this step is
    // mounted the tweak values cannot change (the tweak panel lives on the
    // Trace step), so in practice this fires once per visit.
  }, [image, previewSvg, tweakValues]);

  if (!previewSvg) {
    return (
      <section>
        <p role="alert">No traced image yet — go back and trace one first.</p>
      </section>
    );
  }

  const displaySvg = fullResSvg ?? previewSvg;
  const statusCaption = preparing
    ? "Preparing full-resolution export…"
    : (fullResNotice ?? undefined);

  return (
    <section className={styles.layout}>
      <div className={styles.previewCol}>
        <Preview title="Your SVG is ready" tracedSvg={displaySvg} caption={statusCaption} />
      </div>
      <div className={styles.controls}>
        <Export svg={displaySvg} defaultFileName={svgDownloadName(wizard.fileName)} />
      </div>
    </section>
  );
}
