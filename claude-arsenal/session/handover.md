# Session Handover

<!-- Written at session end. A new session reading this file can resume without additional context. -->

## Last task

- **ID**: `lo-d6ec`
- **Title**: T12: Static hosting deploy pipeline (GitHub Actions -> GitHub Pages)
- **Status at handover**: `merged` — PR #14 merged, **site is LIVE and verified**.

## What was done this session

CLI session (`/continue`, global scope). T12 was the only CLI-runnable open task,
but its payload said "hold until 2026-08-01" (Actions-minutes exhaustion on the
private repo). Root-caused and unblocked it the real way.

1. **Made the repo PUBLIC** (with explicit user consent; secret-scanned first —
   clean: no sensitive files, no secret patterns in tree or full history).
   Public repos get **free, unlimited** GitHub-hosted Actions minutes, so this
   permanently removes the "2000-min/month exhausted" blocker — no more waiting
   for 2026-08-01. CI now runs **for real** (it was previously green-by-not-running:
   every run since T1 was rejected in ~4s with 0 billable time).

2. **Fixed pre-existing format drift CI never caught** (folded into PR #15).
   `tests/worker/vtracer.test.ts` failed `format:check` under the **pinned**
   prettier 3.9.5 (landed via T3 while CI wasn't executing). Note the trap:
   `UploadStep.tsx` looked broken only when formatted by a *newer* stray
   `npx prettier` — under pinned 3.9.5 it was already correct. **Always format
   with the pinned binary (`npm run format`), never `npx prettier`.**

3. **Enforced format+lint pre-push + pinned node** (PR #15, merged): added
   `.githooks/pre-push` (runs `format:check` + `lint`), enabled repo-wide via a
   `prepare` npm script setting `core.hooksPath .githooks`; added `.nvmrc` (22)
   and pointed `ci.yml` + `deploy.yml` at `node-version-file: .nvmrc`. Combined
   with the committed `package-lock.json` (`npm ci`), CI and local now resolve
   identical toolchains — the user's explicit ask.

4. **T12 deploy pipeline** (PR #14, merged): worker added `deploy.yml` (build →
   upload-pages-artifact → deploy-pages on push to main) and set Vite
   `base: "/image-converter/"` for the build so assets resolve under the project
   Pages path. Enabled Pages (source: GitHub Actions) via `gh api`. Merged →
   deploy ran green → **gate verified**: `curl https://nuncaeslupus.github.io/image-converter/`
   → **200**, and the referenced JS asset under `/image-converter/assets/` → 200.
   Recorded `release.sh done --pr #14`; `reconcile_merged.sh` → `merged`.

## Live site

**https://nuncaeslupus.github.io/image-converter/** (auto-deploys on push to main).

## What remains

- **6 open tasks, all WEB-tagged**: T6 (`lo-e707`, unblocked — deps T3+T5 merged)
  → gates T7 (`lo-b7ec`) / T8 (`lo-22c0`) / T10 (`lo-3e7c`); then T9 (`lo-1e92`,
  behind T6+T8) and T11 (`lo-f1d0`, behind T3+T7). These are frontend TS with no
  CLI-only toolchain, so they're runnable from either surface now — the WEB tag
  is the user's CLI/WEB division-of-labor, not a hard requirement. Original plan:
  do them from a Claude Code Web session. **Open question for next session:** run
  the WEB chain from CLI now that public+CI works, or keep them for web.
- **Bundle downgrade recurs**: `init.py` again tried to "upgrade" the arsenal
  bundle 0.20.5 → 0.20.2 (a downgrade). Reverted at session start. The plugin
  source is apparently still behind the vendored bundle (0.20.5).

## PR audit

- **#12** (T3), **#14** (T12), **#15** (format+hook+node-pin): all **merged**, CI green.
- No open PRs. No escalated tasks. CI + Deploy workflows both green on main.
