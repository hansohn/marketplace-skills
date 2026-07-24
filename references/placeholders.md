# Platform-file placeholder sources

Read this during **Step 3b** of the `listing` orchestrator, once per run, right before substituting placeholders into each `platforms/{name}.md` block. All platform files draw from these — generate or derive each value before substitution.

Four placeholders are **not** derived here — `{INCLUDES_SECTION}`, `{RETAIL_CALLOUT}`, `{RETAIL_CALLOUT_BLOCK}`, and `{AVAILABILITY_NOTE}` are orchestrator-computed and locked in Step 3a; substitute their pre-computed values as-is.

## Shared across all platforms

| Placeholder | Source |
|---|---|
| `{MAKE}` | CSV `Make` column |
| `{MODEL}` | CSV `Model` column |
| `{MODEL_NUMBER}` | CSV `Model Number` column |
| `{COLOR}` | CSV `Color` column |
| `{YEAR}` | CSV `Year` column |
| `{RETAIL_CALLOUT}` | **🔒 ORCHESTRATOR-COMPUTED (see Step 3a/B).** Pre-computed from the CSV `MSRP` column if set, else by parsing the comps Retail table for the MSRP-labeled row. The platform file's `{RETAIL_CALLOUT}` placeholder is replaced with this exact pre-computed string — never re-derived during platform-file rendering. |
| `{AVAILABILITY_NOTE}` | **🔒 ORCHESTRATOR-COMPUTED (see Step 3a/C).** Pre-computed from the CSV `Quantity` column: `"> **{N} available** — price is per unit.\n>\n"` when Quantity > 1, else `""`. Substitute as-is; don't re-derive. (eBay also gets the quantity on the offer itself via `/marketplace:ebay-draft`.) |
| `{RETAIL_CALLOUT_BLOCK}` | **🔒 ORCHESTRATOR-COMPUTED (see Step 3a/B).** Same source as above, formatted as an eBay-style blockquote line. Pre-computed and locked. |
| `{LOCATION}` | User's city/state/zip as resolved by the **Location resolution** section (CLI flag → memory → sibling listings → interactive prompt). Format: `City, ST ZIP` (e.g., `Phoenix, AZ 85016`). Never hardcoded. |
| `{KEY_DIFFERENTIATOR}` | **Derived.** Short phrase (3–6 words) capturing what makes this listing stand out: "Ages 18mo–5yr", "Anti-glare Display", "Original Box Included". Pull from CSV `Specifics` (the most marketable spec), CSV `Notes`, photo observations, or retail product page. |
| `{ONE_SENTENCE_VALUE_HOOK}` | **Derived.** One sentence answering "what is this and why does someone want it?" — combines product purpose + one or two compelling specs. |
| `{HONEST_CONDITION_SUMMARY}` | **Derived.** CSV `Condition` enriched with specifics from CSV `Notes` and any wear visible in photos reviewed by `/marketplace:photos`. Avoid bare "good"; prefer "Frame and seat in good condition, normal wear, no damage". |
| `{INCLUDES_SECTION}` | **🔒 ORCHESTRATOR-COMPUTED (see Step 3a/A).** Pre-computed by scanning CSV `Notes` for explicit extras-signal phrases, applying the integral-parts filter, and constructing the section string. The platform file's `{INCLUDES_SECTION}` placeholder is replaced with this exact pre-computed string — never re-derived during platform-file rendering. The model must not "improve" or repopulate this section at platform-file time. |
| `{FEATURES_BULLETS}` | **Derived.** Multi-line string, 3–6 items, each prefixed with `> - `. Pull from retail product page (comps research already touched this) or general knowledge. |
| `{KNOWN_ISSUES_SECTION}` | **Derived.** If CSV `Notes` mentions wear/damage/missing parts/dead battery, expand to a full section (header line + bullet lines + trailing `>` separator). If no issues, expand to **empty string**. Header text differs by platform; check the platform file's "Generation rules" for the exact header. Example (FB): `> **Known issues — please read before messaging:**\n> - Dead battery\n> - One missing rubber foot\n>\n`. |

## eBay-only

| Placeholder | Source |
|---|---|
| `{KEY_FEATURE_OR_SPEC}` | **Derived.** eBay-title equivalent of `{KEY_DIFFERENTIATOR}` — keyword-dense, no special chars, e.g., "Anti Glare 8GB" instead of "Anti-glare 8 GB display". |
| `{EBAY_CATEGORY_PATH}` | **Derived.** Best-guess eBay category path (e.g., "Sporting Goods > Cycling > Bicycles > Balance Bikes"). If unsure, emit `[Confirm category]`. |
| `{EBAY_CONDITION}` | **Mapped from CSV `Condition`** to one of eBay's dropdown values: `New`, `New other (see details)`, `Manufacturer refurbished`, `Seller refurbished`, `Used`, `For parts or not working`. Mapping: `Used` / `Used (Like New)` / `Used (Good)` → `Used`; `For parts` → `For parts or not working`; `New` → `New`; `Open box` → `New other (see details)`. |
| `{EBAY_CONDITION_DESCRIPTION}` | **Derived.** 1–2 sentences with specifics — what works, what doesn't, what wear is visible. Factual, not promotional. |
| `{EBAY_TYPE}` | **Derived.** Category-specific item type (e.g., `Balance Bike`, `Laptop`, `Stroller`). |
| `{EBAY_EXTRA_SPECIFICS}` | **Primary source: the CSV `Specifics` column** (`key: value; key: value` pairs) — emit one Item-Specifics row per pair (these are eBay's searchable filter fields, so fill them whenever provided). Supplement with any further category-specific fields derivable from `Notes`, comps, or photos (e.g., a bike's `Wheel Size` if visible but not in `Specifics`). When non-empty, expand to `"\n\| Field \| Value \|\n\| Field \| Value \|"` (leading newline, no trailing newline — same-line placement after previous row preserves spacing). When empty, expand to `""`. See `platforms/ebay.md` for the placement detail. |
| `{EBAY_SHIPPING}` | **Derived or user-supplied.** E.g., `calculated at checkout`, `$12 USPS Priority`, `free with $5 handling`, or `not available — local pickup only`. If unknown, default to `calculated at checkout` and flag for the user. Heavy/bulky items (strollers, bikes) may warrant `local pickup only` — flag that judgment call. |
| `{EBAY_RETURNS}` | **Derived or user-supplied.** E.g., `No returns`, `30-day returns, buyer pays return shipping`. Default to `No returns` if not specified. |

## Derivation principles

- Pull from CSV first, fall back to comps/photo research, then to general product knowledge
- Be specific, not promotional ("Light scratches on bottom panel" beats "great condition")
- If a value can't be determined, emit `[NEEDS USER INPUT: <what's missing>]` rather than fabricating
- For multi-line placeholders (`{FEATURES_BULLETS}`, `{INCLUDES_SECTION}`, `{KNOWN_ISSUES_SECTION}`), preserve the `> ` blockquote prefix on every line since they sit inside the listing body's blockquote
