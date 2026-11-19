# Treasuries after the FOMC, following the 2-year's reading of the decision: result

**Verdict: FAIL.** Neither test passes the pre-registered bar. 2016 → now, net of costs: USB10Y −0.167R a trade (n 79, month t −2.09), USB30Y −0.117R (n 79, month t −1.44).

Paper research only. No live rule, size, filter, stop, config or council member changed. Rule, costs, windows, placebo and pass bar were fixed in `PREREGISTRATION.md` (commit 465368d0e) before any candle of this study was fetched.

## What was tested

Scheduled FOMC decision days 2008 to October 2026 (150 in the two windows; Federal Reserve FOMC meeting calendars (federalreserve.gov), scheduled meetings only: 2008-2021 copied from the pre-fomc-drift study (from memory, to be checked there), 2022 on copied from council/events.mjs). Signal: the USB02Y (US 2-year Treasury CFD, OANDA mid M5) change from the close of the candle ending 5 minutes before the statement to the close of the candle ending 16:00 New York that day; up (yield down) → buy, down → sell. Trade: USB10Y (T1) and USB30Y (T2) at the 09:30 New York open of the next trading day, out at the 16:00 New York close of the third trading day; stop 1.5 × ATR(20) of complete daily candles (weekends folded), checked on hourly blocks from the entry (a block opening beyond the stop exits at its open). Costs: 0.10 % of price a round trip (the tsmom bond CFD assumption) and financing per rollover (`council/fills.mjs` `nights`; long DGS2 + 2.5 % a year, short max(0, 2.5 % − DGS2)). t on calendar-month sums of net R; Holm over T1 and T2; placebo 40 seeds of random non-FOMC weekdays with the same construction (13:55 → 16:00 on that day). Decisive 2016-01-01 → 2026-11-13; replication 2008-2015. Candles to 2026-11-12.

## The tests

| Test | Window | n | Gross R a trade | Net R a trade | Net at x2 costs | Month t (net) | One-sided p | Holm p | Win | Stops (gaps) | Total net R | Placebo net p5 / p50 / p95 | Beats seeds |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 USB10Y | 2016 → now | 79 | +0.013 | −0.167 | −0.346 | −2.09 | 0.9800 | 1.0000 | 39 % | 11 (1) | −13.18 | −0.268 / −0.172 / −0.081 | 21 / 40 |
| T1 USB10Y | 2008-2015 | 56 | +0.093 | −0.044 | −0.181 | −0.51 | 0.6938 | — | 45 % | 3 (0) | −2.46 | −0.223 / −0.151 / +0.014 | 33 / 40 |
| T2 USB30Y | 2016 → now | 79 | −0.027 | −0.117 | −0.207 | −1.44 | 0.9226 | 1.0000 | 41 % | 14 (2) | −9.26 | −0.203 / −0.057 / +0.022 | 11 / 40 |
| T2 USB30Y | 2008-2015 | 56 | +0.121 | +0.043 | −0.034 | +0.48 | 0.3149 | — | 54 % | 3 (0) | +2.43 | −0.181 / −0.102 / +0.082 | 35 / 40 |
| Pooled (both) | 2016 → now | 158 | −0.007 | −0.142 | −0.277 | −1.79 | 0.9617 | 0.9617 | 40 % | 25 (3) | −22.44 | −0.235 / −0.128 / −0.035 | 14 / 40 |
| Pooled (both) | 2008-2015 | 112 | +0.107 | −0.000 | −0.107 | −0.00 | 0.5013 | — | 49 % | 6 (0) | −0.03 | −0.215 / −0.119 / +0.037 | 35 / 40 |

| Test | 1: net > 0 and t ≥ 2 | 2: Holm p < 0.05 | 3: above placebo p95 | 4: replication > 0 | 5: > 0 at x2 costs | Pass |
|---|---|---|---|---|---|---|
| T1 USB10Y | no | no | no | no | no | no |
| T2 USB30Y | no | no | no | yes | no | no |
| Pooled (both) | no | no | no | no | no | no |

The pooled test is reported with the same checks and does not decide alone (as pre-registered).

## Costs and placebo t (descriptive)

| Test | Window | Without financing | Spread a trade (R) | Financing a trade (R) | Month t gross | Month t at x2 costs | Per-trade t | Long / short | Placebo month t p5 / p50 / p95 |
|---|---|---|---|---|---|---|---|---|---|
| T1 USB10Y | 2016 → now | −0.140 | 0.153 | 0.027 | +0.16 | −4.26 | −2.09 | 51 / 28 | −4.12 / −2.11 / −1.03 |
| T1 USB10Y | 2008-2015 | −0.024 | 0.118 | 0.020 | +1.07 | −2.11 | −0.51 | 31 / 25 | −2.78 / −1.76 / +0.16 |
| T2 USB30Y | 2016 → now | −0.105 | 0.077 | 0.012 | −0.34 | −2.52 | −1.44 | 51 / 28 | −2.88 / −0.75 / +0.31 |
| T2 USB30Y | 2008-2015 | +0.054 | 0.066 | 0.011 | +1.34 | −0.38 | +0.48 | 31 / 25 | −2.06 / −1.16 / +0.95 |
| Pooled (both) | 2016 → now | −0.122 | 0.115 | 0.020 | −0.09 | −3.45 | −2.49 | 102 / 56 | −3.41 / −1.63 / −0.47 |
| Pooled (both) | 2008-2015 | +0.015 | 0.092 | 0.015 | +1.25 | −1.27 | −0.00 | 62 / 50 | −2.73 / −1.44 / +0.44 |

## By side (net R a trade, descriptive)

| Test | Window | Buy n | Buy net | Sell n | Sell net |
|---|---|---|---|---|---|
| T1 USB10Y | 2016 → now | 51 | −0.196 | 28 | −0.114 |
| T1 USB10Y | 2008-2015 | 31 | −0.036 | 25 | −0.053 |
| T2 USB30Y | 2016 → now | 51 | −0.179 | 28 | −0.005 |
| T2 USB30Y | 2008-2015 | 31 | +0.080 | 25 | −0.002 |

## By year (net R summed, n)

- T1 USB10Y: 2008 −0.34 (8) · 2009 −0.98 (8) · 2010 −2.66 (8) · 2011 −0.59 (8) · 2012 +3.13 (8) · 2013 +0.99 (2) · 2014 −1.11 (7) · 2015 −0.90 (7) · 2016 −1.62 (8) · 2017 −1.08 (8) · 2018 −2.48 (4) · 2019 −4.93 (8) · 2020 −2.01 (5) · 2021 +2.09 (7) · 2022 +2.73 (8) · 2023 −2.90 (8) · 2024 +0.63 (8) · 2025 −4.39 (8) · 2026 +0.77 (7)
- T2 USB30Y: 2008 +0.89 (8) · 2009 −0.57 (8) · 2010 −0.42 (8) · 2011 −0.05 (8) · 2012 +3.32 (8) · 2013 +1.58 (2) · 2014 −1.85 (7) · 2015 −0.47 (7) · 2016 −1.16 (8) · 2017 −0.52 (8) · 2018 −2.71 (4) · 2019 −4.45 (8) · 2020 −1.46 (5) · 2021 +3.30 (7) · 2022 +2.35 (8) · 2023 −2.02 (8) · 2024 +1.09 (8) · 2025 −4.09 (8) · 2026 +0.41 (7)

## Event list check

USB02Y range of the M5 candle at the statement minute against the same clock candle on weekdays within ±25 days: median 9.00x. Below 1x (listed, not dropped): 2013-03-20, 2013-05-01. No candle at the statement minute: 2012-10-24, 2013-01-30, 2020-11-05.

Skipped: 2013-01-30 (no 2-year candle before the statement); 2013-03-20 (no change in the 2-year); 2013-05-01 (no 2-year candle before the statement); 2013-07-31 (no 2-year candle before the statement); 2013-10-30 (no 2-year candle before the statement); 2013-12-18 (no 2-year candle at 16:00); 2014-01-29 (no 2-year candle before the statement); 2015-07-29 (no 2-year candle at 16:00); 2018-01-31 (no change in the 2-year); 2018-05-02 (no 2-year candle before the statement); 2018-08-01 (no 2-year candle at 16:00); 2018-11-08 (no 2-year candle before the statement); 2020-04-29 (no change in the 2-year); 2020-11-05 (no 2-year candle before the statement); 2021-01-27 (no 2-year candle at 16:00).

## What this means

The pre-registered bar is not met: following the 2-year's decision-day move in the 10-year or 30-year Treasury CFD over the next three trading days is not an edge on the council's feed after costs. No proposal is written and nothing live changed. Any other version (a threshold on the 2-year's move, another hold, other maturities, European bonds) would need its own pre-registration on data not used here.

## Caveats

- The 2008-2021 decision dates were written from memory in the pre-fomc-drift study (federalreserve.gov could not be reached from the build sandbox); check them against the Federal Reserve's calendars. 2022 on are the repository's own calendar.
- The bond CFD spread (0.10 % of price a round trip) is the tsmom study's assumption, not a measured spread; the financing markup (2.5 %) is assumed too, and the Wednesday triple rollover of `nights` is the gold rule (a week counts seven nights either way). DGS2 is weekly.
- The 2008-2012 statements at 14:15 / 12:30 use a signal window starting 5 minutes before the statement (the pre-registration's rule); the placebo always uses 13:55 → 16:00.
- Seen after the run (post hoc, changes nothing): OANDA's USB02Y M5 history is thin at times (15 decision days skipped for a missing 2-year candle or no change, most in 2013-14 and 2018); and on the 10-year the assumed spread alone is about 0.15R a trade, larger than the gross result in either window.
