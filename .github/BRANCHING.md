# Funspot branch policy

## Canonical branch

`master` is the only development, integration, and release branch for this repository.

## Required workflow

- Make all new implementation, fixes, tests, documentation, and integration commits directly on `master`.
- Do not create feature, fix, chore, release, staging, or temporary branches.
- Do not open pull requests for repository-internal work; commit directly to `master`.
- Before each change, inspect the current `master` tree and latest commit. Preserve existing work and avoid overwriting concurrent changes.
- Run the relevant tests, typechecks, lint, and production builds after changes. Record exact commands and outcomes; never claim checks passed unless they were run and passed.
- Keep deployment credentials and secrets out of the repository. Use the configured deployment secret store.
- Existing historical branches and pull requests are not sources of truth. Inspect their changes individually and port only verified, still-needed work directly to `master`; do not merge stale or divergent branches wholesale.
- Do not declare the repository complete while known production-critical implementation or verification gaps remain. Continue through the next actionable item instead of creating a backlog-only handoff.
