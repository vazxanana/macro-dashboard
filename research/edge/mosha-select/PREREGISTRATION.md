# Mosha selection: which sweeps are worth taking? Pre-registration

Written and committed on 10 Nov 2026, before any number of this study was computed. Paper research only: no live rule,
size, filter or mirror setting is changed by this study, whatever it finds.

## Why

`research/edge/mosha-sweep/` found that the owner's pattern (a swept H1 swing, the M5 VR, its CF) prints about five times a
trading day and loses when every one is taken: −0.11R a trade at the CF, −0.21R at the zone, over 20 years. The owner's
own five example trades all won. So the open question is not the entry, it is the SELECTION: is there a simple condition,
visible when the order is placed, that separates the setups worth taking? The owner: "Keep going."

This is an investigation with a fixed, short list of conditions read from the owner's examples and words, and a
three-step time split so that a condition must be found on one period, hold on a second and still hold on a third. It is
not a search: no condition outside the list is tried, and no pair of conditions is combined.

What I already know, said plainly: the mosha-sweep result on the whole file (both entries lose in both of its windows).
I have not looked at any split of those trades by any condition.

## Data and candidates

The mosha-sweep candidates, unchanged: same detector (`research/edge/mosha-sweep/run.mjs` `detect`), same OANDA M5 file
(June 2006 to 9 Nov 2026), same two entries (CF and ZONE), same stops, targets, cost ($0.30) and M5 fills. A condition
filters the CANDIDATES; the one-at-a-time rule is then applied to what is left, so a filtered stream is what would really
have been traded.

## Periods

- **Discovery**: orders placed 2006-07-01 to 2012-12-31.
- **Validation**: 2013-01-01 to 2019-12-31.
- **Confirmation**: 2020-01-01 to the end of the file.

## The conditions (each known at the moment the order is placed)

1. **H4 direction** (`with` / `against`): the trade's side against the most recent H4 BO that had closed when the order
   was placed (a close beyond the last H4 swing, 3 candles a side, as in mosha-retrace). No H4 BO yet: the candidate is
   in neither cell.
2. **The level swept** (`h4` / `h1 only`): `h4` when the episode's extreme also went beyond an H4 swing level (3 a side)
   on the trade's side that was live when the sweep started (existing, under 30 days old, no H4 close through it).
3. **Session** of the order (`asia` 21:00-07:00 UTC / `london` 07:00-12:00 / `new york` 12:00-21:00).
4. **Room** (`far` / `near`): `far` when the target is 4R or more away. The examples' plans were 2.8R to 16R.

Nine cells per entry, eighteen in all. Each cell is its own stream.

**Implementation check, made before this file was committed** (`node run.mjs example`: the conditions of the last three
weeks' candidates, no result of any trade): the owner's 28 Oct sell (the CF order at 00:05 UTC on 29 Oct) reads
`against · h4 · asia · near`. The owner labelled that trade "with the H4 BO sell"; by this rule the last 3-a-side H4 BO
before it was a buy, so the rule calls it `against`. The rule stays as written: it is not bent to the label. The 10 Nov
sell is after the end of the candle file (9 Nov).

## The rule for a cell

- **Selected** on discovery: 100 or more trades and mean net R > 0.
- **Validated**: selected, and on validation 100 or more trades, mean net R > 0, and a one-sided p under 0.05 after the
  Holm correction over the cells selected on discovery.
- **Confirmed**: validated, and mean net R > 0 on confirmation with 100 or more trades.

## Verdict (fixed here)

- **PASS**: at least one cell is confirmed.
- **INCONCLUSIVE**: at least one cell is validated, none confirmed.
- **FAIL**: no cell is validated (including the case that none is selected).

All eighteen cells are reported for the three periods whatever happens. A confirmed cell is a proposal for a paper shadow
stream, not an edge to trade: it would still be one of eighteen.

## What happens next

Nothing changes live on any outcome.
