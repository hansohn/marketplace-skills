'use strict';

const { test } = require('node:test');
const assert   = require('node:assert');

const { findLocationLeaks, ALLOWED } = require('./check-location-leaks.js');

test('flags a real City, ST ZIP', () => {
  const hits = findLocationLeaks('Local pickup only — Springfield, IL 62704. Cash or Venmo.');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].match, 'Springfield, IL 62704');
  assert.equal(hits[0].line, 1);
});

test('allows the documented placeholder', () => {
  assert.deepEqual(findLocationLeaks('Local pickup only — Phoenix, AZ 85016.'), []);
});

test('flags a multi-word city', () => {
  const hits = findLocationLeaks('shipping from San Francisco, CA 94103 today');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].match, 'San Francisco, CA 94103');
});

test('flags a ZIP+4', () => {
  const hits = findLocationLeaks('Austin, TX 78701-1234');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].match, 'Austin, TX 78701-1234');
});

test('reports correct line numbers across multiple lines', () => {
  const hits = findLocationLeaks('line one\nline two\nBoston, MA 02108\n');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 3);
});

test('ignores bare numbers that are not locations', () => {
  // the 25 KB scrape cap, a model year, and a price — none are "City, ST ZIP"
  const text = 'substring(0, 25000) for a 2020 model that retails for $129.99';
  assert.deepEqual(findLocationLeaks(text), []);
});

test('ignores ordinary comma text without a state+zip', () => {
  assert.deepEqual(findLocationLeaks('Newborn to Toddler, all carry positions'), []);
});

test('respects a custom allow set', () => {
  const allowed = new Set(['Denver, CO 80202']);
  assert.deepEqual(findLocationLeaks('warehouse in Denver, CO 80202', allowed), []);
  assert.equal(findLocationLeaks('warehouse in Miami, FL 33101', allowed).length, 1);
});

test('the default ALLOWED contains exactly the documented placeholder', () => {
  assert.deepEqual([...ALLOWED], ['Phoenix, AZ 85016']);
});
