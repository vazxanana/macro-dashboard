# Five other central banks: follow the first hour after the decision: result

**Verdict: FAIL.** Pooled over the five banks, 2018 → now: n 320, +0.208R a trade net, month t +1.77; 2010-17 −0.030R (n 273); placebo p95 +0.068R; at 2x cost +0.116R.

Pre-registered in `PREREGISTRATION.md` (committed with `dates.json` and `frozen.mjs` before any trade was computed). The frozen ecb-boj-days rule on five other central banks' scheduled decisions; a stand-alone event rule on forex, not a test of the gold book (owner decision item 44 untouched). Rule (frozen, byte for byte the ecb-boj-days trade function): direction of the first 60 minutes after the decision (close of the M5 candle ending at D + 60 min against the one ending at D); entry at D + 60 min in that direction, stop 1 x the 14-hour ATR known at D, no target, out at 21:00 UTC (BoE, BoC, SNB) / 15:00 UTC (RBA, RBNZ). D: 12:00 London, 09:45 or 10:00 Toronto (larger-range candle), 09:30 Zurich, 14:30 Sydney, 14:00 Wellington (before 2019 the larger-range candle of 09:00 and 14:00; 09:00 = no trade). Costs: per round trip 0.3 pip spread + 0.3 pip slippage + 45 USD per million notional commission (0.0045 % of the price). Data: OANDA mid M5 through the candle proxy.

## The tests (the pooled row decides; 2018 → now)

| bank | window | n | net R a trade | month t | Holm p (5 banks) | 2010-17 net R (n) | placebo p5 / p50 / p95 | at 2x cost: net R (month t) | all bars met |
|---|---|---|---|---|---|---|---|---|---|
| BoE, GBP/USD | 2018-01-01 → 2026-11-13 | 71 | +0.110 | +0.46 | 0.9655 | −0.215 (90) | −0.352 / −0.172 / +0.194 | +0.036 (+0.15) | no |
| BoC, USD/CAD | 2018-01-01 → 2026-11-13 | 71 | −0.121 | −0.60 | 0.9655 | +0.253 (64) | −0.361 / −0.081 / +0.190 | −0.221 (−1.10) | no |
| SNB, USD/CHF | 2018-01-01 → 2026-11-13 | 35 | +0.038 | +0.09 | 0.9655 | −0.179 (32) | −0.572 / −0.216 / +0.714 | −0.067 (−0.15) | no |
| RBA, AUD/USD | 2018-01-01 → 2026-11-13 | 89 | +0.445 | +1.73 | 0.2093 | +0.009 (87) | −0.325 / −0.134 / +0.098 | +0.349 (+1.36) | no |
| RBNZ, NZD/USD | 2018-01-01 → 2026-11-13 | 54 | +0.489 | +1.52 | 0.2551 | n/a (0) | −0.425 / −0.052 / +0.372 | +0.401 (+1.25) | no |
| **Pooled (decides)** | 2018 → now | 320 | +0.208 | +1.77 | n/a (one-sided p 0.0384) | −0.030 (273) | −0.253 / −0.119 / +0.068 | +0.116 (+0.99) | no |

Pooled bars: nOk yes, positive yes, t2 no, sameSign no, beatsPlacebo yes, cost2 yes (n ≥ 40; mean net R > 0; month-sum t ≥ 2 with every month of the window counted, 0 without a trade; positive in 2010-17; above the 95th percentile of 40 placebo seeds, 40 of 40 beaten; positive at 2x cost). The per-bank rows are reported only (their "all bars met" adds Holm p < 0.05 over the five); they cannot decide the verdict.

## Detail per window

| bank | window | events | trades | net R | month t | trade t | gross R | cost R | win | exits | skipped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BoE, GBP/USD | 2010-2017 | 90 | 90 | −0.215 | −1.09 | −1.09 | −0.141 | +0.075 | 23 % | stop 69, time 21 | none |
| BoE, GBP/USD | 2018 → now | 71 | 71 | +0.110 | +0.46 | +0.46 | +0.184 | +0.074 | 34 % | stop 47, time 24 | none |
| BoC, USD/CAD | 2010-2017 | 64 | 64 | +0.253 | +0.94 | +0.94 | +0.329 | +0.076 | 38 % | stop 34, time 30 | none |
| BoC, USD/CAD | 2018 → now | 71 | 71 | −0.121 | −0.60 | −0.60 | −0.021 | +0.100 | 30 % | stop 46, time 25 | none |
| SNB, USD/CHF | 2010-2017 | 32 | 32 | −0.179 | −0.62 | −0.62 | −0.105 | +0.074 | 28 % | stop 22, time 9, gap 1 | none |
| SNB, USD/CHF | 2018 → now | 35 | 35 | +0.038 | +0.09 | +0.09 | +0.143 | +0.105 | 20 % | stop 27, time 8 | none |
| RBA, AUD/USD | 2010-2017 | 88 | 87 | +0.009 | +0.04 | +0.04 | +0.083 | +0.074 | 26 % | stop 63, time 24 | no direction 1 |
| RBA, AUD/USD | 2018 → now | 89 | 89 | +0.445 | +1.73 | +1.73 | +0.542 | +0.096 | 33 % | stop 56, time 33 | none |
| RBNZ, NZD/USD | 2010-2017 | 62 | 0 | n/a | n/a | n/a | n/a | n/a | 0 % |  | early clock (09:00 Wellington) 62 |
| RBNZ, NZD/USD | 2018 → now | 61 | 54 | +0.489 | +1.52 | +1.53 | +0.577 | +0.088 | 39 % | time 22, stop 31, gap 1 | early clock (09:00 Wellington) 7 |
| Pooled | 2018 → now | | 320 | +0.208 | +1.77 | +1.70 | +0.300 | +0.092 | 32 % | stop 207, time 112, gap 1 | |

## By year (net R a trade, n)

- BoE, GBP/USD, 2010-2017: 2010 −1.05 (12) · 2011 −0.34 (12) · 2012 −0.09 (12) · 2013 −0.15 (12) · 2014 +0.11 (12) · 2015 +0.41 (11) · 2016 −0.56 (11) · 2017 +0.08 (8)
- BoE, GBP/USD, 2018 → now: 2018 +0.12 (8) · 2019 +0.55 (8) · 2020 +0.79 (8) · 2021 −0.50 (8) · 2022 −0.41 (8) · 2023 −0.70 (8) · 2024 +1.08 (8) · 2025 −0.45 (8) · 2026 +0.56 (7)
- BoC, USD/CAD, 2010-2017: 2010 +0.37 (8) · 2011 −0.58 (8) · 2012 −0.89 (8) · 2013 −0.39 (8) · 2014 +0.50 (8) · 2015 +1.06 (8) · 2016 +0.12 (8) · 2017 +1.85 (8)
- BoC, USD/CAD, 2018 → now: 2018 −0.48 (8) · 2019 +1.09 (8) · 2020 +0.20 (8) · 2021 −0.40 (8) · 2022 −0.29 (8) · 2023 −1.08 (8) · 2024 −0.28 (8) · 2025 −0.27 (8) · 2026 +0.50 (7)
- SNB, USD/CHF, 2010-2017: 2010 +0.29 (4) · 2011 −0.35 (4) · 2012 −1.10 (4) · 2013 −1.08 (4) · 2014 −0.75 (4) · 2015 −0.79 (4) · 2016 +2.08 (4) · 2017 +0.26 (4)
- SNB, USD/CHF, 2018 → now: 2018 +1.83 (4) · 2019 −1.11 (4) · 2020 +1.06 (4) · 2021 −0.02 (4) · 2022 +0.17 (4) · 2023 −0.89 (4) · 2024 −1.14 (4) · 2025 +0.41 (4) · 2026 +0.02 (3)
- RBA, AUD/USD, 2010-2017: 2010 +0.97 (11) · 2011 +0.60 (11) · 2012 −0.49 (11) · 2013 −1.07 (11) · 2014 −0.12 (11) · 2015 +0.45 (11) · 2016 +0.60 (10) · 2017 −0.81 (11)
- RBA, AUD/USD, 2018 → now: 2018 +1.07 (11) · 2019 +0.31 (11) · 2020 +0.35 (11) · 2021 +0.35 (11) · 2022 +0.18 (11) · 2023 +1.60 (11) · 2024 −0.04 (8) · 2025 +0.65 (8) · 2026 −1.10 (7)
- RBNZ, NZD/USD, 2010-2017: 
- RBNZ, NZD/USD, 2018 → now: 2019 +0.29 (7) · 2020 −0.07 (6) · 2021 +1.34 (7) · 2022 −0.19 (7) · 2023 +0.51 (7) · 2024 +0.68 (7) · 2025 −0.60 (7) · 2026 +2.10 (6)

## The clock check (direction-free) and unconfirmed decision candles

- BoE, GBP/USD, 2010-2017: Confirmed (chosen candle over 2x its minute's 20-day median): 73 of 90; not confirmed: 2010-09-09, 2010-12-09, 2011-06-09, 2011-07-07, 2011-12-08, 2012-01-12, 2012-03-08, 2012-04-05, 2014-07-10, 2014-10-09, 2015-01-08, 2015-02-05, 2015-03-05, 2015-04-09, 2015-05-11, 2015-06-04, 2015-07-09.
- BoE, GBP/USD, 2018 → now: Confirmed (chosen candle over 2x its minute's 20-day median): 69 of 71; not confirmed: 2018-12-20, 2020-11-05.
- BoC, USD/CAD, 2010-2017: minute picked: 2010 09:45 5 / 10:00 3 · 2011 10:00 6 / 09:45 2 · 2012 10:00 5 / 09:45 3 · 2013 10:00 8 · 2014 10:00 8 · 2015 10:00 8 · 2016 10:00 8 · 2017 10:00 8. Confirmed (chosen candle over 2x its minute's 20-day median): 45 of 64; not confirmed: 2010-01-19, 2010-03-02, 2010-07-20, 2010-09-08, 2010-10-19, 2010-12-07, 2011-01-18, 2011-03-01, 2011-04-12, 2011-05-31, 2011-07-19, 2011-09-07, 2011-12-06, 2012-01-17, 2012-03-08, 2012-04-17, 2012-06-05, 2012-12-04, 2013-06-05.
- BoC, USD/CAD, 2018 → now: minute picked: 2018 10:00 8 · 2019 10:00 8 · 2020 10:00 8 · 2021 10:00 8 · 2022 10:00 8 · 2023 10:00 8 · 2024 09:45 8 · 2025 09:45 7 / 10:00 1 · 2026 10:00 2 / 09:45 5. Confirmed (chosen candle over 2x its minute's 20-day median): 68 of 71; not confirmed: 2025-06-04, 2026-03-18, 2026-07-15.
- SNB, USD/CHF, 2010-2017: Confirmed (chosen candle over 2x its minute's 20-day median): 22 of 32; not confirmed: 2010-03-11, 2010-09-16, 2011-09-15, 2012-06-14, 2012-12-13, 2013-09-19, 2013-12-12, 2016-12-15, 2017-03-16, 2017-06-15.
- SNB, USD/CHF, 2018 → now: Confirmed (chosen candle over 2x its minute's 20-day median): 29 of 35; not confirmed: 2018-06-21, 2018-12-13, 2019-03-21, 2020-09-24, 2020-12-17, 2021-06-17.
- RBA, AUD/USD, 2010-2017: Confirmed (chosen candle over 2x its minute's 20-day median): 87 of 87; not confirmed: none.
- RBA, AUD/USD, 2018 → now: Confirmed (chosen candle over 2x its minute's 20-day median): 87 of 89; not confirmed: 2020-04-07, 2020-12-01.
- RBNZ, NZD/USD, 2010-2017: minute picked: 2010 09:00 8 · 2011 09:00 8 · 2012 09:00 8 · 2013 09:00 8 · 2014 09:00 8 · 2015 09:00 8 · 2016 09:00 7 · 2017 09:00 7. Confirmed (chosen candle over 2x its minute's 20-day median): 0 of 0; not confirmed: none.
- RBNZ, NZD/USD, 2018 → now: minute picked: 2018 09:00 7. Confirmed (chosen candle over 2x its minute's 20-day median): 52 of 54; not confirmed: 2026-08-19, 2026-10-07.

## What this means

The pooled test does not meet the pre-registered bar, so following the first hour after these five central banks' decisions is not an edge on the council's feed after costs. With ecb-boj-days (ECB near miss, BoJ flat) this closes the rule: the ECB figure did not repeat on independent decisions. No proposal is written and nothing live changed. This was a stand-alone event rule, not a test of the gold book (item 44). Any other version (another first window, exit time, stop, pair or filter) would need its own pre-registration on data not used here.

Post hoc reading (not part of the verdict): the pooled bars missed are t2, sameSign. Most of the 2018 → now mean comes from RBA, AUD/USD +0.445R (t +1.73, 2010-17 +0.009R); RBNZ, NZD/USD +0.489R (t +1.52, 2010-17 no trade); the same rule earned −0.030R a trade over the five banks in 2010-17, so the recent figure did not hold on the earlier years. A per-bank result picked after seeing these rows is not evidence; a follow-up on one bank would need its own pre-registration on data not used here.

RBNZ before 2019: the pre-registered clock check picked 09:00 Wellington on 62 of 62 dates in 2010-17 and 7 in 2018, so those dates give no trade by the rule (the announcement fell on the UTC evening before) and the RBNZ has no 2010-17 trade. That is consistent with the bank publishing at 09:00 until 2018 and at 14:00 from 2019.

Caveat: every date is written from memory of the banks' calendars (the sandbox cannot reach their sites); `dates.json` lists the uncertain ones and where to check them. A wrong date gives a trade on an ordinary day and pulls the result toward the placebo. The "not confirmed" dates above are where the date, the minute or the feed may be off.

To repeat: `node --use-env-proxy research/edge/cb-days-other/fetch.mjs <dir>`, then `node research/edge/cb-days-other/run.mjs <dir>`. Tests: `tests/cb-days-other.test.mjs`.
