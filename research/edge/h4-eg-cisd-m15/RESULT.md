# H4 engulf zone + an M15 change in the state of delivery

**Verdict: FAIL. 0 of 3 zone cells pass; best zone cell "zone 2R" -0.061R a trade after costs in 2015-26 (n 30,191, month t -6.49; +0.002R before costs).**

Pre-registered 24 Nov 2026 (PREREGISTRATION.md, committed before any run). Research only: nothing live changed, no rule is proposed.

The signal: a run of two or more same-colour M15 candles, then within 12 candles a close back through the open of the run's
first candle; market at that close against the run, stop past the extreme made since the run began (+ 0.1 ATR), targets 1R, 2R
and the origin of the run, out after 48 hours. **zone** = the run carried price from outside into a standing H4 engulf zone of
the trade's side; **away** = the run's whole range touches no standing H4 engulf zone. Five markets (xau, eurusd, gbpusd, usdjpy, audusd),
OANDA mid 5-minute candles, discovery 2005-2014, confirmation 2015 to October 2026, costs = the shared round trips.

Signals: 301,030 (zone 54,927, away 108,960, neither and left out 137,143).

## Every cell

R a trade; t = t of calendar-month sums after costs; Holm over the 6 confirmation tests.

| cell | n 2005-14 | won | before costs | after costs | month t | n 2015-26 | won | before costs | after costs | month t | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| zone 1R | 24,606 | 50 % | -0.009 | -0.063 | -8.72 | 30,191 | 50 % | +0.002 | -0.061 | -9.22 | 0.000 | no |
| zone 2R | 24,606 | 35 % | -0.002 | -0.056 | -5.34 | 30,191 | 35 % | +0.002 | -0.061 | -6.49 | 0.000 | no |
| zone origin | 332 | 56 % | -0.032 | -0.162 | -3.26 | 389 | 61 % | +0.038 | -0.110 | -2.44 | 0.016 | no |
| away 1R | 49,069 | 49 % | -0.025 | -0.102 | -19.24 | 59,437 | 49 % | -0.017 | -0.103 | -21.15 | 0.000 | no |
| away 2R | 49,069 | 33 % | -0.037 | -0.114 | -14.69 | 59,437 | 33 % | -0.030 | -0.116 | -15.62 | 0.000 | no |
| away origin | 1,301 | 57 % | -0.021 | -0.170 | -6.11 | 1,572 | 59 % | +0.025 | -0.150 | -6.35 | 0.000 | no |

## Zone against away (after costs, R a trade, Welch t on trades)

| target | 2005-14 zone minus away | t | 2015-26 zone minus away | t |
|---|---|---|---|---|
| 1R | +0.039 | 5.01 | +0.042 | 5.89 |
| 2R | +0.058 | 5.37 | +0.055 | 5.63 |
| origin | +0.008 | 0.14 | +0.039 | 0.80 |

## Zone cells by market (2015-26, after costs; n, R a trade, month t)

| market | 1R | 2R | origin |
|---|---|---|---|
| xau | 6,041, -0.086, -6.18 | 6,041, -0.080, -4.23 | 109, -0.248, -2.81 |
| eurusd | 5,973, -0.064, -4.55 | 5,973, -0.049, -2.18 | 64, -0.041, -0.40 |
| gbpusd | 5,932, -0.065, -4.42 | 5,932, -0.060, -2.90 | 69, +0.085, 0.81 |
| usdjpy | 5,987, -0.033, -2.14 | 5,987, -0.038, -1.71 | 70, -0.150, -1.33 |
| audusd | 6,258, -0.058, -4.28 | 6,258, -0.077, -4.12 | 77, -0.111, -1.05 |

## Checks and limits

- Cut test (signals, context and stop found on candles cut at a moment against the full series up to it): 15 cuts, 0 differences.
- No-trades: near 160,142, small 156, past 255, open 4 (per signal and target; "small" = risk under the round-trip cost, "past" = the fill already beyond the stop, "near" = the origin under 0.5R away, "open" = not ended in the data).
- Every signal is its own trade, so trades overlap and are not independent; the month-sum t is the guard.
- OANDA mid candles; today's demo round trip is charged on every year; gold starts March 2006.
- A market entry after a weekend gap fills at the reopen (as written).
- One run, no variants. Not an edge by this test; the desks are unchanged.
