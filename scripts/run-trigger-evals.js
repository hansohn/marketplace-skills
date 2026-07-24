#!/usr/bin/env node
/**
 * run-trigger-evals.js — routing regression tripwire for the marketplace plugin.
 *
 * For every case in evals/cases/<skill>.json, each positive query is scored
 * against ALL four skill descriptions; the query "routes" to the highest-scoring
 * skill. We then measure how often the intended skill ranks #1 (rank-1 accuracy)
 * and fail if it drops below a checked-in baseline (--min-rank1).
 *
 * IMPORTANT — what this is and isn't:
 *   The scorer is a TF-IDF cosine over description vs query tokens (IDF computed
 *   across the four descriptions, so words shared by all skills — "marketplace",
 *   "listing", "item" — carry little weight and the discriminating words drive
 *   the match). It is a *lexical proxy* for how Claude actually routes, NOT the
 *   real thing. Its job is to catch a description edit that quietly destroys a
 *   skill's discriminability, not to prove routing is correct. Treat a pass as
 *   "no routing regression vs baseline," not "routing is perfect."
 *
 * evals/cases/_out-of-scope.json queries are reported informationally (a lexical
 * scorer has no meaningful absolute "routes to nothing" threshold).
 *
 * Usage:
 *   node scripts/run-trigger-evals.js [--min-rank1 <pct>] [--verbose]
 *
 * Zero dependencies. Exit 1 if rank-1 accuracy < min-rank1, or on a setup error.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const CASES_DIR  = path.join(ROOT, 'evals', 'cases');

// Short, generic words that carry no routing signal.
const STOPWORDS = new Set([
  'the','and','for','you','your','with','this','that','have','has','are','was',
  'can','use','used','using','when','what','which','item','items','out','get',
  'want','need','help','from','into','one','all','any','via','per','not','but',
  'a','an','of','to','in','on','is','it','my','me','i','do','how','some','they',
]);

// ─── Pure scoring helpers (unit-testable) ──────────────────────────────────────

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/** term-frequency map for a token list */
function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

/** Inverse document frequency across a set of token lists (docs). */
function computeIdf(docsTokens) {
  const N = docsTokens.length;
  const df = new Map();
  for (const toks of docsTokens) {
    for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map();
  for (const [t, d] of df) idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
  return idf;
}

/** TF-IDF cosine similarity of a query TF map against a document TF map. */
function cosineTfIdf(queryTf, docTf, idf) {
  let dot = 0, qNorm = 0, dNorm = 0;
  const terms = new Set([...queryTf.keys(), ...docTf.keys()]);
  for (const t of terms) {
    const w  = idf.get(t) || Math.log(2) + 1; // unseen term: modest weight
    const qv = (queryTf.get(t) || 0) * w;
    const dv = (docTf.get(t)   || 0) * w;
    dot   += qv * dv;
    qNorm += qv * qv;
    dNorm += dv * dv;
  }
  if (qNorm === 0 || dNorm === 0) return 0;
  return dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm));
}

/**
 * Rank a query against a set of skills.
 * @param {string} query
 * @param {Array<{name, tf}>} skills  precomputed doc TF maps
 * @param {Map} idf
 * @returns {Array<{name, score}>} sorted desc
 */
function rankQuery(query, skills, idf) {
  const qtf = termFreq(tokenize(query));
  return skills
    .map(s => ({ name: s.name, score: cosineTfIdf(qtf, s.tf, idf) }))
    .sort((a, b) => b.score - a.score);
}

// ─── Loading ───────────────────────────────────────────────────────────────────

function descriptionOf(skillDir) {
  const p = path.join(SKILLS_DIR, skillDir, 'SKILL.md');
  const content = fs.readFileSync(p, 'utf8');
  const fm = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!fm) return null;
  for (const line of fm[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i !== -1 && line.slice(0, i).trim() === 'description') {
      return line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return null;
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { minRank1: 80, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--min-rank1') args.minRank1 = Number(argv[++i]);
    else if (argv[i] === '--verbose' || argv[i] === '-v') args.verbose = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const skillDirs = fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
    .sort();

  // Build doc vectors from descriptions (name folded in, it carries signal).
  const skillTokens = skillDirs.map(d => {
    const desc = descriptionOf(d);
    if (desc == null) { console.error(`ERROR: ${d} has no description`); process.exit(1); }
    return tokenize(`${d.replace(/-/g, ' ')} ${desc}`);
  });
  const idf = computeIdf(skillTokens);
  const skills = skillDirs.map((d, i) => ({ name: d, tf: termFreq(skillTokens[i]) }));

  // Coverage: every skill must have a case file.
  let setupErrors = 0;
  for (const d of skillDirs) {
    if (!fs.existsSync(path.join(CASES_DIR, `${d}.json`))) {
      console.log(`  ✗  coverage: no evals/cases/${d}.json for skill '${d}'`);
      setupErrors++;
    }
  }

  // Score positives.
  let total = 0, rank1 = 0;
  const misroutes = [];
  console.log('Routing positives (intended skill should rank #1):\n');
  for (const d of skillDirs) {
    const casePath = path.join(CASES_DIR, `${d}.json`);
    if (!fs.existsSync(casePath)) continue;
    const cases = JSON.parse(fs.readFileSync(casePath, 'utf8'));
    let skillRank1 = 0;
    for (const q of cases.positives || []) {
      const ranked = rankQuery(q, skills, idf);
      total++;
      const top = ranked[0];
      const ok = top.name === d;
      if (ok) { rank1++; skillRank1++; }
      else misroutes.push({ intended: d, got: top.name, q, ranked });
      if (args.verbose) {
        const mark = ok ? '✓' : '✗';
        console.log(`    ${mark} [${top.name}] ${q.slice(0, 70)}${q.length > 70 ? '…' : ''}`);
      }
    }
    const n = (cases.positives || []).length;
    console.log(`  ${skillRank1 === n ? '✓' : '⚠'}  ${d}: ${skillRank1}/${n} routed correctly`);
  }

  // Misroute detail.
  if (misroutes.length) {
    console.log('\nMisroutes (intended → scored winner):');
    for (const m of misroutes) {
      console.log(`  ✗  ${m.intended} → ${m.got}: "${m.q.slice(0, 72)}${m.q.length > 72 ? '…' : ''}"`);
    }
  }

  // Out-of-scope: informational only.
  const oosPath = path.join(CASES_DIR, '_out-of-scope.json');
  if (fs.existsSync(oosPath)) {
    const oos = JSON.parse(fs.readFileSync(oosPath, 'utf8'));
    console.log('\nOut-of-scope (informational — top match should be a weak score):');
    for (const q of oos.out_of_scope || []) {
      const top = rankQuery(q, skills, idf)[0];
      console.log(`  ·  [${top.name} ${top.score.toFixed(2)}] ${q.slice(0, 64)}${q.length > 64 ? '…' : ''}`);
    }
  }

  const pct = total ? (rank1 / total) * 100 : 0;
  const passed = setupErrors === 0 && pct >= args.minRank1;
  console.log(`\nRank-1 accuracy: ${rank1}/${total} = ${pct.toFixed(0)}%  (baseline --min-rank1 ${args.minRank1}%)`);
  console.log(passed ? 'PASSED' : 'FAILED');
  if (!passed) process.exit(1);
}

module.exports = { tokenize, termFreq, computeIdf, cosineTfIdf, rankQuery };

if (require.main === module) {
  try { main(); }
  catch (err) { console.error(`\nERROR: run-trigger-evals failed: ${err.message}`); process.exit(1); }
}
