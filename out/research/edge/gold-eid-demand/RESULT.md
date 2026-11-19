# Result: spot gold into and after the two Eids (2026-11-14)

**Verdict: FAIL (0 of 3 pass): OOS excess over every-day trade: Fitr run-up +0.375R (n 10, t +0.93), Adha +0.279R (t +0.55), post-Eid short −0.179R (t −1.45).**

Judged on the pre-registered bar (PREREGISTRATION.md and `dates.mjs`, pushed alone before any candle was read). A standalone calendar study of one claim about physical demand around Eid al-Fitr and Eid al-Adha, **not** a gate, exit, entry or size of any gold-book system (owner item 44); the live book's positions were not read. Nothing live changed and no proposal follows.

Data: OANDA mid daily candles (UTC days), council-data research/daily/xau.json (git show), weekend folded into Monday; stops on OANDA mid H1, 2006-03-20 to 2026-11-13 (H1 to 2026-11-13). Eid dates: `dates.mjs` (Umm al-Qura calendar (ICU islamic-umalqura in Node 22), generated 2026-11-14 before any price was read); all 40 kept. Windows the candles do not cover: none. Stop 2 x ATR(20) of the daily candles, checked on H1 (a gap fills at the open); cost $0.60 an ounce round trip; financing `FIN.xau.long` 0.000148 of price a rollover on buys only. In sample 2007-2016, out of sample 2017-2026. **Primary measure: excess R** = an event's net R minus the mean net R of every ordinary holding of the same length and side in the same calendar year (outside that test's windows), so gold's drift of the year is taken out. **10 events a window per Eid: low power**; a FAIL means "not shown", not "shown absent".

## The three tests

| Test, window | n | gross R | gross t | cost R | financing R | net R | net t | year baseline R | **excess R** | **excess t** | p (OOS: Holm) | excess R 2x | net R 2x | beat baseline | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Eid al-Fitr run-up, long 10 trading days into the day before, in sample | 10 | +0.260 | +0.67 | +0.018 | +0.057 | +0.184 | +0.48 | −0.019 | +0.204 | +0.53 | 0.608 | +0.203 | +0.167 | 60 % | 2 |
| T1 Eid al-Fitr run-up, long 10 trading days into the day before, out of sample | 10 | +0.556 | +1.28 | +0.014 | +0.080 | +0.462 | +1.08 | +0.086 | +0.375 | +0.93 | 0.754 | +0.375 | +0.448 | 60 % | 2 |
| T1 Eid al-Fitr run-up, long 10 trading days into the day before, whole | 20 | +0.408 | +1.43 | +0.016 | +0.069 | +0.323 | +1.14 | +0.034 | +0.289 | +1.07 | 0.300 | +0.289 | +0.307 | 60 % | 4 |
| T2 Eid al-Adha run-up, long 10 trading days into the day before, in sample | 10 | +0.066 | +0.19 | +0.015 | +0.054 | −0.003 | −0.01 | +0.005 | −0.007 | −0.02 | 0.982 | −0.005 | −0.018 | 40 % | 2 |
| T2 Eid al-Adha run-up, long 10 trading days into the day before, out of sample | 10 | +0.445 | +0.88 | +0.013 | +0.066 | +0.366 | +0.73 | +0.087 | +0.279 | +0.55 | 0.754 | +0.280 | +0.353 | 40 % | 3 |
| T2 Eid al-Adha run-up, long 10 trading days into the day before, whole | 20 | +0.255 | +0.84 | +0.014 | +0.060 | +0.182 | +0.61 | +0.046 | +0.136 | +0.47 | 0.645 | +0.138 | +0.168 | 40 % | 5 |
| T3 Post-Eid give-back, short 5 trading days after the Eid (both pooled), in sample | 20 | −0.275 | −1.52 | +0.016 | +0.000 | −0.291 | −1.61 | −0.049 | −0.243 | −1.31 | 0.205 | −0.242 | −0.307 | 35 % | 8 |
| T3 Post-Eid give-back, short 5 trading days after the Eid (both pooled), out of sample | 20 | −0.273 | −2.07 | +0.014 | +0.000 | −0.286 | −2.17 | −0.107 | −0.179 | −1.45 | 0.490 | −0.179 | −0.300 | 35 % | 6 |
| T3 Post-Eid give-back, short 5 trading days after the Eid (both pooled), whole | 40 | −0.274 | −2.48 | +0.015 | +0.000 | −0.289 | −2.62 | −0.078 | −0.211 | −1.92 | 0.062 | −0.210 | −0.304 | 35 % | 14 |

## Pass bar (each test on its own)

| Test | OOS excess t >= 2 and Holm p < 0.05 | IS excess same sign | OOS net R and excess R positive at 2x cost | above >= 38 of 40 placebo seeds | passes |
|---|---|---|---|---|---|
| T1 | no (t +0.93, Holm p 0.7542) | yes (IS +0.204R, OOS +0.375R) | yes (net +0.448R, excess +0.375R) | no (36) | no |
| T2 | no (t +0.55, Holm p 0.7542) | no (IS −0.007R, OOS +0.279R) | yes (net +0.353R, excess +0.280R) | no (34) | no |
| T3 | no (t −1.45, Holm p 0.4899) | yes (IS −0.243R, OOS −0.179R) | no (net −0.300R, excess −0.179R) | no (5) | no |

## Placebo

| Test | OOS events | real OOS excess R | seeds beaten (of 40) | seed means |
|---|---|---|---|---|
| T1 | 10 | +0.375 | 36 | −0.785 to +0.632 |
| T2 | 10 | +0.279 | 34 | −0.725 to +0.593 |
| T3 | 20 | −0.179 | 5 | −0.265 to +0.356 |

Per seed, one random ordinary holding (same length, side and year, outside that test's windows) per out-of-sample event, its excess over the year baseline by the same formula.

## Each event (R per trade)

| Eid | year | date | test | entry → exit | gross R | net R | year baseline | excess R | exit |
|---|---|---|---|---|---|---|---|---|---|
| Eid al-Fitr | 2007 | 2007-10-13 | T1 | 2007-09-28 → 2007-10-04 | −1.00 | −1.05 | +0.17 | −1.23 | stop |
| Eid al-Fitr | 2007 | 2007-10-13 | T3 | 2007-10-12 → 2007-10-19 | −0.60 | −0.63 | −0.18 | −0.45 | close |
| Eid al-Adha | 2007 | 2007-12-20 | T2 | 2007-12-05 → 2007-12-19 | +0.20 | +0.15 | +0.21 | −0.06 | close |
| Eid al-Adha | 2007 | 2007-12-20 | T3 | 2007-12-20 → 2007-12-27 | −1.00 | −1.02 | −0.18 | −0.84 | stop |
| Eid al-Fitr | 2008 | 2008-10-01 | T1 | 2008-09-16 → 2008-09-30 | +2.03 | +1.98 | −0.10 | +2.07 | close |
| Eid al-Fitr | 2008 | 2008-10-01 | T3 | 2008-10-01 → 2008-10-08 | −0.54 | −0.55 | +0.00 | −0.55 | close |
| Eid al-Adha | 2008 | 2008-12-08 | T2 | 2008-11-21 → 2008-12-05 | −0.71 | −0.74 | −0.10 | −0.65 | close |
| Eid al-Adha | 2008 | 2008-12-08 | T3 | 2008-12-08 → 2008-12-11 | −1.00 | −1.01 | +0.00 | −1.01 | stop |
| Eid al-Fitr | 2009 | 2009-09-20 | T1 | 2009-09-04 → 2009-09-18 | +0.48 | +0.38 | +0.18 | +0.20 | close |
| Eid al-Fitr | 2009 | 2009-09-20 | T3 | 2009-09-18 → 2009-09-25 | +0.56 | +0.54 | −0.20 | +0.74 | close |
| Eid al-Adha | 2009 | 2009-11-27 | T2 | 2009-11-12 → 2009-11-26 | +2.47 | +2.38 | +0.13 | +2.25 | close |
| Eid al-Adha | 2009 | 2009-11-27 | T3 | 2009-11-27 → 2009-12-02 | −1.00 | −1.01 | −0.20 | −0.82 | stop |
| Eid al-Fitr | 2010 | 2010-09-10 | T1 | 2010-08-26 → 2010-09-09 | +0.33 | +0.21 | +0.12 | +0.09 | close |
| Eid al-Fitr | 2010 | 2010-09-10 | T3 | 2010-09-10 → 2010-09-14 | −1.00 | −1.02 | −0.20 | −0.83 | stop |
| Eid al-Adha | 2010 | 2010-11-16 | T2 | 2010-11-01 → 2010-11-15 | +0.09 | +0.01 | +0.17 | −0.16 | close |
| Eid al-Adha | 2010 | 2010-11-16 | T3 | 2010-11-16 → 2010-11-23 | −0.61 | −0.62 | −0.20 | −0.43 | close |
| Eid al-Fitr | 2011 | 2011-08-30 | T1 | 2011-08-15 → 2011-08-29 | +0.34 | +0.28 | +0.17 | +0.11 | close |
| Eid al-Fitr | 2011 | 2011-08-30 | T3 | 2011-08-30 → 2011-09-06 | −0.42 | −0.42 | −0.12 | −0.31 | close |
| Eid al-Adha | 2011 | 2011-11-06 | T2 | 2011-10-21 → 2011-11-04 | +1.19 | +1.15 | +0.18 | +0.96 | close |
| Eid al-Adha | 2011 | 2011-11-06 | T3 | 2011-11-04 → 2011-11-11 | −0.48 | −0.49 | −0.12 | −0.37 | close |
| Eid al-Fitr | 2012 | 2012-08-19 | T1 | 2012-08-03 → 2012-08-17 | +0.28 | +0.19 | −0.12 | +0.32 | close |
| Eid al-Fitr | 2012 | 2012-08-19 | T3 | 2012-08-17 → 2012-08-22 | −1.00 | −1.02 | −0.00 | −1.02 | stop |
| Eid al-Adha | 2012 | 2012-10-26 | T2 | 2012-10-11 → 2012-10-15 | −1.00 | −1.02 | +0.00 | −1.02 | stop |
| Eid al-Adha | 2012 | 2012-10-26 | T3 | 2012-10-26 → 2012-11-02 | +0.94 | +0.92 | −0.00 | +0.92 | close |
| Eid al-Fitr | 2013 | 2013-08-08 | T1 | 2013-07-24 → 2013-08-07 | −0.59 | −0.65 | −0.36 | −0.28 | close |
| Eid al-Fitr | 2013 | 2013-08-08 | T3 | 2013-08-08 → 2013-08-15 | −1.00 | −1.01 | +0.27 | −1.28 | stop |
| Eid al-Adha | 2013 | 2013-10-15 | T2 | 2013-09-30 → 2013-10-11 | −1.00 | −1.05 | −0.32 | −0.73 | stop |
| Eid al-Adha | 2013 | 2013-10-15 | T3 | 2013-10-15 → 2013-10-22 | −1.00 | −1.01 | +0.27 | −1.28 | stop |
| Eid al-Fitr | 2014 | 2014-07-28 | T1 | 2014-07-11 → 2014-07-14 | −1.00 | −1.02 | −0.12 | −0.91 | stop |
| Eid al-Fitr | 2014 | 2014-07-28 | T3 | 2014-07-28 → 2014-08-04 | +0.55 | +0.53 | +0.03 | +0.50 | close |
| Eid al-Adha | 2014 | 2014-10-04 | T2 | 2014-09-19 → 2014-10-03 | −0.85 | −0.96 | −0.10 | −0.86 | close |
| Eid al-Adha | 2014 | 2014-10-04 | T3 | 2014-10-03 → 2014-10-08 | −1.00 | −1.02 | +0.03 | −1.05 | stop |
| Eid al-Fitr | 2015 | 2015-07-17 | T1 | 2015-07-02 → 2015-07-16 | −0.84 | −0.96 | −0.15 | −0.81 | close |
| Eid al-Fitr | 2015 | 2015-07-17 | T3 | 2015-07-17 → 2015-07-24 | +1.46 | +1.44 | +0.03 | +1.41 | close |
| Eid al-Adha | 2015 | 2015-09-23 | T2 | 2015-09-08 → 2015-09-22 | +0.06 | −0.04 | −0.23 | +0.19 | close |
| Eid al-Adha | 2015 | 2015-09-23 | T3 | 2015-09-23 → 2015-09-30 | +0.63 | +0.60 | +0.03 | +0.58 | close |
| Eid al-Fitr | 2016 | 2016-07-06 | T1 | 2016-06-21 → 2016-07-05 | +2.57 | +2.48 | +0.01 | +2.47 | close |
| Eid al-Fitr | 2016 | 2016-07-06 | T3 | 2016-07-06 → 2016-07-13 | +0.44 | +0.42 | −0.12 | +0.54 | close |
| Eid al-Adha | 2016 | 2016-09-11 | T2 | 2016-08-26 → 2016-09-09 | +0.21 | +0.10 | +0.09 | +0.01 | close |
| Eid al-Adha | 2016 | 2016-09-11 | T3 | 2016-09-09 → 2016-09-16 | +0.59 | +0.57 | −0.12 | +0.69 | close |
| Eid al-Fitr | 2017 | 2017-06-25 | T1 | 2017-06-09 → 2017-06-23 | −0.38 | −0.51 | +0.16 | −0.66 | close |
| Eid al-Fitr | 2017 | 2017-06-25 | T3 | 2017-06-23 → 2017-06-30 | +0.60 | +0.57 | −0.13 | +0.71 | close |
| Eid al-Adha | 2017 | 2017-09-01 | T2 | 2017-08-17 → 2017-08-31 | +1.33 | +1.19 | −0.00 | +1.19 | close |
| Eid al-Adha | 2017 | 2017-09-01 | T3 | 2017-09-01 → 2017-09-08 | −1.00 | −1.02 | −0.13 | −0.89 | stop |
| Eid al-Fitr | 2018 | 2018-06-15 | T1 | 2018-05-31 → 2018-06-14 | +0.14 | −0.01 | −0.20 | +0.19 | close |
| Eid al-Fitr | 2018 | 2018-06-15 | T3 | 2018-06-15 → 2018-06-22 | +0.41 | +0.38 | −0.03 | +0.41 | close |
| Eid al-Adha | 2018 | 2018-08-21 | T2 | 2018-08-06 → 2018-08-15 | −1.00 | −1.08 | −0.19 | −0.89 | stop |
| Eid al-Adha | 2018 | 2018-08-21 | T3 | 2018-08-21 → 2018-08-28 | −0.26 | −0.29 | −0.03 | −0.26 | close |
| Eid al-Fitr | 2019 | 2019-06-04 | T1 | 2019-05-20 → 2019-06-03 | +2.26 | +2.10 | +0.14 | +1.97 | close |
| Eid al-Fitr | 2019 | 2019-06-04 | T3 | 2019-06-04 → 2019-06-07 | −1.00 | −1.03 | −0.13 | −0.90 | stop |
| Eid al-Adha | 2019 | 2019-08-11 | T2 | 2019-07-26 → 2019-08-09 | +1.74 | +1.66 | +0.14 | +1.52 | close |
| Eid al-Adha | 2019 | 2019-08-11 | T3 | 2019-08-09 → 2019-08-16 | −0.39 | −0.41 | −0.13 | −0.27 | close |
| Eid al-Fitr | 2020 | 2020-05-24 | T1 | 2020-05-08 → 2020-05-22 | +0.52 | +0.45 | +0.17 | +0.28 | close |
| Eid al-Fitr | 2020 | 2020-05-24 | T3 | 2020-05-22 → 2020-05-29 | +0.10 | +0.09 | −0.16 | +0.25 | close |
| Eid al-Adha | 2020 | 2020-07-31 | T2 | 2020-07-16 → 2020-07-30 | +4.09 | +3.98 | −0.02 | +4.00 | close |
| Eid al-Adha | 2020 | 2020-07-31 | T3 | 2020-07-31 → 2020-08-05 | −1.00 | −1.01 | −0.16 | −0.85 | stop |
| Eid al-Fitr | 2021 | 2021-05-13 | T1 | 2021-04-28 → 2021-05-12 | +0.78 | +0.68 | −0.16 | +0.84 | close |
| Eid al-Fitr | 2021 | 2021-05-13 | T3 | 2021-05-13 → 2021-05-18 | −1.00 | −1.01 | +0.06 | −1.08 | stop |
| Eid al-Adha | 2021 | 2021-07-20 | T2 | 2021-07-05 → 2021-07-19 | +0.40 | +0.32 | −0.10 | +0.41 | close |
| Eid al-Adha | 2021 | 2021-07-20 | T3 | 2021-07-20 → 2021-07-27 | +0.25 | +0.24 | +0.06 | +0.18 | close |
| Eid al-Fitr | 2022 | 2022-05-02 | T1 | 2022-04-14 → 2022-04-25 | −1.00 | −1.06 | −0.03 | −1.03 | stop |
| Eid al-Fitr | 2022 | 2022-05-02 | T3 | 2022-05-02 → 2022-05-09 | +0.17 | +0.15 | −0.07 | +0.23 | close |
| Eid al-Adha | 2022 | 2022-07-09 | T2 | 2022-06-24 → 2022-07-05 | −1.00 | −1.05 | −0.01 | −1.04 | stop |
| Eid al-Adha | 2022 | 2022-07-09 | T3 | 2022-07-08 → 2022-07-15 | +0.68 | +0.67 | −0.07 | +0.74 | close |
| Eid al-Fitr | 2023 | 2023-04-21 | T1 | 2023-04-05 → 2023-04-20 | −0.21 | −0.28 | +0.10 | −0.38 | close |
| Eid al-Fitr | 2023 | 2023-04-21 | T3 | 2023-04-21 → 2023-04-28 | −0.11 | −0.12 | −0.08 | −0.04 | close |
| Eid al-Adha | 2023 | 2023-06-28 | T2 | 2023-06-13 → 2023-06-27 | −0.59 | −0.68 | +0.16 | −0.84 | close |
| Eid al-Adha | 2023 | 2023-06-28 | T3 | 2023-06-28 → 2023-07-05 | −0.16 | −0.17 | −0.08 | −0.09 | close |
| Eid al-Fitr | 2024 | 2024-04-10 | T1 | 2024-03-25 → 2024-04-09 | +3.19 | +3.09 | +0.18 | +2.91 | close |
| Eid al-Fitr | 2024 | 2024-04-10 | T3 | 2024-04-10 → 2024-04-12 | −1.00 | −1.01 | −0.19 | −0.82 | stop |
| Eid al-Adha | 2024 | 2024-06-16 | T2 | 2024-05-31 → 2024-06-14 | +0.08 | +0.00 | +0.35 | −0.35 | close |
| Eid al-Adha | 2024 | 2024-06-16 | T3 | 2024-06-14 → 2024-06-21 | +0.15 | +0.14 | −0.19 | +0.33 | close |
| Eid al-Fitr | 2025 | 2025-03-30 | T1 | 2025-03-14 → 2025-03-28 | +1.27 | +1.18 | +0.58 | +0.60 | close |
| Eid al-Fitr | 2025 | 2025-03-30 | T3 | 2025-03-28 → 2025-04-02 | −1.00 | −1.01 | −0.36 | −0.65 | stop |
| Eid al-Adha | 2025 | 2025-06-06 | T2 | 2025-05-22 → 2025-06-05 | +0.39 | +0.34 | +0.63 | −0.29 | close |
| Eid al-Adha | 2025 | 2025-06-06 | T3 | 2025-06-06 → 2025-06-13 | −0.85 | −0.85 | −0.36 | −0.49 | close |
| Eid al-Fitr | 2026 | 2026-03-20 | T1 | 2026-03-05 → 2026-03-19 | −1.00 | −1.04 | −0.08 | −0.96 | stop |
| Eid al-Fitr | 2026 | 2026-03-20 | T3 | 2026-03-20 → 2026-03-27 | +0.01 | +0.01 | +0.03 | −0.02 | close |
| Eid al-Adha | 2026 | 2026-05-27 | T2 | 2026-05-12 → 2026-05-15 | −1.00 | −1.02 | −0.09 | −0.93 | stop |
| Eid al-Adha | 2026 | 2026-05-27 | T3 | 2026-05-27 → 2026-06-03 | −0.05 | −0.06 | +0.03 | −0.08 | close |

## Reading

- T1 Eid al-Fitr run-up, long 10 trading days into the day before: excess +0.204R a trade in sample (n 10, t +0.53), +0.375R out of sample (n 10, t +0.93, Holm p 0.7542); raw net +0.462R out of sample; above 36 of 40 placebo seeds.
- T2 Eid al-Adha run-up, long 10 trading days into the day before: excess −0.007R a trade in sample (n 10, t −0.02), +0.279R out of sample (n 10, t +0.55, Holm p 0.7542); raw net +0.366R out of sample; above 34 of 40 placebo seeds.
- T3 Post-Eid give-back, short 5 trading days after the Eid (both pooled): excess −0.243R a trade in sample (n 20, t −1.31), −0.179R out of sample (n 20, t −1.45, Holm p 0.4899); raw net −0.286R out of sample; above 5 of 40 placebo seeds.
- The post-Eid short lost in both windows: gold did better than its usual 5-day hold after the Eids (whole-sample excess of the short −0.211R, t −1.92, n 40). That is the opposite of the claim, seen after the fact; a long after the Eids was not pre-registered here and is not a finding.
- The raw net R of a long window carries the year's drift (gold rose in most years); the excess column is the measure this study is judged on.
- One event a year per Eid: ten out-of-sample observations cannot show a modest effect. Paper only; never call this an edge without its n and t.

To repeat: `node --use-env-proxy research/edge/gold-eid-demand/run.mjs fetch <dir>` (daily candles by git show from `origin/council-data`, H1 through the candle proxy; keep `<dir>` out of git), then `… full <dir>`. Test: `tests/gold-eid-demand.test.mjs`.
