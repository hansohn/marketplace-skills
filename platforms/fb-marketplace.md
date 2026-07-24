# Facebook Marketplace

## Aliases
`fb`, `fb-marketplace`, `facebook`, `facebook-marketplace`

## Format rules
- **Title**: under ~100 characters (FB's effective limit). Readable/casual format. Special chars OK (`–`, `|`). No emojis, no all-caps, no OBO.
- **Body**: conversational. Up to 10 photos in the listing itself (managed separately by the user when posting).
- **Posting**: copy-paste only. No public API exists for personal Marketplace listings.

## Block template

```markdown
## Facebook Marketplace Listing

**Title:** {MAKE} {MODEL} – {COLOR} ({MODEL_NUMBER}) | {KEY_DIFFERENTIATOR}

**Body:**
> {ONE_SENTENCE_VALUE_HOOK}
>
{AVAILABILITY_NOTE}> **Condition:** {HONEST_CONDITION_SUMMARY}
>
{KNOWN_ISSUES_SECTION}{INCLUDES_SECTION}> **Features:**
{FEATURES_BULLETS}
>
> {RETAIL_CALLOUT}Smoke-free, pet-free home. Local pickup only — {LOCATION}. Cash or Venmo. No holds.
```

## Generation rules
- Lead the body with a value hook (one sentence: what it is, why someone wants it).
- State condition with specifics, not just "good".
- `{KNOWN_ISSUES_SECTION}` expands to either a full `> **Known issues — please read before messaging:**` section (header + bullets + trailing `>` separator) OR an **empty string** if the item has no issues. Never emit an empty header.
- `{INCLUDES_SECTION}` is **orchestrator-computed and locked** (see `skills/listing/SKILL.md` Step 3a/A). The orchestrator scans CSV `Notes` for extras-signal phrases, applies the integral-parts filter, and constructs the final string before platform-file rendering. **Substitute the placeholder with the locked value as-is.** Do not re-derive, re-evaluate, or "improve" the section during platform-file substitution. If the locked value is the empty string, the section is omitted entirely — do not add a header.
- `{RETAIL_CALLOUT}` is also **orchestrator-computed and locked** (see Step 3a/B): from the CSV `MSRP` column if set, else the MSRP-labeled row of the comps Retail table. Substitute as-is. Never use a street-price row to fill the retail callout.
- `{AVAILABILITY_NOTE}` is **orchestrator-computed and locked** (see Step 3a/C): a `> **N available** — price is per unit.` line when CSV `Quantity` > 1, else an empty string. Substitute as-is; don't add a note when it's empty.
- List 3–6 features. More than 6 dilutes attention.
- Close with the standard footer (retail callout, smoke/pet disclosure, location, payment, "No holds").

## Selling notes

Not part of the generated copy — seller-facing advice the orchestrator surfaces (see `listing` Step 6):

- **Renewal cadence.** Facebook's feed ranks fresh listings higher, so a post that has sat for a week gets buried. If there are no bites in ~7 days, **delete the listing and repost it** to refresh visibility — often more effective than a price drop alone. Pair it with the comps drop-price cadence. (The plugin never auto-posts; this is guidance for the seller to act on manually.)
