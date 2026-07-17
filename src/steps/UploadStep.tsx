import { useCallback, useId, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { Wizard } from "../lib/wizard";
import { decodeImage, ImageDecodeError } from "../lib/imageDecode";

type Status =
  { kind: "idle" } | { kind: "decoding"; fileName: string } | { kind: "error"; message: string };

/**
 * Wizard step 1 — file picker + drag-and-drop, client-side decode (T4).
 *
 * The selected file is decoded entirely in-browser via `decodeImage()`
 * (never uploaded anywhere, per status/specification.md Goals) and the
 * wizard only advances once decode succeeds. Wiring the decoded bitmap into
 * the Tracer Worker is a later task (T2/T6) — this step's job ends at a
 * successful, error-free decode.
 */
export function UploadStep({ wizard }: { wizard: Wizard }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isDragOver, setIsDragOver] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setStatus({ kind: "decoding", fileName: file.name });
      try {
        const bitmap = await decodeImage(file);
        bitmap.close();
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

  const handleInputChange = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      void handleFile(file);
    }
  };

  const handleDrop = (event: JSX.TargetedDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDragOver = (event: JSX.TargetedDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  return (
    <section>
      <h2>1. Upload</h2>
      <p>
        Choose an image, or drag and drop it below. PNG, JPEG, WebP, GIF, and BMP are supported.
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        data-drag-over={isDragOver || undefined}
      >
        <p>Drag and drop an image here</p>
        <label htmlFor={inputId}>Choose file</label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          onChange={handleInputChange}
        />
      </div>

      {status.kind === "decoding" && <p role="status">Decoding {status.fileName}…</p>}
      {status.kind === "error" && <p role="alert">{status.message}</p>}
    </section>
  );
}
