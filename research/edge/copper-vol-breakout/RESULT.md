# Gold's T1 breakout on copper (24 Nov 2026)

**Verdict: FAIL: T1 on copper, confirmation 2016 → now −0.021R a trade after an assumed 0.06 % (n 2132, month t −0.81; gross +0.053R; 2x cost −0.094R); discovery +0.039R (n 1083, t +1.20); 40 of 40 placebos; fails: bothWindows, t2, cost2x**

Paper research only. Rule, cost, windows and pass bar fixed in `PREREGISTRATION.md` (pushed alone before any copper candle was fetched). `vbTrade` imported unchanged from `research/edge/index-vol-breakout/original.mjs` (sha256 checked at run time). Nothing live changed; no proposal.

## Results (net of the ASSUMED 0.06 % round trip; R of the stop at the UTC open)

| Window | n | Gross R | Net R | Net 2x cost | Cost R | Month t net | Month t gross | Month t 2x | Stops / time | Max DD R | Median stop ($) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Discovery 2005-01-03 → 2015 | 1083 | +0.113 | +0.039 | −0.035 | +0.074 | +1.20 | +3.57 | −1.00 | 337 / 746 | -23.91 | 0.03 |
| Confirmation 2016 → now | 2132 | +0.053 | −0.021 | −0.094 | +0.074 | −0.81 | +2.09 | −3.60 | 710 / 1422 | -113.61 | 0.03 |

Placebo (confirmation, 40 seeds, random side and start 01:00-18:00 UTC, same stop distance): the rule's mean net beats 40 of 40 seed means.
At the repository's 0.10 % group cost (reported, not judged): confirmation −0.070R a trade, month t −2.68.

Checks: bothWindows NO, t2 NO, cost2x NO, placebo yes, n200 yes.

## Early (fill before 06:00 UTC) against late fills, descriptive

| Window | Early n | Early net R | Early month t | Late n | Late net R | Late month t |
|---|---|---|---|---|---|---|
| Discovery | 332 | +0.190 | +2.44 | 751 | −0.028 | −0.79 |
| Confirmation | 673 | +0.014 | +0.24 | 1459 | −0.037 | −1.58 |

## By year (net R a trade)

| Year | n | Net R | Total R |
|---|---|---|---|
| 2007 | 20 | +0.335 | +6.71 |
| 2008 | 49 | +0.078 | +3.82 |
| 2009 | 110 | −0.098 | −10.77 |
| 2010 | 112 | +0.171 | +19.11 |
| 2011 | 110 | +0.133 | +14.59 |
| 2012 | 126 | +0.091 | +11.49 |
| 2013 | 180 | +0.037 | +6.66 |
| 2014 | 190 | −0.095 | −18.09 |
| 2015 | 186 | +0.047 | +8.77 |
| 2016 | 188 | +0.010 | +1.97 |
| 2017 | 181 | +0.175 | +31.70 |
| 2018 | 195 | −0.057 | −11.21 |
| 2019 | 199 | −0.102 | −20.24 |
| 2020 | 207 | −0.094 | −19.39 |
| 2021 | 205 | +0.055 | +11.20 |
| 2022 | 196 | −0.119 | −23.24 |
| 2023 | 201 | −0.114 | −22.94 |
| 2024 | 200 | −0.027 | −5.46 |
| 2025 | 188 | +0.003 | +0.52 |
| 2026 | 172 | +0.075 | +12.83 |

Sides, confirmation: buys n 1059 +0.021R, sells n 1073 −0.062R; discovery: buys n 523 +0.023R, sells n 560 +0.054R.

Data: OANDA mid M5 XCU/USD, 2005-01-03 → 2026-11-24, 1261785 candles; days on file 5660, traded days 4261 (the rest skipped by the original's `daySkip`: noprev 1, thin 739, noopen 658, flatprev 1).

Caveats: the cost is ASSUMED (the demo broker lists no copper symbol, so no spread has been measured); OANDA mid candles, not broker quotes. A before-cost tilt is not an edge. Never call this an edge.
