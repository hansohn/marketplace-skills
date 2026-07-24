# Deterministic pricing method (comps Step 4)

The `comps` skill's recommendation comes from plain, reproducible statistics — **no
model in the number**. `scripts/price.js` is the source of truth; run it and use its
output verbatim. This file documents the identical method for when the script can't run
(no Bash/Node) so you can compute it by hand — never eyeball or fabricate the stats.

Inputs: the **Pre-Owned** sold-item prices only (exclude New/parts and the shipping
amounts). Condition grade and an optional "heterogeneous" flag (comp set mixes
incompatible variants, e.g. Strider Sport vs Pro vs Classic).

## Steps

1. **Remove outliers — Tukey fences.** Sort the prices. Compute Q1 (25th pct) and Q3
   (75th pct) by linear interpolation. `IQR = Q3 − Q1`. Drop any price below
   `Q1 − 1.5·IQR` or above `Q3 + 1.5·IQR`. Report what you removed. Everything below uses
   the **cleaned** set.
2. **Central tendency — median, not mean.** Report Q1 / **median** / Q3 / IQR from the
   cleaned set. The median is robust to the skew a single high sale would add to a mean.
3. **List and drop prices (condition-adjusted).**
   - `list = round( P75(cleaned) × conditionFactor )` — the robust "upper cluster."
   - `drop = round( median(cleaned) × conditionFactor )` — the quick-sell midpoint (use
     if no bites in 7–10 days).
4. **Confidence tier.** With `dispersion = IQR / median`:
   - **high** — ≥ 8 cleaned comps and dispersion ≤ 0.35
   - **medium** — ≥ 4 comps and dispersion ≤ 0.60
   - **low** — otherwise
   A **heterogeneous** comp set caps confidence at **medium**.
5. **Percentile of the list price.** State where `list` lands among the cleaned comps
   ("~P73 of sold comps") — an honest read on how competitive it is.

## Condition factors (multiplicative)

| Grade | Factor |
|---|---|
| New / Brand New | 1.10 |
| Like New / Open Box / New Other | 1.05 |
| Excellent | 1.05 |
| **Good / Used / Pre-Owned (baseline)** | **1.00** |
| Fair | 0.88 |
| For parts / Needs repair / Not working | 0.70 |

## Two rules the number can't capture

- **No synthetic pickup premium.** The figures are anchored to real sold prices; any
  "local pickup saves shipping" framing is qualitative prose in the recommendation, not
  baked into the number.
- **Item-specific defects** not reflected by the grade (a seat puncture, a missing part,
  a dead pixel) warrant a small **manual markdown below** the calculator's list price —
  state it explicitly (e.g. "$72 baseline, −$7 for the seat puncture → **$65**").
