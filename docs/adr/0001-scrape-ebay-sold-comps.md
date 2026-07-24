# 0001 — Scrape live eBay sold comps instead of using the eBay API

**Status:** Accepted

## Context

Pricing is the plugin's core value: a resale recommendation is only as good as its
comps. The authoritative signal for "what does this used item actually sell for" is
eBay **sold/completed** listings. eBay offers official APIs (Browse, Marketplace
Insights), but Marketplace Insights (which exposes sold data) is gated behind a
restricted-access application process, and all of them require per-user OAuth app
credentials before a single price can be pulled.

## Decision

The `comps` skill pulls sold-listing data by driving a real browser (Playwright MCP)
against eBay's public sold-listings search, with a `WebSearch`/`WebFetch` fallback and
an honest "no comparable data found" terminal state. It never fabricates prices.

## Consequences

- **Zero setup to get value** — a user gets live comps without registering an eBay dev
  app. That matters for a plugin whose whole point is a fast price read.
- **Fragility is real and expected** — eBay serves anti-bot interstitials; the skill
  encodes warm-up, wait-in-place, close/retry, and web-search fallback to cope. This is
  documented as a known limitation in the README requirements table.
- **ToS / maintenance risk** — scraping is more brittle and more ToS-adjacent than the API. If
  volume or breakage justifies it, a future ADR can revisit adopting Marketplace
  Insights behind an optional credential, keeping the scrape path as the no-setup
  default.
- Sold data drives the recommendation; active FB Marketplace listings are opt-in and
  treated as noisy context only.
