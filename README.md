<div align="center">
  <h3>marketplace-skills</h3>
  <p>Prep secondhand items for resale — pricing, photos, and listing copy for Facebook Marketplace &amp; eBay.</p>

  <a href="https://github.com/hansohn/marketplace-skills/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/hansohn/marketplace-skills/ci.yml?branch=main&style=for-the-badge&label=Build&cacheSeconds=3600" alt="Build Status"></a>
  <a href="https://github.com/hansohn/marketplace-skills/tags"><img src="https://img.shields.io/github/v/tag/hansohn/marketplace-skills?style=for-the-badge&label=Tag&cacheSeconds=3600" alt="Tag"></a>
  <a href="https://github.com/hansohn/marketplace-skills/blob/main/LICENSE"><img src="https://img.shields.io/github/license/hansohn/marketplace-skills?style=for-the-badge&cacheSeconds=3600" alt="License"></a>
</div>

A Claude Code plugin, invoked as `/marketplace:*`. It turns a secondhand item into a complete listing file — **pricing analysis, listing copy per platform, and a recommended photo order** — and can optionally push an eBay draft. Give it an item name or a CSV of items; it does the research and writes the file. You review and post.

<table align="center">
<tr>
<td align="center"><b>📦&nbsp; Item</b><br><sub>name or CSV row</sub></td>
<td align="center"><b>→</b></td>
<td align="center"><b>🔎&nbsp; comps + photos</b><br><sub>live sold $ · ranked order</sub></td>
<td align="center"><b>→</b></td>
<td align="center"><b>📝&nbsp; listing</b><br><sub>your ready-to-post .md file</sub></td>
</tr>
</table>

<div align="center"><sub><i>comps and photos run in parallel · listing writes one file per enabled platform</i></sub></div>

<div align="center"><sub>↳ &nbsp;optionally, <code>/marketplace:ebay-draft</code> pushes the eBay portion to your account <b>as a draft</b> — you publish</sub></div>

## Skills

| Skill | Invocation | What it does |
|---|---|---|
| **listing** | `/marketplace:listing` | Orchestrator. Reads item details, runs comps + photos, generates one listing-copy section per enabled platform, writes the final `.md`. Optionally chains into `ebay-draft`. |
| **comps** | `/marketplace:comps` | Pricing research only. Live eBay sold listings via browser automation, with a web-search fallback. Never fabricates prices. |
| **photos** | `/marketplace:photos` | Photo review only. Ranks a folder of product photos (hero first, honest condition shots, detail last) and calls out skips. |
| **ebay-draft** | `/marketplace:ebay-draft` | Creates an eBay inventory item + offer **as a draft** via the eBay MCP. Never publishes — you review and publish in Seller Hub. |

The `listing` orchestrator delegates to the others; each also runs standalone.

## Quick start

```bash
# 1. Load the plugin
claude --plugin-dir ~/Code/ai/claude/marketplace-skills

# 2. Price and generate a listing from an item name…
/marketplace:listing "Strider 12 Sport Balance Bike" --location="Phoenix, AZ 85016"

# …or batch a whole CSV of items
/marketplace:listing examples/garage/inventory.csv
```

See [`examples/garage/`](examples/garage/) for a working sample CSV and real generated output.

## Requirements

The core — turning an item name or CSV row into a listing `.md` — needs nothing but Claude Code and this plugin. Everything else **degrades gracefully**: a missing dependency makes a feature slower or thinner, never fabricated. The one hard wall is Facebook posting, which has no public API for anyone.

**Legend:** ✅ works&nbsp; · &nbsp;⚠️ degrades&nbsp; · &nbsp;❌ not possible

| Feature | Requires | Behavior without it |
|---|---|---|
| **Listing copy generation** (core) | Claude Code + this plugin | ✅ Always works — item name or CSV in, listing `.md` out |
| **Live pricing comps** | Playwright MCP (browser automation) | ⚠️ Falls back to `WebSearch`/`WebFetch` snippets — thinner, less precise. With no web tools at all, emits an honest "no comparable sales data found" — **never invents prices** |
| **Photo review & ordering** | Image files + Read tool | ✅ Cross-platform. With no photos, emits a shot-list stand-in instead of inventing filenames |
| **Photo downscaling** (speed / token saver) | macOS `sips` (or `magick` / `convert`) | ✅ Falls back to reading full-res originals — slower and more tokens, identical result |
| **eBay auto-draft** | [eBay MCP server](https://github.com/YosefHayim/ebay-mcp) + free eBay dev credentials | ⚠️ Skipped — you paste the generated eBay block into Seller Hub yourself |
| **FB Marketplace posting** | — (no public API exists) | ❌ Never automated. The plugin generates copy; you paste it into Facebook manually |
| **Retail / MSRP lookup** | `WebSearch` (US-only) | ⚠️ Non-US users get weaker retail anchors; comps are `eBay.com` / USD by default |

> [!NOTE]
> **Pricing is an estimate, not an appraisal.** Comps are pulled live and can be noisy — sold-price variance, thin comp sets, or an ambiguous MSRP (the skill surfaces these rather than guessing). Sanity-check the recommended price against the comp table before you list.

## Installation

```bash
claude --plugin-dir ~/Code/ai/claude/marketplace-skills
```

To make it always available, add the flag to a shell alias or wrapper script.

<details>
<summary><b>Dev permissions (optional, for working on the plugin)</b></summary>

<br>

When you open this repo as a workspace, `.claude/settings.json` can pre-approve the tools the skills use (Bash/Read/Write, web tools, the Playwright MCP) and grant access to the directory your listings live in. That file is personal (it holds an absolute path to your own sales folder) and is gitignored. Copy the tracked template and edit the path:

```bash
cp .claude/settings.example.json .claude/settings.json
# then set additionalDirectories to your own listings/photos folder
```

This only affects developing the plugin — a plugin installed via `--plugin-dir` does not inherit these permissions.
</details>

## Usage

**Single item**
```
/marketplace:listing "Strider 12 Sport Balance Bike"
```

**CSV batch** — one listing file per row
```
/marketplace:listing examples/garage/inventory.csv
```

Expected CSV columns: `Make, Model, Model Number, Color, Year, Condition, Notes, Specifics, Photos, Quantity, MSRP, Asking, Platforms, Expiration`. The identity fields plus `Notes` are normally filled; `Specifics` holds `key: value; key: value` pairs (eBay item specifics); `Quantity` defaults to 1; and `MSRP / Asking / Platforms / Expiration` are optional per-row overrides.

**Interactive** — the orchestrator asks for item, photos, and location
```
/marketplace:listing
```

**Standalone sub-skills**
```
/marketplace:comps "Strider 12 Sport"
/marketplace:photos ./Photos/
/marketplace:ebay-draft            # after a listing has been generated
```

## Setting your location

Your city/state/zip appears in every listing (local-pickup footer, comps framing). **No default location ships with the plugin.** Resolution order — most specific wins:

| # | Layer | Example |
|---|---|---|
| 1 | `--location` CLI flag | `--location="Phoenix, AZ 85016"` |
| 2 | User memory | *"Remember my default resale location is Phoenix, AZ 85016"* |
| 3 | Sibling listings | parsed from the footer of other `*-Listing.md` files in the dir |
| 4 | Interactive prompt | asked once per run, offers to save to memory |

> [!IMPORTANT]
> The plugin never substitutes a placeholder city like `[YOUR_CITY]` or `Anytown, USA`. If it can't resolve a real location, it stops with a clear error rather than guessing.

## Platform preference

One listing-copy block is generated per **enabled** platform; disabled platforms produce zero output and zero tokens. Resolution order — most specific wins:

| # | Layer | Use case |
|---|---|---|
| 1 | CSV `Platforms` column | per-row override in a batch |
| 2 | `--platforms=<csv>` flag | per-run override, e.g. `--platforms=fb,ebay` |
| 3 | User memory | stable personal preference |
| 4 | Default `["fb-marketplace"]` | FB is the most universal |

Accepted names/aliases come from each file's `## Aliases` section in `platforms/`:
- `fb`, `fb-marketplace`, `facebook`, `facebook-marketplace` → Facebook Marketplace
- `ebay` → eBay

<details>
<summary><b>Adding a new platform (no code changes)</b></summary>

<br>

Drop a `platforms/{name}.md` file with these sections:

````markdown
# {Display name}

## Aliases
short-name, alt-name

## Format rules
- Title length, character limits, photo limits, posting method

## Block template
```markdown
## {Display Name} Listing
**Title:** ...
**Body:** ...
```

## Generation rules
- How to fill in the template fields
````

The orchestrator iterates `platforms/*.md` automatically — it picks the new file up with no code change.
</details>

## Optional: eBay auto-draft via MCP

If you install the [eBay MCP server](https://github.com/YosefHayim/ebay-mcp), `/marketplace:listing` offers to create the eBay listing as a **draft** via eBay's Sell API — no copy-paste. The orchestrator creates the inventory item + offer; you review and publish from Seller Hub. **Facebook Marketplace has no equivalent — no public API exists for personal Marketplace listings.**

<details>
<summary><b>eBay MCP setup &amp; prerequisites</b></summary>

<br>

```bash
# 1. Get free eBay developer credentials at https://developer.ebay.com/my/keys
# 2. Install the MCP server
npm install -g ebay-mcp
# 3. Run the interactive setup (handles OAuth, writes MCP config to ~/.claude.json)
npm run setup
```

Restart Claude Code after setup.

**eBay-side prerequisites (one-time)** — before any draft can be published in Seller Hub, eBay requires:
- An **inventory location** (your shipping address)
- A **payment policy**, **fulfillment policy**, and **return policy** at [bizpolicy.ebay.com](https://www.bizpolicy.ebay.com/)

If any are missing, `/marketplace:ebay-draft` surfaces a clear error with a link to Seller Hub.

**Photo caveat** — eBay needs publicly accessible image URLs. Since photos are local files in `./Photos/`, the auto-created draft has no images; upload them in Seller Hub before publishing.
</details>

## What the plugin does **not** do

- ❌ **Auto-publish** to any platform — drafts and copy are always reviewed by you before going live
- ❌ **Auto-post to Facebook Marketplace** — no API exists, paste-only forever
- ❌ **Browser-automate FB Marketplace posting** — against ToS, risks account suspension
- ❌ **Fabricate prices** — comps are live or the run says so; it never invents a number

## Project layout

```
.claude-plugin/plugin.json   plugin manifest (name, version, agents)
skills/<name>/SKILL.md        one skill per directory
agents/<name>.md              least-privilege subagent personas
platforms/<name>.md           one file per marketplace format (drives generation)
templates/listing.md          output-file skeleton with {PLACEHOLDER} slots
references/*.md                progressive-disclosure reference (placeholders, locked fields, ambiguity)
scripts/                      zero-dependency validation + eval tooling (CI gates)
examples/garage/              sample CSV + real generated output
docs/adr/                     architecture decision records
```

Contributing conventions and invariants live in [`CLAUDE.md`](CLAUDE.md); the *why* behind non-obvious decisions is in [`docs/adr/`](docs/adr/).
