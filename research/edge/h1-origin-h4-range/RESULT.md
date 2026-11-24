# An H1 break-origin zone, split by its place in the H4 dealing range (result)

**Verdict: FAIL. 0 of 4 cells pass; best aligned 2R, -0.063R a trade after costs in 2015-26 (n 6,470, month t -3.49; before costs +0.008R; discovery -0.053R, n 5,599, t -2.53).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing
is proposed. One run, no variants.

## What was run

On closed H1 candles, every close beyond the last confirmed swing high or low (3 candles a side); the zone is the last H1 candle
of the other colour before that break, wick to wick. A resting limit at the zone's near edge from the break candle's close, alive
5 days, first return only; stop past the far edge by 0.1 x ATR(14) of H1; targets 1R and 2R; out 5 days after the fill; a candle
holding stop and target is a stop. Each order is classed by its entry inside the H4 dealing range (the last confirmed H4 swing
low to the last confirmed H4 swing high): **aligned** = a buy in the lower half or a sell in the upper half, **opposite** = the
reverse. Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute candles, the demo account's round-trip costs.
Discovery = fills 2005-2014, confirmation = fills 2015 to October 2026.

Counts: 49,421 H1 breaks, 47,557 orders, 40,236 filled, of which 10,993 had their entry outside the H4 range (or no valid range) and are in neither class; 24 fills dropped by the data-quality exclusions.

## The four cells (R a trade; "before" = before costs, "after" = after costs; t = t of calendar-month sums after costs)

| cell | disc n | disc win | disc before | disc after | disc t | conf n | conf win | conf before | conf after | conf t | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aligned 1R | 5599 | 49.2% | +0.005 | -0.060 | -3.74 | 6470 | 49.4% | +0.006 | -0.065 | -4.30 | 1.000 | no |
| aligned 2R | 5599 | 33.3% | +0.012 | -0.053 | -2.53 | 6470 | 33.4% | +0.008 | -0.063 | -3.49 | 1.000 | no |
| opposite 1R | 8061 | 49.9% | +0.014 | -0.052 | -4.23 | 9113 | 48.5% | -0.015 | -0.086 | -7.57 | 1.000 | no |
| opposite 2R | 8061 | 34.1% | +0.030 | -0.036 | -2.01 | 9113 | 32.5% | -0.019 | -0.091 | -6.08 | 1.000 | no |

Month t before costs: aligned 1R 0.29 / 0.41; aligned 2R 0.57 / 0.44; opposite 1R 1.13 / -1.32; opposite 2R 1.72 / -1.31 (discovery / confirmation).

## The hypothesis itself: aligned minus opposite (after costs, Welch t on trades; no verdict)

| target | window | aligned - opposite (R) | Welch t |
|---|---|---|---|
| 1R | discovery | -0.008 | -0.42 |
| 1R | confirmation | +0.022 | 1.27 |
| 2R | discovery | -0.017 | -0.64 |
| 2R | confirmation | +0.028 | 1.19 |

## By market, confirmation (n, mean R after costs)

| market | aligned 1R | aligned 2R | opposite 1R | opposite 2R |
|---|---|---|---|---|
| xau | 1251, -0.106 | 1251, -0.105 | 1685, -0.162 | 1685, -0.160 |
| eurusd | 1329, -0.059 | 1329, -0.064 | 1925, -0.060 | 1925, -0.030 |
| gbpusd | 1423, -0.050 | 1423, -0.032 | 1853, -0.051 | 1853, -0.100 |
| usdjpy | 1220, -0.050 | 1220, -0.061 | 1789, -0.077 | 1789, -0.073 |
| audusd | 1247, -0.060 | 1247, -0.057 | 1861, -0.089 | 1861, -0.100 |

## Checks

- Cut test (orders made from candles cut at a moment against the full run's orders up to it, last 60,000 five-minute candles of
  each market, three cuts): 15 cuts, 0 differences.
- Every filled trade had its stop on the losing side of the fill (the run throws otherwise).

## Limits

- Mid candles: a limit counts as filled on a touch, which flatters a limit entry; the real result is at best what is shown.
- Today's demo costs are charged for every year. Trades overlap (several open at once), so a per-trade t would overstate; the
  month-sum t is the one judged.
- The split is by a mechanical H4 swing range (3 candles a side), not a range chosen by eye.
- Whatever is above, this is a paper study of one reading; no other swing size, zone, range or target is tried on these years.
