# ECB and BoJ decision days: follow the first hour: result

**Verdict: FAIL, 0 of 2 tests.** 2018 → now: T1 ECB, EUR/USD: n 71, +0.631R a trade net, month t +1.51, Holm p 0.1315, 2010-17 +0.471R; T2 BoJ, USD/JPY: n 67, +0.064R a trade net, month t +0.22, Holm p 0.4121, 2010-17 +0.152R. Pooled +0.356R (n 138, month t +1.48).

Pre-registered in `PREREGISTRATION.md` (committed with `dates.json` before any trade of the rule was computed). A new stand-alone event rule on EUR/USD and USD/JPY; not a test of the gold book (owner decision item 44 untouched). Rule: direction of the first 60 minutes after the decision (close of the M5 candle ending at D + 60 min against the one ending at D); entry at D + 60 min in that direction, stop 1 x the 14-hour ATR known at D, no target, out at 21:00 UTC (ECB) / 15:00 UTC (BoJ). D: ECB the larger-range candle of 13:45 / 14:15 Frankfurt; BoJ the first M5 candle from 03:00 UTC with a range above 2x the median of that hour on the 20 previous weekdays (none before 05:00 UTC: no trade). Costs: per round trip 0.3 pip spread + 0.3 pip slippage + 45 USD per million notional commission (0.0045 % of the price). Data: OANDA mid M5 through the candle proxy. Dates: 2010 to July 2025: written from memory of the central banks' published calendars, because the build sandbox cannot reach ecb.europa.eu or boj.or.jp (not checked against them). August 2025 on: copied from council/events.mjs (RAW.ECB, RAW.BOJ), which was checked against the official pages. Where to check: ECB Governing Council monetary policy meeting calendar and the press releases of each date (ecb.europa.eu/press/calendars/mgcgc/html/index.en.html, ecb.europa.eu/press/pr/html/index.en.html); Bank of Japan Monetary Policy Meeting schedule and the statements on monetary policy of each meeting (boj.or.jp/en/mopo/mpmsche_minu/index.htm, boj.or.jp/en/mopo/mpmdeci/state_all/index.htm).

## The tests (2018 → now decides)

| test | window | n | net R a trade | month t | Holm p | 2010-17 net R (n) | placebo p5 / p50 / p95 | at 2x cost: net R (month t) | pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 ECB, EUR/USD | 2018-01-01 → 2026-11-13 | 71 | +0.631 | +1.51 | 0.1315 | +0.471 (84) | −0.309 / −0.141 / +0.230 | +0.520 (+1.25) | no |
| T2 BoJ, USD/JPY | 2018-01-01 → 2026-11-13 | 67 | +0.064 | +0.22 | 0.4121 | +0.152 (95) | −0.353 / +0.049 / +0.230 | −0.011 (−0.04) | no |
| Pooled (not in Holm, cannot pass alone) | 2018 → now | 138 | +0.356 | +1.48 | n/a | +0.302 (179) | −0.215 / −0.027 / +0.150 | +0.262 (+1.09) | no |

"pass" = n ≥ 40, mean net R > 0, month-sum t ≥ 2 (every month of the window counted, 0 without a trade), Holm p < 0.05 over T1 and T2, positive in 2010-17 and above the placebo's 95th percentile (the same rule on non-event weekdays near each event, 40 seeds).

## Detail per window

| test | window | events | trades | net R | month t | trade t | gross R | cost R | win | exits | skipped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 ECB, EUR/USD | 2010-2017 | 84 | 84 | +0.471 | +1.41 | +1.41 | +0.554 | +0.084 | 27 % | stop 60, time 24 | none |
| T1 ECB, EUR/USD | 2018 → now | 71 | 71 | +0.631 | +1.51 | +1.51 | +0.742 | +0.111 | 25 % | stop 53, time 18 | none |
| T2 BoJ, USD/JPY | 2010-2017 | 100 | 95 | +0.152 | +0.62 | +0.59 | +0.231 | +0.079 | 27 % | stop 65, time 30 | no direction 1, no release bar 4 |
| T2 BoJ, USD/JPY | 2018 → now | 71 | 67 | +0.064 | +0.22 | +0.22 | +0.140 | +0.076 | 24 % | stop 49, time 18 | no release bar 4 |

## By year (net R a trade, n)

- T1 ECB, EUR/USD, 2010-2017: 2010 −0.05 (12) · 2011 +0.78 (12) · 2012 −0.87 (12) · 2013 +0.89 (12) · 2014 +1.69 (12) · 2015 +3.04 (8) · 2016 −0.65 (8) · 2017 −1.10 (8)
- T1 ECB, EUR/USD, 2018 → now: 2018 +1.16 (8) · 2019 +0.51 (8) · 2020 +1.54 (8) · 2021 −0.25 (8) · 2022 +1.06 (8) · 2023 +1.64 (8) · 2024 +0.80 (8) · 2025 −1.10 (8) · 2026 +0.28 (7)
- T2 BoJ, USD/JPY, 2010-2017: 2010 +0.16 (12) · 2011 +0.61 (13) · 2012 +0.29 (14) · 2013 +0.85 (13) · 2014 −0.47 (14) · 2015 −0.34 (13) · 2016 +1.00 (8) · 2017 −0.96 (8)
- T2 BoJ, USD/JPY, 2018 → now: 2018 −0.21 (8) · 2019 −0.23 (7) · 2020 −0.46 (7) · 2021 −0.60 (8) · 2022 +1.16 (7) · 2023 −0.04 (8) · 2024 +0.32 (8) · 2025 +1.08 (8) · 2026 −0.56 (6)

## The ECB clock check (direction-free; which candidate minute had the larger candle)

- 2010-2017: 2010 13:45 8 / 14:15 4 · 2011 13:45 10 / 14:15 2 · 2012 13:45 9 / 14:15 3 · 2013 13:45 9 / 14:15 3 · 2014 13:45 11 / 14:15 1 · 2015 13:45 7 / 14:15 1 · 2016 13:45 7 / 14:15 1 · 2017 13:45 8 / 14:15 0. Confirmed (chosen candle over 2x its minute's 20-day median): 56 of 84; not confirmed: 2010-01-14, 2010-02-04, 2010-03-04, 2010-04-08, 2010-06-10, 2010-07-08, 2010-08-05, 2010-09-02, 2010-10-07, 2010-11-04, 2010-12-02, 2011-01-13, 2011-02-03, 2011-05-05, 2011-06-09, 2011-08-04, 2012-03-08, 2012-04-04, 2012-11-08, 2013-08-01, 2014-07-03, 2014-08-07, 2015-03-05, 2015-04-15, 2015-07-16, 2015-09-03, 2015-10-22, 2017-01-19.
- 2018 → now: 2018 13:45 8 / 14:15 0 · 2019 13:45 8 / 14:15 0 · 2020 13:45 8 / 14:15 0 · 2021 13:45 7 / 14:15 1 · 2022 13:45 4 / 14:15 4 · 2023 13:45 0 / 14:15 8 · 2024 13:45 0 / 14:15 8 · 2025 13:45 2 / 14:15 6 · 2026 13:45 0 / 14:15 7. Confirmed (chosen candle over 2x its minute's 20-day median): 64 of 71; not confirmed: 2018-09-13, 2019-04-10, 2019-10-24, 2019-12-12, 2020-01-23, 2025-01-30, 2025-10-30.

## What this means

No test meets the pre-registered bar, so following the first hour after an ECB or BoJ decision is not an edge on the council's feed after costs. No proposal is written and nothing live changed. This was a new stand-alone event rule, not a test of the gold book (item 44). Any other version (another first window, exit time, stop, pair or filter) would need its own pre-registration on data not used here.

Post hoc reading (not part of the verdict): T1 ECB, EUR/USD made money in both windows and beat the placebo's 95th percentile, but its month-sum t is under 2 (a few large time exits carry the mean; most trades are stopped). That is not evidence of an edge; a follow-up would need its own pre-registration on data not used here.

Caveat: the dates before August 2025 were written from memory of the central banks' calendars (the sandbox cannot reach their sites); `dates.json` lists the uncertain ones and where to check them. The ECB clock check (pre-registered) picks the larger of two candles, so on a quiet decision it can pick the wrong minute (it did not confirm 2025-10-30, which come from the checked council calendar); the "not confirmed" dates above are where the date, the minute or the feed may be off.

To repeat: `node --use-env-proxy research/edge/ecb-boj-days/fetch.mjs <dir>`, then `node research/edge/ecb-boj-days/run.mjs <dir>`. Tests: `tests/ecb-boj-days.test.mjs`.
