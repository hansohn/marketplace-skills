# 0004 — Keep the scripts/ tooling zero-dependency Node

**Status:** Accepted

## Context

The repo carries validation and eval tooling (`validate-skills.js`,
`run-trigger-evals.js`, `check-location-leaks.js`, and their tests). It is otherwise a
plugin made of Markdown — no build step, no runtime package. Adding an npm dependency
tree (and a lockfile, and `npm ci` in CI) for a few hundred lines of glue would be
disproportionate, and it would slow every CI run and every contributor's first checkout.

## Decision

All tooling is plain Node using only the standard library (`node:fs`, `node:path`,
`node:child_process`, `node:test`). No `package.json`, no dependencies, no lockfile. CI
runs the scripts directly with no install step.

## Consequences

- **Instant, hermetic CI and setup** — `actions/setup-node` then run the scripts;
  nothing to install, nothing to cache-invalidate.
- **No supply-chain surface** in the tooling.
- We forgo conveniences a library would give (e.g. a YAML parser — the frontmatter
  checks use small purpose-built regex helpers instead; a changesets-style release
  flow — deliberately not adopted, see below).
- **Consequence for releases:** version bumps stay manual in `.claude-plugin/plugin.json`
  rather than automated via changesets, which would reintroduce npm. Acceptable at this
  size; revisit with a new ADR if release cadence grows.
