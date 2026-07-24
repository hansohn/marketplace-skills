# eBay

## Aliases
`ebay`

## Format rules
- **Title**: **80 character HARD limit** (eBay rejects longer). Keyword-dense for search (front-load Brand + Model + key terms). Avoid special chars like `–`, `|`, `&` — they don't help search. No emojis, no all-caps except brand abbreviations (e.g., `UPPAbaby`).
- **Description**: up to 500,000 characters. First ~200 chars show above the mobile "Read More" fold — make them count.
- **Item Specifics**: required. Brand, Model, Condition required for most categories; MPN strongly recommended. Add category-specific fields (e.g., Wheel Size for bikes, Storage Capacity for electronics, Size for clothing). Use eBay's standardized dropdown values where possible.
- **Photos**: up to 24, minimum 500px on longest side, recommend 1600px+ to enable zoom.
- **Posting**: full Sell API available; if the user has the eBay MCP configured, can be auto-drafted via `/marketplace:ebay-draft`. Otherwise copy-paste.

## Block template

```markdown
## eBay Listing

**Title (≤80 chars):** {MAKE} {MODEL} {MODEL_NUMBER} {COLOR} {YEAR} {KEY_FEATURE_OR_SPEC}

**Category:** {EBAY_CATEGORY_PATH}

**Condition:** {EBAY_CONDITION}

**Item Specifics:**
| Field | Value |
|---|---|
| Brand | {MAKE} |
| Model | {MODEL} |
| MPN | {MODEL_NUMBER} |
| Type | {EBAY_TYPE} |
| Color | {COLOR} |
| Year Manufactured | {YEAR} |{EBAY_EXTRA_SPECIFICS}

**Condition Description:**
> {EBAY_CONDITION_DESCRIPTION}

**Description:**
> {ONE_SENTENCE_VALUE_HOOK}
>
{AVAILABILITY_NOTE}{INCLUDES_SECTION}> **Features:**
{FEATURES_BULLETS}
>
{KNOWN_ISSUES_SECTION}{RETAIL_CALLOUT_BLOCK}> **Shipping & Pickup:** Local pickup available in {LOCATION}. Shipping {EBAY_SHIPPING}.
>
> **Returns:** {EBAY_RETURNS}.
>
> Smoke-free, pet-free home.
```

## Generation rules

Derive the placeholder *values* (`{EBAY_CONDITION}`, `{EBAY_CONDITION_DESCRIPTION}`, `{EBAY_TYPE}`, `{EBAY_CATEGORY_PATH}`, `{EBAY_SHIPPING}`, `{EBAY_RETURNS}`, etc.) from `references/placeholders.md` — that's the single source of truth, don't restate it here. The notes below are only eBay-template formatting specifics:

- **Title**: front-load Brand + Model + MPN; avoid prepositions (`with`, `for`, `the`). Hard 80-char ceiling.
- **`{EBAY_EXTRA_SPECIFICS}`** placement: when non-empty, expand to `"\n| Field | Value |\n| Field | Value |"` (leading newline, no trailing newline); when empty, `""`. The placeholder sits immediately after the previous row's closing `|`, so this preserves one blank line before the next section either way.
- **`{KNOWN_ISSUES_SECTION}`** header for eBay is `> **Known issues:**` (full section + bullets + trailing `>` separator, or empty string if none).
- **`{INCLUDES_SECTION}`, `{RETAIL_CALLOUT_BLOCK}`, and `{AVAILABILITY_NOTE}`** are orchestrator-computed and locked (Step 3a) — substitute as-is, never re-derive. Empty string ⇒ the section is omitted entirely (never emit `"Retails new for ."` with a blank price). `{AVAILABILITY_NOTE}` is a `> **N available**` blockquote line when CSV `Quantity` > 1, else empty; the offer's actual quantity is set separately by `/marketplace:ebay-draft`.
- **Description**: lead with what matters most in the first ~200 chars.

## Cross-platform consistency
The eBay block describes the **same item** as any other platform block in the same listing — pricing, condition, inclusions, features, and known issues must match. Only the format differs.
