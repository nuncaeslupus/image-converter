# halftone

A free, browser-based file converter. Everything runs client-side — files never
leave your device, and there's no server cost, no upload limits, no paywall.

**First and priority feature: raster image → SVG** (the conversion online tools
usually charge for). Silhouette and multi-color output, with live tweaks for
palette / number of colors, level of detail, and straight vs. curved lines.

## Status

Implemented and deployed to GitHub Pages, with PWA/offline support. **Halftone**
walks through a 4-step wizard — Upload → Edit → Trace → Export:

- **Tracer:** [VTracer](https://github.com/visioncortex/vtracer) (Rust → WASM),
  running in a Web Worker so tracing never blocks the UI thread.
- **Hosting:** 100% static site (GitHub Pages) — $0 backend.
- **Fast tweaking:** two-tier pipeline — cheap SVG-only edits (background, fill,
  scale) never retrace; only color/detail/curve changes re-run the tracer.
- **Device-safe:** tweaking traces a preview downscaled to a 512px long edge,
  keeping it snappy on phones/tablets; export re-traces once at full source
  resolution.
- Tracer sits behind a `bitmap → SVG` interface, leaving room for an AI tracer later.

## Development

This repo uses the [claude-arsenal](https://github.com/nuncaeslupus/claude-arsenal)
spec → design → execution workflow (`claude-arsenal/`, vendored skills in
`.claude/skills/`).
