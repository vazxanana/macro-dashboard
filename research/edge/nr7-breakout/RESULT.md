# NR7 breakout on gold, two US indices and three currency pairs: result (13 Nov 2026)

**Verdict: FAIL.** Neither exit passes the pre-registered bar (PREREGISTRATION.md, committed before any trade was computed). Pooled over the six markets in the decisive window (entries 2016-01-01 to 2026-11-06), exit A made +0.013R a trade after costs (n 2191, t 0.38 on 131 calendar-month sums) and exit B +0.008R (n 2191, t 0.29); the bar was t ≥ 2. Neither beats the random-day placebo's 95th percentile (A +0.014R, B +0.026R), and exit B loses in the 2008-15 replication. Not an edge; no proposal.

A stand-alone rule, not a test of the gold book: no gate, exit, entry or size of Gold trend or Gold daily engulf was tested (docs/owner-decisions.md item 44). Paper research only: nothing here is read by the council, the mirror or the page, and nothing live changed.

## Rule (as pre-registered)

- Days: OANDA mid daily candles, UTC, weekend stubs folded into Monday with `council/fills.mjs` `foldWeekend`.
- NR7: a day whose high-low range is strictly smaller than each of the six trading days before it.
- Next day: buy stop at its high, sell stop at its low; the first traded wins, the other is cancelled. Stop = the other side of the NR7 candle (every trade has it from the fill). One position per market.
- The path is walked on H1 candles; both levels in one H1 candle = a loss of 1R. Exit A: the close of the trading day after the entry day. Exit B: a 2R target, else that close (stop first when one candle holds both).
- Costs: round-trip spread (gold $0.30, NAS100 3 points, SPX500 1 point, forex 1 pip) and financing per 22:00 UTC rollover (`nights`): gold longs `FIN.xau.long`, indices (DGS2 + 2.5 %) / 365 on longs and max(0, 2.5 % − DGS2) / 365 on shorts, forex 0.004 % of price a night.

## Pooled result

| Exit | Window | n | Gross R a trade | Net R a trade | Net at x2 spread | Total net R | Win % | t (month sums) | One-sided p |
|---|---|---|---|---|---|---|---|---|---|
| A | 2016 → now (decisive) | 2191 | +0.065 | +0.013 | −0.020 | +28.26 | 42.1 | 0.38 | 0.351 |
| A | 2008-15 (replication) | 1614 | +0.113 | +0.042 | −0.012 | +67.44 | 40.6 | 0.82 | 0.206 |
| B | 2016 → now (decisive) | 2191 | +0.056 | +0.008 | −0.025 | +17.81 | 43.7 | 0.29 | 0.386 |
| B | 2008-15 (replication) | 1614 | +0.042 | −0.025 | −0.079 | −39.57 | 41.9 | −0.75 | 0.773 |

## The four checks

| Exit | Decisive net > 0 | Decisive t ≥ 2 | Replication net > 0 | Holm (two exits) | Beats placebo p95 | Pass |
|---|---|---|---|---|---|---|
| A | yes | no | yes | no | no | no |
| B | yes | no | no | no | no | no |

## Placebo (decisive window, 40 seeds)

Each real signal day was replaced by a random trading day of the same market in the window, with the same bracket orders, stop, exits and costs on that day's own high and low (same count per market).

| Exit | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|---|
| A | +0.013 | −0.013 | +0.014 | −0.060 / +0.038 |
| B | +0.008 | −0.013 | +0.026 | −0.057 / +0.035 |

A narrow day does no measurably better than a random day under the same bracket: both real streams sit inside the placebo range, under its 95th percentile.

## Per market (reported, no market passes on its own)

Exit A (exit at the close of the day after entry):

| Market | Window | Signals | Skipped (position open) | n | Net R a trade | Total net R | t (month sums) | Both-in-one-candle losses |
|---|---|---|---|---|---|---|---|---|
| Gold | 2016 → now | 372 | 38 | 357 | −0.008 | −2.71 | −0.11 | 5 |
| Gold | 2008-15 | 288 | 31 | 273 | +0.414 | +112.96 | 2.02 | 1 |
| Nasdaq 100 | 2016 → now | 383 | 62 | 368 | +0.049 | +17.86 | 0.64 | 2 |
| Nasdaq 100 | 2008-15 | 275 | 35 | 261 | −0.047 | −12.38 | −0.56 | 0 |
| S&P 500 | 2016 → now | 385 | 62 | 362 | −0.075 | −27.33 | −1.18 | 2 |
| S&P 500 | 2008-15 | 277 | 31 | 265 | −0.156 | −41.34 | −1.96 | 1 |
| EUR/USD | 2016 → now | 385 | 53 | 379 | +0.032 | +12.06 | 0.43 | 3 |
| EUR/USD | 2008-15 | 267 | 33 | 253 | −0.066 | −16.79 | −0.87 | 2 |
| GBP/USD | 2016 → now | 369 | 43 | 356 | +0.028 | +10.05 | 0.39 | 2 |
| GBP/USD | 2008-15 | 271 | 30 | 265 | +0.032 | +8.60 | 0.35 | 1 |
| USD/JPY | 2016 → now | 394 | 45 | 369 | +0.050 | +18.31 | 0.71 | 6 |
| USD/JPY | 2008-15 | 314 | 45 | 297 | +0.055 | +16.39 | 0.73 | 3 |

Exit B (2R target, else that close):

| Market | Window | Signals | Skipped (position open) | n | Net R a trade | Total net R | t (month sums) | Both-in-one-candle losses |
|---|---|---|---|---|---|---|---|---|
| Gold | 2016 → now | 372 | 38 | 357 | +0.016 | +5.54 | 0.24 | 5 |
| Gold | 2008-15 | 288 | 31 | 273 | +0.095 | +25.91 | 1.30 | 1 |
| Nasdaq 100 | 2016 → now | 383 | 62 | 368 | +0.038 | +14.14 | 0.58 | 2 |
| Nasdaq 100 | 2008-15 | 275 | 35 | 261 | −0.075 | −19.46 | −1.14 | 0 |
| S&P 500 | 2016 → now | 385 | 62 | 362 | −0.020 | −7.17 | −0.32 | 2 |
| S&P 500 | 2008-15 | 277 | 31 | 265 | −0.128 | −34.03 | −1.78 | 1 |
| EUR/USD | 2016 → now | 385 | 53 | 379 | +0.006 | +2.43 | 0.10 | 3 |
| EUR/USD | 2008-15 | 267 | 33 | 253 | −0.129 | −32.53 | −2.06 | 2 |
| GBP/USD | 2016 → now | 369 | 43 | 356 | +0.005 | +1.74 | 0.08 | 2 |
| GBP/USD | 2008-15 | 271 | 30 | 265 | −0.028 | −7.38 | −0.40 | 1 |
| USD/JPY | 2016 → now | 394 | 45 | 369 | +0.003 | +1.12 | 0.06 | 6 |
| USD/JPY | 2008-15 | 314 | 45 | 297 | +0.094 | +27.91 | 1.52 | 3 |

No market has t ≥ 2 in the decisive window under either exit. Gold's replication figure under exit A (t 2.02) rests largely on one trade (next section); a market that looks good alone is at most a hypothesis for a new pre-registration, never evidence.

## Looked at after the results (post hoc, not evidence)

- The largest trade of the replication window is a gold buy entered 2008-01-02 after the 1 Jan 2008 holiday candle (range $0.60): +51.17R under exit A. NR7 days dated 25 Dec or 1 Jan are thin holiday candles that the rule, as written, takes.
- Without trades whose NR7 day is 25 Dec or 1 Jan:
  - exit A, decisive: n 2143, net −0.003R a trade, t −0.10 (48 trades left out).
  - exit A, replication: n 1594, net −0.009R a trade, t −0.21 (20 trades left out).
  - exit B, decisive: n 2143, net +0.008R a trade, t 0.29 (48 trades left out).
  - exit B, replication: n 1594, net −0.033R a trade, t −0.97 (20 trades left out).

This only strengthens the FAIL; it is not a rule change.

## Data and coverage

- Daily: council-data `research/daily/<key>.json` (data to 6 Nov 2026). H1: the candle proxy from 2 Dec 2007; every entry day and exit day had H1 candles on file (no daily fallback was used).
- Financing benchmark: DGS2 weekly from council-data `macro/cache.json`.
- To repeat: `node --use-env-proxy research/edge/nr7-breakout/run.mjs fetch <dir>` (candles outside git), then `node research/edge/nr7-breakout/run.mjs full <dir>`. Tests: `tests/nr7-breakout.test.mjs`.
