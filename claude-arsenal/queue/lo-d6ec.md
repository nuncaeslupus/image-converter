# Payload: lo-d6ec — T12: Static hosting deploy pipeline (GitHub Actions -> GitHub Pages)

**Gate**: `deployed_site_status_code == 200`

## Tests

Manual/smoke gate — no unit test. `gate_run.sh` verifies via a recorded `curl -o /dev/null -w '%{http_code}'` against the deployed URL after each deploy.

## References

- Plan: `status/plan.md` "Technology choices" — GitHub Pages via GitHub Actions on push to `main`, chosen for $0 hosting with zero extra service to provision.
- Existing: `.github/workflows/ci.yml` (added in T1) already runs format/lint/typecheck/test/build on push/PR — this task ADDS a separate deploy job/workflow that runs `npm run build` and publishes `dist/` to GitHub Pages on push to `main`, it does not replace the CI workflow.
- **Known blocker as of T1 landing**: the CI workflow's first run failed with 0ms billable runner time — this looks like a repo/account Actions-settings issue (Actions disabled, or spending limit at $0), not a workflow-file bug. Confirm CI is green before building the deploy job on top of it, since a deploy workflow will hit the same blocker if it isn't resolved. See PR #4 discussion.

## Context

Location: `.github/workflows/deploy.yml` (or extend `ci.yml` with a second job gated on the `main` branch), plus enabling GitHub Pages in repo settings (Settings → Pages → source: GitHub Actions). No code dependency on any other task — can land any time after T1.

## Failure notes
