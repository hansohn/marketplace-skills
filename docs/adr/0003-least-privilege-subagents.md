# 0003 — Run the heavy phases as least-privilege subagents

**Status:** Accepted

## Context

The two slowest, most context-heavy phases of a listing run are pricing (large eBay
page text) and photo review (token-heavy image reads). Run inline, both dump their raw
material into the orchestrator's context, crowding out the assembly logic — and a
compaction pass keeps only the first ~5,000 tokens of each invoked skill, so bloat is
not free. Both phases also need only a narrow slice of tools.

## Decision

Ship two named agent personas — `comps-researcher` (browser + web + read, **no
file-write**) and `photo-reviewer` (`Read` + `Bash` only, no network, no file-write) —
and have the `listing` orchestrator launch them as background subagents, collecting only
their two labeled Markdown blocks. The orchestrator degrades to inline execution when a
harness can't spawn subagents (identical result, heavier context).

## Consequences

- **Clean orchestrator context** — raw eBay HTML and image bytes stay in the subagent;
  only the distilled blocks return.
- **Least privilege** — the scraper cannot write files and the photo reviewer cannot
  reach the network, limiting blast radius. This is a deliberate posture we protect (see
  ADR [0005](0005-invocation-control-and-tool-grants.md) on not auto-granting tools).
- **Concurrency** — the two independent phases run in parallel, roughly halving
  wall-clock time.
- Requires maintaining agent definitions in lockstep with the skills they run; the
  fallback-to-inline path keeps the agents an optimization, never a hard dependency.
