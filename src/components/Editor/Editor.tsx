import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  IDENTITY_TRANSFORM,
  isIdentityTransform,
  type EditTransform,
  type NormalizedRect,
} from "../../lib/imageEdit";
import {
  CropIcon,
  RedoIcon,
  ResetIcon,
  RotateLeftIcon,
  RotateRightIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons";
import styles from "./Editor.module.css";

type Handle = "nw" | "ne" | "sw" | "se";
const HANDLES: Handle[] = ["nw", "ne", "sw", "se"];

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.25;
const STAGE_PAD = 22; // leaves room for the rotate handle straddling the top edge
const SNAP_STEP = 45; // Shift snaps rotation to these marks
const MIN_CROP = 0.05; // smallest crop, as a fraction of the rotated bounding box
const GRID_LINES = 4; // internal grid lines per axis (a 5×5 field ≈ 2× rule-of-thirds)

const FULL_CROP: NormalizedRect = { x: 0, y: 0, w: 1, h: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Free = round to 1°, Shift = snap to 45°, Ctrl/Cmd = fine (0.1°). */
function snapRotation(deg: number, shift: boolean, ctrl: boolean): number {
  if (shift) return Math.round(deg / SNAP_STEP) * SNAP_STEP;
  if (ctrl) return Math.round(deg * 10) / 10;
  return Math.round(deg);
}

/** Axis-aligned bounding box of a `w`×`h` rectangle rotated by `deg`. */
function rotatedBounds(w: number, h: number, deg: number): { w: number; h: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return { w: w * cos + h * sin, h: w * sin + h * cos };
}

/** Moves one corner of a normalized crop rect, keeping it inside [0,1]. */
function moveCropCorner(
  rect: NormalizedRect,
  handle: Handle,
  dxN: number,
  dyN: number,
): NormalizedRect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.w;
  let bottom = rect.y + rect.h;
  if (handle === "nw" || handle === "sw") left = clamp(left + dxN, 0, right - MIN_CROP);
  else right = clamp(right + dxN, left + MIN_CROP, 1);
  if (handle === "nw" || handle === "ne") top = clamp(top + dyN, 0, bottom - MIN_CROP);
  else bottom = clamp(bottom + dyN, top + MIN_CROP, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function isCropped(crop: NormalizedRect | null): boolean {
  return crop !== null && (crop.x > 0 || crop.y > 0 || crop.w < 1 || crop.h < 1);
}

export interface EditorProps {
  image: ImageBitmap;
  /** The current pending transform (from the wizard) — seeds this visit's history. */
  transform: EditTransform;
  /** Called with the committed transform on any applied change / undo / redo / reset. */
  onChange: (transform: EditTransform) => void;
}

/**
 * Non-destructive crop / rotate editor (T5). Rotation and crop are pending
 * numbers, never baked here — Trace/Export bake them once (see
 * docs/superpowers/specs/2026-07-19-nondestructive-edit-design.md). Straighten
 * with the on-image rotate handle (a rule-based grid appears while dragging;
 * Shift snaps to 45°, Ctrl/Cmd is fine), then pull the screen-aligned crop
 * frame in over the tilted image. Undo/Redo/Reset ride on `{angle, crop}`
 * snapshots — no bitmap history.
 */
export function Editor({ image, transform, onChange }: EditorProps) {
  const [history, setHistory] = useState<{ stack: EditTransform[]; index: number }>(() => ({
    stack: [transform],
    index: 0,
  }));
  const committed = history.stack[history.index];
  const canUndo = history.index > 0;
  const canRedo = history.index < history.stack.length - 1;

  // Live drafts while a handle is being dragged (committed to history on release).
  const [draftRotation, setDraftRotation] = useState<number | null>(null);
  const [draftCrop, setDraftCrop] = useState<NormalizedRect | null | undefined>(undefined);
  const rotation = draftRotation ?? committed.rotation;
  const crop = draftCrop !== undefined ? draftCrop : committed.crop;
  const cropRect = crop ?? FULL_CROP;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [rotatingLive, setRotatingLive] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bboxRef = useRef<HTMLDivElement>(null);

  const atFit = zoom === 1;
  const panning = zoom > 1;

  function commit(next: EditTransform) {
    setHistory((h) => {
      const stack = h.stack.slice(0, h.index + 1);
      stack.push(next);
      return { stack, index: stack.length - 1 };
    });
    setDraftRotation(null);
    setDraftCrop(undefined);
    onChange(next);
  }
  function goTo(index: number) {
    setHistory((h) => ({ ...h, index }));
    onChange(history.stack[index]);
  }
  function undo() {
    if (canUndo) goTo(history.index - 1);
  }
  function redo() {
    if (canRedo) goTo(history.index + 1);
  }
  function reset() {
    if (!isIdentityTransform(committed)) commit(IDENTITY_TRANSFORM);
  }
  function rotate90(delta: 90 | -90) {
    commit({ rotation: (((committed.rotation + delta) % 360) + 360) % 360, crop: committed.crop });
  }
  function zoomBy(factor: number) {
    setZoom((z) => {
      const next = clamp(z * factor, ZOOM_MIN, ZOOM_MAX);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }

  // Draw the source into the canvas once per image.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
  }, [image]);

  // Reset the view when the source changes.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [image]);

  // Measure the stage for the contain-fit sizing.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () =>
      setStageSize((prev) => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        return prev.w === w && prev.h === h ? prev : { w, h };
      });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Window keyboard: undo/redo/rotate shortcuts + modifier tracking (drives the
  // rotate-handle snap mode). Registered once; reads latest actions via a ref.
  const actionsRef = useRef({ undo, redo, rotate90 });
  actionsRef.current = { undo, redo, rotate90 };
  useEffect(() => {
    function track(event: KeyboardEvent) {
      setShiftHeld(event.shiftKey);
      setCtrlHeld(event.ctrlKey || event.metaKey);
    }
    function onKeyDown(event: KeyboardEvent) {
      track(event);
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const mod = event.ctrlKey || event.metaKey;
      if (mod && (event.key === "z" || event.key === "Z")) {
        event.preventDefault();
        if (event.shiftKey) actionsRef.current.redo();
        else actionsRef.current.undo();
        return;
      }
      if (mod && (event.key === "y" || event.key === "Y")) {
        event.preventDefault();
        actionsRef.current.redo();
        return;
      }
      if (typing) return;
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        actionsRef.current.rotate90(event.shiftKey ? -90 : 90);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", track);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", track);
    };
  }, []);

  // ---- geometry: contain-fit the rotated bounding box into the stage ----
  const availW = Math.max(0, stageSize.w - STAGE_PAD * 2);
  const availH = Math.max(0, stageSize.h - STAGE_PAD * 2);
  const bounds = rotatedBounds(image.width, image.height, rotation);
  const fit =
    availW && availH && bounds.w && bounds.h ? Math.min(availW / bounds.w, availH / bounds.h) : 0;
  const dispW = bounds.w * fit;
  const dispH = bounds.h * fit;

  const outW = Math.max(1, Math.round(bounds.w * cropRect.w));
  const outH = Math.max(1, Math.round(bounds.h * cropRect.h));

  // ---- rotate-handle drag (orbit around the image centre) ----
  const rotateDragRef = useRef<{ pointerId: number; cx: number; cy: number; start: number } | null>(
    null,
  );
  function onRotateDown(event: JSX.TargetedPointerEvent<HTMLButtonElement>) {
    const bbox = bboxRef.current;
    if (!bbox) return;
    event.stopPropagation();
    const r = bbox.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    rotateDragRef.current = {
      pointerId: event.pointerId,
      cx,
      cy,
      start: Math.atan2(event.clientY - cy, event.clientX - cx),
    };
    setRotatingLive(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onRotateMove(event: JSX.TargetedPointerEvent<HTMLButtonElement>) {
    const d = rotateDragRef.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const ang = Math.atan2(event.clientY - d.cy, event.clientX - d.cx);
    const delta = ((ang - d.start) * 180) / Math.PI;
    setDraftRotation(snapRotation(committed.rotation + delta, shiftHeld, ctrlHeld));
  }
  function onRotateUp(event: JSX.TargetedPointerEvent<HTMLButtonElement>) {
    const d = rotateDragRef.current;
    if (!d || d.pointerId !== event.pointerId) return;
    rotateDragRef.current = null;
    setRotatingLive(false);
    if (draftRotation !== null && draftRotation !== committed.rotation) {
      commit({ rotation: ((draftRotation % 360) + 360) % 360, crop: committed.crop });
    } else {
      setDraftRotation(null);
    }
  }

  // ---- crop-handle drag (screen-aligned frame over the rotated image) ----
  const cropDragRef = useRef<{
    pointerId: number;
    handle: Handle;
    startRect: NormalizedRect;
    startX: number;
    startY: number;
  } | null>(null);
  function onCropDown(handle: Handle, event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    cropDragRef.current = {
      pointerId: event.pointerId,
      handle,
      startRect: cropRect,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onCropMove(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const d = cropDragRef.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const dxN = dispW ? (event.clientX - d.startX) / (dispW * zoom) : 0;
    const dyN = dispH ? (event.clientY - d.startY) / (dispH * zoom) : 0;
    setDraftCrop(moveCropCorner(d.startRect, d.handle, dxN, dyN));
  }
  function onCropUp(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const d = cropDragRef.current;
    if (!d || d.pointerId !== event.pointerId) return;
    cropDragRef.current = null;
    if (draftCrop !== undefined) {
      commit({ rotation: committed.rotation, crop: isCropped(draftCrop) ? draftCrop : null });
    }
  }

  // ---- stage pan (when zoomed in) ----
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPan: { x: number; y: number };
  } | null>(null);
  function onStageDown(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (!panning) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPan: pan,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onStageMove(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const d = panRef.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const rect = stageRef.current?.getBoundingClientRect();
    const maxX = rect ? (rect.width * (zoom - 1)) / 2 : Infinity;
    const maxY = rect ? (rect.height * (zoom - 1)) / 2 : Infinity;
    setPan({
      x: clamp(d.startPan.x + (event.clientX - d.startX), -maxX, maxX),
      y: clamp(d.startPan.y + (event.clientY - d.startY), -maxY, maxY),
    });
  }
  function onStageUp(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  }

  const gridLines = Array.from(
    { length: GRID_LINES },
    (_, i) => ((i + 1) / (GRID_LINES + 1)) * 100,
  );

  return (
    <div className={styles.editor}>
      <div
        ref={stageRef}
        className={`${styles.stage} ${panning ? styles.stagePannable : ""}`}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={onStageUp}
      >
        <div
          className={styles.view}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <div
            ref={bboxRef}
            className={styles.bbox}
            style={{ width: `${dispW}px`, height: `${dispH}px` }}
          >
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              style={
                fit > 0
                  ? {
                      width: `${image.width * fit}px`,
                      height: `${image.height * fit}px`,
                      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    }
                  : { display: "none" }
              }
              data-testid="editor-canvas"
            />

            {rotatingLive && (
              <div className={styles.grid} aria-hidden="true">
                {gridLines.map((p) => (
                  <div key={`v${p}`} className={styles.gridV} style={{ left: `${p}%` }} />
                ))}
                {gridLines.map((p) => (
                  <div key={`h${p}`} className={styles.gridH} style={{ top: `${p}%` }} />
                ))}
              </div>
            )}

            <div
              className={`${styles.cropFrame} ${isCropped(crop) ? styles.cropScrim : ""}`}
              style={{
                left: `${cropRect.x * 100}%`,
                top: `${cropRect.y * 100}%`,
                width: `${cropRect.w * 100}%`,
                height: `${cropRect.h * 100}%`,
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
                  role="button"
                  aria-label={`Crop ${handle} corner`}
                  onPointerDown={(event) => onCropDown(handle, event)}
                  onPointerMove={onCropMove}
                  onPointerUp={onCropUp}
                  onPointerCancel={onCropUp}
                />
              ))}
            </div>

            {fit > 0 && (
              <button
                type="button"
                className={styles.rotateHandle}
                aria-label="Rotate image"
                title="Drag to rotate · Shift = snap 45° · Ctrl/Cmd = fine"
                onPointerDown={onRotateDown}
                onPointerMove={onRotateMove}
                onPointerUp={onRotateUp}
                onPointerCancel={onRotateUp}
              >
                <RotateRightIcon />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.sidebar}>
        <div className={styles.toolRow}>
          <button
            type="button"
            className={styles.toolButton}
            disabled={!canUndo}
            onClick={undo}
            title="Undo (Ctrl/Cmd+Z)"
          >
            <UndoIcon />
            <span className={styles.toolButtonLabel}>Undo</span>
          </button>
          <button
            type="button"
            className={styles.toolButton}
            disabled={!canRedo}
            onClick={redo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <RedoIcon />
            <span className={styles.toolButtonLabel}>Redo</span>
          </button>
          <button
            type="button"
            className={styles.toolButton}
            disabled={isIdentityTransform(committed)}
            onClick={reset}
            title="Reset to original"
          >
            <ResetIcon />
            <span className={styles.toolButtonLabel}>Reset</span>
          </button>
        </div>

        <div className={styles.toolRow}>
          <span className={styles.rowLabel}>Zoom</span>
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
              {atFit ? "Fit" : `${Math.round(zoom * 100)}%`}
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
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.groupLabel}>
              <RotateRightIcon /> Rotate
            </span>
            <span className={`${styles.angleValue} mono`}>{Math.round(rotation)}°</span>
          </div>
          <div className={styles.rotateButtons}>
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => rotate90(-90)}
              title="Rotate left 90° (Shift+R)"
            >
              <RotateLeftIcon />
              <span className={styles.toolButtonLabel}>90° left</span>
            </button>
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => rotate90(90)}
              title="Rotate right 90° (R)"
            >
              <RotateRightIcon />
              <span className={styles.toolButtonLabel}>90° right</span>
            </button>
          </div>
          <p className={styles.hint}>Drag the handle above the image to straighten.</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.groupLabel}>
              <CropIcon /> Crop
            </span>
            <span className={`${styles.cropDims} mono`}>
              {outW} × {outH}
            </span>
          </div>
          <p className={styles.hint}>Drag the corner handles on the image.</p>
        </div>
      </div>
    </div>
  );
}
