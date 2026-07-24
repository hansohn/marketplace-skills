'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  quantile,
  tukeyFilter,
  percentileRank,
  conditionFactor,
  confidenceTier,
  analyze,
} = require('./price.js');

// Strider 12 Sport Pre-Owned sold comps (the example fixture's real cluster).
const STRIDER = [74.99, 50, 39, 79.99, 76, 69.95, 49.99, 59, 55, 44.99, 49.99];

test('quantile uses linear interpolation (type 7)', () => {
  const s = [1, 2, 3, 4, 5];
  assert.equal(quantile(s, 0), 1);
  assert.equal(quantile(s, 0.5), 3);
  assert.equal(quantile(s, 1), 5);
  assert.equal(quantile(s, 0.25), 2);
});

test('tukeyFilter removes a high outlier, keeps the cluster', () => {
  const sorted = [...STRIDER, 500].sort((a, b) => a - b);
  const { cleaned, removed } = tukeyFilter(sorted);
  assert.deepEqual(removed, [500]);
  assert.equal(cleaned.length, STRIDER.length);
  assert.ok(!cleaned.includes(500));
});

test('tukeyFilter keeps a tight cluster intact (no false positives)', () => {
  const { removed } = tukeyFilter([...STRIDER].sort((a, b) => a - b));
  assert.deepEqual(removed, []);
});

test('percentileRank is mid-rank in [0,1]', () => {
  assert.equal(percentileRank(5, [1, 2, 3, 4]), 1);
  assert.equal(percentileRank(0, [1, 2, 3, 4]), 0);
  assert.equal(percentileRank(2, [1, 2, 3, 4]), 0.375); // (1 below + 0.5 equal)/4
});

test('conditionFactor maps grades (and is case-insensitive)', () => {
  assert.equal(conditionFactor('Used (Good)'), 1.0);
  assert.equal(conditionFactor('used (fair)'), 0.88);
  assert.equal(conditionFactor('For parts or not working'), 0.7);
  assert.equal(conditionFactor('Like New'), 1.05);
  assert.equal(conditionFactor(undefined), 1.0);
  assert.equal(conditionFactor('unrecognized'), 1.0);
});

test('confidenceTier: count + dispersion, heterogeneity caps at medium', () => {
  assert.equal(confidenceTier({ n: 12, dispersion: 0.2, heterogeneous: false }), 'high');
  assert.equal(confidenceTier({ n: 12, dispersion: 0.2, heterogeneous: true }), 'medium');
  assert.equal(confidenceTier({ n: 5, dispersion: 0.5, heterogeneous: false }), 'medium');
  assert.equal(confidenceTier({ n: 2, dispersion: 0.9, heterogeneous: false }), 'low');
});

test('analyze on the Strider cluster produces the expected deterministic numbers', () => {
  const r = analyze(STRIDER, { condition: 'Used (Good)' });
  assert.equal(r.n, 11);
  assert.equal(r.cleanedN, 11);
  assert.deepEqual(r.removed, []);
  assert.equal(r.median, 55);
  assert.equal(r.list, 72); // P75 ≈ 72.47 → 72, condition factor 1.0
  assert.equal(r.drop, 55); // median
  assert.equal(r.confidence, 'medium'); // n=11 but dispersion ~0.41 > 0.35
  assert.ok(r.listPercentile >= 70 && r.listPercentile <= 80);
});

test('a worse condition grade lowers the list price', () => {
  const good = analyze(STRIDER, { condition: 'Used (Good)' });
  const fair = analyze(STRIDER, { condition: 'Used (Fair)' });
  assert.ok(fair.list < good.list, 'Fair should price below Good');
  assert.equal(fair.list, Math.round(72.47 * 0.88)); // 64
});

test('a lone high sale does not drag the recommendation (outlier removed)', () => {
  const withOutlier = analyze([...STRIDER, 500], { condition: 'Used (Good)' });
  assert.deepEqual(withOutlier.removed, [500]);
  assert.ok(withOutlier.list < 100, 'list stays in-cluster despite the $500 sale');
});

test('empty / unusable input returns an error, never a fabricated price', () => {
  assert.equal(analyze([]).error, 'no usable prices');
  assert.equal(analyze(['abc', '-5', '0']).error, 'no usable prices');
});
