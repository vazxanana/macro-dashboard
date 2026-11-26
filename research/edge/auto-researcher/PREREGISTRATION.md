# Auto-researcher: five workers searching rule combinations around the clock (pre-registered 24 Nov 2026)

Written and committed alone, before the engine ran. Paper research only: nothing here trades, alerts or changes a rule. Results
go to council-data `research/auto/`, never to main.

## Why

The owner asked for a researcher that never stops, tries "a million simulations of different combinations" and thinks out of the
box, with five workers. A million tries on the same years WILL produce winners by chance, so the protocol below counts every
try and makes a winner prove itself on years it was never searched on.

## The search

Five workers (GitHub Actions jobs, `researcher.yml`), each a seeded random generator of rules over H1 OANDA mid candles of ten
markets (xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag), costs from `research/edge/_lib/edgekit.mjs` `COSTS`
(round trip, charged in R), entry at the next open after the signal, stop first when one candle holds both, a candle opening
beyond the stop exits at its open, one position at a time per rule.

A rule = trigger + filters + exit. Triggers (the worker's family): **brk** (close beyond the prior N-bar high / low, followed),
**fade** (the same, traded the other way), **pull** (a moving-average trend with an RSI pullback), **big** (a candle over k ATR,
faded or followed), **blk** (a break of the previous clock block's range, followed or faded), **dev** (a close z ATR from its
moving average, faded or followed), **eg** (the owner's engulf: a candle closing beyond the high / low of the nearest opposite
candle within the 3 candles before it, first close only; followed or faded), **sweep** (a wick through the prior N-bar high
or low that closes back inside: traded as the reversal, or against it), and for the "wild" worker two triggers that must agree on the side. Filters: UTC hour
window, weekdays, trend with / against the 200-bar average, ATR percentile below / above. Exit: stop 0.5-3 ATR, target 0.5-6R or
none, a time limit of 4-240 candles. Side: long, short or both. The grids are in `engine.mjs` (`SPACE`); nothing is added after
a run starts.

Workers: 1 brk + fade + eg, 2 pull + dev, 3 big + blk + sweep, 4 all families, 5 wild (two triggers). Seeds differ by worker and by chunk. Version `auto-1`; adding the `eg` and `sweep` triggers happened before any run.

## The three stages (windows by entry date)

- **Stage A, search: 2005-2014.** Every try is scored here. It survives with n >= 250, mean net R >= 0.04 and a month-sum t >= 3.0.
- **Stage B, validation: 2015-2019.** A survivor needs n >= 100, mean net R > 0, month-sum t >= 1.5, and its side-flipped twin
  (placebo) must have mean net R < 0 on A. Passing A and B = a candidate.
- **Stage C, holdout: 2020 to the day of the run.** Never searched. Candidates are grouped by market, trigger and side; ONE
  member per group, the first to reach C, is looked at on C, once. Pass: n >= 100, mean net R > 0, month-sum t >= 2.0, and a
  Holm-adjusted p < 0.05 over every group looked at on C so far.

## What is counted and reported

Every worker's counters: tries, A survivors, B candidates, C looks, C passes; the trial count is the SUM over workers. With T
tries the chance count at A is roughly T x 0.0013 (one-sided p at t 3), at B about 7 % of those, so the file reports the
expected number of chance candidates beside the real one. A C pass is the only thing called a **lead**, never an edge: a lead
goes to a pre-registered forward record before anyone trades it.

## Honesty rules

No threshold, grid, window or stage changes after a run starts; a change is a new version (`VERSION`), counted separately.
Results are never edited. The ledger keeps every C look, passes and fails. A rule that depends on a stop being absent is not
generated: every rule has a stop.

## Four more workers (25 Nov 2026, owner: "add more 4 helpers to the researcher to speed it more")

Workers 6-9 join workers 1-5, **version `auto-1` unchanged**: the same grids, windows, bars, stages and Holm rule; nothing in the
search space, a threshold or a stage changed. Only the seeds differ (`worker * 1000003`). Their families: 6 and 7 wild (two
triggers that must agree, the largest space), 8 all families, 9 big + blk + sweep. This is more tries, not another search:
every try is still counted and the report sums all nine files, so the chance count and the Holm correction over every C look
grow with the tries. A group that two workers both reach is looked at once per worker file and each look counts in Holm. No
result so far is edited or discounted by the change.


## Two market-structure workers (26 Nov 2026, owner: "Tell the researcher to look the edges following market structure")

Written and committed before any structure rule is run. Workers **11** and **12** join; the windows, bars, three stages, the
one-look-per-group rule, the costs and the Holm rule over every C look of every file are unchanged, and workers 1-10 draw
exactly the rules they drew before (their generator is not touched). The search space GROWS by three triggers and one filter
that only workers 11 and 12 can draw, so their tries are a new part of the search: they are counted in the same totals and the
same Holm correction (which makes every lead's bar stricter, never looser), and their looks are told apart by the worker number.

**Structure, from closed H1 candles only.** A swing high is a candle whose high is strictly above the highs of the `P` candles
before it and at or above the `P` after it (swing low mirrored); it exists only once its `P`-th following candle has closed. The last
confirmed swing high and swing low not yet closed beyond are the two levels. A close above the swing high is a break up, a
close below the swing low a break down; a broken level is spent. The structure's direction is the direction of the last break.
- **bos** (break of structure): a break in the direction the structure already had (continuation). Followed or faded.
- **choch** (change of character): a break against the direction the structure had (the first break the other way). Followed or faded.
- **mspb** (pullback in structure): with the structure up, a candle that is not a break, closes above its open, and whose low
  has retraced at least `d` of the leg from the leg's origin (the lowest low between the broken swing high's candle and the
  break) to the highest high since the break, without trading below that origin: a buy. Mirrored for a sell.
- Filter **ms** (the larger structure): the direction of the same structure read with a larger swing size `msP`; a rule may
  require its side to agree with it (`with`), to oppose it (`against`), or not read it (`none`).

Grids, fixed now: `P` in {2, 3, 5, 8}; `d` in {0.382, 0.5, 0.618, 0.786}; `msP` in {8, 12, 20, 30}; `ms` none / with / against
(with twice as likely as each other). Every other filter, exit and side grid is the one of `SPACE`.

Worker 11: one structure trigger. Worker 12: a structure trigger together with a second trigger that must agree on the side
(another structure trigger with a different `P`, or one of the eight older kinds). Markets: the ten of `MARKETS` and the Nasdaq
100 (`nas100`, at the NQ worker's cost setting: none charged, so every Nasdaq figure is BEFORE costs). A lead from these
workers is, like every lead, re-priced at the broker's own quotes before it means anything.

Runner budget: the workflow already uses the 20 jobs a free plan allows, so workers 7 and 9 (duplicates of 5 / 6 and of 3)
stop drawing and their runners go to 11 and 12; the files of 7 and 9 stay and are still counted.
