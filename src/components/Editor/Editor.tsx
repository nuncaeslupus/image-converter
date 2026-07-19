import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  cropImage,
  fitToFrameScale,
  rotateImage,
  rotateImageArbitrary,
  type CropBox,
} from "../../lib/imageEdit";
import { TOOLBAR_KEYS, nextRovingIndex } from "../../lib/rovingFocus";
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
const MIN_CROP_SIZE = 8;
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.25;
// Rotation slider marks (every 45°), all numbered. Default drag has a small
// snap zone around each mark; Shift snaps hard to the nearest 45°; Ctrl/Cmd
// disables snapping entirely.
const ANGLE_MARKS = [-180, -135, -90, -45, 0, 45, 90, 135, 180];
const SNAP_STEP = 45;
const SNAP_ZONE = 2;
const STAGE_PAD = 12;

interface History {
  stack: ImageBitmap[];
  index: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function fullBoxFor(image: { width: number; height: number }): CropBox {
  return { x: 0, y: 0, width: image.width, height: image.height };
}

function snapAngle(value: number, shift: boolean, ctrl: boolean): number {
  if (ctrl) return value;
  const nearest = Math.round(value / SNAP_STEP) * SNAP_STEP;
  if (shift) return nearest;
  return Math.abs(value - nearest) <= SNAP_ZONE ? nearest : value;
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
  /** Called with the replacement image whenever an edit is applied/undone/redone. */
  onChange: (image: ImageBitmap) => void;
}

/**
 * Crop / rotate editor (T5). The stage is a constant size and fills unused
 * space with a neutral colour — the image is never stretched to fit. Zoom
 * −/+ scales the view (− bottoms out at "fit"; when zoomed in, drag to pan);
 * the rotation slider keeps the image size constant (transparent corners) or,
 * with "fit to frame", zooms so the image never leaves its rectangle.
 *
 * Keyboard: `R`/`Shift+R` rotate ±90°, hold `Shift` while dragging the slider
 * to snap to 45° marks, `Escape` cancels a pending rotation, `Ctrl/Cmd+Z`
 * undo, `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` redo. Crop handles nudge with arrows.
 */
export function Editor({ image, onChange }: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [cropBox, setCropBox] = useState<CropBox>(() => fullBoxFor(image));
  const [angle, setAngle] = useState(0);
  const [fitToFrame, setFitToFrame] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  // Roving-tabindex state for the toolbar (WAI-ARIA APG toolbar pattern):
  // only one button is a Tab stop at a time; Left/Right arrow keys move it.
  // `toolbarRef` points at the toolbar container; the button list is queried
  // from the DOM on demand (see `handleToolbarKeyDown`) rather than collected
  // via per-button ref callbacks during render.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarActiveIndex, setToolbarActiveIndex] = useState(0);
  // In-session edit history: index 0 is the image this Edit visit started from.
  const [history, setHistory] = useState<History>(() => ({ stack: [image], index: 0 }));

  const canUndo = history.index > 0;
  const canRedo = history.index < history.stack.length - 1;
  const isEdited = history.index > 0;
  const isCropped =
    cropBox.x !== 0 ||
    cropBox.y !== 0 ||
    cropBox.width !== image.width ||
    cropBox.height !== image.height;
  const rotating = angle !== 0;
  const panning = zoom > 1;

  const dragRef = useRef<{
    handle: Handle;
    pointerId: number;
    startBox: CropBox;
    startClientX: number;
    startClientY: number;
    scale: number;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPan: { x: number; y: number };
  } | null>(null);
  const shiftRef = useRef(false);
  const ctrlRef = useRef(false);
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  // Free the GPU backing store of every inactive history bitmap on unmount —
  // the active one (index) is still `wizard.image`, consumed downstream.
  useEffect(
    () => () => {
      const { stack, index } = historyRef.current;
      stack.forEach((bmp, i) => {
        if (i !== index) bmp.close();
      });
    },
    [],
  );

  // Latest values for the window keydown handler (registered once).
  const actionsRef = useRef<{
    rotate90: (d: 90 | -90) => void;
    undo: () => void;
    redo: () => void;
  }>({ rotate90: () => {}, undo: () => {}, redo: () => {} });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
  }, [image]);

  // A new working image resets the pending crop box and the view.
  useEffect(() => {
    setCropBox(fullBoxFor(image));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [image]);

  // Measure the stage so the image can be sized to a true "contain" fit
  // (never stretched). Layout effect + ResizeObserver keeps it exact.
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

  function pushEdit(next: ImageBitmap) {
    setHistory((h) => {
      // A new edit discards any redo-future bitmaps — close them to free memory.
      for (const bmp of h.stack.slice(h.index + 1)) bmp.close();
      const stack = h.stack.slice(0, h.index + 1);
      stack.push(next);
      return { stack, index: stack.length - 1 };
    });
    onChange(next);
  }

  function goToHistory(index: number) {
    setHistory((h) => ({ ...h, index }));
    onChange(history.stack[index]);
  }

  async function rotate90(degrees: 90 | -90) {
    if (busy) return;
    setBusy(true);
    try {
      pushEdit(await rotateImage(image, degrees));
      setAngle(0);
    } finally {
      setBusy(false);
    }
  }

  async function applyAngle() {
    if (busy || angle === 0) return;
    setBusy(true);
    try {
      pushEdit(await rotateImageArbitrary(image, angle, fitToFrame));
      setAngle(0);
    } finally {
      setBusy(false);
    }
  }

  async function applyCrop() {
    if (busy || !isCropped) return;
    setBusy(true);
    try {
      pushEdit(await cropImage(image, cropBox));
    } finally {
      setBusy(false);
    }
  }

  function undo() {
    if (canUndo) goToHistory(history.index - 1);
  }
  function redo() {
    if (canRedo) goToHistory(history.index + 1);
  }
  function reset() {
    setAngle(0);
    if (isEdited) goToHistory(0);
  }

  function zoomBy(factor: number) {
    setZoom((z) => {
      const next = clamp(z * factor, ZOOM_MIN, ZOOM_MAX);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }

  actionsRef.current = { rotate90: (d) => void rotate90(d), undo, redo };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      shiftRef.current = event.shiftKey;
      ctrlRef.current = event.ctrlKey || event.metaKey;

      const target = event.target as HTMLElement | null;
      const isTypingTarget =
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

      if (event.key === "Escape") {
        setAngle(0);
        return;
      }
      if (isTypingTarget) return;

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        actionsRef.current.rotate90(event.shiftKey ? -90 : 90);
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      shiftRef.current = event.shiftKey;
      ctrlRef.current = event.ctrlKey || event.metaKey;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function handlePointerDownOnHandle(
    handle: Handle,
    event: JSX.TargetedPointerEvent<HTMLDivElement>,
  ) {
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width > 0 ? image.width / rect.width : 1;
    dragRef.current = {
      handle,
      pointerId: event.pointerId,
      startBox: cropBox,
      startClientX: event.clientX,
      startClientY: event.clientY,
      scale,
    };
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
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

  function handleStagePointerDown(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (!panning) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPan: pan,
    };
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handleStagePointerMove(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const drag = panRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = stageRef.current?.getBoundingClientRect();
    const maxX = rect ? (rect.width * (zoom - 1)) / 2 : Infinity;
    const maxY = rect ? (rect.height * (zoom - 1)) / 2 : Infinity;
    setPan({
      x: clamp(drag.startPan.x + (event.clientX - drag.startX), -maxX, maxX),
      y: clamp(drag.startPan.y + (event.clientY - drag.startY), -maxY, maxY),
    });
  }

  function handleStagePointerUp(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
    }
  }

  // Mirrors each toolbar button's `disabled` expression, in JSX order, so the
  // render-time active index can be corrected away from a disabled button
  // (a disabled button can't receive focus, so leaving tabIndex=0 on it would
  // make the whole toolbar unreachable by keyboard — see toolbarTabIndex).
  const toolbarEnabled = [
    !busy,
    !busy,
    !(busy || zoom <= ZOOM_MIN),
    !(busy || zoom >= ZOOM_MAX),
    !(busy || !canUndo),
    !(busy || !canRedo),
    !(busy || !isEdited),
  ];
  const effectiveToolbarIndex = toolbarEnabled[toolbarActiveIndex]
    ? toolbarActiveIndex
    : toolbarEnabled.findIndex(Boolean);

  function toolbarTabIndex(index: number): number {
    return index === effectiveToolbarIndex ? 0 : -1;
  }

  function handleToolbarKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>) {
    const container = toolbarRef.current;
    if (!container) return;
    const allButtons = Array.from(container.querySelectorAll("button"));
    const enabledButtons = allButtons.filter((el) => !el.disabled);
    if (enabledButtons.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const activeIndex = active ? enabledButtons.indexOf(active) : -1;
    const currentIndex = activeIndex === -1 ? 0 : activeIndex;
    const nextIndex = nextRovingIndex(event.key, currentIndex, enabledButtons.length, TOOLBAR_KEYS);
    if (nextIndex === null) return;
    event.preventDefault();
    const nextEl = enabledButtons[nextIndex];
    nextEl.focus();
    setToolbarActiveIndex(allButtons.indexOf(nextEl));
  }

  // Pan + zoom always transform the frame (screen space). Rotation targets
  // differ: fit-to-frame rotates the image *inside* a fixed axis-aligned
  // rectangle (clipped); otherwise the whole rectangle tilts at constant size.
  const viewParts: string[] = [];
  if (pan.x || pan.y) viewParts.push(`translate(${pan.x}px, ${pan.y}px)`);
  if (zoom !== 1) viewParts.push(`scale(${zoom})`);

  let canvasStyle: JSX.CSSProperties | undefined;
  if (rotating && fitToFrame) {
    const cover = fitToFrameScale(image.width, image.height, (angle * Math.PI) / 180);
    canvasStyle = { transform: `rotate(${angle}deg) scale(${cover})`, transformOrigin: "center" };
  } else if (rotating) {
    viewParts.push(`rotate(${angle}deg)`);
  }

  // Size the image rectangle to a true contain-fit of the measured stage — the
  // image is never stretched; leftover space stays the neutral stage colour.
  const availW = Math.max(0, stageSize.w - STAGE_PAD * 2);
  const availH = Math.max(0, stageSize.h - STAGE_PAD * 2);
  const fit = availW && availH ? Math.min(availW / image.width, availH / image.height) : 0;
  const frameStyle: JSX.CSSProperties = {};
  if (fit > 0) {
    frameStyle.width = `${image.width * fit}px`;
    frameStyle.height = `${image.height * fit}px`;
  }
  if (viewParts.length) frameStyle.transform = viewParts.join(" ");

  return (
    <div className={styles.editor}>
      <div
        ref={toolbarRef}
        className={styles.toolbar}
        role="toolbar"
        aria-label="Image editing tools"
        onKeyDown={handleToolbarKeyDown}
      >
        <button
          type="button"
          className={styles.toolButton}
          disabled={busy}
          tabIndex={toolbarTabIndex(0)}
          onFocus={() => setToolbarActiveIndex(0)}
          onClick={() => void rotate90(-90)}
          title="Rotate left 90° (Shift+R)"
        >
          <RotateLeftIcon />
          <span className={styles.toolButtonLabel}>Rotate left</span>
        </button>
        <button
          type="button"
          className={styles.toolButton}
          disabled={busy}
          tabIndex={toolbarTabIndex(1)}
          onFocus={() => setToolbarActiveIndex(1)}
          onClick={() => void rotate90(90)}
          title="Rotate right 90° (R)"
        >
          <RotateRightIcon />
          <span className={styles.toolButtonLabel}>Rotate right</span>
        </button>

        <span className={styles.spacer} />

        <div className={styles.zoomGroup}>
          <button
            type="button"
            className={styles.zoomButton}
            disabled={busy || zoom <= ZOOM_MIN}
            tabIndex={toolbarTabIndex(2)}
            onFocus={() => setToolbarActiveIndex(2)}
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOutIcon />
          </button>
          <span className={`${styles.zoomLabel} mono`}>
            {zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            type="button"
            className={styles.zoomButton}
            disabled={busy || zoom >= ZOOM_MAX}
            tabIndex={toolbarTabIndex(3)}
            onFocus={() => setToolbarActiveIndex(3)}
            onClick={() => zoomBy(ZOOM_STEP)}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomInIcon />
          </button>
        </div>

        <span className={styles.spacer} />

        <button
          type="button"
          className={styles.toolButton}
          disabled={busy || !canUndo}
          tabIndex={toolbarTabIndex(4)}
          onFocus={() => setToolbarActiveIndex(4)}
          onClick={undo}
          title="Undo (Ctrl/Cmd+Z)"
        >
          <UndoIcon />
          <span className={styles.toolButtonLabel}>Undo</span>
        </button>
        <button
          type="button"
          className={styles.toolButton}
          disabled={busy || !canRedo}
          tabIndex={toolbarTabIndex(5)}
          onFocus={() => setToolbarActiveIndex(5)}
          onClick={redo}
          title="Redo (Ctrl/Cmd+Shift+Z)"
        >
          <RedoIcon />
          <span className={styles.toolButtonLabel}>Redo</span>
        </button>
        <button
          tabIndex={toolbarTabIndex(6)}
          onFocus={() => setToolbarActiveIndex(6)}
          type="button"
          className={styles.toolButton}
          disabled={busy || !isEdited}
          onClick={reset}
          title="Reset to original"
        >
          <ResetIcon />
          <span className={styles.toolButtonLabel}>Reset</span>
        </button>
      </div>

      {(isCropped || rotating) && (
        <p className={styles.unappliedHint} role="status">
          {isCropped && rotating
            ? "Unapplied crop and rotation — use Apply to keep them"
            : isCropped
              ? "Unapplied crop — use Apply to keep it"
              : "Unapplied rotation — use Apply to keep it"}
        </p>
      )}

      <div
        ref={stageRef}
        className={`${styles.stage} ${panning ? styles.stagePannable : ""}`}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerUp}
      >
        <div
          className={`${styles.frame} ${rotating && fitToFrame ? styles.frameClip : ""}`}
          style={frameStyle}
        >
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={canvasStyle}
            data-testid="editor-canvas"
          />
          {!rotating && (
            <div className={styles.cropOverlay}>
              <div
                className={`${styles.cropRect} ${isCropped ? styles.cropRectScrim : ""}`}
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
                    role="button"
                    aria-roledescription="crop handle"
                    tabIndex={0}
                    // role="button" has no notion of aria-valuetext (that's a
                    // slider/spinbutton feature), so the position info folds
                    // into the label itself instead of being silently dropped.
                    aria-label={`Crop handle: ${handle}, x ${Math.round(cropBox.x)}, y ${Math.round(cropBox.y)}, width ${Math.round(cropBox.width)}, height ${Math.round(cropBox.height)}`}
                    onPointerDown={(event) => handlePointerDownOnHandle(handle, event)}
                    onPointerMove={handlePointerMoveOnHandle}
                    onPointerUp={handlePointerUpOnHandle}
                    onPointerCancel={handlePointerUpOnHandle}
                    onKeyDown={(event) => handleHandleKeyDown(handle, event)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.rotateHead}>
          <span className={styles.groupLabel}>
            <CropIcon /> Crop &amp; rotate
          </span>
          <span className={`${styles.cropDims} mono`}>
            {Math.round(cropBox.width)} × {Math.round(cropBox.height)}
          </span>
        </div>

        <div className={styles.sliderWrap}>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={angle}
            disabled={busy}
            aria-label="Rotation angle"
            onInput={(event) =>
              setAngle(
                snapAngle(Number(event.currentTarget.value), shiftRef.current, ctrlRef.current),
              )
            }
          />
          <div className={styles.ticks} aria-hidden="true">
            {ANGLE_MARKS.map((t) => (
              <div
                key={t}
                className={styles.tickWrap}
                style={{ left: `${((t + 180) / 360) * 100}%` }}
              >
                <span className={styles.tick} data-major={t % 90 === 0 || undefined} />
                <span className={`${styles.tickLabel} mono`}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={fitToFrame}
              onChange={(event) => setFitToFrame(event.currentTarget.checked)}
            />
            Fit to frame
          </label>
          <span className={`${styles.angleValue} mono`}>{angle}°</span>
          <span className={styles.spacer} />
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => void applyCrop()}
            disabled={busy || !isCropped}
          >
            Apply crop
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void applyAngle()}
            disabled={busy || !rotating}
          >
            Apply rotation
          </button>
        </div>
      </div>
    </div>
  );
}
