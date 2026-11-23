# Result: the weekly-structure daily rejection rule (long and its mirror short) on 17 markets, 2020-now

**Verdict: FAIL. Longs pooled over 17 markets made +0.086R a trade after costs (n 6,778, month-sum t 1.85) and shorts -0.075R (n 3,534, month-sum t -1.31); neither passes discovery (t 1.48 / -0.27) or confirmation (t 1.12 / -2.22).**

Pre-registration: `PREREGISTRATION.md` (committed alone first). Run: `nice -n 10 node research/edge/weekly-daily-rejection-2020/run.mjs`
(about 15 s on the desk's candle cache). Days, weeks, weekly state, signals and the trade are `gold-drd-long`'s, imported.
Stop buffer 0.01 % of the signal day's low / high; cost = the desk's per-market round trip (`combo-grid-2` `COSTS`), a median
0.003-0.05R a trade (daily stops are wide, so costs barely matter here). Trades in bad-data intervals dropped (33 long, 20 short).

## The two tests (pooled over the 17 markets, net of costs, t of calendar-month sums)

| Test | Discovery 2020-2023 | Confirmation 2024-now | 2x cost (disc / conf) | Holm p | Pass |
|---|---|---|---|---|---|
| T1 longs | n 3,902, +0.101R, t 1.48 | n 2,876, +0.066R, t 1.12 | +0.085 / +0.050R | 0.543 | no |
| T2 shorts | n 2,137, -0.022R, t -0.27 | n 1,397, -0.155R, t -2.22 | -0.037 / -0.172R | 1.000 | no |

Longs are positive in both windows but the monthly sums are far from t 2 (the trade-count t of 4.46 overstates it: the 17
markets' trades overlap and move together). Pooled long R by year: 2020 +135, 2021 +10, 2022 +240, 2023 +11, 2024 +224,
2025 +94, 2026 -128 (worst drawdown -146R). Shorts lose from 2023 on.

## Per market, 2020-now (descriptive, not tested)

| Market | Long n / R a trade / month t | Short n / R a trade / month t |
|---|---|---|
| eurusd | 222 / +0.005 / 0.03 | 352 / -0.003 / -0.03 |
| gbpusd | 324 / +0.060 / 0.41 | 258 / +0.153 / 0.99 |
| usdjpy | 501 / +0.226 / 1.66 | 165 / -0.203 / -1.70 |
| audusd | 353 / -0.136 / -1.17 | 218 / -0.146 / -1.10 |
| nzdusd | 256 / -0.186 / -1.53 | 284 / +0.025 / 0.18 |
| usdcad | 286 / +0.038 / 0.23 | 287 / -0.091 / -0.75 |
| usdchf | 272 / -0.072 / -0.44 | 299 / +0.077 / 0.61 |
| eurjpy | 420 / +0.170 / 1.44 | 179 / -0.213 / -1.51 |
| xag | 426 / +0.184 / 1.26 | 149 / -0.018 / -0.09 |
| gbpjpy | 536 / +0.307 / 2.47 | 86 / -0.432 / -2.59 |
| eurgbp | 255 / -0.104 / -0.88 | 299 / -0.117 / -1.16 |
| audjpy | 501 / +0.226 / 1.92 | 145 / +0.072 / 0.43 |
| cadjpy | 512 / +0.131 / 1.12 | 130 / -0.075 / -0.42 |
| euraud | 262 / -0.062 / -0.56 | 285 / -0.081 / -0.71 |
| nas100 | 585 / +0.063 / 0.66 | 130 / -0.235 / -1.20 |
| spx500 | 559 / +0.078 / 0.76 | 139 / -0.237 / -1.66 |
| de40 | 508 / +0.046 / 0.46 | 129 / -0.335 / -1.87 |

What carries the long side is the markets that rose for most of 2020-2026 (the yen crosses, USD/JPY, silver): the rule's
lift over buying every day of a bullish week is small almost everywhere (largest: silver +0.218R, t 2.10; GBP/JPY +0.178R,
t 2.04; neither tested, 34 comparisons read). GBP/JPY's long t 2.47 is one of 34 descriptive rows picked after the fact.

## Gold 2020-now (a known in-sample row; `gold-drd-long` covers it, not part of any test)
Long n 450, +0.476R a trade, month t 3.44 (2020-2023 +0.281R, t 1.50; 2024-now +0.674R, t 3.48); lift over every bullish-week
day +0.222R (t 2.31). Short n 148, -0.041R. Gold's record does not travel: on the other 17 markets the same rule is near zero.

## Checks
- Cut test: on all 18 markets the long and short signals before 15 Jun 2023 are unchanged when every later candle is removed.
- Every trade has a stop on the losing side (the signal day's low / high past a buffer). Nothing live changed.
