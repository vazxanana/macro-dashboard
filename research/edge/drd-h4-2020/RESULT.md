# Daily rejection, H4 break, limit at the broken level (18 markets, 2020-now): result

**Verdict: FAIL. Before costs, T1 (strong H4 body, 30-pip stop, 3R) made -0.022R a trade in confirmation 2024-now (n 1323, month-sum t -0.41) after -0.052R in discovery 2020-23 (n 1780, t -0.95); 0 of 3 tests pass.**

Pre-registered in `PREREGISTRATION.md` (committed alone first), judged on R before costs by the owner's request (dated amendment
before the run; after-cost figures beside). Signals are the repository's own `snrSides` (council/eg-methods.mjs, imported, not
edited) on OANDA mid 5-minute candles (edgekit cache), Daily = 17:00 New York days, H4 UTC-aligned; orders and exits by
combo-grid-2's `multi` (3R column); data-quality exclusions applied; at most 2 fills a UTC day per market. Windows:
2020-01-01..2023-12-31 and 2024-01-01..2026-11-23. Paper research only: nothing live changed.

## Tests (pooled, 18 markets; R a trade before costs, month-sum t)

| Test | Window | n | R before costs | t | R after costs | R at 2x cost |
|---|---|---|---|---|---|---|
| T1 | discovery | 1780 | -0.052 | -0.95 | -0.092 | -0.132 |
| T1 | confirmation | 1323 | -0.022 | -0.41 | -0.070 | -0.118 |
| T2 | discovery | 4324 | -0.019 | -0.51 | -0.062 | -0.104 |
| T2 | confirmation | 3163 | -0.001 | -0.03 | -0.046 | -0.090 |
| T3 | discovery | 1802 | -0.056 | -0.99 | -0.075 | -0.094 |
| T3 | confirmation | 1349 | -0.003 | -0.06 | -0.022 | -0.041 |

- T1: strong H4 body, 30-pip stop, 3R. Confirmation one-sided p 0.657, Holm 1.000; pass: no.
- T2: plain H4 close, 30-pip stop, 3R. Confirmation one-sided p 0.513, Holm 1.000; pass: no.
- T3: strong body, stop past the rejection candle, 3R. Confirmation one-sided p 0.523, Holm 1.000; pass: no.

No test is positive in discovery; the confirmation means sit within about 0.02R of zero with |t| under 0.5. The strong-body
filter (T1) and the structural stop (T3) do no better than the plain close (T2). After costs every test loses in both windows.

## Gold and each market (descriptive, not judged; R before costs)

| Market | T1 disc n | R | t | T1 conf n | R | t | T2 conf n | R | t |
|---|---|---|---|---|---|---|---|---|---|
| xau | 98 | -0.136 | -0.79 | 67 | 0.254 | 1.15 | 131 | 0.160 | 1.12 |
| eurusd | 99 | -0.030 | -0.14 | 82 | -0.222 | -1.10 | 187 | 0.087 | 0.53 |
| gbpusd | 113 | -0.186 | -1.00 | 70 | -0.371 | -2.05 | 174 | -0.126 | -0.86 |
| usdjpy | 83 | 0.012 | 0.07 | 65 | 0.123 | 0.56 | 175 | 0.156 | 0.94 |
| audusd | 101 | 0.069 | 0.38 | 75 | 0.067 | 0.27 | 184 | -0.065 | -0.40 |
| nzdusd | 98 | -0.061 | -0.31 | 68 | -0.294 | -1.47 | 183 | -0.194 | -1.15 |
| usdcad | 105 | -0.200 | -1.08 | 70 | 0.257 | 1.12 | 157 | 0.190 | 1.30 |
| usdchf | 105 | -0.124 | -0.67 | 81 | -0.062 | -0.26 | 187 | 0.027 | 0.15 |
| eurjpy | 85 | 0.230 | 1.10 | 75 | -0.493 | -0.91 | 192 | -0.375 | -1.59 |
| xag | 104 | -0.002 | -0.01 | 62 | -0.032 | -0.16 | 149 | 0.091 | 0.61 |
| gbpjpy | 96 | 0.292 | 1.34 | 75 | -0.115 | -0.47 | 189 | 0.039 | 0.24 |
| eurgbp | 108 | -0.188 | -1.06 | 77 | -0.161 | -0.85 | 203 | -0.093 | -0.72 |
| audjpy | 97 | 0.072 | 0.36 | 58 | 0.310 | 1.22 | 172 | 0.160 | 0.96 |
| cadjpy | 92 | 0.052 | 0.27 | 92 | 0.174 | 0.91 | 202 | -0.011 | -0.09 |
| euraud | 108 | -0.111 | -0.80 | 79 | 0.363 | 1.41 | 203 | 0.279 | 1.93 |
| nas100 | 97 | -0.465 | -4.65 | 69 | 0.093 | 0.37 | 148 | -0.054 | -0.34 |
| spx500 | 101 | 0.019 | 0.09 | 79 | -0.190 | -1.09 | 165 | -0.249 | -1.73 |
| de40 | 90 | -0.067 | -0.35 | 79 | -0.019 | -0.11 | 162 | 0.020 | 0.15 |

Gold alone: T1 -0.136R in discovery (n 98, t -0.79) and 0.254R in confirmation (n 67,
t 1.15): the sign flips between windows and neither t reaches 2. No single market reaches t 2 in both windows;
picking one after this table would not be a test.

## Checks

- Look-ahead: signals computed on candles cut at 6 moments equal the whole-file signals known by each cut (gold:
  2041 signals checked, 0 mismatched cuts; eurusd the same, 2,001 signals, 0); a seeded-market
  cut test runs in `tests/drd-h4-2020.test.mjs`.
- Every trade's stop is on the losing side of its entry (checked in the test).
- Fixed after the first full run, disclosed: `pipOfMarket` falls back to 0.1 for eight markets (nzdusd, usdchf, eurjpy,
  gbpjpy, audjpy, eurgbp, euraud, cadjpy), which made their 30-pip stops 10 (yen pairs) to 1,000 times too wide. They now take the
  pre-registered pip (0.0001; 0.01 for a yen pair). The first run's pooled T1 confirmation was +0.019R (t 0.41): FAIL either way.
- Before the amendment, eurusd alone had been run once while checking the code (whole-window after-cost means only).

## What it says

The gold plan's direction call, traded as a limit at the broken H4 level with a 30-pip stop and 3R, is at zero before costs
on 18 markets 2020-now. Not an edge. Do not test variants of this entry on these years.

To repeat: fill the cache (`research/edge/_lib/fetch-cache.mjs <m> 5m 2019`), then `node research/edge/drd-h4-2020/run.mjs
market <m> <dir>` for the 18 markets, `cut xau <dir>/cut.json`, `report <dir>`.
