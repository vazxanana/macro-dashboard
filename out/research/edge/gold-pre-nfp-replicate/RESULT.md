# Gold in the three days before US payrolls, replicated on 2006-2021: result

**Verdict: FAIL: no replication on 2006-21, -0.024R a trade net (n 156, month t -0.97, 14 of 40 placebos); month t -0.97 under 2, 2x costs not positive, 14 of 40 placebos, a half not positive.**

Pre-registered in PREREGISTRATION.md (pushed before any 2006-21 candle was read). Paper research only; a stand-alone event study on spot gold, not a gate, exit, entry or size of the live gold book (item 44: no book record or position is read). Nothing live changed. Not an edge; every figure carries its n and t.

The rule is `gold-pre-cpi`'s T2 unchanged: long gold at 17:00 New York on the third weekday before the payrolls release, out at 08:00 New York on release day, stop 2 x ATR20(H1) x √hours, $0.60 a round trip plus financing on every night held. Data: OANDA mid H1 gold through /md/bars (125704 candles, 2006-03-19 to 2026-11-13).

## The test (replication window 2006-04-07 to 2021-12-03; one test, no Holm)

| | n | months | gross R | net R | month t (one-sided p) | 2x costs | first half | second half | placebo beats | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| Pre-payrolls long, 2006-21 | 156 | 155 | +0.003 | -0.024 | -0.97 (0.832) | -0.052 | +0.001 (n 78, t 0.03) | -0.050 (n 78, t -1.5) | 14 of 40 (median -0.01, p95 0.016) | no |

Checks: net > 0 and month t ≥ 2 no; 2x costs > 0 no; 38+ of 40 placebos no; both halves > 0 no. Gross month t 0.14. Halves: 2006-04-07..2013-10-22 | 2013-11-08..2021-12-03. Stops reached: 1 of 156. Median risk a unit $56.18.

**Harness gate** (the same code on 2022-26 against gold-pre-cpi's T2, n 47, +0.088R): n 47, +0.088R, month t 2.07: reproduced.

## Reported, never judged

- **Pooled 2006-2026** (information only): +0.002R a trade net (n 203, month t 0.08, gross +0.028, 2x costs -0.025).
- On release-minute-verified dates only: -0.033R (n 145, t -1.28).
- 2006-2016: -0.014R (n 111, t -0.44); 2017-2021: -0.051R (n 45, t -1.14).
- Raw drift E → X: +0.0368 % a window (n 156, t 0.31); gold-pre-cpi measured +0.6152 % (n 47, t 2.89) on 2022-26.
- By year (net R a trade, n): 2006 0.058 (8), 2007 0.03 (10), 2008 0.097 (10), 2009 0.091 (11), 2010 -0.089 (11), 2011 0.001 (11), 2012 -0.059 (11), 2013 -0.132 (8), 2014 0.008 (10), 2015 -0.233 (10), 2016 0.062 (11), 2017 -0.094 (8), 2018 -0.036 (9), 2019 -0.061 (7), 2020 0.061 (11), 2021 -0.148 (10).

## Payroll dates

BLS pages are refused by the sandbox's proxy, so the dates are derived by the BLS rule (`dates.mjs`): the third Friday after the week holding the 12th, a Friday on or before 3 January one week later, a holiday Friday to the Thursday before; the October 2013 shutdown dates by hand (22 Oct, 8 Nov 2013, from memory). **The rule gives 56 of the 59 payroll dates of `council/events.mjs` (2022-26)**; the misses are the 2025-26 shutdown changes: 2025-11-20, 2025-12-16, 2026-02-11.

Release-minute check on OANDA M5 (08:30 New York candle range ≥ 2x the median of the same candle on the weekdays around it): of 189 dates April 2006 to December 2021, **165 verified**, 5 moved to the adjacent Friday by the check, 2 hand-written exceptions (2 verified), **17 unverified** (no M5 candles: April and May 2006; or a ratio under 2 and no adjacent Friday passing): 2006-04-07 (1.5), 2007-04-06 (0), 2007-05-04 (1.95), 2008-02-01 (1.89), 2009-01-09 (1.82), 2009-04-03 (0.99), 2009-05-08 (1.49), 2010-04-02 (1.82), 2010-07-02 (1.4), 2010-08-06 (1.92), 2010-11-05 (1.75), 2011-10-07 (1.56), 2011-11-04 (1.37), 2015-04-03 (no M5), 2019-04-05 (1.53), 2020-11-06 (1.9), 2021-04-02 (no M5). Moved: 2006-06-02 → 2006-05-26 (1.95 → 2), 2006-07-07 → 2006-06-30 (1.76 → 2.12), 2007-12-07 → 2007-12-14 (1.52 → 2.31), 2008-11-07 → 2008-11-14 (1.63 → 3.03), 2015-05-08 → 2015-05-01 (2 → 2.02).

Exclusions: FOMC 2008-21 (fomc-even-week's list) and 2006-07 (from memory, unverified), unscheduled FOMC statements, CPI 2012-17 (cpi-follow's list from memory, unverified) and 2018-21 (BLS schedule list), CPI and FOMC 2022 on from `council/events.mjs`. **No CPI list exists for 2006-11.** In 2012-2026 CPI blocked 0 payroll window(s), so the missing list should matter little.

Dropped 2006-21: 2006-06-30 (another release in the window: FOMC 2006-06-29); 2007-02-02 (another release in the window: FOMC 2007-01-31); 2007-11-02 (another release in the window: FOMC 2007-10-31); 2008-02-01 (another release in the window: FOMC 2008-01-30); 2008-05-02 (another release in the window: FOMC 2008-04-30); 2009-11-06 (another release in the window: FOMC 2009-11-04); 2010-11-05 (another release in the window: FOMC 2010-11-03); 2011-11-04 (another release in the window: FOMC 2011-11-02); 2012-08-03 (another release in the window: FOMC 2012-08-01); 2013-01-04 (missing candles); 2013-02-01 (another release in the window: FOMC 2013-01-30); 2013-05-03 (another release in the window: FOMC 2013-05-01); 2013-08-02 (another release in the window: FOMC 2013-07-31); 2014-05-02 (another release in the window: FOMC 2014-04-30); 2014-08-01 (another release in the window: FOMC 2014-07-30); 2015-04-03 (missing candles); 2015-05-01 (another release in the window: FOMC 2015-04-29); 2016-11-04 (another release in the window: FOMC 2016-11-02); 2017-02-03 (another release in the window: FOMC 2017-02-01); 2017-05-05 (another release in the window: FOMC 2017-05-03); 2017-07-07 (missing candles); 2017-11-03 (another release in the window: FOMC 2017-11-01); 2018-02-02 (another release in the window: FOMC 2018-01-31); 2018-05-04 (another release in the window: FOMC 2018-05-02); 2018-08-03 (another release in the window: FOMC 2018-08-01); 2019-01-04 (missing candles); 2019-02-01 (another release in the window: FOMC 2019-01-30); 2019-05-03 (another release in the window: FOMC 2019-05-01); 2019-08-02 (another release in the window: FOMC 2019-07-31); 2019-11-01 (another release in the window: FOMC 2019-10-30); 2020-11-06 (another release in the window: FOMC 2020-11-05); 2021-04-02 (missing candles); 2021-11-05 (another release in the window: FOMC 2021-11-03).

## Post hoc (written after the results; descriptive, not a test)

- The check moved 5 dates to an adjacent Friday, each on a ratio near the bar of 2 (2006-06-02 1.95 → 2006-05-26 2, 2006-07-07 1.76 → 2006-06-30 2.12, 2007-12-07 1.52 → 2007-12-14 2.31, 2008-11-07 1.63 → 2008-11-14 3.03, 2015-05-08 2 → 2015-05-01 2.02). From memory of the BLS schedule, at least the 2006, 2007 and 2008 moves look wrong (the release was on the derived date): gold's 08:30 candle in 2006-11 is often not much wider than on other days, so a ratio of about 2 cannot tell two Fridays apart. With the rule's own dates and no move: -0.025R a trade net (n 158, month t -0.99, 2x costs -0.053). The verdict does not depend on these 5 dates.
- The 2022-26 effect (+0.088R, raw drift +0.62 % a window) does not show in 2006-21: gross +0.003R a trade, raw drift +0.0368 %. The near miss of gold-pre-cpi was most likely its post hoc pick of the best of three tests in a strong gold market; the pooled 2006-26 figure is +0.002R (t 0.08).

## Placebo

40 seeded draws (mulberry32, seed 20261114 + draw): each event moved to a random weekday of its own month with no release of the lists on it or in its window, same times, rules and costs. Median -0.01, 95th percentile 0.016; the rule's mean beats 14 of 40.

## Notes

- Costs: $0.30 spread + $0.15 slippage on each of two market orders ($0.60); financing `nights` x `FIN.xau.long` (0.000148, 2026-11-11) x entry on every night, today's rate in every year (gold was cheaper to hold in the zero-rate years; the gross column shows the trade without it).
- To repeat: `node --use-env-proxy research/edge/gold-pre-nfp-replicate/fetch.mjs <dir>`, then `node research/edge/gold-pre-nfp-replicate/run.mjs <dir>`.
