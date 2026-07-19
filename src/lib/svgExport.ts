/**
 * Export (T9) — download/copy/viewBox override/size estimate for the current
 * traced SVG. See status/specification.md Goals and §5, status/plan.md "Data
 * flow" step 8: the viewBox/size override is a cheap SVG-only string edit —
 * same regex-rewrite style as `tweakPipeline.ts`'s `applyBackground` — never
 * a tracer/worker call.
 */

export interface ViewBoxOverride {
  width?: number;
  height?: number;
  viewBox?: string;
}

function setAttr(openTag: string, name: string, value: string): string {
  const attrRegex = new RegExp(`\\s${name}="[^"]*"`);
  if (attrRegex.test(openTag)) {
    return openTag.replace(attrRegex, ` ${name}="${value}"`);
  }
  return openTag.replace(/^<svg/, `<svg ${name}="${value}"`);
}

/** Rewrites width/height/viewBox on the root `<svg>` tag. Pure string edit — no worker call. */
export function applyViewBoxOverride(svg: string, override: ViewBoxOverride): string {
  const match = /<svg[^>]*>/.exec(svg);
  if (!match) return svg;
  let openTag = match[0];
  if (override.viewBox !== undefined) openTag = setAttr(openTag, "viewBox", override.viewBox);
  if (override.width !== undefined) openTag = setAttr(openTag, "width", String(override.width));
  if (override.height !== undefined) openTag = setAttr(openTag, "height", String(override.height));
  return svg.slice(0, match.index) + openTag + svg.slice(match.index + match[0].length);
}

/** Downloadable Blob for the current SVG markup. */
export function createSvgBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml" });
}

/** Grace period before revoking the download's object URL — revoking in the
 * same tick as `click()` can abort the download in Firefox, which resolves
 * the navigation asynchronously. */
const DOWNLOAD_REVOKE_DELAY_MS = 4000;

/** Triggers a browser download of the SVG markup as a `.svg` file. */
export function downloadSvg(svg: string, filename = "image.svg"): void {
  const url = URL.createObjectURL(createSvgBlob(svg));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_DELAY_MS);
}

/** Copies the full, exact SVG markup to the clipboard. */
export async function copySvgToClipboard(svg: string): Promise<void> {
  await navigator.clipboard.writeText(svg);
}

export interface SvgEstimate {
  bytes: number;
  pathCount: number;
}

/**
 * Counts `<path>` elements in SVG markup. Matches both open (`<path ...>`)
 * and self-closing (`<path .../>`) forms — the single shared definition for
 * this, so the worker's post-trace `pathCount` (src/worker/vtracerTracer.ts)
 * and this pre-export estimate never disagree on the same markup.
 */
export function countPaths(svg: string): number {
  return (svg.match(/<path[\s/>]/g) ?? []).length;
}

/** Byte size and `<path>` count of the given SVG markup, for a pre-export estimate. */
export function estimateSvg(svg: string): SvgEstimate {
  return {
    bytes: new TextEncoder().encode(svg).length,
    pathCount: countPaths(svg),
  };
}
