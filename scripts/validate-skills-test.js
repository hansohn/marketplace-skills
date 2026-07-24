'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const {
  frontmatterOf, fieldOf, lintSkill, descriptionOverlap, collisionWarnings,
} = require('./validate-skills');

const good = `---
name: comps
description: Research pricing comparables for a secondhand item.
---

# Comps
`;

test('frontmatterOf extracts the block, null when absent', () => {
  assert.equal(fieldOf(frontmatterOf(good), 'name'), 'comps');
  assert.equal(frontmatterOf('# no frontmatter here'), null);
});

test('lintSkill passes a well-formed skill', () => {
  const { errors, description } = lintSkill('comps', good);
  assert.deepEqual(errors, []);
  assert.match(description, /pricing comparables/);
});

test('lintSkill flags a name that does not match the directory', () => {
  const { errors } = lintSkill('photos', good); // frontmatter name is "comps"
  assert.ok(errors.some(e => /does not match directory/.test(e)));
});

test('lintSkill flags a non-kebab name', () => {
  const c = good.replace('name: comps', 'name: Comps_Skill');
  const { errors } = lintSkill('Comps_Skill', c);
  assert.ok(errors.some(e => /lowercase-hyphen/.test(e)));
});

test('lintSkill flags missing frontmatter', () => {
  const { errors } = lintSkill('comps', '# just a heading');
  assert.ok(errors.some(e => /frontmatter/i.test(e)));
});

test('lintSkill flags an over-long description', () => {
  const longDesc = 'x'.repeat(1100);
  const c = good.replace(/description: .*/, `description: ${longDesc}`);
  const { errors } = lintSkill('comps', c);
  assert.ok(errors.some(e => /exceeds the 1024/.test(e)));
});

test('descriptionOverlap: identical high, disjoint zero', () => {
  assert.ok(descriptionOverlap('price research comps sold', 'price research comps sold') > 0.9);
  assert.equal(descriptionOverlap('alpha bravo charlie', 'delta echo foxtrot'), 0);
});

test('collisionWarnings fires only on heavy overlap', () => {
  const clash = collisionWarnings({
    a: 'research pricing comparables secondhand marketplace',
    b: 'research pricing comparables secondhand marketplace',
  });
  assert.equal(clash.length, 1);

  const clear = collisionWarnings({
    comps: 'research live ebay sold pricing comparables',
    photos: 'rank product photographs choose hero shot ordering',
  });
  assert.equal(clear.length, 0);
});
