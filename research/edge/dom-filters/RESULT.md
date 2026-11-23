# Filters on the H1 dominant-zone limit, 2010-2019

**Verdict: FAIL. 0 of 13 filters pick better trades in both halves; the unfiltered rule itself made +0.0548R a trade before costs (n 151045, month t 14.23) and -0.052R after costs.**

Run 23 Nov 2026 as pre-registered (PREREGISTRATION.md, committed alone before the run). Paper research only: nothing live changed.

## What was run

The H1 dominant-zone limit of combo-grid-3 (no trigger, limit at the near edge, stop past the far side by half the cost + 0.25 x ATR(14) of H1, trailing exit), the exact trade list of dom-zone-holdout (checked trade by trade per market at run time), on OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy, audusd, fills 2010-01-01 to 2019-12-31: 151045 trades. Each of combo-grid-3's 13 filters (computed as runMarket computes them, from candles closed at the touch; a cut test in tests/dom-filters.test.mjs) splits them into kept and dropped. Test: kept minus dropped R a trade > 0 with Welch t >= 2 in both 2010-14 and 2015-19, Holm over 13, judged before costs.

## Reference: the rule unfiltered

| | n | Before costs (month t) | After costs (month t) |
|---|---:|---:|---:|
| 2010-19 | 151045 | 0.0548 (14.23) | -0.052 (-12.05) |
| 2010-14 | 75351 | 0.0596 (12.15) | -0.0398 (-7.07) |
| 2015-19 | 75694 | 0.05 (8.45) | -0.064 (-10.37) |
| xau | 27965 | 0.0298 (3.06) | -0.1532 (-14.41) |
| eurusd | 30514 | 0.0611 (7.48) | -0.0175 (-2.04) |
| gbpusd | 30197 | 0.057 (6.36) | -0.0262 (-2.9) |
| usdjpy | 30335 | 0.066 (8.31) | -0.0481 (-5.65) |
| audusd | 32034 | 0.0578 (6.08) | -0.0244 (-2.52) |

Other exits, 2010-19 before costs: trail 0.0548 (t 14.23), 1R 0.0454 (t 13.83), 2R 0.049 (t 10.3), 4R 0.0523 (t 7.3). After costs every exit loses (gold worst, -0.1532R).

## The filters (trailing exit, before costs)

| Filter | Kept share | Kept minus dropped 2010-14 (Welch t) | 2015-19 (Welch t) | Holm p | Kept trades 2010-19 before (month t) | After costs, diff 2010-14 / 2015-19 |
|---|---:|---:|---:|---:|---:|---:|
| struct | 0.56 | 0.0098 (0.98) | -0.024 (-2.43) | 1 | 0.0516 (8.77) | 0.0123 / -0.0184 |
| structUp | 0.546 | 0.0102 (1.03) | 0.0088 (0.9) | 1 | 0.0591 (9.45) | 0.0131 / 0.0137 |
| msnr | 0.54 | 0.0019 (0.19) | 0.0038 (0.38) | 1 | 0.0561 (8.93) | 0.006 / 0.0088 |
| d1eg | 0.533 | -0.0144 (-1.45) | 0.0057 (0.58) | 1 | 0.0527 (8.29) | -0.0125 / 0.0075 |
| weekly | 0.516 | -0.0171 (-1.73) | -0.0159 (-1.62) | 1 | 0.0468 (6.68) | -0.0151 / -0.0142 |
| er20 | 0.491 | -0.0151 (-1.53) | -0.0145 (-1.48) | 1 | 0.0475 (7.94) | -0.0101 / -0.0118 |
| er35 | 0.227 | -0.0122 (-1.06) | -0.0245 (-2.02) | 1 | 0.0413 (4.28) | -0.0066 / -0.0241 |
| weeklyEr20 | 0.257 | -0.0173 (-1.56) | -0.0047 (-0.42) | 1 | 0.0467 (4.56) | -0.0127 / -0.0021 |
| london | 0.235 | -0.0168 (-1.42) | 0.0149 (1.29) | 1 | 0.0541 (6.33) | -0.0231 / 0.0081 |
| ny | 0.25 | 0.0063 (0.54) | -0.0191 (-1.68) | 1 | 0.0496 (6.12) | 0.0136 / -0.0128 |
| sideways | 0.436 | 0.0343 (3.44) | 0.0161 (1.62) | 0.678 | 0.0689 (11.65) | 0.0373 / 0.0181 |
| half | 0.51 | -0.031 (-3.13) | -0.0059 (-0.6) | 1 | 0.0458 (7.7) | -0.0377 / -0.0151 |
| boConf | 0.286 | -0.0136 (-1.25) | -0.0493 (-4.61) | 1 | 0.0324 (3.44) | -0.0111 / -0.0451 |

## Reading

- No filter passes. The nearest, **sideways** (the 2 H1 candles after the zone formed did not touch it), kept the better trades in both halves (0.0343R, Welch t 3.44; 0.0161R, t 1.62) but the second half is short of t 2 (Holm p 0.678). A lean, not a pass; its kept trades still lose after costs (-0.0364R a trade).
- Several filters chosen for being "with the market" picked WORSE trades: the confirmed-BO side (-0.0493R, t -4.61 in 2015-19), the half, the weekly side, the efficiency ratio. The structure and direction filters are within noise.
- The unfiltered rule is positive before costs in every market and both halves (that is the dom-zone-holdout question, reported here as the reference only), and negative after costs in every market: the before-cost tilt is smaller than a round trip. No filter changes that.
- Welch t treats trades as independent; same-day trades are not, so the t values above overstate certainty if anything. One run, no variants: do not test these filters on these years again.
