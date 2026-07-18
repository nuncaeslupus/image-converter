# Session Handover

<!-- Written at session end. A new session reading this file can resume without additional context. -->

## Last task

- **ID**: `lo-9704`
- **Title**: T15: Offline/PWA — service worker precache (spec §1)
- **Status at handover**: `merged` — PR #25.

## Headline

Spec §1 **offline capability** is now shipped and merged (was a manual-validation
gap last session). The app loads and runs fully offline after first visit via a
service-worker precache of the app shell + WASM tracer. Verified end-to-end.

## What was done this session

1. **Offline/PWA (T15, #25)**: added `vite-plugin-pwa` to `vite.config.ts`
   (`registerType: "autoUpdate"`, `workbox.globPatterns` extended to include
   `wasm` — not in workbox's default glob, so the tracer would break offline
   without it; minimal manifest). No app code change — `injectRegister: "auto"`
   injects `registerSW.js` at build.
2. **Verified offline for real**: built → served `dist/` under the
   `/image-converter/` base with a plain static server (mirrors GitHub Pages) →
   SW registered + controlling, 7 precache entries incl. the 133 KB WASM + tracer
   worker → **killed the server, reloaded → app rendered fully from cache**.
3. **Lockfile fix (#25, 2nd commit)**: CI's `npm ci` first failed — the lockfile
   was missing cross-platform optional transitive deps (`@emnapi/*`) that the
   workbox tree pulls in; my Linux-only `npm install` had omitted them.
   Regenerated from a clean install; verified `npm ci` + full CI gate pass locally.
4. **Gemini review**: asked for *installability* (`display`/`start_url`/`icons`).
   Declined inline as out-of-scope — that's a separate feature from offline and
   needs real icon PNG assets to do anything. Left as a possible follow-up.

## Trap learned

`npm run dev` and `npm run preview` **mis-serve `sw.js`/`registerSW.js` as
`text/html`** (vite 8's SPA fallback is too broad) → the SW won't register there.
Offline can only be verified against a plain static host (`python3 -m http.server`
from `dist/`), which is also the real deploy target (GitHub Pages). Not a bug.

Also: `npm install` on one platform can omit cross-platform optional deps from the
lockfile → `npm ci` fails in CI. Regenerate with a clean `rm -rf node_modules
package-lock.json && npm install` and confirm `npm ci` locally before pushing.

## Live + local

- **Live**: https://nuncaeslupus.github.io/image-converter/ (auto-deploys on push to main; now offline-capable after first load)
- **Local dev**: `npm run dev` (SW won't register locally — see trap above).

## What remains — 2 seeded follow-ups (queue has these OPEN)

Both modules were built + unit-tested by their tasks but never wired into the app:
- **T13 (`lo-50a8`, WEB)**: wire `traceCache.ts` into the trace path. Blocked on
  no stable `imageId` in `wizard.ts` — add one, then wrap the worker call in
  `TraceStep.runRetrace` with `withTraceCache`.
- **T14 (`lo-8913`, WEB)**: wire `settingsStore.ts` — seed initial tweak values
  from `load()` on mount, `save()` on change, in `TraceStep.tsx`.
- Optional: PWA **installability** (icons + `display`/`start_url`/`background_color`)
  — not seeded; separate from offline. Seed if "install to home screen" is wanted.

## PR audit

- **#25** (T15 offline/PWA): **MERGED**, CI green (`ci` ✓, GitGuardian ✓), squash-merged, branch deleted.
- No open PRs, no `in_progress` tasks with a PR, no escalated tasks.

## Note

Retrospective scan surfaced only noise (generic exit-code spikes, false-positive
"wrong" matches on skill boilerplate) — no skill-update proposals this session.
