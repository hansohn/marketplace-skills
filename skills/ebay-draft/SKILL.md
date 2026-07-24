---
name: ebay-draft
description: Create an eBay listing draft (inventory item + offer) via the eBay MCP server, leaving publication to the user. Use whenever the user wants to push a prepared listing to eBay without copy-pasting, asks to "create an eBay draft", "make an eBay offer", "push to eBay", or after /marketplace:listing finishes generating copy and the user wants the eBay portion auto-drafted. Never publishes the offer — always leaves it as a draft for the user to review and publish manually in Seller Hub.
---

# eBay Draft

Create an eBay inventory item and offer (as a draft) via the [eBay MCP server](https://github.com/YosefHayim/ebay-mcp). The user reviews and publishes the draft manually from eBay Seller Hub.

## When to use

Trigger when:
- The user asks to create an eBay draft, push to eBay, or auto-list on eBay
- The `/marketplace:listing` orchestrator delegates eBay draft creation after generating listing copy
- The user has a prepared listing (item details + price + photos) and wants to skip manual entry into eBay's UI

Do not use for:
- Auto-publishing — this skill only creates drafts, never calls `ebay_publish_offer`
- Facebook Marketplace — no API exists; FB always requires manual paste

## Required inputs

- **Item identification**: year, make, model, model number, color, condition
- **eBay-ready listing data**: title (≤80 chars), description, item specifics, condition description
- **Price**: list price + currency (default USD)
- **Photo URLs** (optional): publicly accessible image URLs. If only local file paths are available, the draft is created without images and the user uploads via Seller Hub before publishing.

### Input resolution (where the data comes from)

This skill can be invoked three ways. Resolve missing data in this order:

**1. Chained from `/marketplace:listing` (eBay was in the enabled platforms).**
The orchestrator already generated the eBay block during the listing run. Extract:
- Title, item specifics, condition description, description body → from the `## eBay Listing` section of the generated `.md` file
- Price → from the Pricing Recommendation section's "Final listing price"
- Item identification → from the Item Details section

**2. Standalone, with a path to an existing `{ItemPrefix}-Listing.md`.**
Read the file. If it contains a `## eBay Listing` section, use it (same extraction as case 1). If it has the item details + pricing but no eBay block (because eBay wasn't enabled when generated), **derive the eBay-formatted data on the fly**:
- Read `${CLAUDE_PLUGIN_ROOT}/platforms/ebay.md` for the block template and generation rules (these shared files live at the **plugin root**, not inside this skill's folder — a bare `platforms/ebay.md` read relative to `skills/ebay-draft/` will 404)
- Use the orchestrator's "Platform-file placeholder sources" derivation logic (see `${CLAUDE_PLUGIN_ROOT}/skills/listing/SKILL.md` Step 3) to fill the placeholders from the existing Item Details + Pricing data
- Don't write the derived eBay block back to the .md file — just use it to populate the API call

**3. Standalone, no listing file.**
Run `/marketplace:comps` first to get pricing, then derive eBay-formatted data from CSV row or interactive prompt + comps output. This path is for users who want to push directly to eBay without generating the full `.md` listing artifact. Honor the CSV per-row overrides: a non-empty `Asking` column is the offer price (overriding the comps recommendation), `MSRP` feeds the retail callout, and `Quantity` (default 1) sets the offer's available quantity.

If the user invokes this skill in case 2 or 3 and required data is missing, ask — surface the gap with concrete options rather than guessing (see `${CLAUDE_PLUGIN_ROOT}/references/handling-ambiguity.md`). Don't fabricate.

## Process

### 1. Detect the eBay MCP

Check whether any tool whose name starts with `ebay_` is available (e.g., `ebay_create_inventory_item`). If none exist:

- The MCP isn't installed or configured.
- Tell the user how to set it up (see plugin README's "Optional: eBay auto-draft via MCP" section).
- Stop. **Do not** fall back to browser automation — eBay's terms prohibit it and risks account suspension.

### 2. Confirm with the user

This step makes authenticated API calls to eBay. Always confirm before proceeding, even if the user originally asked for "the whole flow". Surface:
- The SKU that will be created
- The list price
- The eBay title
- Whether photos will be attached (any URLs starting with `http://` or `https://`) or skipped (paths are local files, no protocol)

### 3. Verify prerequisites (best-effort)

eBay requires the seller to have an inventory location and payment / fulfillment / return policies configured before any offer can be published. The orchestrator does not create these — the user sets them up once in Seller Hub.

If possible, call:
- `ebay_get_inventory_locations` — confirm at least one location exists
- `ebay_get_fulfillment_policies`, `ebay_get_payment_policies`, `ebay_get_return_policies` — confirm policies exist

If any are missing, warn the user and link to [bizpolicy.ebay.com](https://www.bizpolicy.ebay.com/). The draft can still be created without these (offers will fail to publish until the user resolves), but it's better to surface the gap up front.

### 4. Create the inventory item

Call `ebay_create_inventory_item` with these fields:

| Field | Value |
|---|---|
| `sku` | ItemPrefix (e.g., `Strider-12-SportBalanceBike`) — predictable, deduplicates across re-runs |
| `product.title` | eBay-formatted title (≤80 chars, keyword-dense) |
| `product.description` | eBay description (Markdown body of the eBay platform block) |
| `product.aspects` | Item Specifics as `{ "Brand": ["Strider"], "Model": ["12 Sport"], "MPN": ["ST-S4RD"], ... }` |
| `product.brand`, `product.mpn` | From item details |
| `product.imageUrls` | Array of publicly accessible image URLs. **Detection rule:** treat a path as a URL if it starts with `http://` or `https://`; otherwise it's a local file. If all photos are local, **omit the `imageUrls` field entirely** — do not pass file paths. The draft will be created without images and the user uploads via Seller Hub before publishing. |
| `condition` | eBay enum: `NEW`, `NEW_OTHER`, `USED_EXCELLENT`, `USED_VERY_GOOD`, `USED_GOOD`, `USED_ACCEPTABLE`, `FOR_PARTS_OR_NOT_WORKING` |
| `conditionDescription` | Free-text elaboration on condition |
| `availability.shipToLocationAvailability.quantity` | `Quantity` from CSV (default 1) |

### 5. Create the offer

Call `ebay_create_offer` with:

| Field | Value |
|---|---|
| `sku` | Same as inventory item |
| `marketplaceId` | `EBAY_US` (or from env override) |
| `format` | `FIXED_PRICE` (auctions out of scope) |
| `pricingSummary.price` | `{ value: list_price, currency: "USD" }` |
| `categoryId` | From item details; call `ebay_get_category_suggestions` if unknown |
| `listingPolicies.fulfillmentPolicyId` | User's fulfillment policy ID |
| `listingPolicies.paymentPolicyId` | User's payment policy ID |
| `listingPolicies.returnPolicyId` | User's return policy ID |
| `merchantLocationKey` | User's inventory location key |

### 6. Stop here — do not publish

**Never call `ebay_publish_offer`.** Leave the offer as a draft. The user reviews and publishes from Seller Hub.

### 7. Report back

Tell the user:
- SKU and offer ID
- eBay Seller Hub URL: `https://www.ebay.com/sh/lst/drafts` (or similar)
- Whether photos were attached or need manual upload
- Any prerequisite warnings surfaced in step 3

## Verification

Before returning, confirm every item. The first two are hard safety gates on irreversible, authenticated actions:

- **Never published** — `ebay_publish_offer` was not called. The offer is left as a draft for the user to publish from Seller Hub.
- **Explicit confirmation** — the user confirmed (SKU, price, title, photo handling) before any authenticated eBay API call, even if they originally asked for "the whole flow."
- **No browser fallback** — if the eBay MCP was absent, you stopped and guided setup; you did not fall back to browser automation (eBay's terms prohibit it).
- **Valid title** — the eBay title is ≤80 characters.
- **Valid condition** — `condition` is one of the allowed eBay enums (`NEW`, `NEW_OTHER`, `USED_EXCELLENT`, `USED_VERY_GOOD`, `USED_GOOD`, `USED_ACCEPTABLE`, `FOR_PARTS_OR_NOT_WORKING`).
- **No local paths as image URLs** — `imageUrls` contains only `http(s)` URLs; if all photos were local files, the field was omitted entirely.
- **Reported back** — you returned the SKU, offer ID, Seller Hub drafts URL, photo status, and any prerequisite warnings.

## Notes

- This skill is platform-specific (eBay only). The equivalent does not exist for Facebook Marketplace — there is no public API for personal Marketplace posting.
- If the user wants to update an existing draft, use `ebay_update_offer` instead of creating a new one. Check for existing offers by SKU first via `ebay_get_offers`.
- All eBay API calls are subject to rate limits: 1k/day on client credentials, 10k–50k/day with user OAuth tokens. The MCP setup wizard configures user tokens by default.
