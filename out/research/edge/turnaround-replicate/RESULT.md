# Result: the NAS100 "Turnaround Tuesday" cell on six markets it never saw (13 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). The frozen rule (the
week's first session closes more than 1 % down → buy that close, sell the next session's close, stop 2 x ATR(20), costs and
one night of financing) made **+0.052R a trade net on the equal-risk pool of six markets, 2016 to now (n 411), but the t of
the calendar-month sums is 1.69 (131 months; bar 2)**: P1 not met. P2 met (6 of 6 markets positive), P3 met (the pool beat
random down-1 % days in 40 of 40 seeds). **This does not support the NAS100 cell**: it stays one cell of four on one market,
found among about forty studies of one day, and unreplicated. Nothing live changed and no proposal follows.

The sign is the same everywhere and the size is about half of NAS100's (+0.098R), with no market reaching t 2 on its own
(best JP225 +0.103R, t 1.99, n 75; US2000 +0.061R, t 1.76). The trade t of the pool (2.63) is not the test: the six markets'
down Mondays fall in the same weeks, so their trades are not independent; the month sums count that, and stay under 2. In
2008-15 the pool made +0.025R a trade (month-sum t 1.03), with DE40, UK100 and JP225 negative.

| 2016 - Nov 2026, net of costs and financing | n | net R a trade | t (trades) | gross R | net % a trade | won | stopped | placebo beaten |
|---|---|---|---|---|---|---|---|---|
| Dow 30 (US30) | 55 | +0.018 | 0.30 | +0.035 | +0.416 | 50.91 % | 3 | 33 of 40 |
| Russell 2000 (US2000) | 93 | +0.061 | 1.76 | +0.084 | +0.467 | 58.06 % | 2 | 40 of 40 |
| Germany 40 (DE40) | 64 | +0.054 | 1.04 | +0.069 | +0.429 | 62.50 % | 2 | 38 of 40 |
| Euro Stoxx 50 (EU50) | 74 | +0.024 | 0.54 | +0.047 | +0.298 | 55.41 % | 3 | 40 of 40 |
| UK 100 (UK100) | 50 | +0.036 | 0.61 | +0.060 | +0.309 | 64.00 % | 3 | 39 of 40 |
| Japan 225 (JP225) | 75 | +0.103 | 1.99 | +0.121 | +0.494 | 62.67 % | 3 | 40 of 40 |
| **Pool (equal risk)** | 411 | +0.052 | 2.63 | +0.072 | +0.410 | 58.88 % | 16 | 40 of 40 |

| 2008 - 2015 (reported only) | n | net R a trade | t (trades) | gross R | net % a trade | won | stopped |
|---|---|---|---|---|---|---|---|
| Dow 30 (US30) | 52 | +0.126 | 2.59 | +0.140 | +0.778 | 65.38 % | 0 |
| Russell 2000 (US2000) | 96 | +0.083 | 2.13 | +0.102 | +0.705 | 55.21 % | 0 |
| Germany 40 (DE40) | 70 | -0.041 | -0.98 | -0.029 | -0.165 | 45.71 % | 3 |
| Euro Stoxx 50 (EU50) | 74 | +0.023 | 0.50 | +0.040 | +0.137 | 54.05 % | 4 |
| UK 100 (UK100) | 68 | -0.044 | -0.91 | -0.027 | -0.173 | 54.41 % | 5 |
| Japan 225 (JP225) | 45 | -0.008 | -0.14 | +0.008 | +0.005 | 64.44 % | 3 |
| **Pool (equal risk)** | 405 | +0.025 | 1.31 | +0.041 | +0.235 | 55.56 % | 15 |

## The three checks
- **P1, pooled net return**: +0.052R a trade > 0, but month-sum t 1.69 over 131 months (mean +0.163R a month; 110 months with
  a trade). **Not met.**
- **P2, breadth**: 6 of 6 markets positive net on 2016-now (bar 4). **Met.**
- **P3, placebo**: the pool's +0.052R beat the pooled mean of random down-more-than-1 % days in 40 of 40 seeds (median seed
  -0.028R; bar 38). **Met.**

## How to read it
- What the rule picks up looks like a real but small tendency of index CFDs to bounce for a session after the week opens with
  a fall of more than 1 %, better than the bounce after other down-1 % days (P3 in every seed). It is not large enough, after
  costs and financing, to be told apart from noise on the six markets the cell was not chosen on: about +0.05R a trade, or
  +0.4 % of price, with month-sum t 1.69. Never call it, or the NAS100 cell, an edge.
- Before costs the pool made +0.072R a trade: the stated spreads and one night of financing take about 0.02R.
- The US markets carried the 2008-15 result (US30 +0.126R, US2000 +0.083R) and are the weakest after 2016 (US30 +0.018R); the
  European and Japanese markets did the reverse. No market reaches t 2 on 2016-now; the two that did in 2008-15 (US30,
  US2000) fell to t 0.30 and 1.76.

## Data notes
- OANDA mid H1 candles (`fetch.mjs`), 1 Oct 2007 to 12 Nov 2026 (US30 from the turnaround-tuesday study's cache, the same
  fetch). Closes found per market: US30 4,807, US2000 4,806, DE40 4,849, EU50 4,859, UK100 4,821, JP225 4,009 of their local
  trading days.
- **JP225 has no Tokyo-hours candles on OANDA before mid-2010** (2008 candles run 08:00-21:00 UTC only), so its first trade is
  7 Jun 2010 and its 2008-15 row is short (n 45). Trades skipped for a missing close or ATR: US30 3, US2000 6, DE40 14, EU50 8,
  UK100 2, JP225 34 (listed in result.json).
- Calendars, closes, costs and the yearly local rates are as pre-registered (`run.mjs` `MARKETS`, `RATES`); `frozen.mjs` is the
  turnaround-tuesday `run.mjs` byte for byte (sha256 pinned in the test).

To repeat: `node --use-env-proxy research/edge/turnaround-replicate/fetch.mjs <dir>` (candles outside git), then
`node research/edge/turnaround-replicate/run.mjs <dir>`. Tests: `tests/turnaround-replicate.test.mjs`.
