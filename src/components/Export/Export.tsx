import type { JSX } from "preact";
import { useState } from "preact/hooks";
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
  const intrinsic = intrinsicSize(svg);
  // Pre-fill the override fields with the SVG's own dimensions so the user sees
  // the current size and can edit from there (blank falls back to intrinsic).
  const [width, setWidth] = useState(intrinsic.width);
  const [height, setHeight] = useState(intrinsic.height);
  const [copied, setCopied] = useState(false);

  const effectiveSvg = applyViewBoxOverride(svg, {
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
  });
  const estimate = estimateSvg(effectiveSvg);

  async function handleCopy() {
    await copySvgToClipboard(effectiveSvg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleNumberInput(setter: (value: string) => void) {
    return (event: JSX.TargetedEvent<HTMLInputElement>) => setter(event.currentTarget.value);
  }

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
              onInput={handleNumberInput(setWidth)}
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
              onInput={handleNumberInput(setHeight)}
            />
          </label>
        </div>
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
        {copied ? "Copied!" : "Copy SVG markup"}
      </button>
    </div>
  );
}
