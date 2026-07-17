import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { cropImage, resizeImage, rotateImage, type CropBox } from "../../lib/imageEdit";
import { CropIcon, ResetIcon, ResizeIcon, RotateLeftIcon, RotateRightIcon } from "./icons";
import styles from "./Editor.module.css";

type Tool = "crop" | "resize" | null;
type Handle = "nw" | "ne" | "sw" | "se";

const HANDLES: Handle[] = ["nw", "ne", "sw", "se"];
const MIN_CROP_SIZE = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function fullBoxFor(image: { width: number; height: number }): CropBox {
  return { x: 0, y: 0, width: image.width, height: image.height };
}

/** Moves one corner of `box` by `(dx, dy)`, keeping the opposite corner fixed and staying in bounds. */
function moveCorner(
  box: CropBox,
  handle: Handle,
  dx: number,
  dy: number,
  bounds: { width: number; height: number },
): CropBox {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.width;
  let bottom = box.y + box.height;

  if (handle === "nw" || handle === "sw") {
    left = clamp(left + dx, 0, right - MIN_CROP_SIZE);
  } else {
    right = clamp(right + dx, left + MIN_CROP_SIZE, bounds.width);
  }
  if (handle === "nw" || handle === "ne") {
    top = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
  } else {
    bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, bounds.height);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export interface EditorProps {
  /** The current working image. */
  image: ImageBitmap;
  /** The untouched, originally-decoded image — restored by "Reset". */
  originalImage: ImageBitmap;
  /** Called with the replacement image whenever an edit is applied. */
  onChange: (image: ImageBitmap) => void;
}

/**
 * Crop / rotate / resize editor (T5). A visible toolbar (never a buried
 * menu) with standard icons: crop, rotate left/right, resize, reset.
 * Keyboard shortcuts: `R` rotates clockwise, `Shift+R` counter-clockwise,
 * `C` toggles the crop tool, `Escape` cancels the active tool. While the
 * crop tool is active, its corner handles support arrow-key nudging (1px,
 * 10px with Shift) in addition to dragging.
 */
export function Editor({ image, originalImage, onChange }: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [cropBox, setCropBox] = useState<CropBox>(() => fullBoxFor(image));
  const [resizeWidth, setResizeWidth] = useState(image.width);
  const [resizeHeight, setResizeHeight] = useState(image.height);
  const [lockAspect, setLockAspect] = useState(true);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{
    handle: Handle;
    pointerId: number;
    startBox: CropBox;
    startClientX: number;
    startClientY: number;
    scale: number;
  } | null>(null);

  // Render the working bitmap into the preview canvas at its natural pixel
  // size (CSS scales it down for display) whenever it changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(image, 0, 0);
  }, [image]);

  // Reset tool-specific pending state whenever the working image changes
  // (e.g. after an edit is applied, or a fresh image is passed in).
  useEffect(() => {
    setCropBox(fullBoxFor(image));
    setResizeWidth(image.width);
    setResizeHeight(image.height);
  }, [image]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (event.key === "Escape") {
        setTool(null);
        return;
      }
      if (isTypingTarget) return;

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        void handleRotate(event.shiftKey ? -90 : 90);
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        setTool((current) => (current === "crop" ? null : "crop"));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [image, busy]);

  async function handleRotate(degrees: 90 | -90) {
    if (busy) return;
    setBusy(true);
    try {
      const rotated = await rotateImage(image, degrees);
      onChange(rotated);
    } finally {
      setBusy(false);
    }
  }

  async function applyCrop() {
    if (busy) return;
    setBusy(true);
    try {
      const cropped = await cropImage(image, cropBox);
      onChange(cropped);
      setTool(null);
    } finally {
      setBusy(false);
    }
  }

  async function applyResize() {
    if (busy) return;
    setBusy(true);
    try {
      const resized = await resizeImage(image, resizeWidth, resizeHeight);
      onChange(resized);
      setTool(null);
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setTool(null);
    onChange(originalImage);
  }

  function handleWidthInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const next = Math.max(1, Math.round(Number(event.currentTarget.value) || 0));
    setResizeWidth(next);
    if (lockAspect) {
      setResizeHeight(Math.max(1, Math.round((next * image.height) / image.width)));
    }
  }

  function handleHeightInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const next = Math.max(1, Math.round(Number(event.currentTarget.value) || 0));
    setResizeHeight(next);
    if (lockAspect) {
      setResizeWidth(Math.max(1, Math.round((next * image.width) / image.height)));
    }
  }

  function handlePointerDownOnHandle(
    handle: Handle,
    event: JSX.TargetedPointerEvent<HTMLDivElement>,
  ) {
    const stage = canvasRef.current?.parentElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const scale = rect.width > 0 ? image.width / rect.width : 1;
    dragRef.current = {
      handle,
      pointerId: event.pointerId,
      startBox: cropBox,
      startClientX: event.clientX,
      startClientY: event.clientY,
      scale,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMoveOnHandle(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startClientX) * drag.scale;
    const dy = (event.clientY - drag.startClientY) * drag.scale;
    setCropBox(moveCorner(drag.startBox, drag.handle, dx, dy, image));
  }

  function handlePointerUpOnHandle(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleHandleKeyDown(handle: Handle, event: JSX.TargetedKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    switch (event.key) {
      case "ArrowLeft":
        dx = -step;
        break;
      case "ArrowRight":
        dx = step;
        break;
      case "ArrowUp":
        dy = -step;
        break;
      case "ArrowDown":
        dy = step;
        break;
      default:
        return;
    }
    event.preventDefault();
    setCropBox((current) => moveCorner(current, handle, dx, dy, image));
  }

  const isEdited = image !== originalImage;

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar} role="toolbar" aria-label="Image editing tools">
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={tool === "crop"}
          disabled={busy}
          onClick={() => setTool((current) => (current === "crop" ? null : "crop"))}
          title="Crop (C)"
        >
          <CropIcon />
          <span className={styles.toolButtonLabel}>Crop</span>
        </button>
        <button
          type="button"
          className={styles.toolButton}
          disabled={busy}
          onClick={() => void handleRotate(-90)}
          title="Rotate left (Shift+R)"
        >
          <RotateLeftIcon />
          <span className={styles.toolButtonLabel}>Rotate left</span>
        </button>
        <button
          type="button"
          className={styles.toolButton}
          disabled={busy}
          onClick={() => void handleRotate(90)}
          title="Rotate right (R)"
        >
          <RotateRightIcon />
          <span className={styles.toolButtonLabel}>Rotate right</span>
        </button>
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={tool === "resize"}
          disabled={busy}
          onClick={() => setTool((current) => (current === "resize" ? null : "resize"))}
          title="Resize"
        >
          <ResizeIcon />
          <span className={styles.toolButtonLabel}>Resize</span>
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.toolButton}
          disabled={busy || !isEdited}
          onClick={handleReset}
          title="Reset to original"
        >
          <ResetIcon />
          <span className={styles.toolButtonLabel}>Reset</span>
        </button>
      </div>

      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} data-testid="editor-canvas" />
        {tool === "crop" && (
          <div className={styles.cropOverlay} aria-hidden={false}>
            <div
              className={styles.cropRect}
              style={{
                left: `${(cropBox.x / image.width) * 100}%`,
                top: `${(cropBox.y / image.height) * 100}%`,
                width: `${(cropBox.width / image.width) * 100}%`,
                height: `${(cropBox.height / image.height) * 100}%`,
              }}
            >
              {HANDLES.map((handle) => (
                <div
                  key={handle}
                  className={styles.cropHandle}
                  style={{
                    left: handle.includes("w") ? "0%" : "100%",
                    top: handle.includes("n") ? "0%" : "100%",
                  }}
                  role="slider"
                  tabIndex={0}
                  aria-label={`Crop handle: ${handle}`}
                  aria-valuetext={`x ${Math.round(cropBox.x)}, y ${Math.round(cropBox.y)}, width ${Math.round(cropBox.width)}, height ${Math.round(cropBox.height)}`}
                  onPointerDown={(event) => handlePointerDownOnHandle(handle, event)}
                  onPointerMove={handlePointerMoveOnHandle}
                  onPointerUp={handlePointerUpOnHandle}
                  onKeyDown={(event) => handleHandleKeyDown(handle, event)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {tool === "crop" && (
        <div className={styles.panel}>
          <label className={styles.field}>
            X
            <input
              type="number"
              min={0}
              max={image.width - MIN_CROP_SIZE}
              value={Math.round(cropBox.x)}
              onInput={(event) =>
                setCropBox((current) =>
                  moveCorner(
                    current,
                    "nw",
                    Number(event.currentTarget.value) - current.x,
                    0,
                    image,
                  ),
                )
              }
            />
          </label>
          <label className={styles.field}>
            Y
            <input
              type="number"
              min={0}
              max={image.height - MIN_CROP_SIZE}
              value={Math.round(cropBox.y)}
              onInput={(event) =>
                setCropBox((current) =>
                  moveCorner(
                    current,
                    "nw",
                    0,
                    Number(event.currentTarget.value) - current.y,
                    image,
                  ),
                )
              }
            />
          </label>
          <label className={styles.field}>
            Width
            <input
              type="number"
              min={MIN_CROP_SIZE}
              max={image.width}
              value={Math.round(cropBox.width)}
              onInput={(event) =>
                setCropBox((current) =>
                  moveCorner(
                    current,
                    "se",
                    Number(event.currentTarget.value) - current.width,
                    0,
                    image,
                  ),
                )
              }
            />
          </label>
          <label className={styles.field}>
            Height
            <input
              type="number"
              min={MIN_CROP_SIZE}
              max={image.height}
              value={Math.round(cropBox.height)}
              onInput={(event) =>
                setCropBox((current) =>
                  moveCorner(
                    current,
                    "se",
                    0,
                    Number(event.currentTarget.value) - current.height,
                    image,
                  ),
                )
              }
            />
          </label>
          <button type="button" onClick={() => void applyCrop()} disabled={busy}>
            Apply crop
          </button>
          <button type="button" onClick={() => setTool(null)} disabled={busy}>
            Cancel
          </button>
          <p className={styles.hint}>Drag a handle, use arrow keys, or type exact values.</p>
        </div>
      )}

      {tool === "resize" && (
        <div className={styles.panel}>
          <label className={styles.field}>
            Width
            <input type="number" min={1} value={resizeWidth} onInput={handleWidthInput} />
          </label>
          <label className={styles.field}>
            Height
            <input type="number" min={1} value={resizeHeight} onInput={handleHeightInput} />
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={lockAspect}
              onChange={(event) => setLockAspect(event.currentTarget.checked)}
            />
            Lock aspect ratio
          </label>
          <button type="button" onClick={() => void applyResize()} disabled={busy}>
            Apply resize
          </button>
          <button type="button" onClick={() => setTool(null)} disabled={busy}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
