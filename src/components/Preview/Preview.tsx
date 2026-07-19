import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
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
}

/**
 * Reusable design left-panel: a surface card holding a checkerboard preview of
 * the traced SVG (T7). When `originalImage` is supplied, holding the compare
 * button swaps to the source raster (pointer down) and reverts on release —
 * per status/specification.md Goals' "hold to see original" toggle.
 */
// Long-edge cap for the compare canvas's backing store — a preview box never
// shows more detail than this, so a full-resolution draw (~96MB of pixels for
// a 24MP photo) would just be wasted memory. Matches the approach UploadStep's
// thumbnail uses.
const MAX_COMPARE_EDGE = 1024;

export function Preview({ title, tracedSvg, originalImage, caption }: PreviewProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      <div className={styles.box}>
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

      {caption && <span className={`${styles.caption} mono`}>{caption}</span>}
    </div>
  );
}
