import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  applyViewBoxOverride,
  copySvgToClipboard,
  downloadSvg,
  estimateSvg,
} from "../../lib/svgExport";
import { ExportStepIcon, CopyIcon } from "../shellIcons";
import styles from "./Export.module.css";

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** A blank field means "auto" (fall back to intrinsic) — anything else must parse as >= 1. */
function isInvalidSize(value: string): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return !(Number.isFinite(n) && n >= 1);
}

/** Parses a size field into a positive-integer override, or `undefined` for blank/invalid (caller falls back to intrinsic). */
function parseSizeOverride(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : undefined;
}

/** How long the "Copied!" / "Copy failed" feedback stays visible before reverting to the idle label. */
const COPY_FEEDBACK_MS = 1500;

export interface ExportProps {
  /** The current traced SVG markup (status/plan.md "Data flow" step 8). */
  svg: string;
}

/**
 * Reads the SVG's intrinsic width/height/viewBox for the size fields. Parses
 * the markup with `DOMParser` (robust to quoting/whitespace) and falls back to
 * the viewBox extents when width/height are absent.
 */
function intrinsicSize(svg: string): { width: string; height: string; viewBox: string } {
  try {
    const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg");
    if (!svgEl) return { width: "", height: "", viewBox: "—" };
    const viewBox = svgEl.getAttribute("viewBox") ?? "";
    let width = svgEl.getAttribute("width")?.match(/[\d.]+/)?.[0] ?? "";
    let height = svgEl.getAttribute("height")?.match(/[\d.]+/)?.[0] ?? "";
    if ((!width || !height) && viewBox) {
      const [, , w, h] = viewBox.split(/[\s,]+/);
      if (!width && w) width = w;
      if (!height && h) height = h;
    }
    return {
      width,
      height,
      viewBox: viewBox || (width && height ? `0 0 ${width} ${height}` : "—"),
    };
  } catch {
    return { width: "", height: "", viewBox: "—" };
  }
}

/**
 * Export controls (T9): download `.svg`, copy raw markup, override output
 * width/height, and a size/path-count estimate. The override is a pure string
 * rewrite (`applyViewBoxOverride`) applied on every render — never a tracer
 * call — so it's reflected instantly in the estimate, download, and copy.
 */
export function Export({ svg }: ExportProps) {
  // DOMParser + a viewBox regex/TextEncoder pass over potentially hundreds
  // of KB of markup — memoized so it only reruns when its actual inputs
  // change, not on every render/keystroke (finding: recomputes heavy work
  // every render).
  const intrinsic = useMemo(() => intrinsicSize(svg), [svg]);
  // Pre-fill the override fields with the SVG's own dimensions so the user sees
  // the current size and can edit from there (blank falls back to intrinsic).
  const [width, setWidth] = useState(intrinsic.width);
  const [height, setHeight] = useState(intrinsic.height);
  // The last value in each field that actually validated — Download/Copy/the
  // estimate always use these, never a currently-invalid typed value, so a
  // stray "0" or "-5" can never produce an invisible `width="0"` SVG.
  const [lastValidWidth, setLastValidWidth] = useState(intrinsic.width);
  const [lastValidHeight, setLastValidHeight] = useState(intrinsic.height);

  // Re-seed the fields if the SVG itself is replaced while this component
  // stays mounted (`intrinsic` is memoized on `svg`, so its identity only
  // changes with a genuinely new document) — without this, stale dimensions
  // from the previous SVG would keep overriding the new one's.
  useEffect(() => {
    setWidth(intrinsic.width);
    setHeight(intrinsic.height);
    setLastValidWidth(intrinsic.width);
    setLastValidHeight(intrinsic.height);
  }, [intrinsic]);

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears the pending "revert to idle" timeout on unmount — otherwise
  // navigating away within COPY_FEEDBACK_MS of a copy calls setState after
  // the component is gone.
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const widthInvalid = isInvalidSize(width);
  const heightInvalid = isInvalidSize(height);

  const effectiveSvg = useMemo(
    () =>
      applyViewBoxOverride(svg, {
        width: parseSizeOverride(lastValidWidth),
        height: parseSizeOverride(lastValidHeight),
      }),
    [svg, lastValidWidth, lastValidHeight],
  );
  const estimate = useMemo(() => estimateSvg(effectiveSvg), [effectiveSvg]);

  async function handleCopy() {
    try {
      await copySvgToClipboard(effectiveSvg);
      setCopyState("copied");
    } catch {
      // No clipboard permission, an unfocused document, etc. — surface it
      // instead of leaving an unhandled rejection with no user feedback.
      setCopyState("failed");
    }
    if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
  }

  function handleWidthInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    setWidth(value);
    if (!isInvalidSize(value)) setLastValidWidth(value);
  }

  function handleHeightInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    setHeight(value);
    if (!isInvalidSize(value)) setLastValidHeight(value);
  }

  const copyLabel =
    copyState === "copied" ? "Copied!" : copyState === "failed" ? "Copy failed" : "Copy SVG markup";

  return (
    <div className={styles.export}>
      <div>
        <div className={styles.label}>Output size</div>
        <div className={styles.sizeRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Width</span>
            <input
              type="number"
              min={1}
              placeholder="auto"
              className="mono"
              value={width}
              aria-invalid={widthInvalid ? "true" : undefined}
              onInput={handleWidthInput}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Height</span>
            <input
              type="number"
              min={1}
              placeholder="auto"
              className="mono"
              value={height}
              aria-invalid={heightInvalid ? "true" : undefined}
              onInput={handleHeightInput}
            />
          </label>
        </div>
        {(widthInvalid || heightInvalid) && (
          <p className={styles.sizeError} role="alert">
            {widthInvalid && heightInvalid
              ? "Width and height must be positive numbers — using the last valid size instead."
              : widthInvalid
                ? "Width must be a positive number — using the last valid size instead."
                : "Height must be a positive number — using the last valid size instead."}
          </p>
        )}
        <div className={`${styles.viewBox} mono`}>viewBox {intrinsic.viewBox}</div>
      </div>

      <div className={styles.estimate}>
        <div className={styles.estimateRow}>
          <span className={styles.estimateLabel}>Estimated size</span>
          <span className={`${styles.estimateValue} mono`}>{formatBytes(estimate.bytes)}</span>
        </div>
        <div className={styles.estimateRow}>
          <span className={styles.estimateLabel}>Path count</span>
          <span className={`${styles.estimateValue} mono`}>
            {estimate.pathCount.toLocaleString()}
          </span>
        </div>
      </div>

      <button type="button" className={styles.primary} onClick={() => downloadSvg(effectiveSvg)}>
        <ExportStepIcon size={17} />
        Download .svg
      </button>
      <button type="button" className={styles.secondary} onClick={() => void handleCopy()}>
        <CopyIcon />
        <span aria-live="polite">{copyLabel}</span>
      </button>
    </div>
  );
}
