# Example fixture

A self-contained sample so you can see what the plugin produces — and the fixture the
behavioral evals point at (see `skills/listing/evals/evals.json`).

## What's here

```
examples/garage/
├── inventory.csv                    # 2-row sample inventory (current column schema)
├── Strider-12-Sport-generated.md    # real, sanitized generated output for row 1
└── Photos/                          # bring your own images (see below)
```

- **`inventory.csv`** demonstrates the full column schema, including the two features the
  evals exercise: a **known-issue disclosure** (the Strider's seat puncture) and the
  **includes filter** (the UPPAbaby keeps *bassinet / rain shield / original box* but drops
  integral parts like *canopy / basket*).
- **`Strider-12-Sport-generated.md`** is actual `/marketplace:listing` output, sanitized for
  the repo: an example location (`Phoenix, AZ 85016`) and no personal data. Prices are a
  point-in-time snapshot — a live run pulls fresh comps and dates.

> **Note on filenames.** These fixtures are deliberately *not* named `garage.csv` or
> `{ItemPrefix}-Listing.md` — the repo's `.gitignore` defensively blocks those patterns so a
> real personal CSV or listing can never be committed by accident. A live run still writes
> the normal `{ItemPrefix}-Listing.md` (e.g. `Strider-12-SportBalanceBike-Listing.md`) into
> *your* working directory; only these committed samples carry the renamed, non-colliding
> names.

## Photos are not committed

Product photos are yours (and bulky), so none ship here. To run the photo-ordering step or
the behavioral evals end-to-end, drop images into `examples/garage/Photos/<item>/`, named
`{ItemPrefix}-NN.jpeg` — e.g. `examples/garage/Photos/Strider/Strider-12-SportBalanceBike-01.jpeg`.
Without photos, the `photos` skill emits a shot-list stand-in rather than inventing filenames,
so the rest of the listing still generates.

## Try it

```
/marketplace:listing examples/garage/inventory.csv --platforms=fb --location="Phoenix, AZ 85016"
```
