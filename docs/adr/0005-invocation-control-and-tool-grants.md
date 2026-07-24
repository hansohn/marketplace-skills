# 0005 — Don't disable model-invocation on ebay-draft; don't auto-grant tools

**Status:** Accepted

## Context

Two Claude Code skill-frontmatter features looked applicable while hardening the plugin
for a public release:

- **`disable-model-invocation: true`** makes a skill user-invocable only (Claude can't
  auto-trigger it) and drops its description from context. The docs pitch it for
  side-effect commands like `/deploy` — which resembles our `ebay-draft` (it creates an
  external eBay draft).
- **`allowed-tools`** pre-approves tools for the turn that invokes a skill, cutting
  permission prompts — attractive for `comps` (browser/web) and `photos` (Read/Bash).

## Decision

Adopt **neither**, for now.

- **ebay-draft keeps default invocation.** Its safety already comes from a hard
  invariant (never publishes — draft only) and a tightly scoped description, not from
  gating who can call it. Setting `disable-model-invocation` would also break the
  `listing` orchestrator's opt-in hand-off into `ebay-draft`, and there is a known bug
  ([anthropics/claude-code#26251](https://github.com/anthropics/claude-code/issues/26251))
  where such skills intermittently refuse even explicit slash invocation. Cost outweighs
  a marginal safety gain.
- **No `allowed-tools` auto-grants.** The docs warn a project skill can grant itself
  broad tool access once the repo is trusted. Auto-approving browser automation (comps)
  or Bash (photos) cuts against the least-privilege posture we deliberately hold (ADR
  [0003](0003-least-privilege-subagents.md)). Users should grant powerful tools
  explicitly.

## Consequences

- `ebay-draft` remains callable both by the user and by the orchestrator's opt-in step;
  the "never auto-post" guarantee stays enforced by its Verification invariant, not by
  invocation gating.
- Users see permission prompts for powerful tools on standalone `comps`/`photos` runs —
  an accepted friction in exchange for not shipping self-granted access to a public repo.
- Revisit if the platform bug is fixed and a concrete misuse case for autonomous
  `ebay-draft` invocation appears.
