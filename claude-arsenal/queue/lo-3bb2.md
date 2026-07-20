# UI-1: Rotate handle keeps a fixed screen position under zoom/pan

## Context
On the Edit screen the rotate handle is now constant-*size* under zoom
(counter-scaled by `1/zoom`), but it still lives inside the scaled/panned
`.view`, so when the user zooms in to inspect the straightening grid the handle
drifts off-screen. It should stay visible at a fixed screen position regardless
of zoom level (user request #3).

## What to do
Move the rotate handle out of the scaled `.view` and render it as a `.stage`
overlay (screen-space), positioned relative to the image's on-screen bounding
box. The rotate math already uses `bboxRef.getBoundingClientRect()` center
(screen coords), so the orbit calculation is already decoupled from the handle's
DOM position — this is a positioning/DOM-parent refactor, not a math change.

Consider anchoring the handle to the top-center of the bbox's *screen* rect
(recompute on zoom/pan/resize), clamped into the visible stage so it never
leaves the viewport.

## Location
- `src/components/Editor/Editor.tsx` — rotate handle JSX + positioning
- `src/components/Editor/Editor.module.css` — `.rotateHandle`, `.stage`, `.view`

## Acceptance gate
Prose: on the Edit screen, zoom in to ~300% and pan around — the rotate handle
stays visible at a stable screen position and rotation still works (drag orbits
around the image center). Constant size is preserved. Gate verified by browser
check + author judgment.

```bash
npm run typecheck && npx vitest run --exclude "tests/perf/**" && npm run lint
```

## Tests
No new unit test required (visual/interaction change); the mechanical gate is
typecheck + existing suite + lint. Browser-verify the zoomed rotate interaction.
