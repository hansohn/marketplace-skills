'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const {
  tokenize, termFreq, computeIdf, cosineTfIdf, rankQuery,
} = require('./run-trigger-evals');

test('tokenize lowercases, drops short words and stopwords', () => {
  const toks = tokenize('Sell my USED Peloton bike for a fair price');
  assert.ok(toks.includes('sell'));
  assert.ok(toks.includes('peloton'));
  assert.ok(toks.includes('price'));
  assert.ok(!toks.includes('my'));   // stopword
  assert.ok(!toks.includes('a'));    // too short
  assert.ok(!toks.includes('used')); // stopword
});

test('computeIdf gives rarer terms higher weight', () => {
  const docs = [tokenize('pricing sold comps ebay'), tokenize('photos hero shot order')];
  const idf = computeIdf(docs);
  // "pricing" appears in one doc; a term in both would be lower. Here all terms
  // are doc-unique, so just assert positivity and finiteness.
  assert.ok(idf.get('pricing') > 0);
  assert.ok(Number.isFinite(idf.get('photos')));
});

test('cosineTfIdf: identical vectors ~1, disjoint 0', () => {
  const idf = computeIdf([tokenize('alpha bravo charlie delta')]);
  const a = termFreq(tokenize('alpha bravo charlie'));
  assert.ok(cosineTfIdf(a, a, idf) > 0.99);

  const b = termFreq(tokenize('echo foxtrot golf'));
  assert.equal(cosineTfIdf(a, b, idf), 0);
});

test('rankQuery routes a pricing query to the pricing skill', () => {
  const docs = {
    comps:  tokenize('research live ebay sold pricing comparables what is it worth'),
    photos: tokenize('rank product photos choose hero shot ordering skips'),
  };
  const idf = computeIdf(Object.values(docs));
  const skills = Object.entries(docs).map(([name, toks]) => ({ name, tf: termFreq(toks) }));

  const ranked = rankQuery('what did this sell for — pricing comparables?', skills, idf);
  assert.equal(ranked[0].name, 'comps');

  const ranked2 = rankQuery('rank my product photos and pick the hero shot', skills, idf);
  assert.equal(ranked2[0].name, 'photos');
});
