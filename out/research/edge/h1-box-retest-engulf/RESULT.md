# H1 box break, retest of the broken edge, M15 engulf with the break: result (24 Nov 2026)

**Verdict: FAIL. Best cell len8 eg1 box: -0.100R a trade after costs in 2015-26 (n 6443, month t -3.66), -0.171R in 2005-14 (n 5742, month t -6.24); 0 of 8 cells positive after costs in both windows.**

Pre-registered in `PREREGISTRATION.md` (committed alone before `run.mjs` existed). OANDA mid 5-minute candles, five markets pooled
(xau, eurusd, gbpusd, usdjpy, audusd), H1 and M15 built from them. Windows by the fill: discovery 2005-2014, confirmation
2015 to October 2026. Research only: nothing live changed, no rule is proposed. Never an edge.

## The rule, in one paragraph

An H1 box follows price until an H1 candle closes outside it. After that close, the first M15 candle that trades back to the
broken edge (within 96 M15 candles) is the retest; from that candle to the 12th after it, the first M15 engulf with the break is
the entry, at market at its close. Stop past the lowest low (highest high) of the engulf candles by one round-trip cost; target
1R, or the box height projected from the broken edge; out after 48 hours otherwise; stop first in a candle that holds both.

## Every cell

R a trade; t = t of calendar-month sums (month of the fill). "cost R" = mean round-trip cost / risk.

| cell | 2005-14 n | won | before costs (t) | after costs (t) | 2015-26 n | won | before costs (t) | after costs (t) | cost R | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| len3 eg3 1R | 20541 | 49 % | -0.027 (-3.38) | -0.097 (-11.68) | 24907 | 48 % | -0.035 (-5.23) | -0.117 (-16.76) | 0.08 | 1.000 | no |
| len3 eg3 box | 20146 | 31 % | -0.056 (-3.98) | -0.126 (-8.96) | 24238 | 32 % | -0.050 (-4.15) | -0.133 (-11.04) | 0.08 | 1.000 | no |
| len3 eg1 1R | 14710 | 48 % | -0.032 (-3.58) | -0.109 (-11.46) | 17908 | 48 % | -0.036 (-4.45) | -0.126 (-15.08) | 0.09 | 1.000 | no |
| len3 eg1 box | 14150 | 29 % | -0.064 (-3.85) | -0.142 (-8.50) | 17103 | 31 % | -0.035 (-2.42) | -0.127 (-8.78) | 0.09 | 1.000 | no |
| len8 eg3 1R | 8146 | 48 % | -0.037 (-3.09) | -0.109 (-8.76) | 9177 | 49 % | -0.024 (-2.26) | -0.105 (-9.79) | 0.08 | 1.000 | no |
| len8 eg3 box | 8077 | 26 % | -0.071 (-3.02) | -0.143 (-6.09) | 9076 | 27 % | -0.035 (-1.71) | -0.118 (-5.68) | 0.08 | 1.000 | no |
| len8 eg1 1R | 5853 | 48 % | -0.044 (-3.13) | -0.124 (-8.37) | 6568 | 49 % | -0.025 (-1.93) | -0.116 (-8.60) | 0.09 | 1.000 | no |
| len8 eg1 box | 5742 | 24 % | -0.091 (-3.32) | -0.171 (-6.24) | 6443 | 26 % | -0.008 (-0.31) | -0.100 (-3.66) | 0.09 | 1.000 | no |

Median planned reward of the `box` target: len3 eg3 box 2.57R, len3 eg1 box 2.83R, len8 eg3 box 3.42R, len8 eg1 box 3.75R.

## The bar

- n >= 300 in both windows: 8 of 8.
- Mean R after costs > 0 in both windows: 0 of 8.
- Month t >= 2 after costs in both windows: 0 of 8.
- Holm p < 0.05 in confirmation: 0 of 8.
- Mean R BEFORE costs > 0 in both windows: 0 of 8.

## The best cell by market (context only, no verdict): len8 eg1 box

| market | 2005-14 n | after costs (t) | 2015-26 n | before costs | after costs (t) |
|---|---|---|---|---|---|
| xau | 983 | -0.188 (-2.66) | 1226 | +0.050 | -0.079 (-1.33) |
| eurusd | 1171 | -0.197 (-3.40) | 1265 | -0.078 | -0.154 (-2.60) |
| gbpusd | 1225 | -0.168 (-2.91) | 1294 | +0.015 | -0.062 (-1.00) |
| usdjpy | 1212 | -0.083 (-1.46) | 1279 | +0.010 | -0.081 (-1.14) |
| audusd | 1151 | -0.224 (-3.58) | 1379 | -0.035 | -0.123 (-2.31) |

## How many boxes reached each step (engulf span 3 / span 1)

| market | candles from | H1 boxes broken | retested | engulfed (eg3 / eg1) | of 8+ candles | traded in the windows (any box length) |
|---|---|---|---|---|---|---|
| xau | 2006-03-19 | 22311 | 19364 | 15762 / 11387 | 3082 / 2250 | 15751 / 11376 |
| eurusd | 2005-01-02 | 26776 | 23245 | 18963 / 13579 | 3462 / 2475 | 18952 / 13569 |
| gbpusd | 2005-01-02 | 27399 | 23879 | 19467 / 14059 | 3575 / 2588 | 19457 / 14044 |
| usdjpy | 2005-01-02 | 27355 | 23948 | 19763 / 14043 | 3558 / 2532 | 19758 / 14037 |
| audusd | 2005-01-02 | 31317 | 27612 | 22497 / 16103 | 3653 / 2582 | 22478 / 16085 |

## What to doubt

- Mid candles, one fixed round-trip cost a market for every year; no slippage on the market entry or the stop.
- Boxes are independent, so trades of neighbouring boxes overlap; the month-sum t absorbs some of that, not all.
- "Retested" counts boxes of any length; the retest candle may be the first M15 candle after the break (a break that closes
  barely outside is retested at once), so the retest is a weak condition.
- Every cell is below zero BEFORE costs. Part of that is the mandatory worst case: a 5-minute candle that holds both stop and
  target is booked as a stop, and the stops are tight (risk about twelve round trips), so the true before-cost figure is nearer zero.
- Gold has no candles before 2006 in the cache. The five markets were read by many earlier studies: nothing here is a holdout.
