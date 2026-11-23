# Order blocks and fair value gaps, standard rules (pre-registration)

Written 23 Nov 2026 and committed ALONE before any run. Research only: nothing live reads it, it places nothing.

## Question

Do two textbook rules of "smart money" trading pick better limit entries than the plain resting-limit effect already
measured in `research/edge/dom-placebo` (any limit at a recent candle body made about +0.05 to +0.08R a trade before costs
on these years)?

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd.
2009 is warm-up; trades are counted by fill time from 2010-01-01 to 2019-12-31. Discovery half 2010-2014, confirmation half
2015-2019. H1 and H4 are UTC-aligned resamples of the 5-minute candles. Intervals excluded by `data-quality`
(`combo-grid-2` `exclusions`) drop a trade whose fill falls inside them. Costs: `combo-grid-2` `COSTS` (round trip, price
units). Closed candles only; no candle after the moment a signal is known is read to make it (a cut test pins this).

## Rules

ATR = ATR(14) of H1 at the candle where the signal becomes known.

**(A) Order block with displacement.** An H1 break of structure = `edgekit.structure(H1, 3)` event (a close beyond the last
confirmed, unbroken H1 swing, 3 candles a side; BO or ChoCh). For a break up at candle i whose broken swing high is at
index s: the impulse origin o = the lowest low among candles s+1..i (s if none). The order block = the last bearish candle
(close < open) at or before o, looking back at most 10 candles. Displacement: an H1 fair value gap inside the impulse, i.e.
some k with ob < k-1, k+1 <= i and low(k+1) > high(k-1). No displacement, no block. The block also needs no H1 close below
its low between it and the break. Zone = the block's wick range. Known at the break candle's close. Order: a buy limit at the
block's high (near edge), stop = block low - 0.1 ATR, target 2R, from the break close; it fills only on the first return
(5-minute candles), and dies at the first H1 close below the block's low or after 120 H1 candles. Breaks down mirror it.

**(B) FVG 50% fill.** A bullish H1 FVG = low(k+1) > high(k-1) (gap high(k-1)..low(k+1)), known at candle k+1's close, taken
only when the last closed H4 candle's `edgekit.structure(H4, 3)` side is up; bearish mirrors it with a down side. Order: a
limit at the gap's middle, stop = gap far side - 0.1 ATR (below high(k-1) for a buy), target 2R; it dies at the first H1
close through the far side or after 120 H1 candles. "Fresh": the order rests from the moment the gap is known, so only the
first return can fill it.

**Both**: every trade has a stop on the losing side; exits by `combo-grid-3` `multi()` (imported, not edited): stop first in
a candle that holds both, a limit's fill candle can only stop it, gaps fill at the open, 2R target, a 5-day time cap. A
trade whose risk is under one round-trip cost is skipped. No one-position rule: every block / gap gives at most one trade.

**Placebo** (per real zone, seeded): a random H1 candle among the 24 before the signal candle (excluding the order block
itself) of the same colour as the order block (bearish for a buy); a placebo zone of the same height as the real zone with
its near edge at that candle's body near edge (body top for a buy), on the right side of the price at the signal close
(below it for a buy). Traded exactly as the real zone: (A)'s placebo enters at its near edge with (A)'s stop and life; (B)'s
placebo (descriptive) uses a bullish candle for a bullish gap and enters at its middle. Seeds 2-5 reported for robustness.

## Tests (judged BEFORE costs, after-cost figures beside; Holm over T1-T3 on one-sided p)

- **T1** order blocks: mean R > 0 and calendar-month-sum t >= 2 in 2010-2014 AND in 2015-2019; Holm p (from the whole
  window's month t) < 0.05.
- **T2** order block minus its placebo (pooled, Welch on trades, plus the month t of the per-month difference): difference
  > 0 in both halves, whole-window Welch t >= 2, Holm p < 0.05.
- **T3** FVG 50% fill: as T1.

**Verdict**: PASS if (T1 and T2) pass, or T3 passes AND the FVG beats its own placebo (difference > 0, Welch t >= 2;
reported, not in Holm). Otherwise FAIL (INCONCLUSIVE only if a family has under 200 trades). Per market tables are
reported, not judged. Nothing found here becomes a rule without its own holdout test and the owner.
