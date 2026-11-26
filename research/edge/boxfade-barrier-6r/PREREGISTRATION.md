# Pre-registration: boxfade-barrier-6r (26 Nov 2026)

Written and committed alone, before any trade of this study was computed. Paper research only: nothing live reads it and no
rule of a desk, the Trader, the mirror or a demo job changes.

## Why

The owner asked (26 Nov 2026): "Why not use box fade for entry for barrier 6", then "Run". The Mosha desk's barrier entries
with a 6R target are about zero before costs on gold (`research/edge/mosha-barrier-6r`, `mosha-6r-quality`); the Equinox Box
fade is a few hundredths of an R before costs with its own 1R target (`fade-breaks-holdout` F1, `equinox-cost-ratio`). The
question: does a Box fade signal, used as the ENTRY at a Mosha barrier, with the barrier's 6R target, make money on gold after
costs?

## Data

OANDA mid gold (`xau`) 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`, outside git) and its raw
UTC daily candles. Nothing is fetched. Run year by year, 2018 to 2026.

- **In sample**: fills 2018-01-01 to 2021-12-31.
- **Out of sample**: fills 2022-01-01 to 2026-10-31 (the split of `mosha-6r-quality`).

## The Box fade signal (the study's code, imported, not edited)

`research/edge/grid6-box-in-box/run.mjs` `signals()` on `combo-grid-3` `frames(M5)`, the cell of `fade-breaks-holdout` F1 as the
tracker's `boxfade` adapter reads it (`council/edge-desks-2.mjs` `boxTrades`): chain H1-M15-M5, trigger "out" (an M5 box
closes out the same way as the last H1 box close-out), session "other" (the close outside 07:00-17:00 UTC: **the rule's own
hours filter is KEPT**). Close-out side d; the fade's side s = −d. Fill = the open of the first 5-minute candle at or after
the signal candle's close. Stop = the box trade's stop (the box's other side −/+ half the cost) mirrored around the signal
close, exactly as the adapter. The adapter's own skips are kept (the un-faded stop at least 2 costs from the signal close; the
filled risk above zero and at least one cost) and one is added, as the engine studies do: **a trade whose filled risk is under
twice the cost ($0.60) is skipped.** Every stop is on the losing side of its fill or the trade does not exist.

## The barriers (the desk's code, imported, not edited)

`assets/mosha-sop.js` `zonesOf(tf, B, F1)` with the page's analysis functions (`council/mosha-desk.mjs` `loadFns`) in the
one-candle structure the 6R reading uses (`oneCandle(F)`), on the barrier timeframes D1, H4, H1, M30 and M15: the BO / iBO
origin boxes and the engulf (EG) boxes, each with its side (buy / sell) and the moment it is known (`known` = the close of the
candle that made it). Candles as `mosha-barrier-6r` builds them (UTC buckets from the 5-minute candles through its exported
`group`; raw UTC days; per year, each timeframe reaching back the desk's own `BACK` days before 1 January). The desk's size
rule is kept (a zone taller than $0.50).

A zone is **standing** at a moment T when: it was known at or before T; no candle of its own timeframe that closed at or
before T (from the zone's `known` on) has closed through its far side (below a buy zone's low, above a sell zone's high: the
desk's own "broken" test); and it became known at most `BACK[tf]` days before T (D1 1500, H4 260, H1 90, M30 60, M15 40: the
desk's own look-back, so the result does not depend on where a yearly run starts).

Left out, said here: the swept-swing barriers and the CF / VR zones the sequence hands to the barrier entry (they carry no
"broken" moment of their own in the desk's code), and the desk's own confirmations at a barrier (QM, Janda, tap), which the
Box fade replaces: that is the question.

## The rule under test (primary)

A Box fade signal is taken when, at its signal close T:

- (a) the fill price is inside a standing barrier zone, or within 0.25 x ATR(14) of the 15-minute candles closed by T of its
  near edge (a buy zone: low <= fill <= high + 0.25 ATR; a sell zone: low − 0.25 ATR <= fill <= high), and
- (b) the fade's side equals that zone's side (a buy at a buy barrier, a sell at a sell barrier).

Stop = the Box fade's own stop. Target = 6R from the fill. Out at the close of the first 5-minute candle that ends 5 days or
more after the fill. Managed in the order of the tracker's `walk()` (imported): after the fill candle an open beyond the stop
exits at the open and an open beyond the target at the open; then the stop, then the target, then the time limit. **One
position at a time**: a signal whose fill comes before the open trade's exit candle has ended is not taken. Where several zones
qualify, the trade is labelled with the highest timeframe's (D1 first), for the tables only.

## Controls (same signals, fixed here)

- **C1**: the Box fade signals that are NOT at a barrier under (a) and (b), with the same stop, 6R target, 5-day limit and
  one-at-a-time rule (their own stream).
- **C2**: the Mosha desk's own 6R barrier entries of `mosha-6r-quality` on the same windows (its year files, net of the same
  cost; every entry, as that study counted them).
- **C3**: the at-barrier Box fade with the Box fade's own exit instead: a 1R target and the 1-day limit, one at a time.

## Costs

$0.30 a round trip (the toolkit's gold cost): net R = R − 0.30 / filled risk. Also reported at twice the cost ($0.60).

## The one test

Net R a trade of the primary on the out-of-sample window; t = the t of calendar-month sums (months with a trade).

**PASS** only if all hold: out-of-sample mean net R > 0; month t >= 2; n >= 100; in-sample mean net R > 0; out-of-sample mean
net R > 0 at twice the cost; and out of sample the primary beats C1 (Welch t of the per-trade net R >= 2).
**TOO FEW** if the primary has under 100 out-of-sample trades. **FAIL** otherwise.

A trade still open at the end of the candles is left out and counted.

## Reported beside, not judged

Win rate; R before costs; the cost as a share of risk (median); by year; by the barrier's timeframe and kind (BO origin, iBO
origin, EG); C1, C2, C3 in both windows; context only: the Box fade signals at a standing barrier of the OPPOSITE side, and
the primary with the hours filter dropped (any hour), each with 6R and one at a time. A cut test: with every candle after a
fixed moment removed, the trades that closed before it (side, fill time, fill, stop, barrier label, result) are unchanged.

No variant (another target, distance, timeframe set, hours rule or market) is tested on these years after this run.

## Amendment (26 Nov 2026, committed alone before any result was read)

The first run of one year counted how many Box fade signals qualify as "at a barrier" under the text above, and nothing else
(no R, win rate or outcome of any trade was printed or read): 1,995 of the 2,009 signals of 2018. With every unbroken zone of
five timeframes standing for up to 1,500 days, almost any price is inside some zone of the right side, so the condition
selects nothing and C1 would be empty. That is not how the desk uses a barrier: it acts when price COMES BACK to the zone (the
first return and each later visit) and watches for 60 candles of the barrier's confirmation timeframe (`BARRIER_WATCH`,
`BARRIER`, `BARRIER30`). Condition (a) is therefore tightened to the desk's own notion; everything else above stands.

A zone must also be **in play** at T: a **return** R of price to it exists with R <= T < R + the watch, where

- a return = the close of a 5-minute candle that trades into the zone (a buy zone: low <= the zone's high; a sell zone: high
  >= the zone's low) when the zone is waiting for one. A zone waits for a return from the moment it is known (the first
  return), and again each time a candle of its own timeframe has closed wholly outside it on the side price came from (a buy
  zone: the candle's low above the zone's high; a sell zone mirrored): the desk's rule for a later visit. Only candles closed
  by T are read; a zone broken by T has no return after its break.
- the watch = 60 candles of the confirmation timeframe of the desk's tables: a D1 barrier 60 hours (H1), H4 15 hours (M15),
  H1 5 hours (M5), M30 5 hours (M5), M15 1 hour (M1).

So the primary takes a Box fade signal when its fill is inside (or within 0.25 x ATR of the near edge of) a standing zone of
its own side that price returned to within that zone's watch. C1 = the Box fade signals for which no such zone exists. The
"opposite side" context row uses the same in-play rule. The test, the bar, the windows, the costs and the controls are
unchanged. No other change will be made.
