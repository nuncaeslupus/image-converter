import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
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
export function Preview({ title, tracedSvg, originalImage, caption }: PreviewProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!showOriginal || !originalImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    canvas.getContext("2d")?.drawImage(originalImage, 0, 0);
  }, [showOriginal, originalImage]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {originalImage && (
          <button
            type="button"
            className={styles.compareButton}
            aria-pressed={showOriginal}
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
          >
            Hold to see original
          </button>
        )}
      </div>

      <div className={styles.box}>
        {showOriginal && originalImage ? (
          <canvas ref={canvasRef} className={styles.canvas} data-testid="preview-original" />
        ) : (
          // svg is our own worker's trace output, not user-supplied markup.
          <div
            className={styles.svg}
            data-testid="preview-traced"
            dangerouslySetInnerHTML={{ __html: tracedSvg }}
          />
        )}
      </div>

      {caption && <span className={`${styles.caption} mono`}>{caption}</span>}
    </div>
  );
}
