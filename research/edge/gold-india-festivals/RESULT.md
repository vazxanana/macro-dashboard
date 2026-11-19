# Result: spot gold into and after the Indian gold-buying festivals (2026-11-14)

**Verdict: FAIL (0 of 3 pass, no OOS t near 2, placebo not beaten): Dhanteras run-up +0.362R net OOS (n 10, t +0.88), Akshaya Tritiya +0.083R (t +0.36), post-festival short +0.102R (t +0.57).**

Judged on the pre-registered bar (PREREGISTRATION.md and `dates.mjs`, pushed alone before any candle was read). A standalone calendar study of one industry claim about Indian physical demand, **not** a gate, exit, entry or size of any gold-book system (owner item 44). Nothing live changed and no proposal follows.

Data: OANDA mid daily candles (UTC days), council-data research/daily/xau.json (git show), weekend folded into Monday; stops on OANDA mid H1, 2006-03-20 to 2026-11-06 (H1 to 2026-11-13). Festival dates: `dates.mjs` (Drik Panchang, New Delhi, cross-checked against press reports; a source on each row). Excluded before any price was read: akshaya 2007: not verified from a source on 14 Nov 2026: excluded; akshaya 2008: observed on two days, 7-8 May (Business Standard, May 2009): excluded. Windows the candles do not cover: dhanteras 2026 post. Stop 2 x ATR(20) of the daily candles, checked on H1 (a gap fills at the open); cost $0.60 an ounce round trip; financing `FIN.xau.long` 0.000148 of price a rollover on buys only. In sample 2007-2016, out of sample 2017-2026. **About 10 events a window per festival: very low power**; only a large effect could pass, and a FAIL means "not shown", not "shown absent".

## The three tests

| Test, window | n | gross % | gross R | gross t | cost R | financing R | net R | net t | p (OOS: Holm) | net R 2x | won | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Dhanteras run-up, long 10 trading days into the day before, in sample | 10 | +0.511 | +0.394 | +1.01 | +0.016 | +0.055 | +0.323 | +0.84 | 0.423 | +0.308 | 60 % | 3 |
| T1 Dhanteras run-up, long 10 trading days into the day before, out of sample | 10 | +0.997 | +0.447 | +1.08 | +0.012 | +0.072 | +0.362 | +0.88 | 1.000 | +0.350 | 70 % | 2 |
| T1 Dhanteras run-up, long 10 trading days into the day before, whole | 20 | +0.754 | +0.420 | +1.51 | +0.014 | +0.064 | +0.343 | +1.25 | 0.227 | +0.329 | 65 % | 5 |
| T2 Akshaya Tritiya run-up, long 10 trading days into the day before, in sample | 8 | +0.615 | +0.116 | +0.32 | +0.015 | +0.061 | +0.040 | +0.11 | 0.915 | +0.025 | 38 % | 2 |
| T2 Akshaya Tritiya run-up, long 10 trading days into the day before, out of sample | 10 | +0.873 | +0.161 | +0.69 | +0.013 | +0.065 | +0.083 | +0.36 | 1.000 | +0.070 | 70 % | 2 |
| T2 Akshaya Tritiya run-up, long 10 trading days into the day before, whole | 18 | +0.758 | +0.141 | +0.70 | +0.014 | +0.063 | +0.064 | +0.32 | 0.753 | +0.050 | 56 % | 4 |
| T3 Post-festival softening, short 5 trading days after the festival (both pooled), in sample | 18 | +0.150 | +0.030 | +0.20 | +0.015 | +0.000 | +0.015 | +0.10 | 0.924 | −0.001 | 56 % | 3 |
| T3 Post-festival softening, short 5 trading days after the festival (both pooled), out of sample | 19 | +0.314 | +0.115 | +0.65 | +0.013 | +0.000 | +0.102 | +0.57 | 1.000 | +0.088 | 58 % | 3 |
| T3 Post-festival softening, short 5 trading days after the festival (both pooled), whole | 37 | +0.234 | +0.074 | +0.63 | +0.014 | +0.000 | +0.059 | +0.51 | 0.612 | +0.045 | 57 % | 6 |

## Pass bar (each test on its own)

| Test | OOS t >= 2 and Holm p < 0.05 | IS same sign | OOS positive at 2x cost | above >= 38 of 40 placebo seeds | passes |
|---|---|---|---|---|---|
| T1 | no (t +0.88, Holm p 1) | yes (IS +0.323R, OOS +0.362R) | yes (+0.350R) | no (33) | no |
| T2 | no (t +0.36, Holm p 1) | yes (IS +0.040R, OOS +0.083R) | yes (+0.070R) | no (18) | no |
| T3 | no (t +0.57, Holm p 1) | yes (IS +0.015R, OOS +0.102R) | yes (+0.088R) | no (37) | no |

## Against ordinary holdings of the same length and the placebo

| Test | window | festival net R | ordinary holds (same side) | their net R | an average same-length LONG hold | Welch t | placebo: real above n of 40 | seed means |
|---|---|---|---|---|---|---|---|---|
| T1 | in sample | +0.323 | 2312 | +0.003 | +0.003 | +0.83 |  |  |
| T1 | out of sample | +0.362 | 2275 | +0.099 | +0.099 | +0.64 | 33 | −0.580 to +0.794 |
| T2 | in sample | +0.040 | 2350 | −0.001 | −0.001 | +0.11 |  |  |
| T2 | out of sample | +0.083 | 2267 | +0.100 | +0.100 | −0.07 | 18 | −0.566 to +0.680 |
| T3 | in sample | +0.015 | 2390 | −0.068 | +0.008 | +0.54 |  |  |
| T3 | out of sample | +0.102 | 2336 | −0.117 | +0.074 | +1.23 | 37 | −0.459 to +0.189 |

Placebo: per seed, one random holding of the same length and side in each out-of-sample event's calendar year, outside the festival windows of that test.

## Each event (R per trade)

| Festival | year | date | run-up entry → exit | run-up gross R | net R | net R 2x | exit | post short gross R | net R | net R 2x | exit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dhanteras | 2007 | 2007-11-07 | 2007-10-23 → 2007-11-06 | +2.54 | +2.46 | +2.44 | close | +0.45 | +0.43 | +0.41 | close |
| Dhanteras | 2008 | 2008-10-26 | 2008-10-10 → 2008-10-22 | −1.00 | −1.02 | −1.02 | stop | +0.11 | +0.10 | +0.10 | close |
| Dhanteras | 2009 | 2009-10-15 | 2009-09-30 → 2009-10-14 | +1.92 | +1.83 | +1.81 | close | −0.26 | −0.28 | −0.30 | close |
| Dhanteras | 2010 | 2010-11-03 | 2010-10-19 → 2010-11-02 | +0.62 | +0.53 | +0.51 | close | −1.00 | −1.01 | −1.03 | stop |
| Dhanteras | 2011 | 2011-10-24 | 2011-10-07 → 2011-10-21 | +0.03 | −0.00 | −0.01 | close | −1.00 | −1.01 | −1.01 | stop |
| Dhanteras | 2012 | 2012-11-11 | 2012-10-26 → 2012-11-02 | −1.00 | −1.06 | −1.08 | stop | +0.44 | +0.43 | +0.41 | close |
| Dhanteras | 2013 | 2013-11-01 | 2013-10-17 → 2013-10-31 | +0.13 | +0.07 | +0.06 | close | +0.58 | +0.57 | +0.55 | close |
| Dhanteras | 2014 | 2014-10-21 | 2014-10-06 → 2014-10-20 | +1.26 | +1.16 | +1.14 | close | +0.65 | +0.63 | +0.61 | close |
| Dhanteras | 2015 | 2015-11-09 | 2015-10-23 → 2015-11-03 | −1.00 | −1.06 | −1.08 | stop | +0.30 | +0.28 | +0.26 | close |
| Dhanteras | 2016 | 2016-10-28 | 2016-10-13 → 2016-10-27 | +0.44 | +0.33 | +0.31 | close | −1.00 | −1.02 | −1.04 | stop |
| Dhanteras | 2017 | 2017-10-17 | 2017-10-02 → 2017-10-16 | +0.79 | +0.69 | +0.67 | close | +0.38 | +0.36 | +0.33 | close |
| Dhanteras | 2018 | 2018-11-05 | 2018-10-19 → 2018-11-02 | +0.29 | +0.17 | +0.14 | close | +1.16 | +1.14 | +1.12 | close |
| Dhanteras | 2019 | 2019-10-25 | 2019-10-10 → 2019-10-24 | +0.19 | +0.11 | +0.10 | close | −0.25 | −0.27 | −0.28 | close |
| Dhanteras | 2020 | 2020-11-13 | 2020-10-29 → 2020-11-12 | +0.15 | +0.06 | +0.05 | close | +0.31 | +0.30 | +0.29 | close |
| Dhanteras | 2021 | 2021-11-02 | 2021-10-18 → 2021-11-01 | +0.62 | +0.52 | +0.51 | close | −1.00 | −1.01 | −1.03 | stop |
| Dhanteras | 2022 | 2022-10-22 | 2022-10-07 → 2022-10-19 | −1.00 | −1.05 | −1.06 | stop | +0.24 | +0.23 | +0.22 | close |
| Dhanteras | 2023 | 2023-11-10 | 2023-10-26 → 2023-11-09 | −0.49 | −0.58 | −0.60 | close | −1.00 | −1.01 | −1.03 | stop |
| Dhanteras | 2024 | 2024-10-29 | 2024-10-14 → 2024-10-28 | +1.46 | +1.37 | +1.36 | close | +0.50 | +0.49 | +0.48 | close |
| Dhanteras | 2025 | 2025-10-18 | 2025-10-03 → 2025-10-17 | +3.46 | +3.38 | +3.37 | close | +0.84 | +0.84 | +0.83 | close |
| Dhanteras | 2026 | 2026-11-06 | 2026-10-22 → 2026-10-30 | −1.00 | −1.03 | −1.04 | stop | n/a | n/a | n/a |  |
| Akshaya Tritiya | 2007 | 2007-04-20 | excluded | | | | | | | | |
| Akshaya Tritiya | 2008 | 2008-05-08 | excluded | | | | | | | | |
| Akshaya Tritiya | 2009 | 2009-04-27 | 2009-04-10 → 2009-04-24 | +0.70 | +0.65 | +0.64 | close | +0.07 | +0.05 | +0.03 | close |
| Akshaya Tritiya | 2010 | 2010-05-16 | 2010-04-30 → 2010-05-14 | +1.61 | +1.52 | +1.50 | close | +1.32 | +1.31 | +1.29 | close |
| Akshaya Tritiya | 2011 | 2011-05-06 | 2011-04-21 → 2011-05-05 | −1.00 | −1.10 | −1.12 | stop | +0.01 | −0.00 | −0.01 | close |
| Akshaya Tritiya | 2012 | 2012-04-24 | 2012-04-09 → 2012-04-23 | −0.12 | −0.20 | −0.21 | close | −0.49 | −0.50 | −0.52 | close |
| Akshaya Tritiya | 2013 | 2013-05-13 | 2013-04-26 → 2013-05-10 | −0.17 | −0.21 | −0.22 | close | +0.69 | +0.68 | +0.67 | close |
| Akshaya Tritiya | 2014 | 2014-05-02 | 2014-04-16 → 2014-04-24 | −1.00 | −1.06 | −1.08 | stop | +0.31 | +0.29 | +0.27 | close |
| Akshaya Tritiya | 2015 | 2015-04-21 | 2015-04-06 → 2015-04-20 | −0.56 | −0.65 | −0.67 | close | −0.32 | −0.34 | −0.36 | close |
| Akshaya Tritiya | 2016 | 2016-05-09 | 2016-04-22 → 2016-05-06 | +1.46 | +1.38 | +1.36 | close | −0.32 | −0.34 | −0.35 | close |
| Akshaya Tritiya | 2017 | 2017-04-28 | 2017-04-12 → 2017-04-25 | −1.00 | −1.10 | −1.12 | stop | +1.63 | +1.61 | +1.59 | close |
| Akshaya Tritiya | 2018 | 2018-04-18 | 2018-04-03 → 2018-04-17 | +0.44 | +0.33 | +0.31 | close | +0.90 | +0.88 | +0.86 | close |
| Akshaya Tritiya | 2019 | 2019-05-07 | 2019-04-22 → 2019-05-06 | +0.38 | +0.23 | +0.20 | close | −0.60 | −0.63 | −0.66 | close |
| Akshaya Tritiya | 2020 | 2020-04-26 | 2020-04-09 → 2020-04-24 | +0.45 | +0.40 | +0.40 | close | +0.42 | +0.41 | +0.40 | close |
| Akshaya Tritiya | 2021 | 2021-05-14 | 2021-04-29 → 2021-05-13 | +1.21 | +1.11 | +1.10 | close | −1.00 | −1.01 | −1.03 | stop |
| Akshaya Tritiya | 2022 | 2022-05-03 | 2022-04-18 → 2022-04-25 | −1.00 | −1.05 | −1.06 | stop | +0.67 | +0.66 | +0.64 | close |
| Akshaya Tritiya | 2023 | 2023-04-22 | 2023-04-06 → 2023-04-21 | −0.35 | −0.42 | −0.43 | close | −0.11 | −0.12 | −0.13 | close |
| Akshaya Tritiya | 2024 | 2024-05-10 | 2024-04-25 → 2024-05-09 | +0.17 | +0.11 | +0.11 | close | −0.69 | −0.70 | −0.71 | close |
| Akshaya Tritiya | 2025 | 2025-04-30 | 2025-04-14 → 2025-04-29 | +0.87 | +0.81 | +0.80 | close | −0.58 | −0.58 | −0.58 | close |
| Akshaya Tritiya | 2026 | 2026-04-19 | 2026-04-02 → 2026-04-17 | +0.43 | +0.40 | +0.39 | close | +0.36 | +0.36 | +0.36 | close |

## Reading

- T1 Dhanteras run-up, long 10 trading days into the day before: +0.323R a trade in sample (n 10, t +0.84), +0.362R out of sample (n 10, t +0.88, Holm p 1); ordinary same-side holds of those years +0.099R (Welch t +0.64); above 33 of 40 placebo seeds.
- T2 Akshaya Tritiya run-up, long 10 trading days into the day before: +0.040R a trade in sample (n 8, t +0.11), +0.083R out of sample (n 10, t +0.36, Holm p 1); ordinary same-side holds of those years +0.100R (Welch t −0.07); above 18 of 40 placebo seeds.
- T3 Post-festival softening, short 5 trading days after the festival (both pooled): +0.015R a trade in sample (n 18, t +0.10), +0.102R out of sample (n 19, t +0.57, Holm p 1); ordinary same-side holds of those years −0.117R (Welch t +1.23); above 37 of 40 placebo seeds.
- Gold rose in most years of the sample, so any long window carries its trend; the comparison with ordinary holdings of the same length is the fair one.
- One event a year per festival: ten out-of-sample observations cannot show a modest effect. Paper only; never call this an edge without its n and t.

To repeat: `node --use-env-proxy research/edge/gold-india-festivals/run.mjs fetch <dir>` (daily candles by git show from `origin/council-data`, H1 through the candle proxy; keep `<dir>` out of git), then `… full <dir>`. Test: `tests/gold-india-festivals.test.mjs`.
