# Grid 6: does stacking context signals help an H1 trigger? (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run. Research only: nothing live reads it, nothing is placed.

## Question

At every H1 trigger, count how many of ten independent context signals agree with the trigger's side. Is the mean R of the
trade a rising (monotone) function of that count, and do trades with a high count (score >= k) make money before costs in
2010-2014 AND again in 2015-2019? Each single signal's own effect is reported beside, so the owner sees which pieces add
anything.

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
2009-01-01 to 2019-12-31 (2009 is warm-up only: no trade fills before 2010-01-01). Timeframes built from the 5-minute
candles with `combo-grid-3` `frames` (UTC-aligned H1 / H4 with `resample`; the Daily trading day with `dailyNY`, 17:00 New
York). The data-quality exclusions (`combo-grid-3` `exclusions`) drop any trade that fills inside a listed interval. Costs:
`combo-grid-2` `COSTS` (round trip in price units). Discovery = fills 2010-2014, confirmation = fills 2015-2019 (60 months
each).

## Triggers (H1, closed candles only)

- `sb`: an H1 structure break, `edgekit` `structure(H1, 3)` (a close beyond the last confirmed swing, 3 candles a side; BO or
  ChoCh). Side = the break's direction.
- `box`: an H1 box close-out, `edgekit` `boxesHL(H1, 3)` (a swing low to a swing high, ended by a close outside). Side = the
  close-out's direction.

The trigger time ts = the close of the trigger candle. When both fire on the same candle with the same side it is ONE trigger
(tagged both). Trigger stop level: `box`: the box's other side; `sb` only: the last H1 swing of the other type confirmed at or
before the trigger candle (a buy: the last swing low).

## The ten context signals (each 0 / 1 for the trigger's side, from candles closed at ts only)

Daily zones come from `combo-grid-3` `buildZones` on the Daily candles (imported, not edited); a zone serves its side from the
close that makes it known until a Daily close through its far side (or its life ends). "Touched" = an H1 candle among the last
24 closed H1 candles (the trigger candle included) that starts after the zone was known and before it died trades into it.

1. `eg`: a Daily engulf zone of the side (`buildZones('eg')`) touched.
2. `dom`: a Daily dominant zone of the side (`buildZones('dom')`) touched.
3. `sd`: a fresh Daily supply / demand zone of the side (`buildZones('bar')`, the origin candle of a Daily structure break)
   whose FIRST touch by an H1 candle is among those 24 candles.
4. `msnr`: the MSNR call (`council/eg-methods.mjs` `direction()`, imported, read through `grid5-msnr-box` `h4Calls`: H4
   working candles, Daily key levels) on the last H4 candle closed at ts equals the side.
5. `h4`: the H4 structure side (`edgekit` `structure(H4, 3)`, the definition `phase.mjs` reads) equals the side.
6. `d1`: the Daily structure side (`structure(D1, 3)`) equals the side.
7. `h4box`: the last H4 box (`boxesHL(H4, 3)`) that closed out by ts closed out on the side.
8. `half`: price (the trigger close) in the discount half of the H4 external range for a buy, the premium half for a sell.
   External range as `phase.mjs` reads it: the leg of the last H4 break (a break up: from the lowest low between the broken
   swing and the break to the highest high since). 0 when H4 has no break yet.
9. `ef`: a failed opposite Daily engulf zone (EF) serving the side (`buildZones('ef')`) touched.
10. `ny`: ts falls in 12:00-17:00 UTC.

Count = the sum, 0 to 10.

## Trades

- Entry at market: the open of the first 5-minute candle starting at or after ts; that candle counts fully.
- Stop: past the trigger's stop level by 0.1 x H1 ATR(14) known at ts. A trade whose stop is not on the losing side of the
  fill, or whose risk is under one round trip of cost, is not taken. Every trade has a stop.
- Exits (`dom-trade-through` `manage`, imported): `1R`, `2R`, `trail` (the stop trails 1R behind the best price once +1R is
  reached; no target). All out at the close of the 5-minute candle 2 days after the fill. A candle that holds stop and target
  is a stop; a candle opening past the stop exits at its open.
- Each trigger is its own trade (no one-at-a-time rule).
- Placebo: the same triggers with the same counts, the side flipped: the same fill, the stop mirrored around the trigger
  close (the same distance on the other side).

## Judged BEFORE costs (after-cost figures beside), month-sum t

Monthly sums of R (empty months 0) over the 60 months of each half; month t = mean / (sd / sqrt 60).

**Primary test, one per exit (3 tests): the slope of R on the count.** OLS of trade R on the count, standard error clustered
by fill month. Passes when the slope is > 0 with cluster t >= 2 in BOTH halves. p = the larger of the two halves' one-sided
p values.

**Bucket tests (6 per exit, 18): score >= k for k = 3, 4, 5, 6, 7, 8.** A bucket passes with n >= 100 in each half, mean R > 0
and month t >= 2 in BOTH halves. p = the larger of the two halves' one-sided month-t p values.

Holm over all 21 tests (3 slopes + 18 buckets), alpha 0.05. The same 21 tests are run on the placebo.

**Verdict:** PASS when at least one of the 21 tests passes after Holm and its placebo twin does not; INCONCLUSIVE when a real
test passes and its placebo twin passes too; FAIL when none passes.

Reported beside, not judged: R by count 0..10 in both halves (n, mean, month t), Spearman rank correlation of count with mean
R per half, the expected number of raw passes by chance (a test with no effect passes a one-sided t >= 2 about 2.3 % of the
time per half, so about 0.05 % for both), each single signal's effect (with vs without, mean R and Welch t per half, every
exit), per trigger type, per market, and all after costs. A cut test: the triggers and counts before five cut moments are the
same when the candles stop at the cut.

A pass is a before-cost tilt on 2010-2019, never an edge; nothing live changes.
