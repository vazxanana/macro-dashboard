# Evening box fade plus: can the 20-23 UTC M15 box close-out fade pay its costs? (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/evening-methods` (23 Nov 2026) found one reading that passed its before-cost bar: fading the M15 box close-out
when the close-out candle starts 20:00-23:59 UTC (R5): +0.245R a trade in 2005-14 and +0.236R in 2015-26 before costs. After
costs it lost: -0.108R and -0.185R a trade, negative in every market in 2015-26. Its stop sits just past the close-out candle,
so one round trip is a large share of 1R (about 0.35-0.42R a trade). What is missing is the cost, not the direction. This study
asks, after costs: does a wider stop, another target, or agreement with the owner's other fades (the plain fade of the first
break, the faded engulf touch, the faded Mosha CFs, the zone flip), or leaving out the rollover fills, turn the evening box fade
positive after costs, and does the one variant chosen hold on markets this reading never saw?

## Data

- OANDA mid 5-minute candles (`research/edge/_lib/edgekit.mjs`, `EDGE_DATA`), loaded from 2004-01-01; windows by fill time
  A = 2005-01-01..2014-12-31, B = 2015-01-01..2026-10-31; month sums with empty months as 0; `combo-grid-2` `exclusions`.
- **Screen markets (already read by evening-methods, in sample):** xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad,
  usdchf, eurjpy.
- **Holdout markets (never used for the box fade or any hour split):** gbpjpy, audjpy, cadjpy, eurgbp, euraud. Said plainly:
  `fade-new-markets` already read the plain whole-day fade on these five; the box close-out and the evening window were not.
- Costs: `combo-grid-2` `COSTS`, one flat round trip a market, in price. Measured on the demo for xau, eurusd, gbpusd, usdjpy,
  audusd; ASSUMED for xag, nzdusd, usdcad, usdchf, eurjpy and for all five holdout markets. A trade whose risk is under one round
  trip is skipped. **Everything here is judged AFTER costs**; before-cost figures sit beside.

## The base signal (fixed, from evening-methods R5)

`grid7-box-fade` `boxEvents` on M15 (box from `edgekit` `boxesHL(M15, 2)`), the close-out event (a close beyond the box, direction
d), signal candle starting at UTC hour 20, 21, 22 or 23; trade -d at the open of the next 5-minute candle; out at the stop, the
target, or after 24 hours (the source's cap); stop first when one 5-minute candle holds both. Closed candles only.

## The screen: 3 stops x 4 targets x 4 filters = 48 variants

- Stop: **S1** past the close-out candle's extreme by 0.1 x ATR(14, M15) (as R5); **S2** 1 x ATR(14, M15) from the fill (the plain
  fade's stop); **S3** 2 x ATR(14, M15) from the fill. Always on the losing side (the run throws otherwise).
- Target: **1R**, **2R**, **3R**, **box** = the box's other edge (no trade in that slot when it is under 1R away).
- Filter: **none**; **+fade** = the same M15 candle is also a first structure break that the plain fade (evening-methods C)
  fades on the same side; **+other** = at least one other fade reading of evening-methods (R2 faded engulf touch, R7 faded Mosha
  CF M30>M5, R9 faded Mosha CF H1>M15, R10 zone flip) has a trade on the same side with a fill in the 60 minutes up to and
  including this fill; **no-roll** = fill outside 21:00-22:59 UTC.

Choice rule (fixed now): a variant is eligible when, after costs, n >= 300 and mean R > 0 in A AND in B. The chosen variant is the
eligible one with the largest min(after-cost month t in A, in B); ties by the larger pooled n. If none is eligible the study
stops: verdict FAIL, the holdout is NOT read.

## The holdout test (one test, the chosen variant only)

On the five holdout markets, 2005-01 to 2026-10, after costs: PASS when all of
1. pooled mean R > 0 and month-sum t >= 2 over the whole span;
2. mean R > 0 in A and in B;
3. mean R > 0 at 1.5 x the cost (a margin for assumed costs);
4. positive after costs in at least 3 of the 5 markets.

Verdict: PASS (holdout passes), FAIL (none eligible, or the holdout fails), INCONCLUSIVE (holdout n under 300).

## Checks

- Gate: the base (S1, 2R, none) on the screen markets reproduces evening-methods R5's evening n and mean in A and B.
- Cut test: on two markets, the trade specs whose fill candle is known by five dates equal on candles cut there.

## What it will not say

Even a PASS is not an edge: costs are one flat figure a market, and the 20-23 UTC hours include the rollover where real spreads
widen; the next step would be the broker's own evening bid / ask (the tick probe) and a forward paper record with its own
pre-registration. No variant outside the 48 is tried, and no window, market or hour is changed after the run.
