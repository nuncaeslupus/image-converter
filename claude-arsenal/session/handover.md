# Session Handover

<!-- Written at session end. A new session reading this file can resume without additional context. -->

## Last task

- **ID**: N/A (T1 was executed directly, before the queue existed)
- **Title**: T1: Vite + TypeScript + Preact scaffold + dev tooling
- **Status at handover**: done — PR #4 **merged**. CI is still red (see below) but that did not block the merge.

## What was done this session

1. Completed the `design` phase (PR #3, **merged**): appended sections 5-6
   (contracts, risks) to `status/specification.md` and created
   `status/plan.md` with the technical solution and a 12-task breakdown
   (T1-T12).
2. Confirmed with the user: the vectorization flow is a **single-page wizard**
   (Upload -> Edit -> Trace & Tweak -> Export), no router. Documented in
   `status/plan.md` "UI flow (step wizard)".
3. Implemented **T1** directly (not via the queue, since the queue didn't
   exist yet): Vite + TypeScript + Preact scaffold with a wizard shell
   (`src/App.tsx`, `src/lib/wizard.ts`, `src/steps/*` placeholders), plus
   supporting tooling — ESLint (flat config) + Prettier, Vitest +
   Testing Library + jsdom, a `Makefile` (`make ci` mirrors CI), a GitHub
   Actions `ci.yml`, and `.gitignore` updates. Recorded T1's gate evidence
   in `status/plan.md`'s Evidence log (commit `6618e37`, measured
   `build_exit_code == 0`).
4. Opened **PR #4** (`claude/plan-creation-c6x6pe` -> `main`) with all of the
   above. Subscribed to its activity.
5. **CI failed on PR #4 with 0ms billable runner time** on every push (job
   completes in ~4s, never picked up by a runner). Initially misdiagnosed as
   an Actions-settings issue and flagged as such on the PR. **User corrected
   this**: this repo's private-repo free Actions minutes (2000/month) are
   exhausted for the month, same as last month — resets **2026-08-01**. Not
   a workflow bug, not fixable from here, and not going away with a re-run
   before then.
6. Seeded the `arsenal-queue` coordination branch with **T2-T12** (11 tasks,
   `lo-*` IDs), priorities from Size (S=10/M=5/L=1), dependency edges
   mirroring `status/plan.md`'s Depends column. Wrote a payload file per
   task (gate, tests, references, context) at
   `claude-arsenal/queue/<id>.md`. `queue_doctor.sh` reports 0 findings.
   Pushed to `origin/arsenal-queue` (commit `e618f3f`).
7. PR #4 merged despite red CI (not a required check on this repo) — normal
   for this account until the minutes reset.

## What remains

- **GitHub Actions CI is unusable until 2026-08-01** (monthly minutes
  exhausted, recurring pattern). Until then, **`make ci` (local) is the
  gate-verification method** for every task's Evidence log row — do not wait
  on or expect a green GitHub check. `gate_run.sh` already runs gates
  locally regardless of CI, so this doesn't block `execution` work.
- Start the worker loop against the seeded queue
  (`T2: lo-59ed`, `T4: lo-38a1`, `T12: lo-d6ec` are immediately unblocked;
  see dependency graph in `status/plan.md`) — nothing is blocking this now.
- **T12 (deploy pipeline) specifically depends on Actions working** — its
  gate (`deployed_site_status_code == 200`) can't be exercised until minutes
  reset on 2026-08-01. Leave it queued but don't start it before then; T2-T11
  have no such dependency and can proceed immediately.
- User mentioned wanting to bring in **Claude Design** / discuss frontend
  design tooling further — the `frontend-design` skill is available
  automatically (part of the standard skill set, not a per-repo install) and
  should be invoked when doing the UI-heavy tasks (T5 Edit, T6 Tweak panel,
  T7 Preview). What "Claude Design" refers to wasn't clarified — worth
  asking the user directly next session if it comes up again.

## How to continue

1. Read `claude-arsenal/AGENTS.md` for the worker loop algorithm.
2. Do **not** gate dispatch on GitHub CI status — it's expected red until
   2026-08-01 (see above). Use `make ci` locally instead.
3. `export ARSENAL_QUEUE_DIR="$(claude-arsenal/bin/queue_branch.sh)"`, then
   `claude-arsenal/bin/queue_eval.sh` (or `/continue`) to get the next
   unblocked task. Skip `lo-d6ec` (T12) until Actions minutes reset.

## Surface profile at handover

Not captured this session (no `detect_surface.sh` hook run) — cloud/remote
session (`claude-arsenal/AGENTS.md` "CLAUDE_CODE_REMOTE=true" surface).

## Queue snapshot at handover

```
total=11  open=11  in_progress=0  done=0  merged=0  blocked=0  escalated=0

  lo-59ed  [open]  T2: Tracer Worker message protocol + stub Tracer implementation
  lo-38a1  [open]  T4: Upload & input handling (file picker/drag-drop, client-side decode)
  lo-d6ec  [open]  T12: Static hosting deploy pipeline (GitHub Actions -> GitHub Pages)
  lo-d4f4  [open]  T3: Integrate VTracer WASM into Tracer Worker + param translation layer   unmet_deps=[lo-59ed]
  lo-4058  [open]  T5: Basic image editing (crop/resize/rotate)   unmet_deps=[lo-38a1]
  lo-e707  [open]  T6: Live tweak panel driving two-tier retrace/cheap-edit pipeline   unmet_deps=[lo-d4f4, lo-4058]
  lo-b7ec  [open]  T7: Preview/canvas with original-vs-traced compare toggle   unmet_deps=[lo-e707]
  lo-22c0  [open]  T8: Trace-result caching by (imageId, params)   unmet_deps=[lo-e707]
  lo-3e7c  [open]  T10: Local settings persistence (localStorage last-used tweak values)   unmet_deps=[lo-e707]
  lo-1e92  [open]  T9: Export (download/copy/viewBox override/size estimate)   unmet_deps=[lo-e707, lo-22c0]
  lo-f1d0  [open]  T11: Performance pass (downscaled preview, max-dim cap, first-trace budget)   unmet_deps=[lo-d4f4, lo-b7ec]
```
