# Locked-field computation (listing Step 3a)

Read this during **Step 3a** of the `listing` orchestrator, once per run, before reading any
`platforms/{name}.md` file. It defines the deterministic logic for the placeholders that must
**not** be produced by free-text model interpretation. Compute each value here, then treat it as
a **fixed, locked input** to Step 3b — the platform file's matching placeholder is replaced with
this exact string, never re-derived or "improved" during platform rendering.

Four values are locked as platform-substitution inputs — `{INCLUDES_SECTION}`,
`{RETAIL_CALLOUT}`, `{RETAIL_CALLOUT_BLOCK}`, and `{AVAILABILITY_NOTE}` — plus `{FINAL_PRICE}`,
which is not substituted into platform copy but feeds the price/eBay-draft offer.

## A. `{INCLUDES_SECTION}`

1. Read the CSV `Notes` column for this item.
2. Apply this matching rule: scan for any of these explicit extras-signal phrases (case-insensitive),
   matching on **whole words/phrases, not substrings** — so `with` matches "comes with a pump" but
   not "wi**thin** the seat", and `bag` doesn't fire on "**bag**gy":
   - `includes`, `included`, `with`, `comes with`, `+`, `plus`, `bundle`, `bundled`, `set of`,
     `original box`, `original packaging`, `accessories`, `adapter`, `tray`, `cover`, `manual`,
     `helmet`, `bag`
3. **If no phrase matches → set `INCLUDES_SECTION = ""` (empty string). LOCK this value.** Do not
   pass any inclusion-related context to Step 3b.
4. **If a phrase matches → parse the specific extras** from the CSV `Notes` text into a bullet list.
   Then set:
   ```
   INCLUDES_SECTION = "> **Includes:**\n> - {extra 1}\n> - {extra 2}\n> - ...\n>\n"
   ```
   Apply the integral-parts filter: even if a phrase matched, exclude any item that is an
   integral/standard part of the product (for a bike: saddle, footrest, handlebars, wheels, frame;
   for a stroller: canopy, basket, harness; for a laptop: keyboard, trackpad, display, charger). If
   after filtering no genuine extras remain → set `INCLUDES_SECTION = ""`.

## B. `{RETAIL_CALLOUT}` and `{RETAIL_CALLOUT_BLOCK}`

1. **If the CSV `MSRP` column is non-empty for this item**, use that value directly as `{MSRP_price}`
   (the user-supplied MSRP is authoritative — don't second-guess it against comps).
2. Otherwise, parse the `/marketplace:comps` Pricing Analysis Block 1 → Retail (New) table and find
   the row whose source label contains the string `"MSRP"` (the comps skill emits this label, e.g.,
   `"Strider Bikes (MSRP, 12 Sport)"`).
3. Extract the price from that row.
4. **If an MSRP value exists (from the CSV column or the comps row):**
   ```
   RETAIL_CALLOUT       = "Retails new for ${MSRP_price}. "
   RETAIL_CALLOUT_BLOCK = "> Retails new for ${MSRP_price}.\n>\n"
   ```
5. **If no MSRP value exists** (no CSV `MSRP` and only street prices in comps): set both to `""`.

**Never use a street-price row to fill the retail callout.**

## C. `{FINAL_PRICE}` and `{AVAILABILITY_NOTE}`

1. **Final list price.** Default to the comps Pricing Recommendation (Block 2) "Final listing price".
   **If the CSV `Asking` column is non-empty for this item, that value overrides the comps
   recommendation** — use it as `{FINAL_PRICE}`. When overridden, flag it in the Step 6 summary
   ("list price set from CSV `Asking`, not comps") and pass `{FINAL_PRICE}` to `/marketplace:ebay-draft`
   as the offer price. The comps Block 2 is still written into the listing file for the user's reference.
2. **Availability note.** Read the CSV `Quantity` column (default 1).
   - **If Quantity > 1:** `AVAILABILITY_NOTE = "> **{Quantity} available** — price is per unit.\n>\n"`.
     This same locked string fills `{AVAILABILITY_NOTE}` in every platform block. Also pass `Quantity`
     to `/marketplace:ebay-draft` (it sets the eBay offer's available quantity).
   - **If Quantity is blank or 1:** `AVAILABILITY_NOTE = ""` (single-item listing — no note, eBay
     quantity defaults to 1).

   Quantity maps cleanly only to eBay's offer quantity; FB Marketplace is one-post-per-unit, so for
   that platform the note in the copy is how availability is communicated.
