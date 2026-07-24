#!/usr/bin/env node
/**
 * check-location-leaks.js — pre-publish PII guard for the marketplace plugin.
 *
 * The plugin writes a real "City, ST ZIP" into every generated listing (the
 * local-pickup footer). Nothing personal should ever be committed — but the leak
 * vector is easy to miss: a bare zip like `12345` slips past a name/path grep.
 * This guard scans every *tracked* file (what actually ships on publish) for a
 * "City, ST ZIP" string and fails on any that isn't the documented placeholder.
 *
 *   Error (exit 1): any "City, ST ZIP" occurrence not in ALLOWED.
 *
 * Scope & precision:
 *   - Only the "City, ST ZIP" shape is matched — the format the plugin emits.
 *     That keeps false positives near zero: bare numbers (the 25000 scrape cap,
 *     a 2020 model year, a $129.99 price) never match, so the gate stays trusted.
 *   - A bare, context-free zip (e.g. `--location="12345"`) is NOT the plugin's
 *     output format and is intentionally out of scope; add a shape here if that
 *     ever becomes a real vector.
 *   - The guard excludes its own source + test, whose fixtures embed sample leaks.
 *
 * Zero dependencies. The pure check is exported for unit testing; running the
 * file directly scans the repo and sets the exit code.
 */

'use strict';

const fs        = require('fs');
const path      = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// The single documented placeholder location. Everything else is a leak.
// Keep in sync with README "Setting your location" and references/placeholders.md.
const ALLOWED = new Set(['Phoenix, AZ 85016']);

// Text files worth scanning (skip images/binaries/lockfiles by extension).
const SCAN_EXT = /\.(md|markdown|mdx|json|jsonc|csv|tsv|txt|ya?ml|js|cjs|mjs|ts)$/i;

// The guard's own source + test carry sample leaks as fixtures — never scan them.
const EXCLUDE = /^scripts[\/\\]check-location-leaks/;

// ─── Pure helper (unit-testable) ────────────────────────────────────────────────

/**
 * Find "City, ST ZIP" occurrences in text that are not in `allowed`.
 * City may be multi-word (e.g. "San Francisco"); ZIP may carry a +4.
 * @param {string} text
 * @param {Set<string>} allowed  exact "City, ST ZIP" strings to permit
 * @returns {{ line: number, col: number, match: string }[]}
 */
function findLocationLeaks(text, allowed = ALLOWED) {
  // City words start uppercase; ", ST " is a 2-letter state; then a 5-digit zip.
  const re = /\b[A-Z][A-Za-z.'’-]*(?: [A-Z][A-Za-z.'’-]*)*, [A-Z]{2} \d{5}(?:-\d{4})?\b/g;
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (!allowed.has(m[0])) hits.push({ line: i + 1, col: m.index + 1, match: m[0] });
    }
  });
  return hits;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────────

/**
 * Repo-relative text files that would actually be published — tracked *and*
 * untracked-but-not-gitignored (new fixtures a commit would sweep in) — minus
 * the guard's own fixtures. Using only `git ls-files` (tracked) would skip
 * brand-new files, which is exactly what a pre-publish check must catch;
 * `--others --exclude-standard` adds untracked files while honoring .gitignore.
 */
function publishableTextFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return out.split('\0').filter(Boolean).filter(f => SCAN_EXT.test(f) && !EXCLUDE.test(f));
}

function main() {
  const files = publishableTextFiles();
  let totalHits = 0;

  for (const rel of files) {
    let content;
    try {
      content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    } catch {
      continue; // unreadable/binary despite extension — skip
    }
    const hits = findLocationLeaks(content);
    for (const h of hits) {
      console.log(`  ✗  ${rel}:${h.line}:${h.col}  leaked location "${h.match}"`);
      totalHits++;
    }
  }

  if (totalHits > 0) {
    const allow = [...ALLOWED].map(a => `"${a}"`).join(', ');
    console.log(`\n${totalHits} location leak(s) found across ${files.length} tracked files — FAILED`);
    console.log(`Only the placeholder ${allow} is allowed. Replace real locations before publishing.`);
    process.exit(1);
  }
  console.log(`${files.length} tracked files scanned — 0 location leak(s) — PASSED`);
}

module.exports = { findLocationLeaks, ALLOWED };

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`\nERROR: check-location-leaks failed unexpectedly: ${err.message}`);
    process.exit(1);
  }
}
