#!/usr/bin/env node
/**
 * price.js — deterministic resale pricing from a set of sold-comp prices.
 *
 * The comps skill used to eyeball "range = min/max, average = mean, list = top or
 * midpoint." An LLM doing IQR by hand is error-prone, and the mean is dragged around
 * by one stray high sale. This computes the recommendation with plain, reproducible
 * math — no model in the number — mirroring the plugin's determinism stance (see
 * docs/adr/0002 and 0007) and its zero-dependency tooling stance (ADR 0004).
 *
 * Method (details in references/pricing-method.md):
 *   1. Remove outliers with Tukey fences (Q1 - 1.5·IQR, Q3 + 1.5·IQR).
 *   2. From the cleaned set report Q1 / median / Q3 / IQR (robust to skew).
 *   3. list = condition-adjusted 75th percentile (robust "upper cluster").
 *      drop = condition-adjusted median (quick-sell midpoint).
 *   4. confidence = tier from comp count + dispersion (IQR/median), capped when the
 *      comp set is heterogeneous (mixed variants).
 *
 * Prices are the eBay *sold item* prices (Pre-Owned only). No synthetic local-pickup
 * premium is baked in — the number stays anchored to real sales; premium framing, if
 * any, is qualitative in the recommendation prose.
 *
 * Zero dependencies. Pure functions are exported for unit testing; run directly to
 * price a comp set from CLI args or stdin.
 */

'use strict';

// Multiplicative condition adjustment applied to the list/drop percentiles. Baseline
// is "good used," which is what most sold comps are. Keys are lowercased; CSV and eBay
// condition strings both map here.
const CONDITION_FACTORS = {
  'new': 1.10, 'brand new': 1.10,
  'like new': 1.05, 'used (like new)': 1.05, 'open box': 1.05, 'new other': 1.05, 'new other (see details)': 1.05,
  'excellent': 1.05,
  'good': 1.00, 'used (good)': 1.00, 'used': 1.00, 'pre-owned': 1.00,
  'fair': 0.88, 'used (fair)': 0.88,
  'for parts': 0.70, 'for parts or not working': 0.70, 'needs repair': 0.70, 'not working': 0.70,
};

const DEFAULT_LIST_PCT = 0.75; // robust "upper cluster" — the old skill's "top of range"
const DEFAULT_DROP_PCT = 0.50; // median — the quick-sell midpoint

// ─── Pure helpers (unit-testable) ──────────────────────────────────────────────

/** Parse to positive finite numbers, sorted ascending. */
function toSortedNums(arr) {
  return arr
    .map(Number)
    .filter((x) => Number.isFinite(x) && x > 0)
    .sort((a, b) => a - b);
}

/** Linear-interpolation quantile (type 7, same as most stats tools). `sorted` ascending. */
function quantile(sorted, p) {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

/** Tukey-fence outlier removal at 1.5·IQR. `sorted` ascending. */
function tukeyFilter(sorted) {
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const cleaned = sorted.filter((x) => x >= lowerFence && x <= upperFence);
  const removed = sorted.filter((x) => x < lowerFence || x > upperFence);
  return { cleaned, removed, lowerFence, upperFence };
}

/** Mid-rank percentile (0–1) of `value` within `sorted`. */
function percentileRank(value, sorted) {
  if (sorted.length === 0) return NaN;
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < value) below++;
    else if (x === value) equal++;
  }
  return (below + equal / 2) / sorted.length;
}

/** Condition string → multiplicative factor (1.0 if unknown). */
function conditionFactor(condition) {
  if (!condition) return 1.0;
  const key = String(condition).trim().toLowerCase();
  return CONDITION_FACTORS[key] ?? 1.0;
}

/** Confidence tier from cleaned-comp count + dispersion; heterogeneity caps at medium. */
function confidenceTier({ n, dispersion, heterogeneous }) {
  let tier;
  if (n >= 8 && dispersion <= 0.35) tier = 'high';
  else if (n >= 4 && dispersion <= 0.6) tier = 'medium';
  else tier = 'low';
  if (heterogeneous && tier === 'high') tier = 'medium';
  return tier;
}

const round = (x) => Math.round(x);
const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Full deterministic pricing from raw sold-comp prices.
 * @returns analysis object, or { error } if no usable prices.
 */
function analyze(rawPrices, opts = {}) {
  const {
    condition,
    heterogeneous = false,
    listPct = DEFAULT_LIST_PCT,
    dropPct = DEFAULT_DROP_PCT,
  } = opts;

  const sorted = toSortedNums(rawPrices);
  if (sorted.length === 0) return { error: 'no usable prices' };

  const { cleaned, removed, lowerFence, upperFence } = tukeyFilter(sorted);
  const set = cleaned.length ? cleaned : sorted; // never end up empty

  const q1 = quantile(set, 0.25);
  const median = quantile(set, 0.5);
  const q3 = quantile(set, 0.75);
  const iqr = q3 - q1;
  const cf = conditionFactor(condition);

  const list = round(quantile(set, listPct) * cf);
  const drop = round(quantile(set, dropPct) * cf);
  const dispersion = median > 0 ? iqr / median : Infinity;
  const confidence = confidenceTier({ n: set.length, dispersion, heterogeneous });

  return {
    n: sorted.length,
    cleanedN: set.length,
    removed,
    min: set[0],
    max: set[set.length - 1],
    q1: round2(q1),
    median: round2(median),
    q3: round2(q3),
    iqr: round2(iqr),
    conditionFactor: cf,
    listPct,
    dropPct,
    list,
    drop,
    listPercentile: Math.round(percentileRank(list, set) * 100),
    confidence,
    dispersion: round2(dispersion),
    lowerFence: round2(lowerFence),
    upperFence: round2(upperFence),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { prices: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--condition') opts.condition = argv[++i];
    else if (a === '--heterogeneous') opts.heterogeneous = true;
    else if (a === '--list-pct') opts.listPct = Number(argv[++i]);
    else if (a === '--drop-pct') opts.dropPct = Number(argv[++i]);
    else opts.prices.push(a);
  }
  return opts;
}

function readStdin() {
  try {
    return require('fs').readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.prices.length === 0) {
    // accept prices piped on stdin (whitespace/comma/$ separated)
    opts.prices = readStdin().split(/[\s,]+/).map((s) => s.replace(/[$,]/g, '')).filter(Boolean);
  }
  if (opts.prices.length === 0) {
    console.error('usage: price.js [--condition "Used (Good)"] [--heterogeneous] [--list-pct 0.75] [--drop-pct 0.50] <price> <price> ...');
    process.exit(2);
  }

  const r = analyze(opts.prices, opts);
  if (r.error) {
    console.error(`ERROR: ${r.error}`);
    process.exit(1);
  }

  const outliers = r.removed.length ? `, ${r.removed.length} outlier(s) removed [${r.removed.join(', ')}]` : '';
  console.log(`Sold comps: ${r.n} in${outliers ? '' : ' set'} → ${r.cleanedN} after Tukey filter${outliers}`);
  console.log(`Cleaned range: $${r.min} – $${r.max}   Q1 $${r.q1} · Median $${r.median} · Q3 $${r.q3}  (IQR $${r.iqr})`);
  console.log(`Condition factor: ×${r.conditionFactor}`);
  console.log('');
  console.log(`  List price:  $${r.list}   (condition-adjusted P${Math.round(r.listPct * 100)}; sits at ~P${r.listPercentile} of sold comps)`);
  console.log(`  Drop price:  $${r.drop}   (condition-adjusted median — no bites in 7–10 days)`);
  console.log('');
  console.log(`Confidence: ${r.confidence.toUpperCase()}  (${r.cleanedN} comps, dispersion ${r.dispersion})`);
  console.log(`JSON: ${JSON.stringify({ list: r.list, drop: r.drop, median: r.median, confidence: r.confidence, cleanedN: r.cleanedN, removed: r.removed })}`);
}

module.exports = { toSortedNums, quantile, tukeyFilter, percentileRank, conditionFactor, confidenceTier, analyze, CONDITION_FACTORS };

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`\nERROR: price.js failed unexpectedly: ${err.message}`);
    process.exit(1);
  }
}
