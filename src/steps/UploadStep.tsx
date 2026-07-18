import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { Wizard } from "../lib/wizard";
import { decodeImage, ImageDecodeError } from "../lib/imageDecode";
import { LockIcon, ReplaceIcon, UploadTrayIcon, XIcon } from "../components/shellIcons";
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

  const handleFile = useCallback(
    async (file: File) => {
      setStatus({ kind: "decoding", fileName: file.name });
      try {
        const bitmap = await decodeImage(file);
        wizard.setImage(bitmap);
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
      }
    },
    [wizard],
  );

  // Draw the loaded image into the thumbnail canvas whenever it changes.
  useEffect(() => {
    if (!image) return;
    const canvas = thumbRef.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
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
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDragOver = (event: JSX.TargetedDragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  function removeImage() {
    wizard.setImage(null);
    wizard.setSvg(null);
  }

  return (
    <section className={styles.step}>
      <div className={styles.head}>
        <h2 className={styles.heading}>
          {image ? "Image ready to vectorize" : "Add an image to vectorize"}
        </h2>
        <p className={styles.subtext}>
          It’s traced right here in your browser — nothing is uploaded anywhere.
        </p>
      </div>

      {image ? (
        <div className={styles.ready}>
          <div className={styles.thumbWrap}>
            <canvas ref={thumbRef} className={styles.thumb} data-testid="upload-thumb" />
            <button
              type="button"
              className={styles.remove}
              onClick={removeImage}
              title="Remove image"
              aria-label="Remove image"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className={styles.readyActions}>
            <span className={`${styles.dims} mono`}>
              {image.width} × {image.height}
            </span>
            <button
              type="button"
              className={styles.replace}
              onClick={() => inputRef.current?.click()}
            >
              <ReplaceIcon size={15} />
              Replace image
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.dropzone}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-drag-over={isDragOver || undefined}
        >
          <span className={styles.tile}>
            <UploadTrayIcon size={28} />
          </span>
          <span>
            <span className={styles.cta}>
              Drop an image here, or <span>browse</span>
            </span>
            <span className={styles.formats}>
              PNG · JPEG · WebP · GIF · BMP · AVIF · up to 25 MB
            </span>
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        className={styles.hiddenInput}
        aria-label="Choose file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
        onChange={handleInputChange}
      />

      <div className={styles.privacy}>
        <LockIcon />
        Processed 100% on your device
      </div>

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
