# US CPI: follow or fade the first 15 minutes, held to the New York close: result

**Verdict: FAIL.** 0 of 4 tests pass. Best on 2020-now: fade-11:00, +0.001R an event net (n 81, t 0.02); 2012-19 -0.098R (n 78).

Paper research only; nothing live changed. Pre-registration: `PREREGISTRATION.md` (pushed before any trade was computed). A new stand-alone event rule, not a gate, exit, entry or size of the supported gold book (owner decision 44 does not apply). Not a repeat of `research/edge/event-reaction` (gold vs the dollar index's first 5-minute read, FAIL): this trades each market's own 08:30-08:45 move both ways, with a stop, net of costs.

Events: 160 CPI days (2012-02-17 to 2026-11-10); decisive 2020-now 82, replication 2012-19 78. The 2012-17 dates are from memory and were spike-checked: 54 of 72 kept, dropped 2012-01-19 (EUR/USD 1.85x, USD/JPY 1.21x), 2012-04-13 (EUR/USD 1.07x, USD/JPY 0.91x), 2012-07-17 (EUR/USD 0.82x, USD/JPY 1.1x), 2012-10-16 (EUR/USD 0.97x, USD/JPY 1.54x), 2012-11-15 (EUR/USD 0.88x, USD/JPY 1.12x), 2013-02-21 (EUR/USD 1.13x, USD/JPY 1.47x), 2013-07-16 (EUR/USD 1.2x, USD/JPY 0.94x), 2013-09-17 (EUR/USD 1.19x, USD/JPY 1.45x), 2013-10-30 (EUR/USD 0.91x, USD/JPY 0.84x), 2013-12-17 (EUR/USD 1.94x, USD/JPY 1.52x), 2014-02-20 (EUR/USD 1.49x, USD/JPY 1.57x), 2014-03-18 (EUR/USD 0.54x, USD/JPY 1.19x), 2014-11-20 (EUR/USD 1.66x, USD/JPY 1.87x), 2015-06-18 (EUR/USD 1.54x, USD/JPY 1.82x), 2015-09-16 (EUR/USD 1.78x, USD/JPY 1.65x), 2016-06-16 (EUR/USD 1.9x, USD/JPY 1.6x), 2016-12-15 (EUR/USD 1.02x, USD/JPY 0.84x), 2017-03-15 (EUR/USD 1.37x, USD/JPY 1.42x). Still to be spot-checked against bls.gov.

## The four tests (pooled over the four markets; t over events, event R = mean net R of the markets traded that day)

| Test | 2020-now events | event R | t | trades | R a trade | Holm p | 2012-19 events | event R | t | trades | R a trade | placebo p95 | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| follow-16:00 | 81 | -0.200 | -2.18 | 321 | -0.191 | 1 | 78 | -0.311 | -2.48 | 306 | -0.304 | +0.114 | no |
| follow-11:00 | 81 | -0.248 | -3.08 | 321 | -0.240 | 1 | 78 | -0.411 | -4.19 | 306 | -0.411 | +0.075 | no |
| fade-16:00 | 81 | -0.066 | -1.01 | 321 | -0.068 | 1 | 78 | +0.054 | 0.5 | 306 | +0.046 | +0.123 | no |
| fade-11:00 | 81 | +0.001 | 0.02 | 321 | +0.000 | 1 | 78 | -0.098 | -1.41 | 306 | -0.102 | +0.103 | no |

Checks per test (decisive t >= 2 and R > 0 / Holm p < 0.05 / 2012-19 same sign / above placebo p95):

- follow-16:00: decisive no, holm no, replication no, placebo no
- follow-11:00: decisive no, holm no, replication no, placebo no
- fade-16:00: decisive no, holm no, replication yes, placebo no
- fade-11:00: decisive no, holm no, replication no, placebo no

## Before costs and at double costs (2020-now, event R, t)

| Test | gross event R | t | 2x costs event R | t | median cost in R | stopped out |
|---|---|---|---|---|---|---|
| follow-16:00 | -0.090 | -0.99 | -0.311 | -3.31 | 0.055 | 166 of 321 |
| follow-11:00 | -0.138 | -1.72 | -0.358 | -4.35 | 0.055 | 138 of 321 |
| fade-16:00 | -0.012 | -0.18 | -0.121 | -1.79 | 0.032 | 72 of 321 |
| fade-11:00 | +0.056 | 1.12 | -0.054 | -1 | 0.032 | 42 of 321 |

## By market (net R a trade, t over trades; reported, never judged)

| Test | Market | 2020-now n | R a trade | t | 2012-19 n | R a trade | t |
|---|---|---|---|---|---|---|---|
| follow-16:00 | xau | 80 | -0.121 | -0.76 | 77 | +0.081 | 0.32 |
| follow-16:00 | eurusd | 80 | -0.311 | -1.96 | 77 | +0.128 | 0.49 |
| follow-16:00 | usdjpy | 81 | -0.079 | -0.54 | 78 | -0.400 | -2.69 |
| follow-16:00 | nas100 | 80 | -0.252 | -1.41 | 74 | -1.053 | -4.61 |
| follow-11:00 | xau | 80 | -0.139 | -1.17 | 77 | -0.086 | -0.45 |
| follow-11:00 | eurusd | 80 | -0.350 | -2.39 | 77 | -0.067 | -0.38 |
| follow-11:00 | usdjpy | 81 | -0.208 | -1.76 | 78 | -0.363 | -2.69 |
| follow-11:00 | nas100 | 80 | -0.262 | -1.6 | 74 | -1.159 | -6.23 |
| fade-16:00 | xau | 80 | -0.079 | -0.84 | 77 | +0.063 | 0.48 |
| fade-16:00 | eurusd | 80 | +0.034 | 0.24 | 77 | +0.174 | 1.05 |
| fade-16:00 | usdjpy | 81 | -0.236 | -2.87 | 78 | +0.163 | 1.14 |
| fade-16:00 | nas100 | 80 | +0.011 | 0.08 | 74 | -0.228 | -1 |
| fade-11:00 | xau | 80 | +0.013 | 0.18 | 77 | -0.010 | -0.11 |
| fade-11:00 | eurusd | 80 | +0.020 | 0.21 | 77 | -0.024 | -0.21 |
| fade-11:00 | usdjpy | 81 | -0.173 | -2.62 | 78 | -0.020 | -0.24 |
| fade-11:00 | nas100 | 80 | +0.144 | 1.28 | 74 | -0.365 | -2.19 |

## Year by year (net event R, n events)

| Year | follow-16:00 | follow-11:00 | fade-16:00 | fade-11:00 |
|---|---|---|---|---|
| 2012 | +0.334 (7) | -0.181 (7) | +0.270 (7) | +0.109 (7) |
| 2013 | -0.950 (7) | -0.781 (7) | +0.229 (7) | +0.000 (7) |
| 2014 | -0.528 (9) | -0.672 (9) | +0.061 (9) | -0.075 (9) |
| 2015 | -0.012 (10) | +0.030 (10) | +0.031 (10) | -0.089 (10) |
| 2016 | -0.606 (10) | -0.642 (10) | -0.002 (10) | -0.313 (10) |
| 2017 | -0.415 (11) | -0.358 (11) | +0.051 (11) | +0.001 (11) |
| 2018 | -0.427 (12) | -0.535 (12) | +0.139 (12) | -0.062 (12) |
| 2019 | +0.060 (12) | -0.232 (12) | -0.194 (12) | -0.246 (12) |
| 2020 | -0.326 (11) | -0.184 (11) | -0.287 (11) | -0.269 (11) |
| 2021 | +0.071 (12) | -0.154 (12) | -0.021 (12) | +0.104 (12) |
| 2022 | -0.172 (12) | -0.184 (12) | +0.006 (12) | +0.068 (12) |
| 2023 | -0.063 (12) | -0.184 (12) | -0.128 (12) | -0.005 (12) |
| 2024 | -0.198 (12) | -0.194 (12) | +0.090 (12) | +0.059 (12) |
| 2025 | -0.101 (11) | -0.238 (11) | -0.175 (11) | -0.016 (11) |
| 2026 | -0.654 (11) | -0.624 (11) | +0.031 (11) | +0.046 (11) |

## Placebo

Each test's rule, filter, costs and exit on random non-event weekdays of 2020-now (pool 1619 days; 40 seeds, as many days as the test's decisive events). Placebo median / 95th percentile of the mean event R: follow-16:00 -0.185 / +0.114; follow-11:00 -0.163 / +0.075; fade-16:00 -0.087 / +0.123; fade-11:00 -0.108 / +0.103.

## Data

OANDA mid M5 candles from the site's candle proxy, December 2011 to the run date, kept out of git. Gold and NAS100 reuse the continuous 2007-26 files of the fomc-follow study; EUR/USD and USD/JPY reuse the 2015-26 files of the fx-london-orb study, and 2011-12 to 2015-11 was fetched for this study (same proxy, same candles). The spike check is a guard on the memory dates only: it also drops real releases with a quiet first candle (2013-10-30, the delayed September 2013 CPI, is one), as pre-registered; no date was moved.

## Costs

Gold $0.30 a round trip (as fixed; no event slippage). EUR/USD and USD/JPY 0.3 pip + 22.5 USD a million a side + 1 pip of slippage on each of the two market fills. NAS100 1.5 points + 1 point on each of the two fills (3.5 points). Never call this rule an edge unless a test above says PASS.
