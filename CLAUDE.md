# marketplace

A Claude Code plugin for preparing secondhand items for resale. It generates a
complete listing file — pricing analysis, listing copy per enabled platform, and
a recommended photo order — from an item name or a CSV row, and can optionally
create an eBay draft.

> **Scope:** this file configures agents working on the plugin **itself**. The
> reusable assets are the skills in `skills/`. The plugin is named `marketplace`
> (in `.claude-plugin/plugin.json`), so its skills are invoked as
> `/marketplace:<skill>`. The on-disk folder and git repo are `marketplace-skills`
> — folder/repo names are intentionally independent of the plugin name.

## Structure

```
.claude-plugin/plugin.json  → plugin manifest (name, version, description)
skills/<name>/SKILL.md       → one skill per directory (nothing else lives here)
agents/<name>.md             → least-privilege subagent personas (registered in plugin.json)
platforms/<name>.md          → one file per marketplace format (drives generation)
templates/listing.md         → output file skeleton with {PLACEHOLDER} slots
references/placeholders.md    → shared placeholder-source table (progressive disclosure)
references/locked-fields.md   → listing Step 3a deterministic-field rules (read at 3a)
docs/adr/                     → architecture decision records (why non-obvious calls were made)
scripts/                      → validation + eval tooling (zero-dependency Node)
evals/cases/<skill>.json      → per-skill routing datasets (run-trigger-evals.js)
evals/workspace/              → skill-creator eval run outputs (gitignored)
.claude/settings.json         → personal dev config (untracked; see settings.example.json)
```

## Skills

- **listing** — orchestrator. Gathers item details, delegates to `comps` and
  `photos`, renders one copy block per enabled platform, writes
  `{ItemPrefix}-Listing.md`, and optionally chains into `ebay-draft`.
- **comps** — pricing research only (live eBay sold data via Playwright, optional FB).
- **photos** — reviews a photo folder, returns a ranked order + condition notes.
- **ebay-draft** — pushes a prepared listing to eBay as a **draft** via the eBay MCP.

## Conventions

- **Skill anatomy.** Every `SKILL.md` has YAML frontmatter (`name` matching the
  directory, `description` ≤1024 chars stating *what* + *when to use*), then these
  sections in order: **When to use → Required inputs → Process → [Output format] →
  Verification → Notes**. The `Verification` section is a checklist of the skill's
  hard invariants (e.g. ebay-draft's "never publish").
- **`skills/` holds only skills.** Every directory under `skills/` must contain a
  `SKILL.md`. Eval outputs, snapshots, and scratch do **not** belong here — that is
  what let the old `listing-workspace/` pollute discovery. `validate-skills.js`
  fails on any non-skill directory here.
- **Plugin-root paths.** `platforms/`, `templates/`, `references/`, and sibling
  skills live at the **plugin root**, not inside a skill folder. Resolve them as
  `${CLAUDE_PLUGIN_ROOT}/platforms/…` etc. A bare `platforms/foo.md` read relative
  to `skills/listing/` will 404.
- **Platforms are file-driven and extensible.** The orchestrator iterates
  `platforms/*.md`; adding a marketplace is just a new file (sections: `## Aliases`,
  `## Format rules`, `## Block template`, `## Generation rules`) — no code change.
  **Only `fb-marketplace` and `ebay` ship.** If you add another, also add it back to
  the skill descriptions (they were trimmed to claim only what ships).
- **Descriptions drive routing, not names.** Keep each skill's `description`
  trigger-rich and distinct from its siblings; `validate-skills.js` warns on
  overlap and `run-trigger-evals.js` measures routing.

## Key invariants (enforced in each skill's Verification section)

- **Never auto-publish or auto-post** anywhere. `ebay-draft` creates a draft and
  stops; the user publishes from Seller Hub. `listing` writes a file; the user posts.
- **No surviving placeholders** in a generated listing (`{...}` / `[YOUR_CITY]`).
- **Live pricing only** — `comps` pulls live data and never fabricates prices.
- **Location resolves to a real user-supplied value**, never a placeholder city.
- **Surface ambiguity with options, never guess.** On missing, conflicting, or
  ambiguous input (location, platform, condition, price, includes, which item),
  state the confusion, give concrete labeled options, and ask — don't invent a
  value or split the difference. See `references/handling-ambiguity.md`.

## Tooling

```bash
node scripts/validate-skills.js         # structure/frontmatter check (CI gate)
node scripts/check-location-leaks.js    # pre-publish PII guard: fails on any real "City, ST ZIP"
node scripts/run-trigger-evals.js       # routing regression tripwire (--min-rank1 80)
node --test scripts/validate-skills-test.js scripts/run-trigger-evals-test.js scripts/check-location-leaks-test.js
```

`run-trigger-evals.js` scores each labeled query in `evals/cases/<skill>.json`
against all skill descriptions with a **TF-IDF lexical proxy** — it catches a
description edit that tanks a skill's discriminability; it is *not* a substitute
for real-model routing. Behavioral (execution) evals for `listing` live under
`skills/listing/evals/` and run via the skill-creator plugin.

## Boundaries

- Always run `validate-skills.js` (and ideally the trigger evals + tests) after
  editing any `SKILL.md`.
- Never add a directory under `skills/` that isn't a skill.
- Never hardcode a personal path or location in tracked files — `.claude/settings.json`
  is personal and untracked; ship changes via `settings.example.json`. The only location
  string allowed in committed files is the placeholder `Phoenix, AZ 85016`;
  `check-location-leaks.js` scans the whole publishable tree (tracked + untracked-not-ignored)
  and fails on any other `City, ST ZIP`. Run it before publishing.
- Never let a skill's copy claim a platform that has no `platforms/<name>.md`.
