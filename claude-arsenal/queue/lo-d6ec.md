# Payload: lo-d6ec — T12: Static hosting deploy pipeline (GitHub Actions -> GitHub Pages)

**Gate**: `deployed_site_status_code == 200`

## Tests

Manual/smoke gate — no unit test. `gate_run.sh` verifies via a recorded `curl -o /dev/null -w '%{http_code}'` against the deployed URL after each deploy.

## References

- Plan: `status/plan.md` "Technology choices" — GitHub Pages via GitHub Actions on push to `main`, chosen for $0 hosting with zero extra service to provision.
- Existing: `.github/workflows/ci.yml` (added in T1) already runs format/lint/typecheck/test/build on push/PR — this task ADDS a separate deploy job/workflow that runs `npm run build` and publishes `dist/` to GitHub Pages on push to `main`, it does not replace the CI workflow.
- **Known blocker (confirmed, not a settings issue)**: this private repo's free Actions minutes (2000/month) are exhausted for the month — recurring pattern, also hit last month. Every run since T1 landing completes in ~4s with 0ms billable runner time. Resets **2026-08-01**. `ci.yml` itself is correct; there's nothing to fix in the workflow file. **Do not start this task before 2026-08-01** — its gate (`deployed_site_status_code == 200`) requires an actual Actions-driven deploy to verify, which can't run until minutes reset. This is the one task in the plan genuinely blocked by external state rather than a code dependency.

## Context

Location: `.github/workflows/deploy.yml` (or extend `ci.yml` with a second job gated on the `main` branch), plus enabling GitHub Pages in repo settings (Settings → Pages → source: GitHub Actions). No code dependency on any other task, but see the Actions-minutes blocker above — hold this one until 2026-08-01 regardless of queue order.

## Failure notes
