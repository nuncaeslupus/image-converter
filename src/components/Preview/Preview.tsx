import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
import { ZoomInIcon, ZoomOutIcon } from "../Editor/icons";
import styles from "./Preview.module.css";

export interface PreviewProps {
  /** Panel heading shown top-left (e.g. "Trace & Tweak", "Your SVG is ready"). */
  title: string;
  /** The current traced SVG markup, shown in the checkerboard preview box. */
  tracedSvg: string;
  /**
   * The untouched working image. When provided, a "Hold to see original"
   * button appears (Trace step); omit it where there's nothing to compare
   * against (Export step).
   */
  originalImage?: ImageBitmap | null;
  /** Optional mono caption below the preview (path count / size / palette). */
  caption?: ComponentChildren;
  /**
   * True while a retrace is in flight — shows a centered spinner over the
   * preview instead of a text line, so the image never resizes as it appears.
   */
  busy?: boolean;
}

// Long-edge cap for the compare canvas's backing store — a preview box never
// shows more detail than this, so a full-resolution draw (~96MB of pixels for
// a 24MP photo) would just be wasted memory. Matches the approach UploadStep's
// thumbnail uses.
const MAX_COMPARE_EDGE = 1024;

// Zoom bounds/step mirror the Editor's zoom widget so the two feel identical.
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Reusable design left-panel: a surface card holding a checkerboard preview of
 * the traced SVG (T7), with a zoom widget (centered in the header, same look as
 * the Editor) to inspect fine detail — the whole point of a raster→vector step.
 * When `originalImage` is supplied, holding the compare button swaps to the
 * source raster (pointer down) and reverts on release. Both the trace and the
 * original share the same zoom/pan, so comparing stays aligned.
 */
export function Preview({ title, tracedSvg, originalImage, caption, busy }: PreviewProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const atFit = zoom === 1;
  const pannable = zoom > 1;

  // Keyed on `originalImage` only (not `showOriginal`) — the canvas is drawn
  // once per image and just toggles visibility afterwards, so repeatedly
  // pressing "hold to see original" never re-draws or re-allocates it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImage) return;
    const scale = Math.min(
      1,
      MAX_COMPARE_EDGE / Math.max(originalImage.width, originalImage.height),
    );
    canvas.width = Math.max(1, Math.round(originalImage.width * scale));
    canvas.height = Math.max(1, Math.round(originalImage.height * scale));
    canvas.getContext("2d")?.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
  }, [originalImage]);

  function zoomBy(factor: number) {
    setZoom((z) => {
      let next = clamp(z * factor, ZOOM_MIN, ZOOM_MAX);
      // Snap to exactly 1 within a float epsilon so `z / ZOOM_STEP` lands on
      // the Fit detent (badge + pan reset) rather than 1.0000001.
      if (Math.abs(next - 1) < 1e-9) next = 1;
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }
  function fit() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // ---- pan when zoomed in ----
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPan: {
      x: number;
      y: number;
    };
  } | null>(null);
  function onPanDown(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (!pannable) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPan: pan,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPanMove(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const d = panRef.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const rect = boxRef.current?.getBoundingClientRect();
    const maxX = rect ? (rect.width * (zoom - 1)) / 2 : Infinity;
    const maxY = rect ? (rect.height * (zoom - 1)) / 2 : Infinity;
    setPan({
      x: clamp(d.startPan.x + (event.clientX - d.startX), -maxX, maxX),
      y: clamp(d.startPan.y + (event.clientY - d.startY), -maxY, maxY),
    });
  }
  function onPanUp(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  }

  // Space/Enter mirrors the pointer hold: press-and-hold reveals the
  // original, release (or losing focus mid-hold) reverts to the trace.
  // `repeat` is guarded so OS key-repeat doesn't spam state updates.
  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLButtonElement>) {
    if (event.repeat) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setShowOriginal(true);
    }
  }
  function handleKeyUp(event: JSX.TargetedKeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Enter") {
      setShowOriginal(false);
    }
  }

  const showingOriginal = showOriginal && !!originalImage;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>

        <div className={styles.zoomRow}>
          <div className={styles.zoomGroup}>
            <button
              type="button"
              className={styles.zoomButton}
              disabled={zoom <= ZOOM_MIN}
              onClick={() => zoomBy(1 / ZOOM_STEP)}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOutIcon />
            </button>
            <span className={`${styles.zoomLabel} mono ${atFit ? styles.zoomAtFit : ""}`}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className={styles.zoomButton}
              disabled={zoom >= ZOOM_MAX}
              onClick={() => zoomBy(ZOOM_STEP)}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomInIcon />
            </button>
          </div>
          <button
            type="button"
            className={styles.fitButton}
            onClick={fit}
            disabled={atFit}
            title="Fit the image to the frame"
          >
            Fit
          </button>
        </div>

        {originalImage && (
          <button
            type="button"
            className={styles.compareButton}
            aria-pressed={showOriginal}
            title="Press and hold (or Space/Enter) to reveal the original image"
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={() => setShowOriginal(false)}
          >
            Hold to see original
          </button>
        )}
      </div>

      <div
        ref={boxRef}
        className={`${styles.box} ${pannable ? styles.boxPannable : ""}`}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerCancel={onPanUp}
      >
        <div
          className={styles.view}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {originalImage && (
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              data-testid="preview-original"
              hidden={!showingOriginal}
              role="img"
              aria-label="Original image"
            />
          )}
          {/* svg is our own worker's trace output, not user-supplied markup. */}
          <div
            className={styles.svg}
            data-testid="preview-traced"
            hidden={showingOriginal}
            role="img"
            aria-label="Traced SVG preview"
            dangerouslySetInnerHTML={{ __html: tracedSvg }}
          />
        </div>

        {busy && (
          <div className={styles.spinnerOverlay} role="status" aria-label="Retracing">
            <span className={styles.spinner} />
          </div>
        )}
      </div>

      {caption && <span className={`${styles.caption} mono`}>{caption}</span>}
    </div>
  );
}
