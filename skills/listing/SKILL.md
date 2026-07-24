---
name: listing
description: Generate a complete marketplace listing file (pricing analysis + listing copy for each enabled platform + photo order) for a secondhand item, and optionally create an eBay draft. Use whenever the user wants to sell, list, post, cross-list, or flip a used item on Facebook Marketplace or eBay. Trigger on phrases like "list this for sale", "make a marketplace listing", "sell this item", "post this on FB or eBay", "cross-list this", "create a listing for X", or when the user references a CSV of items to sell. Orchestrates /marketplace:comps (pricing) and /marketplace:photos (photos), iterates enabled platforms from the plugin's platforms/ directory, writes a single .md file with one listing-copy section per enabled platform, and (if /marketplace:ebay-draft is available and the user opts in) creates an eBay draft via the eBay MCP.
---

# Listing

Orchestrator for the marketplace plugin. Reads item details, gets pricing comps and photo selection, generates listing copy for each enabled platform, and assembles a single `.md` listing file.

## When to use

Trigger automatically when:
- The user wants to sell, list, post, cross-list, or flip a used item on a supported marketplace (Facebook Marketplace or eBay)
- The user references a CSV of items to sell (batch run — one listing file per row)
- The user wants the full listing artifact (pricing + copy + photo order), not just one piece of it

Delegate instead of running the full flow when the user wants only one phase: pricing-only → `/marketplace:comps`, photo-order-only → `/marketplace:photos`, push-an-existing-listing-to-eBay → `/marketplace:ebay-draft`.

## Paths

Every path this skill references — `platforms/`, `templates/`, `references/`, and the sibling skills (`comps`, `photos`, `ebay-draft`) — lives at the **plugin root** (the directory containing `.claude-plugin/`), **not** inside this skill's folder. When the plugin is installed, resolve them as `${CLAUDE_PLUGIN_ROOT}/platforms/…`, `${CLAUDE_PLUGIN_ROOT}/templates/…`, etc. A bare `platforms/foo.md` read relative to `skills/listing/` will 404 — always anchor to the plugin root.

## Invocation

`/marketplace:listing [item-or-csv] [--platforms=<csv>] [--location=<city, state zip>]`

Argument resolution (fallback chain):

1. **If first arg is a `.csv` file** → process every row as a separate item; generate one listing file per row in the CSV's directory. Each row carries its own per-item overrides: `Photos` (that item's photo folder — blank → `./Photos/`), `Platforms` (overrides the run-level platform selection for that row only), `MSRP`/`Asking` (price overrides), and `Quantity` (units available). See **Required context per item** for the full column list.
2. **If first arg is any other text** → treat as a single item name; generate one listing file in the current working directory.
3. **If no first arg** → interactive mode. Ask:
   - What item are you listing? (or "I have a CSV — here's the path")
   - Where are the photos? (default: `./Photos/`)
   - Location for pricing/pickup? (see Location resolution below)

## Location resolution

The user's location (city + state + zip) appears in every generated listing — local-pickup footer, comps research, and the buyer-targeting paragraph. **This plugin does not ship with a hardcoded default location.** Resolve in this order (most specific wins):

1. **`--location="<city, state zip>"` CLI flag** — per-run override, e.g., `--location="Phoenix, AZ 85016"`
2. **User memory** — scan memory for an entry like `default resale location: Phoenix, AZ 85016` or any reference memory tagged with the user's selling location. If found, use it as-is.
3. **Existing sibling listings in the directory** — if the listing directory already contains other `*-Listing.md` files, parse the location from their FB Marketplace footer (the "Local pickup only — {city, state zip}" line). Use whatever is consistent across them.
4. **Interactive prompt** — ask the user:
   > *"What city/state/zip should I use for the local-pickup footer and pricing research?"*

   After the user answers, **offer to save the response to user memory** for future runs:
   > *"Save this as your default resale location for future runs? (Y/n)"*

   If yes, write a new memory entry following the auto-memory format (type: `user`, name: `resale-location`, description: `User's default city + state + zip for resale listings`). Then proceed.

**Never substitute a placeholder city** like `[YOUR_CITY]`, `Anytown, USA`, or any city the user hasn't supplied — always resolve to an actual user-supplied value. If resolution fails (CSV batch run with no memory and no interactive opportunity), surface a clear error: *"No location resolved — pass `--location` or set a memory entry"* and stop the run.

## Platform preference (token-spend control)

The skill generates one listing-copy block per **enabled** platform. Resolve which platforms are enabled in this order (most specific wins):

1. **CSV `Platforms` column** (batch runs only) — per-**row** override, most specific of all. If a row's `Platforms` cell is non-empty (e.g., `fb,ebay`), it wins for that item. Blank → fall through to the chain below.
2. **`--platforms=<csv>` CLI flag** — per-run override, e.g., `--platforms=fb,ebay,mercari`
3. **User memory** — check for an entry like *"default resale platforms: fb-marketplace, ebay"* and use it if present
4. **Hardcoded default** — `["fb-marketplace"]`

Accept short aliases declared in each platform file's `## Aliases` section (e.g., `fb` → `fb-marketplace`, `facebook` → `fb-marketplace`).

Disabled platforms produce zero output and zero tokens — do not generate their blocks.

## Required context per item

Gather before research begins:
- **Item identification**: year, make, model, model number, color, condition
- **Photo directory**: CSV `Photos` column, else typically `./Photos/` relative to the listing dir
- **Location**: zip + city
- **Notes**: known issues, accessories, expiration dates
- **Specifics** (optional): category-specific item specifics as `key: value; key: value` pairs (e.g., `Wheel Size: 26 in; Bike Type: Mountain; Frame Material: Steel`) — these are eBay's searchable filter fields; feeds eBay item specifics and the shared Item Details table (see Step 3b and Step 4)
- **Quantity**: units available in one listing (CSV `Quantity`, default 1) — drives eBay offer quantity and an availability note in copy (see Step 3a/C)
- **Price overrides** (optional): `MSRP` (feeds the retail callout deterministically — see Step 3a/B), `Asking` (overrides the comps-recommended list price — see Step 3a/C)
- **Expiration** (optional): for items that legally expire (car seats, etc.); surfaced in Item Details when present

Sources in priority order:
1. CSV row — columns: `Make, Model, Model Number, Color, Year, Condition, Notes, Specifics, Photos, Quantity, MSRP, Asking, Platforms, Expiration`. The identity fields plus `Notes` are normally filled; `Specifics` holds category-specific item specifics as `key: value; key: value` pairs (blank for items with no filterable attributes); `Quantity` defaults to 1, and `MSRP / Asking / Platforms / Expiration` are optional overrides (blank = derive/research, or fall back to the run-level default).
2. User-provided text in the argument
3. Interactive prompt
4. Photo inspection (model numbers, serial tags)

## Delegation mechanism

When this skill says "delegate to" or "invoke" `/marketplace:comps`, `/marketplace:photos`, or `/marketplace:ebay-draft`:
- **Inline** (default): load the sub-skill's `SKILL.md` and follow its instructions in the current context. Existing context is already available — no formal "argument passing" needed.
- **Subagent** (for browser-heavy work): launch a subagent with the sub-skill loaded. Use for `/marketplace:comps` because eBay pages produce large amounts of text that would eat the main context.

## Process

Steps 1 (pricing) and 2 (photos) are independent, and they're the two slowest, most context-heavy phases — pricing waits on live eBay (large page text), photos waits on image reads (token-heavy). **Run them concurrently as two background subagents:** launch the `comps-researcher` and `photo-reviewer` agents in the *background*, then collect both results before assembling. This roughly halves wall-clock time versus running them in sequence, and keeps both the raw eBay HTML and the image data out of the orchestrator's context. (If your harness can't run work in the background, launch them sequentially or run the skills inline — correctness is identical, only slower and with a heavier context.)

### 1. Research pricing — `comps-researcher` agent (background subagent)

Launch the **comps-researcher** agent (a least-privilege pricing-scraper persona shipped with the plugin — browser + web + read only, no file-write tools) as a **background** subagent, then immediately move to Step 2 while it runs — don't block waiting on it. Send a prompt structured like:

```
Follow the comps skill at ${CLAUDE_PLUGIN_ROOT}/skills/comps/SKILL.md for this item:

- Item name: {Make} {Model} {Model Number}
- Condition: {CSV Condition column}
- Location: {city, state, zip}
- Known MSRP (optional): {CSV MSRP column, if non-empty — comps can skip MSRP research and focus on sold/street comps}

Return exactly two labeled Markdown blocks per the skill's "Output format" section:
- "### Block 1" containing the Pricing Analysis (h2 heading inside)
- "### Block 2" containing the Pricing Recommendation (h2 heading inside)

Do not include any preamble or commentary outside the two labeled blocks.
```

Subagent runs in isolation (browser-heavy eBay HTML stays out of main context). **Collect its result after launching Step 2's agent** — once it returns, extract Block 1 → `{PRICING_ANALYSIS_BLOCK}` and Block 2 → `{PRICING_RECOMMENDATION_BLOCK}`.

**If your harness can't spawn the named agent (or any subagent)**, run `/marketplace:comps` inline in the current context instead. You lose the context-hygiene benefit (the raw eBay text lands in your context), but the result is identical — and a live comp pull beats a clean context. The comps-researcher agent is an optimization, not a hard requirement; never skip the pricing research just because a subagent isn't available.

If the comps output is malformed (missing labels, wrong heading levels, no usable data), surface the issue to the user with concrete options (re-run comps, proceed with the partial data, or provide pricing manually) and ask before continuing — don't paper over it with invented numbers. See `${CLAUDE_PLUGIN_ROOT}/references/handling-ambiguity.md`.

### 2. Review photos — `photo-reviewer` agent (background subagent)

Launch the **photo-reviewer** agent (a least-privilege reviewer persona shipped with the plugin — `Read` + `Bash` only, no file-write tools, no network) as a **background** subagent alongside the comps one, passing the photo directory and item-name filter. Prompt it like:

```
Follow the photos skill at ${CLAUDE_PLUGIN_ROOT}/skills/photos/SKILL.md for this item:

- Photo directory: {photo_dir}
- Item name / filename prefix: {ItemPrefix}

Return exactly two labeled Markdown blocks per the skill's "Output format" section:
- "### Block 1" containing the Recommended Photos table (+ Skip list)
- "### Block 2" containing the Condition Observations (plain text)

Do not include any preamble or per-image narration outside the two labeled blocks.
```

Isolating the review in a subagent keeps the token-heavy image reads out of the main context. Collect its result:
- Block 1 → fills `{PHOTOS_BLOCK}`
- Block 2 → Condition Observations (plain text) → merged into `{ITEM_DETAILS_BLOCK}` Condition Notes (see Step 4)

**If your harness can't spawn the named agent (or any subagent)**, run `/marketplace:photos` inline instead — the result is identical, you just pay the image tokens in the main context.

**No-photos case.** If the photo directory doesn't exist or has no images for this item (common for free-text item requests with no `./Photos/` folder), don't stall and don't invent filenames. Skip the photos sub-skill and set `{PHOTOS_BLOCK}` to a short stand-in:

```markdown
## Recommended Photos

No photos were provided for this item. Before posting, shoot and add: a hero 3/4 shot of the full item, a straight side/front profile, close-ups of any included extras, and honest shots of any wear for condition transparency.
```

With no photos, Condition Observations is empty — `{condition_notes}` then relies on the CSV `Notes` alone (Step 4), and the listing copy should avoid claiming visually-verified condition details it can't see. Flag in the final summary that the listing has no photos yet.

### 3. Generate per-platform listing blocks

**Step 3a — Deterministic pre-substitution (do this BEFORE reading any platform file).**

Compute these placeholders with deterministic logic (never free-text interpretation), then treat each as a **fixed, locked input** to Step 3b — do not regenerate or "improve" them during platform rendering:

- **`{INCLUDES_SECTION}`** — extras parsed from CSV `Notes`, with integral/standard parts filtered out (empty string if none genuinely remain).
- **`{RETAIL_CALLOUT}` / `{RETAIL_CALLOUT_BLOCK}`** — MSRP anchor only (CSV `MSRP`, else the comps MSRP-labeled row; empty if only street prices exist). Never a street price.
- **`{FINAL_PRICE}`** — the comps "Final listing price", overridden by CSV `Asking` when set (flag the override in Step 6). Feeds the price and the eBay-draft offer, not platform copy.
- **`{AVAILABILITY_NOTE}`** — a per-unit note when CSV `Quantity` > 1, else empty.

**Read `${CLAUDE_PLUGIN_ROOT}/references/locked-fields.md` now for the exact matching rules, phrase lists, and output formatting.** The correctness of the includes filter and the retail/price anchors depends on following it precisely — this is the plugin's core determinism guarantee, not a place to improvise.

**Step 3b — Platform-file substitution.**

For each enabled platform:

1. Read `platforms/{platform-name}.md`
2. Substitute placeholders using the source table below. For the four locked placeholders — `{INCLUDES_SECTION}`, `{RETAIL_CALLOUT}`, `{RETAIL_CALLOUT_BLOCK}`, and `{AVAILABILITY_NOTE}` — use the **pre-computed values from Step 3a** as-is; do not re-derive them from the platform file's instructions.
3. Follow the platform file's "Generation rules" for the remaining (derived) placeholders.
4. Emit one Markdown block per platform.

Concatenate all platform blocks with `\n\n---\n\n` separators. The result fills `{PLATFORM_LISTINGS}`.

**Where each placeholder comes from:** read `${CLAUDE_PLUGIN_ROOT}/references/placeholders.md` for the full source table (shared placeholders + eBay-only placeholders + derivation principles). Read it once per run, here. The four locked placeholders (`{INCLUDES_SECTION}`, `{RETAIL_CALLOUT}`, `{RETAIL_CALLOUT_BLOCK}`, `{AVAILABILITY_NOTE}`) are the ones you computed in Step 3a — substitute those as-is; derive the rest per that reference.

### 4. Generate orchestrator-owned blocks

**`{ITEM_DETAILS_BLOCK}`**:

```markdown
## Item Details
| Field | Value |
|---|---|
| Year | {year} |
| Make | {make} |
| Model | {model} |
| Model Number | {model_number} |
| Color | {color} |
| Condition | {condition} |

### Condition Notes
{condition_notes}
```

**Conditional rows:** when the CSV `Specifics` column is non-empty, parse each `key: value` pair (split on `;`, then on the first `:`) and add one `| {key} | {value} |` row per pair — these are the canonical category-specific attributes and they also feed eBay's item specifics in Step 3b, so derive them once here. When the CSV `Quantity` column is > 1, add a `| Quantity | {quantity} available |` row. When the CSV `Expiration` column is non-empty (car seats and other date-expiring gear), add an `| Expiration | {expiration} |` row and make sure the expiration date also appears in the listing copy's known-issues/condition area — buyers of expiring safety gear need it up front. Omit each row when its column is blank/1.

Where `{condition_notes}` = CSV `Notes` column **+** `/marketplace:photos` Block 2 (Condition Observations), merged into a single paragraph. If the CSV `Notes` is empty, use only the photo observations. If both are empty, use the literal text `"No additional condition notes."`

**`{ITEM_TITLE}`**: `{Make} {Model}` (used in the file H1)
**`{RESEARCH_DATE}`**: today's date in `Month D, YYYY` format
**`{RESEARCH_NOTES}`**: short sentence describing what was actually researched. Build from the comps-skill output:
- If eBay sold listings returned data: include `"eBay sold data pulled live via browser automation."`
- If FB Marketplace search returned data: include `"FB Marketplace data from live browser search."`
- If retail data was found: include `"Retail price from {retailer}."`
- If a source returned no usable data (per comps step 4 / the no-comps fallback): include `"No FB Marketplace comps found."` etc.
- Omit clauses for sources that weren't researched (e.g., if eBay-only invocation, don't mention FB)
- Always end the string with a period.

### 5. Assemble and write

Load `templates/listing.md`. Substitute all placeholders:

| Placeholder | Source |
|---|---|
| `{ITEM_TITLE}` | Orchestrator |
| `{ITEM_DETAILS_BLOCK}` | Orchestrator |
| `{PRICING_ANALYSIS_BLOCK}` | `/marketplace:comps` (Block 1) |
| `{PRICING_RECOMMENDATION_BLOCK}` | `/marketplace:comps` (Block 2) |
| `{PLATFORM_LISTINGS}` | Orchestrator (one block per enabled platform, concatenated) |
| `{PHOTOS_BLOCK}` | `/marketplace:photos` |
| `{RESEARCH_DATE}` | Orchestrator (today) |
| `{RESEARCH_NOTES}` | Orchestrator (built from `/marketplace:comps` output — see step 4) |

Write to `{ItemPrefix}-Listing.md` in the listing directory.
- `ItemPrefix` = make + model condensed (e.g., `Strider-12-SportBalanceBike`)
- If the file exists, ask before overwriting

### 6. Summarize

Tell the user:
- Enabled platforms (e.g., "Generated FB Marketplace + eBay")
- Final list price + drop price
- Photos selected + skipped
- File path
- Any judgment calls worth flagging
- **If eBay is in the enabled platforms**, offer to also create an eBay draft. (`/marketplace:ebay-draft` ships with the plugin and is always available; it will detect whether the eBay MCP server is configured at runtime and guide setup if not.)

### 7. (Optional) Create eBay draft

If the user accepts the offer from step 6, delegate to `/marketplace:ebay-draft` (inline). That skill handles MCP detection, prerequisite checks, inventory item creation, and offer creation. Never publishes — leaves the draft in Seller Hub for the user.

## Verification

Before telling the user the listing is done, confirm every item:

- **No surviving placeholders** — the output file contains no unresolved `{...}` tokens and no bracket placeholders like `[YOUR_CITY]`.
- **Real location** — the location came from a CLI flag, memory, sibling listings, or the user; never a placeholder or invented city. If it couldn't be resolved, you stopped with a clear error rather than guessing.
- **Only enabled platforms** — one listing-copy block per enabled platform and zero output for disabled ones.
- **Locked values consistent** — `{INCLUDES_SECTION}`, `{RETAIL_CALLOUT}`, and the price/availability values are the ones computed in Step 3a, identical across every platform block (same retail anchor, same inclusions). Integral/standard parts are excluded from Includes.
- **Known issues surfaced twice** — any defect from CSV `Notes` appears in the listing body *and* gets a dedicated photo slot; an `Expiration` value (if present) appears in the condition/known-issues copy.
- **eBay constraints** (when eBay is enabled) — eBay title ≤80 chars and condition mapped to a valid enum.
- **Written safely** — file saved as `{ItemPrefix}-Listing.md`; you asked before overwriting an existing file.
- **Never auto-posted** — nothing was posted or published to any platform; the user reviews and posts (or publishes the eBay draft) manually.

## Notes

- For CSV batch runs: process items sequentially to avoid browser-session contention during comps research
- Honor user memory entries about location, listing voice, or pricing strategy over the defaults here
- Same item details, pricing, and photos apply across all platforms; only the listing-copy format differs

(The "never auto-post" invariant lives in **Verification** above — its single source of truth.)
