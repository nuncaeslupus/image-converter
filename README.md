# image-converter

A free, browser-based file converter. Everything runs client-side — files never
leave your device, and there's no server cost, no upload limits, no paywall.

**First and priority feature: raster image → SVG** (the conversion online tools
usually charge for). Silhouette and multi-color output, with live tweaks for
palette / number of colors, level of detail, and straight vs. curved lines.

## Status

Pre-specification. Agreed technical direction:

- **Tracer:** [VTracer](https://github.com/visioncortex/vtracer) (Rust → WASM) as
  the primary engine; optional Potrace for clean black-and-white.
- **Hosting:** 100% static site (GitHub / Cloudflare / Netlify Pages) — $0 backend.
- **Fast tweaking:** two-tier pipeline — cheap SVG-only edits (background, fill,
  scale) never retrace; only color/detail/curve changes re-run the tracer. Traced
  results are cached by parameter set.
- **Device-safe:** tracing runs in a Web Worker; a downscaled preview keeps
  tweaking snappy on phones/tablets, full resolution only on export.
- Tracer sits behind a `bitmap → SVG` interface, leaving room for an AI tracer later.

## Development

This repo uses the [claude-arsenal](https://github.com/nuncaeslupus/claude-arsenal)
spec → design → execution workflow (`claude-arsenal/`, vendored skills in
`.claude/skills/`).
