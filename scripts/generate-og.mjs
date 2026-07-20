/**
 * Generates the Open Graph / social share cards (1200×630) — one PNG per
 * language — from a single SVG template, so adding a language is one entry in
 * CARDS + a re-run. No CDN / no browser: renders with resvg.
 *
 * The generated cards are COMMITTED (public/og/*.png), so resvg is NOT a
 * committed dependency (it's a native binary that would bloat the lockfile and
 * every CI install). Install it ad-hoc only when regenerating:
 *
 *   npm i -D @resvg/resvg-js && node scripts/generate-og.mjs   (then: npm uninstall @resvg/resvg-js)
 *
 * Output: public/og/og-<lang>.png            (referenced from the HTML shells)
 *
 * Keep CARDS' keys in sync with i18n `Lang` and the copy in sync with the
 * header (src/lib/i18n.tsx). The card is intentionally standalone (its own copy
 * object) so this build script never imports app source.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// resvg is a native binary that isn't a committed dependency (see the header) —
// import it lazily so running this without it gives an actionable message, not a
// cryptic module-resolution stack trace.
let Resvg;
try {
  ({ Resvg } = await import("@resvg/resvg-js"));
} catch {
  throw new Error(
    "@resvg/resvg-js is not installed — it's not a committed dependency (the cards are). " +
      "Install it ad-hoc to regenerate: " +
      "npm i -D @resvg/resvg-js && node scripts/generate-og.mjs && npm uninstall @resvg/resvg-js",
  );
}

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../public/og");

/** Per-language card copy. Add a language here and re-run to regenerate all. */
const CARDS = {
  en: {
    keywords: "FREE · PRIVATE · NO ADS",
    tagline: "Image → SVG vectorizer, right in your browser",
  },
  es: {
    keywords: "GRATIS · PRIVADO · SIN ANUNCIOS",
    tagline: "Vectorizador de imágenes → SVG, en tu navegador",
  },
};

// Dark palette (punchier as a social thumbnail), matching the app's dark theme.
const BG = "#161b1f";
const FG = "#e9eef1";
const MUTED = "#a3adb4";
const ACCENT = "#34c9bb";
const FONT = "Onest, DejaVu Sans, sans-serif";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The dot-grid logo mark (mirrors public/favicon.svg / the in-app LogoMark). */
const LOGO = `
  <circle cx="20" cy="20" r="5"/>
  <circle cx="20" cy="7" r="2.6"/><circle cx="20" cy="33" r="2.6"/>
  <circle cx="7" cy="20" r="2.6"/><circle cx="33" cy="20" r="2.6"/>
  <circle cx="11" cy="11" r="1.8"/><circle cx="29" cy="11" r="1.8"/>
  <circle cx="11" cy="29" r="1.8"/><circle cx="29" cy="29" r="1.8"/>`;

function cardSvg({ keywords, tagline }) {
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="0" y="0" width="1200" height="9" fill="${ACCENT}"/>
  <g transform="translate(96,92) scale(2.7)" fill="${ACCENT}">${LOGO}</g>
  <text x="230" y="186" font-family="${FONT}" font-size="82" font-weight="700" fill="${FG}">Halftone</text>
  <text x="100" y="360" font-family="${FONT}" font-size="52" font-weight="700" letter-spacing="1.5" fill="${ACCENT}">${esc(keywords)}</text>
  <text x="100" y="428" font-family="${FONT}" font-size="34" fill="${MUTED}">${esc(tagline)}</text>
  <text x="100" y="566" font-family="${FONT}" font-size="26" fill="#6a7681">nuncaeslupus.github.io/image-converter</text>
</svg>`;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [lang, card] of Object.entries(CARDS)) {
  const png = new Resvg(cardSvg(card), {
    fitTo: { mode: "width", value: 1200 },
    font: { loadSystemFonts: true, defaultFontFamily: "sans-serif" },
  })
    .render()
    .asPng();
  const out = resolve(OUT_DIR, `og-${lang}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${(png.length / 1024).toFixed(1)} KB)`);
}
