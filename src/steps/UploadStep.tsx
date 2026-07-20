import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { Wizard } from "../lib/wizard";
import { decodeImage, ImageDecodeError, SUPPORTED_IMAGE_MIME_TYPES } from "../lib/imageDecode";
import { ReplaceIcon, UploadTrayIcon, XIcon } from "../components/shellIcons";
import styles from "./UploadStep.module.css";

type Status =
  { kind: "idle" } | { kind: "decoding"; fileName: string } | { kind: "error"; message: string };

/**
 * Wizard step 1 — file picker + drag-and-drop, client-side decode (T4).
 *
 * The selected file is decoded entirely in-browser via `decodeImage()`
 * (never uploaded anywhere, per status/specification.md Goals) and the
 * wizard advances once decode succeeds. When an image is already loaded
 * (e.g. the user stepped Back here), a thumbnail is shown with Replace /
 * Remove controls so it's obvious an image is present.
 */
export function UploadStep({ wizard }: { wizard: Wizard }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const image = wizard.image;
  const isDecoding = status.kind === "decoding";
  // Guards re-entrant decodes (e.g. a drop on the dropzone bubbling to the
  // window-level drop handler below) independent of React's state timing —
  // checked/set synchronously at call time, not via a possibly-stale closure.
  const decodingRef = useRef(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (decodingRef.current) return;
      decodingRef.current = true;
      setStatus({ kind: "decoding", fileName: file.name });
      try {
        const bitmap = await decodeImage(file);
        // The decoded bitmap is the immutable source: Edit's crop/rotate are
        // non-destructive (a pending transform baked only at trace time), so
        // there's no separate pristine copy to keep anymore.
        wizard.replaceImage(bitmap, file.name);
        // A fresh source invalidates any previously traced SVG.
        wizard.setSvg(null);
        setStatus({ kind: "idle" });
        wizard.next();
      } catch (err) {
        const message =
          err instanceof ImageDecodeError
            ? err.message
            : "Something went wrong reading that file. Please try again.";
        setStatus({ kind: "error", message });
      } finally {
        decodingRef.current = false;
      }
    },
    [wizard],
  );

  // A file dropped anywhere on the window — not just the dropzone tile —
  // should still be picked up, as long as we're not already showing an image
  // or mid-decode. The dropzone's own onDrop (below) stops propagation, so
  // this only fires for drops elsewhere in the window.
  useEffect(() => {
    if (image || isDecoding) return;
    function onWindowDrop(event: DragEvent) {
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        event.preventDefault();
        void handleFile(file);
      }
    }
    window.addEventListener("drop", onWindowDrop);
    return () => window.removeEventListener("drop", onWindowDrop);
  }, [image, isDecoding, handleFile]);

  // Draw the loaded image into the thumbnail canvas whenever it changes. The
  // canvas backing store is capped (a full-res draw of a 24MP photo would
  // allocate ~100MB just to show a small CSS-scaled preview).
  useEffect(() => {
    if (!image) return;
    const canvas = thumbRef.current;
    if (!canvas) return;
    // Backing-store cap: large enough that the preview fills the card box
    // crisply (like Edit), still bounded so a huge photo doesn't allocate a
    // full-resolution canvas just for a preview.
    const MAX = 1024;
    const scale = Math.min(1, MAX / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  }, [image]);

  const handleInputChange = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      void handleFile(file);
    }
  };

  const handleDrop = (event: JSX.TargetedDragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    // Keep this drop from also reaching the window-level fallback listener
    // above, which would otherwise decode the same file a second time.
    event.stopPropagation();
    setIsDragOver(false);
    if (isDecoding) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDragOver = (event: JSX.TargetedDragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!isDecoding) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  function removeImage() {
    wizard.replaceImage(null, null);
    wizard.setSvg(null);
  }

  return (
    <section className={styles.step}>
      {image ? (
        <div className={styles.ready}>
          <div className={styles.previewCol}>
            <div className={styles.previewCard}>
              <div className={styles.previewHead}>
                <h2 className={styles.previewTitle}>Your image</h2>
              </div>
              <div className={styles.thumbWrap}>
                <canvas
                  ref={thumbRef}
                  className={styles.thumb}
                  data-testid="upload-thumb"
                  role="img"
                  aria-label="Uploaded image preview"
                />
              </div>
            </div>
          </div>
          <div className={styles.controls}>
            <div className={styles.info}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>File name</span>
                <span className={`${styles.infoValue} mono`} title={wizard.fileName ?? undefined}>
                  {wizard.fileName ?? "—"}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Dimensions</span>
                <span className={`${styles.infoValue} mono`}>
                  {image.width} × {image.height}
                </span>
              </div>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.replace}
                onClick={() => inputRef.current?.click()}
              >
                <ReplaceIcon size={15} />
                Replace image
              </button>
              <button type="button" className={styles.removeBtn} onClick={removeImage}>
                <XIcon size={15} />
                Remove image
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.head}>
            <h2 className={styles.heading}>Add an image to vectorize</h2>
            <p className={styles.subtext}>
              It’s traced right here in your browser — nothing is uploaded anywhere.
            </p>
          </div>
          <button
            type="button"
            className={styles.dropzone}
            onClick={() => !isDecoding && inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-drag-over={isDragOver || undefined}
            disabled={isDecoding}
            aria-busy={isDecoding}
          >
            <span className={styles.tile}>
              <UploadTrayIcon size={28} />
            </span>
            <span>
              <span className={styles.cta}>
                {status.kind === "decoding" ? (
                  `Decoding ${status.fileName}…`
                ) : (
                  <>
                    Drop an image here, or <span>browse</span>
                  </>
                )}
              </span>
              <span className={styles.formats}>
                PNG · JPEG · WebP · GIF · BMP · AVIF · up to 25 MB
              </span>
            </span>
          </button>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        className={styles.hiddenInput}
        aria-label="Choose file"
        accept={SUPPORTED_IMAGE_MIME_TYPES.join(",")}
        onChange={handleInputChange}
        tabIndex={-1}
        disabled={isDecoding}
      />

      {status.kind === "decoding" && (
        <p className={styles.status} role="status">
          Decoding {status.fileName}…
        </p>
      )}
      {status.kind === "error" && (
        <p className={styles.error} role="alert">
          {status.message}
        </p>
      )}
    </section>
  );
}
