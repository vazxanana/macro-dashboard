# Gold: the late New York session into the next Asian session: result

Pre-registered in PREREGISTRATION.md (pushed alone before any candle was fetched or trade computed). Built 2026-11-14. Paper
research only: nothing live changed. **A new stand-alone intraday rule, not a gate, exit, entry or size of the gold book**
(item 44 respected; no candle before 2015-12-01 read, and those only for the 20-day warm-up).

**Verdict: FAIL, 0 of 3: gold's 13:30-16:30 New York move does not carry into the 18:00-02:00 Asian session (out of sample follow −0.045R a trade net, n 1445, month t −2.57; fade −0.065R, t −3.46).**

Before costs every stream is within 0.02R of zero in both windows; the $0.60 round trip (about 0.05-0.10R of these stops)
makes every stream negative in both. It adds the post-settlement afternoon and the reopen hours to `gold-us-asia` (the whole
cash session into 00:00-07:00 UTC, FAIL) and finds the same: no usable link.

## Results (R of a stop of 1 × the 20-day mean Asia range; t on calendar-month sums of net R)

| Test | Window | n | Buys / sells | Gross R | Net R | Net R at 2× cost | Month t gross | Month t net | One-sided p | Total net R | Max DD R | Win % | Stopped | Median stop $ |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| T1 follow | in sample 2016-20 | 1229 | 615 / 614 | +0.016 | −0.077 | −0.169 | +0.85 | −4.23 | 1 | −94.3 | 97.7 | 44.1 | 123 | 6.10 |
| T1 follow | out of sample 2021-now | 1445 | 732 / 713 | +0.002 | −0.045 | −0.092 | +0.11 | −2.57 | 0.9938 | −65.4 | 73.8 | 47.3 | 161 | 12.03 |
| T2 follow, size > 0.5× | in sample 2016-20 | 756 | 374 / 382 | +0.006 | −0.087 | −0.180 | +0.29 | −3.99 | 0.9999 | −65.6 | 67.4 | 43.9 | 87 | 6.09 |
| T2 follow, size > 0.5× | out of sample 2021-now | 906 | 456 / 450 | +0.019 | −0.029 | −0.077 | +0.83 | −1.27 | 0.896 | −26.2 | 31.9 | 48.0 | 100 | 11.99 |
| T3 fade | in sample 2016-20 | 1229 | 614 / 615 | −0.017 | −0.110 | −0.202 | −0.98 | −5.70 | 1 | −135.0 | 141.2 | 43.5 | 149 | 6.10 |
| T3 fade | out of sample 2021-now | 1445 | 713 / 732 | −0.018 | −0.065 | −0.113 | −0.97 | −3.46 | 0.9995 | −94.4 | 106.4 | 45.3 | 180 | 12.03 |

In sample = signal days 2016-01-04 to 2020-12-31 (60 months); out of sample = 2021-01-01 to 2026-11-12 (71 months; the last
complete trade window on file). Costs: $0.30 spread + $0.15 slippage on the entry and on the exit, $0.60 a round trip.
Financing: 0 on every long (a trade from 18:00 to 02:00 New York crosses no rollover; computed by `council/fills.mjs`
`nights`, not assumed).

## Pass conditions (all needed; Holm over the 3 tests on the out-of-sample one-sided p)

| Test | OOS net > 0 | OOS t ≥ 2 | Holm p < 0.05 | IS net > 0 | OOS net at 2× cost > 0 | OOS n ≥ 200 | Pass |
|---|---|---|---|---|---|---|---|
| T1 | no | no | no (1) | no | no | yes | **no** |
| T2 | no | no | no (1) | no | no | yes | **no** |
| T3 | no | no | no (1) | no | no | yes | **no** |

## Placebo (40 seeds, the same days, entry, stop and exit, a random side per trade; reported, not a pass condition)

| Test | Window | Real net R | Random side p5 / p50 / p95 | Real above |
|---|---|---:|---|---|
| T1 | in sample | −0.077 | −0.117 / −0.091 / −0.068 | 31 of 40 |
| T1 | out of sample | −0.045 | −0.080 / −0.052 / −0.028 | 26 of 40 |
| T2 | in sample | −0.087 | −0.121 / −0.100 / −0.056 | 24 of 40 |
| T2 | out of sample | −0.029 | −0.085 / −0.056 / −0.025 | 37 of 40 |
| T3 | in sample | −0.110 | −0.117 / −0.091 / −0.068 | 5 of 40 |
| T3 | out of sample | −0.065 | −0.080 / −0.052 / −0.028 | 9 of 40 |

Following sits a little above a coin flip and fading a little below it (T1 and T3 share their days), but both lose after
costs, and every real mean is inside the random-side 5-95 % band.

## Descriptive (not tests)

- Correlation of the late-NY move ($) with the whole window's return (18:00 open → 02:00 close, no stop): −0.057 in sample
  (n 1,229), −0.093 out of sample (n 1,445). A slight reversal in dollars, driven by the large-move days; with a stop of one
  Asia range a side it does not show as R (T3 gross −0.02R).
- Correlation with the move from 16:30 to the 18:00 reopen (the last half hour and the halt): +0.041 and +0.143. What
  momentum there is runs out before the trade can start.
- T1 by weekday of the signal (both windows, net R a trade): Mon −0.054, Tue −0.097, Wed −0.025, Thu −0.060, Fri −0.061;
  gross between −0.03 and +0.04R. No day stands out.

## Data and skips

OANDA mid M15 XAU/USD through the site's candle proxy, 2015-12-01 to 2026-11-13 (258,908 candles; cache outside git,
`fetch.mjs`). 2,674 signal days traded; skipped: 146 with the CME shut in the signal window or at the entry (early closes,
holidays; `ict/calendar.mjs` `cmeShut`), 10 with the entry or exit candle missing, 3 with a flat move, 1 with a signal candle
missing.

Nothing here is an edge. No proposal; nothing live changed. To repeat: `node --use-env-proxy
research/edge/gold-late-ny/fetch.mjs <dir>`, then `node research/edge/gold-late-ny/run.mjs <dir>`.
