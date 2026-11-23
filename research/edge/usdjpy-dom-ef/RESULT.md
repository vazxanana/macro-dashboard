# USD/JPY: H4 dominant zone with an M15 failed engulf, 2005-2019

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed.

**Verdict: FAIL. -0.076R a trade after costs on USD/JPY 2005-2019 (n 4,500, month t -3.58).**

The one family of rules the combination grid (`research/edge/combo-grid`) left standing in both its windows, tested once on
years the grid did not read. Gate first: the grid's cell (`usdjpy 4h>15m dom first2 none ef mkt/zone 2R`) is reproduced
exactly on 2020-now with the same functions (2020-23 n 1,292, +0.109R; 2024-now n 968, +0.135R).

| USD/JPY, after costs | n | R a trade | month t |
|---|---:|---:|---:|
| 2005-2019 | 4,500 | -0.076 | -3.58 |
| 2005-2011 | 2,090 | -0.040 | -1.27 |
| 2012-2019 | 2,410 | -0.108 | -3.76 |
| Buys / sells | 2,414 / 2,086 | -0.098 / -0.051 | -3.07 / -1.39 |
| At twice the cost | | -0.119 | |

Reported, no verdict: the same rule on 2005-2019 loses on every market tried: gold -0.052R (t -1.81), EUR/USD -0.014R,
GBP/USD -0.026R, AUD/USD -0.052R, NZD/USD -0.034R, USD/CAD -0.076R, USD/CHF -0.039R, EUR/JPY -0.064R, silver -0.191R.

The grid's survivor was a 2020-26 run of luck (and USD/JPY's rise), not a rule. Combined with the grid (0 of 463,064 rules
confirmed), no combination of these engulf, Mosha and direction pieces tested here is an edge.

To repeat: `node research/edge/usdjpy-dom-ef/run.mjs` (about 5 minutes; the edgekit candle cache).
