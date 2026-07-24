---
name: photos
description: Review a directory of product photos and recommend which to use in a marketplace listing and in what order. Use whenever the user has a folder of photos for an item they're selling and needs to pick the hero shot, rank the rest, and identify duplicates or skip-worthy shots. Trigger on phrases like "review these photos", "which photos should I use", "pick the best photos", "photo order for the listing", or when the /marketplace:listing orchestrator delegates photo selection. Optimizes for buyer scroll behavior: hero shot first, condition transparency in the middle, detail close-ups last.
---

# Marketplace Photos

Review every photo in a target directory and produce a ranked photo order for a marketplace listing, with explicit skips.

## When to use

Trigger automatically when:
- The user names a directory of product photos and asks for a recommended order
- The `/marketplace:listing` orchestrator delegates photo review
- The user is preparing a Facebook Marketplace or eBay listing and has photographed an item

## Required inputs

- **Photo directory** — Path to a folder containing image files. Default to `./Photos/` relative to the current item directory if not specified.
- **Item name** — Used to filter photos when the directory contains multiple items (filenames typically prefix the item, e.g., `Strider-12-SportBalanceBike-01.jpeg`).

If the directory is ambiguous and not derivable from context (e.g. the folder holds several items and the filename prefix doesn't disambiguate), ask which item — don't pick one. Surface it with options rather than guessing (see `${CLAUDE_PLUGIN_ROOT}/references/handling-ambiguity.md`).

## Process

### 1. Enumerate photos

List the directory and filter to images for the target item (typically by filename prefix). Sort by filename so numbering is stable.

**Cap the set you actually read.** The final listing wants only 5–8 photos, so reading 20+ full images is wasted context. If there are more than ~12 matching images, read the first ~12 in filename order — that's plenty to pick a hero, cover the main angles, and spot condition/duplication. Note in the output if you capped (e.g. "reviewed 12 of 20; the rest were additional angles").

**If the directory doesn't exist or contains no matching images**, stop here — don't invent filenames or a photo order. Emit a Block 1 that states no photos were provided plus a short shot list to capture before posting (hero 3/4, side profile, included extras, honest wear shots), and a Block 2 stating condition can't be assessed from photos. This is a normal outcome for items photographed later, not an error.

### 2. View every photo

**Downscale first (big speed + token win).** Phone photos are often 5–10 MB at full resolution — far more than is needed to judge angle, framing, lighting, or wear. Reading them at full size is the slowest, most token-heavy part of a listing run. Before viewing, generate temporary downscaled copies (~1024px on the long edge) and read *those* instead:

```bash
mkdir -p /tmp/resale-thumbs
for f in "{photo_dir}"/{ItemPrefix}-*.{jpeg,jpg,png}; do
  [ -e "$f" ] || continue
  sips --resampleHeightWidthMax 1024 "$f" --out "/tmp/resale-thumbs/$(basename "$f")" >/dev/null
done
```

(`sips` ships with macOS. On other platforms use `magick`/`convert` or skip this step.) Then `Read` the thumbnails for your analysis. **The recommended-photo table in your output must still reference the ORIGINAL filenames** — the thumbnails are only for your eyes; the buyer's listing uses the full-resolution originals. If downscaling isn't available, read the originals directly — it still works, just slower.

Read each image with the Read tool. Note for each:
- **Angle**: hero (3/4 view), profile (side), front, rear, top-down, detail close-up
- **Subject framing**: full item vs partial vs close-up
- **Lighting**: well-lit, harsh shadow, backlit, washed out
- **Condition visibility**: shows wear honestly? hides damage?
- **Duplication**: very similar to another photo? near-identical angle?
- **Distracting elements**: clutter, hands, feet, other items in frame

### 3. Rank and order

Two-phase ordering: **seduce first, then build trust.**

#### Positions 1–3: the seduction sequence (sells desire)

These photos exist to make the buyer *want the item* before they start scrutinizing it. Lead with the most flattering, most aspirational shots.

1. **Hero shot** — the single most visually appealing photo. Best lighting, best angle (usually 3/4 view), item fills the frame, clean uncluttered background. This is the thumbnail; it has to earn the click. If you're choosing between "well-lit and dynamic" vs "technically informative but bland," pick the bland-but-pretty one for position 1.
2. **Confirming hero** — second-best beauty shot. Different angle or side. Reinforces "this is a desirable thing" before the buyer starts looking for flaws.
3. **Full-item context** — front, rear, or three-quarter from another side. Shows scale and proportions, confirms what's being sold.

**Avoid in positions 1–3:** close-ups of wear, photos that look like inspection-report shots, anything that emphasizes a flaw before the buyer is hooked. If the only good photo of the item is a flattering one, position 4+ photos can be condition close-ups; positions 1–3 should not pull the buyer's eye toward a defect.

#### Positions 4+: the trust-building sequence (validates condition)

Now the buyer is interested. They'll scroll deeper to evaluate. These photos build trust through transparency.

4. **Condition close-ups** — tread wear, fabric condition, model number plate, anything material to value
5. **Detail / mechanism shots** — moving parts, key features in action
6. **Known issue disclosure** — if the item has any wear, damage, or missing parts, include a clear, honest shot here. Counterintuitively this *increases* conversion — buyers who self-disclose with the listing are far less likely to no-show or lowball at meetup. Transparency in the back half of the photo set doesn't kill the sale because the buyer is already committed; it just qualifies them.

Aim for **5–8 photos** in the final list. More than 10 dilutes attention. If the item has known issues, reserve at least one position 4+ slot for a transparent disclosure shot — never hide it.

### 4. Identify skips

Explicitly call out which photos to skip and why:
- Near-duplicates (pick the better of two similar angles)
- Unflattering light or angle
- Subject too small in frame
- Compositionally distracting

## Output format

Emit **two labeled blocks** so the orchestrator can extract each separately:

### Block 1: Photos (fills `{PHOTOS_BLOCK}`)

```markdown
## Recommended Photos

| Order | File | Description |
|---|---|---|
| 1 | {filename} | {one-line rationale — what this shot accomplishes} |
| 2 | {filename} | ... |

**Skip:**
- **{NN}** — {short reason}
- **{NN}** — {short reason}
```

### Block 2: Condition Observations (consumed by orchestrator, not the file)

Plain-text summary, 1–3 sentences, capturing condition signals visible in the photos. Examples:
- *"Frame paint clean, no visible scratches. Pneumatic tires show good tread. Seat in good shape, end caps present on handlebars."*
- *"Bottom panel has light scratches visible in photo 6. One rubber foot missing in the top-left corner. Screen clean, no dead pixels visible."*

Focus on what the **photos show** about wear, completeness, and damage — distinct from manufacturer specs or CSV `Notes`. The orchestrator merges this with CSV `Notes` to populate the listing's Condition Notes section.

If photos don't reveal anything condition-relevant (item too small in frame, lighting poor, only product shots), say so explicitly: *"Photos do not show enough detail for condition assessment beyond overall appearance."*

Return both blocks in your response, clearly labeled (`### Block 1` / `### Block 2`).

## Verification

Before returning, confirm every item:

- **Original filenames** — the recommended-photo table references the full-resolution ORIGINAL filenames, never the `/tmp` thumbnail paths used for viewing.
- **No invented files** — every filename in the table exists in the directory. If the directory was empty/missing, you emitted the no-photos stand-in instead of fabricating an order.
- **Seduce before scrutiny** — positions 1–3 are flattering full-item shots with no wear/defect close-ups; the hero leads.
- **Honest disclosure** — if the item has any known issue or visible wear, at least one position 4+ slot is a transparent shot of it (never hidden).
- **Right-sized set** — the final list is 5–8 photos, and every skipped photo is listed with a reason.
- **Two labeled blocks** — output is Block 1 (Recommended Photos) and Block 2 (Condition Observations, plain text).

## Notes

- Hero shot quality matters more than total photo count. If only one photo is genuinely great, lead with it and accept a shorter list.
- For items with known cosmetic issues (scratches, missing parts, wear, punctures), reserve one position 4+ slot for a transparent shot of the issue. Hiding it kills trust on inspection. Disclosing it qualifies buyers before the meetup.
- If photos look thin (everything from the same angle, no detail shots), say so and suggest what to re-shoot before listing.
- **The first photo determines whether the buyer clicks.** Spend disproportionate attention on hero-shot selection. The right hero can lift response rate 2–3x over a mediocre hero.
- When in doubt about position 1–3 ordering, ask: "would a buyer scrolling fast on their phone fall in love with this in 0.5 seconds?" If yes → position 1. If it makes them think "okay, what condition is this in" → position 4+.
