# UI-2: URL-based language routing (/ for EN, /es/ for ES)

## Context
i18n currently persists language in localStorage (`halftone.lang`) with a
`<select>` switcher, but the URL never changes (user request #8). Desired:
English at `/` and Spanish at `/es/`, so the language is shareable/bookmarkable.

**Deferred pending an approach decision** — this touches deployment. Confirm the
routing + GitHub Pages fallback approach with the user BEFORE implementing.

## Constraints / gotchas
- App is a Vite SPA deployed to GitHub Pages under base path `/image-converter/`.
  So the real paths are `/image-converter/` (EN) and `/image-converter/es/` (ES).
- GitHub Pages has no server rewrites — a deep link to `/es/` 404s unless there's
  a `404.html` SPA fallback (the classic `spa-github-pages` redirect trick) or
  the `es/index.html` is emitted at build time.
- Keep it dependency-light: prefer reading/writing `location.pathname` + a small
  effect over pulling in a router, unless the user wants one.
- Reconcile with existing localStorage persistence + `navigator.language` default
  (URL should win over stored pref on load).

## Suggested approach (confirm first)
1. Derive initial lang from the path segment after the base (`es` → Spanish,
   else English), falling back to localStorage / `navigator.language`.
2. On `setLang`, `history.pushState` to the base or `${base}es/` and keep
   localStorage in sync.
3. Add a GitHub Pages `404.html` fallback (or build-time `es/index.html`) so
   direct `/es/` links resolve. Update the deploy workflow if needed.

## Location
- `src/lib/i18n.tsx` — init-from-URL + push-state on change
- `vite.config.ts` / deploy workflow / `public/404.html` — Pages fallback
- Wherever base path is defined (Vite `base`)

## Acceptance gate
Prose: switching language updates the URL (`/` ⇄ `/es/` under the base); loading
`/es/` directly starts in Spanish; a hard refresh preserves the language; a
deployed deep link to `/es/` does not 404. Approach signed off by the user first.

```bash
npm run typecheck && npx vitest run --exclude "tests/perf/**" && npm run lint && npm run build
```

## Tests
Add a small unit test for the path→lang / lang→path mapping helper (pure fn).
Browser-verify URL changes + direct `/es/` load. Verify the Pages fallback on a
preview deploy.
