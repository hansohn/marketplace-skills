# Architecture Decision Records

Short records of the non-obvious decisions behind this plugin — the ones a new
contributor (or a future us) would otherwise re-litigate. Each ADR states the
context, the decision, and the trade-off we accepted. They are historical: an ADR
reflects what was true when written; superseding decisions get a new ADR that links
back rather than an edit in place.

Format is lightweight — Status / Context / Decision / Consequences.

| # | Decision | Status |
|---|---|---|
| [0001](0001-scrape-ebay-sold-comps.md) | Scrape live eBay sold comps instead of using the eBay API | Accepted |
| [0002](0002-deterministic-locked-placeholders.md) | Compute includes / retail / price as locked, deterministic fields | Accepted |
| [0003](0003-least-privilege-subagents.md) | Run the heavy phases as least-privilege subagents | Accepted |
| [0004](0004-zero-dependency-tooling.md) | Keep the scripts/ tooling zero-dependency Node | Accepted |
| [0005](0005-invocation-control-and-tool-grants.md) | Don't disable model-invocation on ebay-draft; don't auto-grant tools | Accepted |
| [0006](0006-location-placeholder-and-leak-guard.md) | One placeholder location, enforced by a pre-publish leak guard | Accepted |
| [0007](0007-deterministic-pricing-math.md) | Deterministic pricing math (Tukey + median + percentile), not eyeballed | Accepted |
