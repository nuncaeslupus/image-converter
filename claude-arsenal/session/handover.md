# Session Handover

<!-- Written at session end. A new session reading this file can resume without additional context. -->

## Last task

- **ID**: `lo-4058`
- **Title**: T5: Basic image editing (crop/resize/rotate)
- **Status at handover**: `merged` — PR #9 merged into `main`.

## What was done this session

1. Ran `/continue WEB` on a fresh web session. `WEB` didn't match a
   workspace/tag, so fell back to the global queue seeded last session.
   Skipped the globally-top-priority task (T12, deploy pipeline) because the
   prior handover flagged it as blocked-in-practice until GitHub Actions
   minutes reset (2026-08-01); picked T2 instead.
2. Claimed and dispatched **T2** (`lo-59ed`, Tracer Worker message protocol +
   stub `Tracer`) to an isolated worktree worker. Landed as **PR #7**,
   merged.
3. Claimed and dispatched **T4** (`lo-38a1`, upload/drag-drop + client-side
   decode). Landed as **PR #8**, merged.
4. Claimed and dispatched **T5** (`lo-4058`, crop/resize/rotate editing,
   flagged UI-design-sensitive — worker was pointed at the `frontend-design`
   skill). T5 depends on T4; since T4 wasn't merged yet when T5 finished, its
   worker stacked **PR #9** on T4's branch rather than reporting blocked.
   After T4 (#8) merged, retargeted #9's base to `main` via
   `update_pull_request`, then it merged too.
5. **User directive**: tag tasks needing a CLI with installed tools
   differently from tasks that work on a bare web session. Mapped this onto
   the queue's existing `requires: ["surface:cli"]` capability mechanism
   (already wired into `queue_batch.sh`/`detect_surface.sh`) rather than
   inventing a new tag axis. Set it on:
   - **T3** (`lo-d4f4`) — needs a `wasm-pack`/Rust WASM build toolchain not
     installed in this web sandbox (`rustc`/`cargo` present, `wasm-pack` is
     not).
   - **T12** (`lo-d6ec`) — needs GitHub Pages repo-settings changes (no `gh`
     CLI on web, no MCP tool for repo settings) plus a real Actions-driven
     deploy to verify; already known-blocked by exhausted Actions minutes
     regardless.
   Verified with `queue_batch.sh` under this session's `surface:web` profile
   that both are now correctly excluded from web dispatch.
6. **Found and worked around a claude-arsenal bug**: `worker_postcheck.sh`
   hardcodes `${ARSENAL_DEFAULT_BRANCH:-main}` — since this session's
   designated branch was `claude/web-continuation-bv66s5` (not `main`), the
   first run misread genuine worktree isolation as "unavailable" and force
   git-reset the main tree onto `main`. No data was lost (already pushed),
   but corrected the main tree back, hand-fixed the
   `claude-arsenal/session/worktree_isolation` sentinel to `available`, and
   exported `ARSENAL_DEFAULT_BRANCH` for the rest of the session so it didn't
   recur (confirmed `ok` on the next `worker_postcheck.sh` run). **Filed
   upstream**: nuncaeslupus/claude-arsenal#128.
7. Landed a small standalone chore, **PR #6**: gitignore
   `.claude/worktrees/` (subagent worktree dirs were showing as untracked
   noise on the main tree) — merged.
8. All four PRs opened this session (#6, #7, #8, #9) are merged. Queue
   updated to the terminal `merged` status for T2/T4/T5 (`release.sh <id>
   merged --pr <url>`, done by hand since `gh` isn't available here for
   `reconcile_merged.sh` to run automatically).

## What remains

- **T3 (`lo-d4f4`) and T12 (`lo-d6ec`) are CLI-only** (`requires:
  ["surface:cli"]`) — only pick them up from a real Claude Code CLI session
  with `wasm-pack` (T3) / `gh` + GitHub Pages access (T12) installed. Do not
  try to dispatch them from a web session; `queue_batch.sh` will silently
  skip them there (by design).
- **T12 still can't be verified before 2026-08-01** (Actions minutes) even
  from a CLI session — its gate needs a real Actions-driven deploy. Hold it
  regardless of surface until then.
- **T6 (`lo-e707`)** needs both T3 and T5. T5 is merged; T6 is blocked
  purely on T3 now. Once T3 lands, T6 unblocks, and T7/T8/T10 unblock behind
  T6, then T9 behind T8, then T11 behind T3+T7.
- No web-eligible task remains open right now — `queue_batch.sh` returns
  empty under `surface:web`. The next session on this repo needs either a
  CLI surface (for T3/T12) or should wait for T3 to land from one.
- claude-arsenal upstream issue #128 (worker_postcheck.sh branch-name bug)
  is unresolved — the workaround (`export ARSENAL_DEFAULT_BRANCH=<branch>`
  before any `worker_postcheck.sh`/`release.sh` call) needs to be repeated
  by hand every session until it's fixed upstream, on any host session whose
  designated branch isn't literally `main`.

## How to continue

1. Read `claude-arsenal/AGENTS.md` for the worker loop algorithm.
2. If this session's designated branch isn't `main`, `export
   ARSENAL_DEFAULT_BRANCH=<that-branch>` before calling
   `worker_postcheck.sh` or `release.sh` (see claude-arsenal#128).
3. `export ARSENAL_QUEUE_DIR="$(claude-arsenal/bin/queue_branch.sh)"`, then
   `claude-arsenal/bin/queue_eval.sh` (or `/continue`) to get the next
   unblocked, surface-eligible task.
4. On a CLI session: T3 and T12 are open and CLI-tagged; T3 is likely the
   more useful of the two to start (T12 is still blocked by Actions minutes
   until 2026-08-01 regardless of surface).

## Surface profile at handover

```json
{
  "surface": "web",
  "capabilities": ["surface:web"],
  "detected_at": "2026-07-17T20:56:09Z"
}
```

`rustc`/`cargo` are present in this web sandbox; `wasm-pack` and `gh` are
not.

## Queue snapshot at handover

```
total=11  open=8  in_progress=0  done=0  merged=3  blocked=0  escalated=0

  lo-59ed  [merged]  T2: Tracer Worker message protocol + stub Tracer implementation   pr=#7
  lo-38a1  [merged]  T4: Upload & input handling (file picker/drag-drop, client-side decode)   pr=#8
  lo-4058  [merged]  T5: Basic image editing (crop/resize/rotate)   pr=#9
  lo-d6ec  [open]  T12: Static hosting deploy pipeline (GitHub Actions -> GitHub Pages)   requires=[surface:cli]
  lo-d4f4  [open]  T3: Integrate VTracer WASM into Tracer Worker + param translation layer   requires=[surface:cli]
  lo-e707  [open]  T6: Live tweak panel driving two-tier retrace/cheap-edit pipeline   unmet_deps=[lo-d4f4]
  lo-b7ec  [open]  T7: Preview/canvas with original-vs-traced compare toggle   unmet_deps=[lo-e707]
  lo-22c0  [open]  T8: Trace-result caching by (imageId, params)   unmet_deps=[lo-e707]
  lo-3e7c  [open]  T10: Local settings persistence (localStorage last-used tweak values)   unmet_deps=[lo-e707]
  lo-1e92  [open]  T9: Export (download/copy/viewBox override/size estimate)   unmet_deps=[lo-e707, lo-22c0]
  lo-f1d0  [open]  T11: Performance pass (downscaled preview, max-dim cap, first-trace budget)   unmet_deps=[lo-d4f4, lo-b7ec]
```
