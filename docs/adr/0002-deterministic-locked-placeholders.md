# 0002 — Compute includes / retail / price as locked, deterministic fields

**Status:** Accepted

## Context

Early listing generation let the model fill every placeholder by free-text
interpretation. Three fields kept going wrong in ways that cost the user money or
trust: the **Includes** section hallucinated extras (or listed integral parts like a
bike's saddle as if they were bonuses), the **retail callout** sometimes anchored to a
cheaper "new street price" instead of MSRP, and the **asking price** drifted from the
comps recommendation. Worse, across a multi-platform listing the same field could
render differently in the FB block vs. the eBay block.

## Decision

The orchestrator computes `{INCLUDES_SECTION}`, `{RETAIL_CALLOUT}` /
`{RETAIL_CALLOUT_BLOCK}`, `{AVAILABILITY_NOTE}`, and `{FINAL_PRICE}` **once**, with
explicit deterministic rules (a whole-word extras-phrase list, an integral-parts
filter, an MSRP-only retail anchor, a CSV-`Asking` override), in Step 3a — *before* any
platform file is read. Each is then a **locked input**: platform rendering substitutes
it verbatim and may not re-derive or "improve" it. The rules live in
`references/locked-fields.md`; a Verification invariant asserts the values are identical
across every platform block.

## Consequences

- **No hallucinated includes, no wrong retail anchor, consistent price** across
  platforms — the failure modes that motivated this are now structurally prevented.
- **The model must follow the reference precisely.** Determinism depends on Step 3a
  being executed; the step flow points to `locked-fields.md` emphatically for this
  reason.
- Slightly more prescriptive skill prose than a "just fill it in" approach — an
  accepted trade for correctness on money-bearing fields.
