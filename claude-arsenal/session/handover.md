# Session Handover

<!-- Written at session end. A new session reading this file can resume without additional context. -->

## Last task

- **ID**: `lo-d4f4`
- **Title**: T3: Integrate VTracer WASM into Tracer Worker + param translation layer
- **Status at handover**: `done` — PR #12 open (not yet merged; CI red is the
  known Actions-minutes blocker, see below).

## What was done this session

CLI session (`/continue CLI`). "CLI" = tasks needing an installed toolchain
absent from Claude Code Web; user asked to tag all tasks CLI/WEB and pick up the
CLI ones (the ones blocking WEB development).

1. **Session-start fixes**:
   - `init.py` tried to "upgrade" the arsenal bundle 0.20.5 → **0.20.2** (a
     downgrade clobbering the newer vendored files). Reverted. User has since
     corrected the plugin to 0.20.5, so it won't recur.
   - **Project-identity stamp mismatch**: `arsenal-queue`'s `.project-id` was
     stamped `local_proxy@127.0.0.1/.../image-converter` (a web-proxy remote
     from the prior web session), tripping `queue_branch.sh`'s guard against
     the CLI's `github.com/...` origin. Same project — re-stamped to
     `github.com/nuncaeslupus/image-converter` and pushed. CLI sessions now
     pass the guard; a future *web* session may need a re-stamp the other way.
2. **Tagged all 11 tasks CLI/WEB** by toolchain requirement (`tags` axis,
   complementary to the existing `requires:["surface:cli"]` capability filter).
   Only **T3** is CLI (Rust→WASM build); all others WEB. Pushed to
   `arsenal-queue`. `/continue CLI` now resolves to T3.
3. **Installed the one-time CLI toolchain** (global, `~/.cargo`, `--no-modify-path`):
   rustup + `wasm32-unknown-unknown` target + `wasm-pack 0.13.1`, alongside the
   pre-existing apt `rustc`/`cargo` 1.88. **Note for future CLI sessions**:
   `~/.cargo/bin` is NOT on the default PATH — `export PATH="$HOME/.cargo/bin:$PATH"`
   before any rust/cargo/wasm-pack use.
4. **Claimed + dispatched T3** to an isolated-worktree worker. Outcome `done`,
   **PR #12**. Gate PASS: `trace_success_rate_on_sample_corpus = 5/5 = 1.0`.
   Built VTracer **from source** (vtracer `=0.6.5`, visioncortex `=0.8.10`) via
   `wasm-pack build --target web` — user explicitly chose build-from-source over
   the prebuilt `vtracer-wasm` npm package (supply-chain trust). New: `vtracer-wasm/`
   Rust crate, `src/wasm/` (committed 133KB `.wasm` + glue), `src/lib/paramTranslation.ts`,
   `src/worker/vtracerTracer.ts`, wired `src/worker/tracer.worker.ts`,
   `tests/worker/vtracer.test.ts`. Local gates all green (typecheck, lint,
   21/21 tests, `npm run build`). `worker_postcheck.sh` → `ok` (real worktree);
   recorded `release.sh lo-d4f4 done --pr #12`.

## What remains

- **PR #12 (T3) needs merging.** `mergeable: MERGEABLE`, GitGuardian pass. Its
  `ci` check is **FAILURE at ~4s with no steps run** — the documented repo-wide
  **Actions-minutes exhaustion** (private repo, resets **2026-08-01**), identical
  to every PR since T1 (T4/#8, T5/#9 merged in this state). Not a code failure.
  Merge when ready (as prior PRs were).
- **T3 landing unblocks the WEB chain**: T6 (`lo-e707`) is now open (its dep T3
  is done); T6 → T7/T8/T10, then T9 behind T8, T11 behind T3+T7. All are WEB —
  do them from a Claude Code Web session.
- **T12 (`lo-d6ec`, deploy)** — tagged WEB (writing the workflow YAML is
  web-doable) but its gate needs a real Actions deploy, so **hold until
  2026-08-01** regardless of surface (same minutes blocker).
- **No CLI tasks remain open.** T3 was the only one; the CLI-scoped queue is
  exhausted.

## How to continue

1. `claude-arsenal/bin/queue_branch.sh` → sets `ARSENAL_QUEUE_DIR` (worktree at
   `../image-converter-arsenal-queue-wt`). Guard passes now (re-stamped).
2. Merge PR #12 when ready; `reconcile_merged.sh` will then flip T3 `done`→`merged`.
3. WEB frontend work (T6+) is unblocked — run it from Claude Code Web.
4. If ever back on CLI: `export PATH="$HOME/.cargo/bin:$PATH"` for wasm-pack.

## Surface profile at handover

CLI session. `rustc`/`cargo` 1.88, `wasm-pack 0.13.1`, `gh 2.46`, `node 24`,
`npm 11` all present. `~/.cargo/bin` not on default PATH.
