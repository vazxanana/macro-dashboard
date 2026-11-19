# Gold: the Asian session after the New York cash session: result

Pre-registered in PREREGISTRATION.md (pushed before any trade was computed). Built 2026-11-14. Paper research only: nothing
live changed. **A new stand-alone intraday rule, not a gate, exit, entry or size of the gold book** (item 44 respected).

## Verdict: FAIL: 0 of 3 tests pass. Gold's Asian session (00:00 → 07:00 UTC) neither continues nor reverses the New York cash session's move: before costs every stream is within 0.02R of zero, after the $0.30 round trip every stream is negative in both windows (decisive 2016-26: fade −0.010R a trade, n 1,928, month-sum t −1.42; follow −0.016R, t −2.39; fade on big NY days −0.011R, n 898, t −0.93).

## Results (R of a 1 × daily ATR20 stop; t on calendar-month sums of net R)

| Test | Window | n | Buys / sells | Gross R | Net R | Net R at 2× cost | Month t gross | Month t net | One-sided p | Total net R | Max DD R | Win % | Stopped | Median stop $ |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| T1 | decisive | 1928 | 957 / 971 | +0.004 | −0.010 | −0.025 | +0.50 | −1.42 | 0.9206 | −20.1 | 32.5 | 49.6 | 23 | 23.53 |
| T1 | replication | 1736 | 867 / 869 | −0.010 | −0.027 | −0.044 | −1.53 | −4.32 | 1 | −46.7 | 49.5 | 47.8 | 15 | 18.4 |
| T2 | decisive | 1928 | 971 / 957 | −0.002 | −0.016 | −0.030 | −0.33 | −2.39 | 0.9909 | −31.5 | 37.6 | 45.5 | 12 | 23.53 |
| T2 | replication | 1736 | 869 / 867 | +0.006 | −0.011 | −0.028 | +1.04 | −1.78 | 0.9613 | −19.1 | 30.0 | 45.6 | 10 | 18.4 |
| T3 | decisive | 898 | 445 / 453 | +0.003 | −0.011 | −0.025 | +0.22 | −0.93 | 0.8227 | −10.2 | 18.3 | 49.4 | 19 | 23.85 |
| T3 | replication | 837 | 423 / 414 | −0.020 | −0.037 | −0.055 | −2.15 | −4.05 | 1 | −31.1 | 32.7 | 47.8 | 11 | 18.41 |

Decisive = trade days 2016-01-01 to 2026-11-13; replication = 2006-03-20 (the first M15 candle the proxy serves is
19 March 2006, not June as the pre-registration guessed; the window was defined as "from the start of the data") to
2015-12-31.

## Pass conditions

| Test | Net > 0 decisive | Net > 0 replication | Holm-adjusted p < 0.05 | n in each window | Pass |
|---|---|---|---|---|---|
| T1 | no | no | no (1) | yes (≥ 200) | no |
| T2 | no | no | no (1) | yes (≥ 200) | no |
| T3 | no | no | no (1) | yes (≥ 100) | no |

## Placebo (40 seeds, the same days, entry, stop and exit, a random side per trade; reported, not a pass condition)

| Test | Window | Real net R | Random side p5 / p50 / p95 | Real above |
|---|---|---:|---|---|
| T1 | decisive | −0.010 | −0.025 / −0.015 / −0.002 | 23 of 40 |
| T1 | replication | −0.027 | −0.026 / −0.019 / −0.011 | 1 of 40 |
| T2 | decisive | −0.016 | −0.025 / −0.015 / −0.002 | 17 of 40 |
| T2 | replication | −0.011 | −0.026 / −0.019 / −0.011 | 39 of 40 |
| T3 | decisive | −0.011 | −0.029 / −0.017 / −0.003 | 26 of 40 |
| T3 | replication | −0.037 | −0.031 / −0.018 / −0.007 | 0 of 40 |

On 2016-26 both directions sit in the middle of a coin flip. On 2006-15 following did a little better than chance and fading
a little worse (the mirror of each other), but following still lost money after costs (−0.011R a trade).

## Descriptive (not a test)

- Correlation of the NY move with the following Asian session's return: −0.004 on 2016-26 (n 2,690), +0.033 on 2006-15
  (n 2,424). Nothing either way.
- Correlation of the NY move with the move from the NY session end to 00:00 UTC (the hours in between, gold has no cash gap):
  −0.002 and −0.154. In 2006-15 a slice of the NY move was given back in the evening hours, before this trade could start.
- Unlike the index CFDs of `us-asia-lead` (the Asian session reversed the US move, −0.04 to −0.12), gold's Asia shows no
  reversal and no continuation.

## Costs and financing

- $0.30 a round trip on a median stop of $18-24 is about 0.013-0.016R a trade: it is the whole loss, the gross is within 0.02R
  of zero in every stream. At 2× cost every stream is between −0.025R and −0.055R.
- Financing: none. `council/fills.mjs` `nights` counts rollovers at 22:00 UTC and a 00:00 → 07:00 UTC hold crosses none
  (asserted for every trade in `run.mjs`).
- A 1 × daily ATR stop is wide for a seven-hour hold: 23 of 1,928 fades were stopped on 2016-26; the trades are in effect
  clock trades out at 07:00 UTC.

## Data

OANDA mid M15 XAU_USD through the site's candle proxy, 494,367 candles, 19 March 2006 to 13 November 2026 (cache outside
git). 5,190 NY cash sessions complete; 5,114 trade days had a session, 20 earlier sessions, the Asian candles and an ATR;
skipped: 187 with the previous weekday's session missing, 20 before the median had 20 sessions, 37 without the 00:00 or
06:45 candle, 2 with a flat NY session.

## What this means

Nothing to build: no fade, follow or big-day rule of gold's Asian session after New York survives costs, in either window.
Nothing live changed; no proposal. To repeat: `node --use-env-proxy research/edge/gold-us-asia/run.mjs fetch <dir>`, then
`node research/edge/gold-us-asia/run.mjs full <dir>`. Tests: `tests/gold-us-asia.test.mjs`.
