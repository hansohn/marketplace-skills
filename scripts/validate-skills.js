#!/usr/bin/env node
/**
 * validate-skills.js — structure check for the resale plugin's skills.
 *
 * Walks skills/, and for every skill directory asserts the conventions that keep
 * skill discovery and routing healthy:
 *
 *   Errors (exit 1):
 *     - A directory under skills/ that has no SKILL.md is not a skill and should
 *       not live here (this is what let the old listing-workspace/ eval output
 *       pollute the skills namespace).
 *     - SKILL.md missing/malformed YAML frontmatter.
 *     - Frontmatter 'name' missing, not lowercase-hyphen, or ≠ directory name.
 *     - Frontmatter 'description' missing or > 1024 chars (Claude's limit).
 *
 *   Warnings (do not block):
 *     - Two skill descriptions that overlap heavily in vocabulary — a sign their
 *       triggers may collide and route to the wrong skill.
 *
 * Zero dependencies. The pure checks are exported for unit testing; running the
 * file directly validates the repo and sets the exit code.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const SKILLS_DIR = path.resolve(__dirname, '..', 'skills');
const MAX_DESCRIPTION_LENGTH = 1024;
// Jaccard overlap above this on unique lowercased word-tokens is flagged as a
// possible routing collision. High enough that four skills describing distinct
// sub-tasks (pricing vs photos vs drafting vs orchestration) stay clear.
const COLLISION_THRESHOLD = 0.5;

// ─── Pure helpers (unit-testable) ──────────────────────────────────────────────

/** Extract the YAML frontmatter block's raw text, or null if absent/malformed. */
function frontmatterOf(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  return match ? match[1] : null;
}

/** Pull a single-line scalar field (name/description) out of frontmatter text. */
function fieldOf(frontmatter, key) {
  for (const line of frontmatter.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    if (line.slice(0, idx).trim() === key) {
      return line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return null;
}

/**
 * Validate one skill's SKILL.md content against the conventions.
 * @returns {{ errors: string[], description: string|null }}
 */
function lintSkill(dirName, content) {
  const errors = [];
  const fm = frontmatterOf(content);
  if (fm === null) {
    errors.push('Missing or malformed YAML frontmatter (expected --- block at top)');
    return { errors, description: null };
  }

  const name = fieldOf(fm, 'name');
  if (!name) {
    errors.push("Frontmatter missing required field: 'name'");
  } else {
    if (name !== dirName) errors.push(`Frontmatter name '${name}' does not match directory '${dirName}'`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) errors.push(`Name '${name}' is not lowercase-hyphen-separated`);
  }

  const description = fieldOf(fm, 'description');
  if (!description) {
    errors.push("Frontmatter missing required field: 'description'");
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`Description is ${description.length} chars — exceeds the ${MAX_DESCRIPTION_LENGTH}-char limit`);
  }

  return { errors, description };
}

/** Jaccard similarity of the unique word-token sets of two strings. */
function descriptionOverlap(a, b) {
  const toks = s => new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => t.length > 3));
  const A = toks(a), B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Cross-skill routing-collision warnings from a {name: description} map. */
function collisionWarnings(descriptions) {
  const warnings = [];
  const names = Object.keys(descriptions).sort();
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const sim = descriptionOverlap(descriptions[names[i]], descriptions[names[j]]);
      if (sim >= COLLISION_THRESHOLD) {
        warnings.push(`'${names[i]}' and '${names[j]}' descriptions overlap ${(sim * 100).toFixed(0)}% — triggers may collide`);
      }
    }
  }
  return warnings;
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`ERROR: skills directory not found at ${SKILLS_DIR}`);
    process.exit(1);
  }

  const dirs = fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
    .sort();

  let totalErrors = 0;
  const descriptions = {};

  for (const dir of dirs) {
    const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      console.log(`  ✗  ${dir}`);
      console.log(`       ERROR: no SKILL.md — a directory under skills/ must be a skill`);
      totalErrors++;
      continue;
    }
    const { errors, description } = lintSkill(dir, fs.readFileSync(skillPath, 'utf8'));
    if (description) descriptions[dir] = description;
    if (errors.length === 0) {
      console.log(`  ✓  ${dir}`);
    } else {
      console.log(`  ✗  ${dir}`);
      for (const msg of errors) console.log(`       ERROR: ${msg}`);
      totalErrors += errors.length;
    }
  }

  const warnings = collisionWarnings(descriptions);
  for (const w of warnings) console.log(`  ⚠  ${w}`);

  const status = totalErrors > 0 ? 'FAILED' : warnings.length > 0 ? 'PASSED WITH WARNINGS' : 'PASSED';
  console.log(`\n${dirs.length} skills checked — ${totalErrors} error(s), ${warnings.length} warning(s) — ${status}`);
  if (totalErrors > 0) process.exit(1);
}

module.exports = { frontmatterOf, fieldOf, lintSkill, descriptionOverlap, collisionWarnings };

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`\nERROR: validate-skills failed unexpectedly: ${err.message}`);
    process.exit(1);
  }
}
