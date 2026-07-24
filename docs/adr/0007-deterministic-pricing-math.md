# 0007 — Deterministic pricing math (Tukey + median + percentile), not eyeballed

**Status:** Accepted

## Context

The `comps` skill originally synthesized its recommendation by having the model
eyeball the sold comps: "range = min/max (drop one-off outliers), average = mean, list
= top of range or midpoint, plus a 10–25% pickup premium." Two problems: the **mean is
dragged** by a single high sale, and "drop one-off outliers" / "midpoint" are
judgment calls an LLM performs inconsistently — the same comp set could yield different
numbers on different runs. A review of comparable tools (notably `bullseye-app`, which
scores listings against eBay sold comps with *"no LLM in the scoring path"*) showed a
more rigorous, reproducible approach.

## Decision

Move the pricing statistics into deterministic code — `scripts/price.js`, a
zero-dependency Node calculator (consistent with ADR [0004](0004-zero-dependency-tooling.md))
whose numbers are locked, not model-generated (consistent with ADR
[0002](0002-deterministic-locked-placeholders.md)):

- **Tukey fences (1.5·IQR)** remove outliers with a stated rule, not a vibe.
- **Trimmed median + IQR** replace the mean (robust to skew).
- **List = condition-adjusted P75**, **drop = condition-adjusted median** — the old
  "top of range" / "midpoint" intent, made reproducible.
- A **confidence tier** (high/medium/low from comp count + dispersion, capped for
  heterogeneous sets) makes the "pricing is an estimate" caveat concrete.
- **Multiplicative condition factors** replace the ad-hoc "knock some off for wear."

The `comps` skill runs the script and uses its output verbatim; `references/pricing-method.md`
documents the identical method for by-hand fallback when Bash/Node isn't available.

## Consequences

- **Reproducible, defensible numbers** — the same comps always yield the same price, and
  a stray $500 sale no longer inflates the recommendation.
- **Honest uncertainty** — a thin or dispersed comp set now surfaces as low confidence
  rather than a falsely precise figure.
- **Two things stay out of the math on purpose:** no synthetic local-pickup premium
  (the number stays anchored to real sales; premium framing is qualitative), and
  **item-specific defects** not captured by the grade (a puncture, a missing part) remain
  a small **manual markdown** the skill states explicitly below the calculator's number.
- Percentile targets and condition factors are tunable constants in `price.js`; changing
  them is a code change with a test, not a prompt tweak.
