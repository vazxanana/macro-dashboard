# Barrier, QM, then the second break: entry at the engulf inside it (gold) — pre-registration

Written 23 Nov 2026, before any code and before any candle of a test window was read for this rule. Research only: nothing
live changes, no proposal follows from this file alone. Every rule below is described in this repository's own words.

## Why this test, and how it differs from what failed
The barrier entry was tested on the desks' code in `desk-rigor` (−0.113R a trade out of sample, t −2.12) and its exits in
`desk-exits` / `desk-partial` (FAIL). Those entries were a limit at the level the confirming QM broke, on every fresh
barrier, with or against the direction. Three things were never tested and are what this study adds: (1) the entry waits for
a SECOND break after the QM and enters on the engulf inside that second break's leg; (2) only barriers on the side of the
Daily structure; (3) the QM's head must turn inside the barrier zone. Nothing of 2020-26 is new for barrier entries in
general, so a 2010-2019 replication is part of the pass bar.

## The rule (gold, XAU/USD)
Timeframe pairs, fixed: **Daily barrier → H1 confirmation; H4 → M15; H1 → M5; M30 → M5.** (No M1 candles exist in the
cache, so the one-minute pairs are left out.) Candles: the toolkit's 5-minute OANDA gold candles, resampled UTC-aligned
(M15, M30, H1, H4); the Daily = `dailyNY` (17:00 New York days). Closed candles only; swings = `swings(bars, 3)`.
1. **Barrier zone** (on the barrier timeframe), two kinds, both read with `research/edge/_lib/edgekit.mjs`:
   - *Break-origin zone*: for each break of `structure(bars, 3)` (with or against the trend, so the break-against and
     break-back zones of the breakout sequence are included), the zone from the broken level to the extreme the break leg
     started from (for a break up: the lowest low between the previous swing high and the break candle). A break up makes a
     buy zone, a break down a sell zone.
   - *Engulf zone*: the last candle of the other colour; a candle at most 3 candles later that closes beyond its high (buy) /
     low (sell) completes it; the zone is that first candle, wick to wick.
   A zone is known from the close of the candle that completes it. It is **fresh** until the first barrier-timeframe candle
   (closed) that trades into it after it was made: that candle is the **touch**; only the first touch is used. A zone is gone
   if a candle closes beyond its far side before the touch, or after 100 barrier-timeframe candles.
2. **Direction**: the side of the Daily structure (`structure(dailyNY, 3)`, closed days) at the touch. Primary: buy zones
   only in a Daily buy structure, sell zones only in a sell structure.
3. **Confirmation**: a QM (`qms(bars, 3)`) on the confirmation timeframe with the zone's side, whose break closes within
   48 confirmation candles of the touch, and whose head (the extreme) lies inside the zone (for a buy zone [lo, hi]:
   lo ≤ head ≤ hi). A close beyond the zone's far side before the QM ends the setup.
4. **Second break**: after the QM's break candle, the first confirmation-timeframe close beyond a swing high (buy) / swing low
   (sell) confirmed after the QM's break, within 48 confirmation candles of it. A close beyond the QM head first ends it.
5. **Entry**: in the leg of that second break (from the lowest low after the QM break up to the second break candle, for a
   buy) the latest engulf zone of the trade's side (definition above, on the confirmation timeframe). A limit at its near edge
   (its high for a buy, low for a sell), placed at the second break's close, alive 24 confirmation candles; cancelled if the
   target is reached or a candle closes beyond the stop first. No engulf in the leg = no trade.
6. **Stop**: $0.30 beyond the QM head. Smallest stop $1.00 from the entry (else no trade). **Target**: the nearest swing high
   (buy) / low (sell) of the barrier timeframe confirmed by the second break's close and at least 2R from the entry; none =
   no trade. Time exit after 20 barrier-timeframe candles. Fills on 5-minute candles: a limit's fill candle can only stop the
   trade, stop first when one candle holds both, a gap through the stop fills at the open. One position at a time per pair.

## Data, costs, statistic
In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to the last cached candle; replication 2010-01-01 to
2019-12-31. Cost: toolkit `COSTS.xau` ($0.30 a round trip) taken off every trade, and buys held over a 22:00 UTC rollover pay
the council's gold financing (`council/fills.mjs` `financing`). R after costs = (exit − entry) × side − costs, over the
opening risk. Statistic: mean R a trade after costs, t on calendar-month sums (`stats`).

## Tests (four, Holm over their out-of-sample month p)
- **P (primary)**: the rule above, the four pairs pooled.
- S1: P without the direction filter (every fresh zone).
- S2: P with the QM head in the zone's near quarter (buy: head ≥ hi − 0.25 × (hi − lo)): a shallow turn at the edge.
- S3: P, buys only.

## Pass bar (each test)
Out-of-sample mean > 0 AND out-of-sample month t ≥ 2 with Holm-adjusted p < 0.05 AND in-sample mean > 0 AND out-of-sample mean
> 0 at 2x costs AND at least 30 out-of-sample trades AND 2010-2019 mean > 0 with month t ≥ 1.
- **PASS**: P meets every line. Even then: one study, not an edge on its own; a forward paper record with its own
  pre-registration would come next, owner's decision.
- **INCONCLUSIVE**: fewer than 30 out-of-sample trades for P; or P positive in sample and out of sample with out-of-sample
  month t between 1 and the bar; or only a secondary test passes (then a hypothesis for its own test on other data).
- **FAIL**: anything else (P's out-of-sample or in-sample mean ≤ 0, t under 1, negative at 2x costs, or negative on 2010-2019).

## Fixed before the run, never changed after it
Swing size 3, the 3-candle engulf, the 100 / 48 / 48 / 24 / 20 candle windows, $0.30 buffer, $1.00 smallest stop, 2R
smallest target, the four pairs. Checks the code must pass first: no look-ahead (every setup equals the one found when the
candles are cut just after it, and changing every later price moves nothing earlier), every trade has its stop on the losing
side. Results are reported in full (n, mean, t, by year, by pair, buys / sells), whatever they are.
