import type { JSX } from "preact";
import { useState } from "preact/hooks";
import {
  applyViewBoxOverride,
  copySvgToClipboard,
  downloadSvg,
  estimateSvg,
} from "../../lib/svgExport";
import { DownloadIcon, CopyIcon } from "../shellIcons";
import styles from "./Export.module.css";

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export interface ExportProps {
  /** The current traced SVG markup (status/plan.md "Data flow" step 8). */
  svg: string;
}

/**
 * Export controls (T9): download `.svg`, copy raw markup, override output
 * width/height, and a size/path-count estimate. The override is a pure string
 * rewrite (`applyViewBoxOverride`) applied on every render — never a tracer
 * call — so it's reflected instantly in the estimate, download, and copy.
 */
/** Reads the SVG's intrinsic width/height/viewBox off its root tag for the size fields. */
function intrinsicSize(svg: string): { width: string; height: string; viewBox: string } {
  const tag = /<svg[^>]*>/.exec(svg)?.[0] ?? "";
  const width = /\bwidth="([\d.]+)/.exec(tag)?.[1] ?? "";
  const height = /\bheight="([\d.]+)/.exec(tag)?.[1] ?? "";
  const viewBox =
    /viewBox="([^"]+)"/.exec(tag)?.[1] ?? (width && height ? `0 0 ${width} ${height}` : "—");
  return { width, height, viewBox };
}

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
        <DownloadIcon />
        Download .svg
      </button>
      <button type="button" className={styles.secondary} onClick={() => void handleCopy()}>
        <CopyIcon />
        {copied ? "Copied!" : "Copy SVG markup"}
      </button>
    </div>
  );
}
