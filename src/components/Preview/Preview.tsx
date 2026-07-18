import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./Preview.module.css";

export interface PreviewProps {
  /** The untouched working image, shown while the compare button is held. */
  originalImage: ImageBitmap;
  /** The current traced SVG markup, shown whenever the compare button isn't held. */
  tracedSvg: string;
}

/**
 * Original-vs-traced compare preview (T7). Shows the traced SVG by default;
 * holding the "Hold to see original" button (pointer down) swaps to the
 * original image, releasing (pointer up or leaving the button) swaps back —
 * per status/specification.md Goals' minimum-bar "hold to see original" toggle.
 */
export function Preview({ originalImage, tracedSvg }: PreviewProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!showOriginal) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    canvas.getContext("2d")?.drawImage(originalImage, 0, 0);
  }, [showOriginal, originalImage]);

  return (
    <div className={styles.preview}>
      {showOriginal ? (
        <canvas ref={canvasRef} className={styles.canvas} data-testid="preview-original" />
      ) : (
        // svg is our own worker's trace output, not user-supplied markup.
        <div
          className={styles.svg}
          data-testid="preview-traced"
          dangerouslySetInnerHTML={{ __html: tracedSvg }}
        />
      )}
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
    </div>
  );
}
