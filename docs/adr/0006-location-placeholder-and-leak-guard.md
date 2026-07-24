# 0006 — One placeholder location, enforced by a pre-publish leak guard

**Status:** Accepted

## Context

Every generated listing embeds a real `City, ST ZIP` (the local-pickup footer). While
preparing the repo to go public, a personal zip leaked through eval fixtures and a
sanitized sample — and a plain name/path grep missed it, because a bare `12345` doesn't
look like personal data the way a filesystem path does.

## Decision

- **Exactly one location string is permitted in committed files:** the placeholder
  `Phoenix, AZ 85016`, used consistently across docs, skills, and examples.
- **`scripts/check-location-leaks.js`** enforces it: it scans the full *publishable*
  tree (tracked **and** untracked-but-not-gitignored, via
  `git ls-files --cached --others --exclude-standard`) for any `City, ST ZIP` that isn't
  the placeholder and fails the build, reporting `file:line:col`. It matches only that
  shape, so bare numbers (a model year, a price, the scrape byte-cap) don't false-positive.
- **CI runs the guard on every PR** alongside the structure validator, trigger evals, and
  unit tests.

## Consequences

- A leaked location can't reach a published commit without CI going red.
- Scanning the untracked-not-ignored set (not just tracked files) is essential — new
  fixtures a commit would sweep in are exactly what a pre-publish check must see.
- The guard is intentionally precise to the plugin's output format. A bare, context-free
  zip (e.g. `--location="12345"`) is out of scope by design; add a shape to the guard if
  that ever becomes a real vector.
- The example fixtures are deliberately **not** named `garage.csv` / `*-Listing.md`,
  because `.gitignore` defensively blocks those patterns to stop real personal listings
  from being committed — so a shippable sample must dodge them.
