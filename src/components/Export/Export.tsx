import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  applyViewBoxOverride,
  copySvgToClipboard,
  countSvgColors,
  downloadSvg,
  estimateSvg,
} from "../../lib/svgExport";
import { ExportStepIcon, CopyIcon, CodeIcon, LinkIcon } from "../shellIcons";
import styles from "./Export.module.css";

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

type Unit = "px" | "%";

/**
 * Parses a size field into an absolute pixel value, or `undefined` if it can't.
 * In `%` mode the number is a percentage of `base`; in `px` mode it's literal.
 */
function parsePx(value: string, base: number, unit: Unit): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (unit === "%") return n > 0 ? Math.max(1, Math.round((base * n) / 100)) : undefined;
  return n >= 1 ? Math.round(n) : undefined;
}

/** Formats an absolute pixel value for display in the current unit. */
function displayIn(px: number, base: number, unit: Unit): string {
  return unit === "%" ? String(Math.round((px / base) * 100)) : String(px);
}

/** How long the "Copied!" / "Copy failed" feedback stays visible before reverting to the idle label. */
const COPY_FEEDBACK_MS = 1500;

export interface ExportProps {
  /** The current traced SVG markup (status/plan.md "Data flow" step 8). */
  svg: string;
  /** Pre-filled download name (source name with a `.svg` extension). */
  defaultFileName: string;
  /** Original (post-edit) image width — the default output size and the `%` base. */
  defaultWidth?: number;
  /** Original (post-edit) image height — the default output size and the `%` base. */
  defaultHeight?: number;
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
export function Export({ svg, defaultFileName, defaultWidth, defaultHeight }: ExportProps) {
  // Pre-fill the download name from the source; re-seed if the default changes.
  const [fileName, setFileName] = useState(defaultFileName);
  useEffect(() => setFileName(defaultFileName), [defaultFileName]);

  const intrinsic = useMemo(() => intrinsicSize(svg), [svg]);
  // The base the `%` unit and the default size are relative to: the original
  // (post-edit) image dimensions when known, else the SVG's intrinsic size.
  const base = useMemo(() => {
    const w = defaultWidth ?? Number(intrinsic.width);
    const h = defaultHeight ?? Number(intrinsic.height);
    return {
      w: Number.isFinite(w) && w >= 1 ? Math.round(w) : 1,
      h: Number.isFinite(h) && h >= 1 ? Math.round(h) : 1,
    };
  }, [defaultWidth, defaultHeight, intrinsic]);
  const aspect = base.w / base.h;

  const [unit, setUnit] = useState<Unit>("px");
  const [keepRatio, setKeepRatio] = useState(true);
  // Canonical output size in px (always valid); the fields display it in `unit`.
  const [pxW, setPxW] = useState(base.w);
  const [pxH, setPxH] = useState(base.h);
  // Raw field text (may be mid-edit / invalid); px only updates on a valid value,
  // so a stray "0"/"-5" can never produce an invisible width="0" SVG.
  const [wStr, setWStr] = useState(String(base.w));
  const [hStr, setHStr] = useState(String(base.h));

  // Re-seed to the original size (in px) whenever the image/base changes — a
  // new source starts from its own dimensions at 100%.
  useEffect(() => {
    setUnit("px");
    setPxW(base.w);
    setPxH(base.h);
    setWStr(String(base.w));
    setHStr(String(base.h));
  }, [base]);

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [showMarkup, setShowMarkup] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears the pending "revert to idle" timeout on unmount — otherwise
  // navigating away within COPY_FEEDBACK_MS of a copy calls setState after
  // the component is gone.
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const widthInvalid = parsePx(wStr, base.w, unit) === undefined;
  const heightInvalid = parsePx(hStr, base.h, unit) === undefined;

  // Download/Copy/estimate always use the canonical px size, never a
  // currently-invalid typed value.
  const effectiveSvg = useMemo(
    () => applyViewBoxOverride(svg, { width: pxW, height: pxH }),
    [svg, pxW, pxH],
  );
  const estimate = useMemo(() => estimateSvg(effectiveSvg), [effectiveSvg]);
  const colorCount = useMemo(() => countSvgColors(effectiveSvg), [effectiveSvg]);

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

  // Switching units keeps the actual size fixed, just re-displaying it (px ↔ %).
  function changeUnit(next: Unit) {
    if (next === unit) return;
    setWStr(displayIn(pxW, base.w, next));
    setHStr(displayIn(pxH, base.h, next));
    setUnit(next);
  }

  function handleWidthInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    setWStr(value);
    const px = parsePx(value, base.w, unit);
    if (px === undefined) return;
    setPxW(px);
    if (keepRatio) {
      const nh = Math.max(1, Math.round(px / aspect));
      setPxH(nh);
      setHStr(displayIn(nh, base.h, unit));
    }
  }

  function handleHeightInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    setHStr(value);
    const px = parsePx(value, base.h, unit);
    if (px === undefined) return;
    setPxH(px);
    if (keepRatio) {
      const nw = Math.max(1, Math.round(px * aspect));
      setPxW(nw);
      setWStr(displayIn(nw, base.w, unit));
    }
  }

  function handleDownload() {
    const name = fileName.trim() || defaultFileName;
    downloadSvg(effectiveSvg, /\.svg$/i.test(name) ? name : `${name}.svg`);
  }

  const copyLabel = copyState === "copied" ? "Copied!" : copyState === "failed" ? "Failed" : "Copy";

  return (
    <div className={styles.export}>
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
        <div className={styles.estimateRow}>
          <span className={styles.estimateLabel}>Colors</span>
          <span className={`${styles.estimateValue} mono`}>{colorCount.toLocaleString()}</span>
        </div>
      </div>

      <div>
        <div className={styles.label}>File name</div>
        <label className={styles.field}>
          <input
            type="text"
            className="mono"
            value={fileName}
            aria-label="Download file name"
            spellcheck={false}
            onInput={(event) => setFileName(event.currentTarget.value)}
          />
        </label>
      </div>

      <div>
        <div className={styles.sizeHead}>
          <div className={styles.label}>Output size</div>
          <div className={styles.unitToggle} role="group" aria-label="Size unit">
            <button
              type="button"
              className={styles.unitButton}
              aria-pressed={unit === "px"}
              onClick={() => changeUnit("px")}
            >
              px
            </button>
            <button
              type="button"
              className={styles.unitButton}
              aria-pressed={unit === "%"}
              onClick={() => changeUnit("%")}
            >
              %
            </button>
          </div>
        </div>
        <div className={styles.sizeRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Width</span>
            <input
              type="number"
              min={1}
              className="mono"
              value={wStr}
              aria-label="Width"
              aria-invalid={widthInvalid ? "true" : undefined}
              onInput={handleWidthInput}
            />
          </label>
          <button
            type="button"
            className={styles.chain}
            aria-pressed={keepRatio}
            aria-label="Keep aspect ratio"
            title={keepRatio ? "Aspect ratio locked" : "Aspect ratio unlocked"}
            onClick={() => setKeepRatio((v) => !v)}
          >
            <LinkIcon />
          </button>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Height</span>
            <input
              type="number"
              min={1}
              className="mono"
              value={hStr}
              aria-label="Height"
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

      <button type="button" className={styles.primary} onClick={handleDownload}>
        <ExportStepIcon size={17} />
        Download .svg
      </button>

      <button
        type="button"
        className={styles.secondary}
        onClick={() => setShowMarkup((v) => !v)}
        aria-expanded={showMarkup}
      >
        <CodeIcon />
        {showMarkup ? "Hide SVG markup" : "View SVG markup"}
      </button>

      {showMarkup && (
        <div className={styles.markup}>
          <textarea
            className={`${styles.markupText} mono`}
            readOnly
            value={effectiveSvg}
            aria-label="SVG markup"
            spellcheck={false}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className={styles.markupCopy}
            onClick={() => void handleCopy()}
            aria-label="Copy SVG markup"
          >
            <CopyIcon size={14} />
            <span aria-live="polite">{copyLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
