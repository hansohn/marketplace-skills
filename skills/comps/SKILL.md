---
name: comps
description: Research pricing comparables for a secondhand item using live eBay sold listings and active Facebook Marketplace listings. Use whenever the user wants to know what a used item is worth, find resale comps, check sold prices, price an item for sale on Facebook Marketplace or eBay, or build a pricing recommendation for resale. Trigger on phrases like "what's this worth", "price comps", "sold for", "resale value", "list price for". Always pull live data via browser automation — do not rely on training data for current market prices.
---

# Marketplace Comps

Pull live pricing comparables for a secondhand item from eBay (sold/completed listings) and Facebook Marketplace (active listings), then synthesize a recommended list price.

## When to use

Trigger automatically when:
- The user names a specific used item and asks what it's worth, what it sold for, or how to price it
- The `/marketplace:listing` orchestrator delegates pricing research
- The user is preparing a Facebook Marketplace or eBay listing

Do not use for new-item retail pricing (use a regular web search) or for pricing services/labor.

## Required inputs

- **Item name** — Make + model, with model number if available (e.g., "Strider 12 Sport Balance Bike ST-S4RD")
- **Condition** — New, Used (Like New / Good / Fair), Open Box
- **Location** — User's city + state + zip, used for FB Marketplace search context (when not skipped) and to phrase the local-pickup pricing premium in the recommendation paragraph. The orchestrator resolves this from CLI flag / user memory / interactive prompt — this skill never hardcodes a default. If the orchestrator did not pass a location and one is genuinely needed (FB research is enabled), ask the user before proceeding.

If any are missing and not derivable from context (CSV row, prior conversation, item details file), ask before continuing — surface the gap with concrete options rather than guessing (see `${CLAUDE_PLUGIN_ROOT}/references/handling-ambiguity.md`).

## Process

### 1. eBay sold listings (primary signal)

**First, confirm a browser MCP is available.** This step's primary path uses Playwright browser tools (`browser_navigate`, `browser_evaluate`, etc.). If no such tool exists — the Playwright MCP isn't installed or configured — **don't error out and don't fabricate prices.** Skip straight to the `WebSearch`/`WebFetch` path (the same fallback described under failure mode 1) to gather sold-price data, and note in the output that pricing came from search results rather than a live DOM scrape, so the comp set is thinner and less precise. If neither browser nor web tools are available, emit the honest "no comparable data found" result (see Notes) — never invent prices. Everything below assumes the browser MCP exists.

**Warm up the session first (do this before the sold-listings URL).** A cold, cookieless hit straight to a deep search URL is what most reliably triggers eBay's "Pardon Our Interruption" challenge — especially when the browser MCP runs isolated/headless (a fresh, cold context every run). Navigate to the homepage first to establish a normal session, then go to the search:

1. `browser_navigate` to `https://www.ebay.com` and wait ~2s for it to settle.
2. *Then* `browser_navigate` to the sold-listings URL below.

This extra navigation is cheap and may reduce challenges, but **it is not reliable on its own** — a smoke test still hit the interstitial right after warming up. So treat warm-up as a minor preventive nicety; the real defense is the wait-and-retry recovery in failure mode 1 below.

Use the playwright browser MCP to navigate to:

```
https://www.ebay.com/sch/i.html?_nkw={URL_ENCODED_QUERY}&LH_Complete=1&LH_Sold=1&_sop=13
```

- `LH_Complete=1&LH_Sold=1` filter to completed + sold listings only
- `_sop=13` sorts by ended-most-recently
- Use the item name as the query; include model number if it narrows results

**After navigation, wait for sold listings to render** with `browser_wait_for` looking for text like `"Sold"` or a sold-listings indicator. This avoids extracting an empty/loading page. If the wait times out after ~5s, proceed anyway — the page may have loaded without the indicator.

**Extract in a single call:**

```js
() => document.body.innerText.substring(0, 25000)
```

One `browser_evaluate` call returns up to 25KB of page text — enough to capture ~30+ sold listings (which appear at the top of the page). Do **not** chunk into 5KB slices; that was an earlier defensive pattern that wastes round-trip latency without saving context. The DOM-selector approach via `.s-item` typically returns empty because eBay loads results asynchronously — text extraction is more reliable.

**Two failure modes to expect — eBay is bot-aware:**

1. **Anti-bot interstitial.** eBay sometimes serves a "Pardon Our Interruption" / "Checking your browser" page instead of results. This does **not** throw an error — you just get a page with no sold rows. So treat *empty or suspiciously thin results as a possible block, not as a real "no comps" signal.* The interstitial behaves like a **soft, time-based challenge that often auto-resolves**, so recover in this order:
   - **First, wait it out in place:** `browser_wait_for` ~4s on the same page, then re-extract — the splash frequently clears itself without a reload. This is the cheapest fix and is what worked in testing.
   - If still blocked: `browser_close` → re-`browser_navigate` to the same URL → wait ~4s → re-extract.
   - Still blocked after that: fall back to a `WebFetch`/`WebSearch` of the same sold-listings query (no browser fingerprint).
   Only emit the "no comps found" result once you've confirmed it isn't a block.
2. **"Browser is already in use" / session lock.** This shows up when browser calls share a turn with other tool calls (e.g. image `Read`s during a listing run). Keep browser calls in their own turn. If the session locks or drops to `about:blank`, `browser_close` and re-navigate. Useful fallback: `browser_navigate` auto-writes an accessibility snapshot `.yml` to disk that already contains the rendered sold rows, which works when `browser_evaluate` keeps throwing. **Do not `Read` the whole `.yml`** — these snapshots run thousands of lines and would blow your context (defeating the 25 KB cap above). Instead `grep` it for just the sold rows, e.g. `grep -iE '\$[0-9]+|sold' <snapshot>.yml | head -60`, and parse those lines.

Parse the returned text for: date sold, title, condition (Pre-Owned vs Brand New vs New Other), price.

**Separate** used (Pre-Owned) comps from new comps. Used comps drive the recommendation; new comps are reference only.

### 2. Facebook Marketplace active listings (OPT-IN, skip by default)

**Skip this step by default.** eBay sold prices are the truth — FB Marketplace active listings are mostly noise (unsold items priced too high) and the extra web search costs 5–10s of latency.

Only run FB Marketplace research when:
- The user explicitly asks for local-market context
- eBay returned fewer than 3 usable sold comps and you need cross-platform reference data
- The orchestrator passes a flag indicating cross-platform analysis is needed

When you do run it, use a single web search:

```
{item name} used Facebook Marketplace {state/region} {current year} price
```

Search-result snippets are usually sufficient for a rough local price band. FB Marketplace requires login for deep browsing, so don't attempt browser automation.

### 3. Retail (new) reference

Quick web search for the item's manufacturer MSRP (the official "originally retails for" price). One sentence is enough — this is the canonical anchor for "Retails new for $X" framing in the listing copy.

**Canonical source rule:** the manufacturer's MSRP (from the brand's own site or a primary authorized retailer) is the **single** number that fills the listing's retail callout. If you find a different "current new street price" (e.g., the item is on eBay Brand New for less than MSRP), include it as a separate reference row in the analysis table — but the listing copy always uses MSRP.

**If the manufacturer's own site blocks you** (many return 403 to `WebFetch`), don't get stuck — the goal is the number, not the source. Take the MSRP from web-search snippets or a primary authorized retailer instead, and label the row accordingly (e.g., `Strider Bikes (MSRP, 12 Sport)`). A consistent figure corroborated across authorized retailers is a fine canonical anchor.

This avoids the awkward case where the listing says "Retails new for $139.99" while the analysis table also shows the item sold New for $119.99 — readers should be able to see both prices but the listing body anchors to the higher, more authoritative MSRP.

### 4. Synthesize

Build a recommendation:

- **Used eBay range** = min/max from Pre-Owned sold comps (drop one-off outliers)
- **Used eBay average** = mean of remaining comps
- **List price** = top of used eBay range, OR midpoint if the item has wear / common color / weak demand signals
- **Drop price** = midpoint of used range, used if no bites in 7–10 days
- Apply a small local-pickup premium vs eBay (buyer avoids shipping cost) — typically 10–25%

## Output format

Emit **two separate Markdown blocks** that the orchestrator slots directly into `{PRICING_ANALYSIS_BLOCK}` and `{PRICING_RECOMMENDATION_BLOCK}` in `${CLAUDE_PLUGIN_ROOT}/templates/listing.md`. Use h2 (`##`) for the top-level headings so they sit at the right level in the final file.

### Block 1: Pricing Analysis (fills `{PRICING_ANALYSIS_BLOCK}`)

```markdown
## Pricing Analysis

### Retail (New)
| Source | Price | Type |
|---|---|---|
| {manufacturer name} | {MSRP} | MSRP (canonical) |
| {other source, optional} | {street price} | Current new street price |

### eBay — Sold Listings ({short item name})
*Source: Live eBay sold listings pulled via browser automation, {Month D, YYYY}*

| Date Sold | Description | Condition | Price |
|---|---|---|---|
| {date} | {title} | Pre-Owned | ${price} |

**Used Range:** ${min} – ${max}
**Used Average:** ~${avg}

### Facebook Marketplace — Active Listings ({location}, {Month D, YYYY})    ← OMIT this entire subsection if step 2 was skipped (default)
*Source: Live FB Marketplace browser search*

| Price | Description | Location | Notes |
|---|---|---|---|
| ${price} | {description} | {city} | {notes} |

**FB Marketplace Range:** ${min} – ${max}
```

### Block 2: Pricing Recommendation (fills `{PRICING_RECOMMENDATION_BLOCK}`)

```markdown
## Pricing Recommendation

| Scenario | Recommended Price | Rationale |
|---|---|---|
| List price | **${list}** | {rationale} |
| No bites in 7–10 days | **${drop}** | {rationale} |

**Final listing price: ${list}**

> {one-paragraph context: why this price, condition factors, color/demand signals}
```

Return both blocks in your response, clearly labeled (`### Block 1` / `### Block 2`) so the orchestrator can extract them.

## Verification

Before returning, confirm every item — these are the invariants a comps run must not violate:

- **Live data only** — every price came from the browser scrape or the web-search fallback, never from training data or memory.
- **Prices, not fabrications** — if data was genuinely absent you emitted the honest "no comparable sales data found" block; you did not invent a single price.
- **Empty ≠ no-comps** — before emitting "no comps found," you confirmed a thin/empty page was not an anti-bot interstitial (waited in place, then retried/closed, then fell back to web search).
- **Used drives the recommendation** — Pre-Owned comps are separated from new comps, and the list/drop prices derive from the used set only.
- **MSRP is the single retail anchor** — the retail callout uses manufacturer MSRP; any "current new street price" appears only as a separate reference row, never as the callout.
- **Research date cited** — the analysis block states the pull date inline in `Month D, YYYY` format.
- **Two labeled blocks** — output is exactly Block 1 (Pricing Analysis) and Block 2 (Pricing Recommendation), each with an h2 heading, nothing outside them.

## Notes

- Always cite the research date inline (format: `Month D, YYYY`, e.g., `June 8, 2026`) so future readers know when comps were pulled. Use the same format as the orchestrator's `{RESEARCH_DATE}` placeholder in the file footer.
- If fewer than 3 Pre-Owned sold comps exist for the exact model, broaden to model family (e.g., "Strider 12" instead of "Strider 12 Sport") and note the broadened scope
- When a query returns many comps (15+), don't dump every row into the table — it bloats the listing file. Show a **representative core cluster** (the comps that actually set the range), then add one line stating the total count and what you excluded as outliers, e.g. *"30 Pre-Owned comps returned; table shows the core cluster. Excluded: three sub-$25 parts/damaged units and three high-shipping bundles."* The range and average should still reflect the full usable set, not just the rows shown.
- If only new comps exist (rare item, no resale history), recommend pricing at 40–60% of retail as a starting point and flag the lack of resale data
- **If no comps and no retail exist** (obscure item, generic part, custom build): emit the blocks with empty tables and a `> ⚠️ No comparable sales data found.` note in the Pricing Recommendation context paragraph. Recommend the user (a) try a different query phrasing, (b) check niche forums/subreddits for the item category, or (c) list at an exploratory price and adjust based on inquiries. Do not invent prices.
- Heavy browser output should be processed in a subagent if possible to keep the main context clean
