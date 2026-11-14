# Result: spot gold into US market holidays (14 Nov 2026)

**Verdict: PASS (T1, T2; T3 fails): long gold on the last trading day before a US holiday makes +0.133R net out of sample 2017-26 (n 92, t 2.35, Holm p 0.021); 2022-26 alone t 0.78.**

Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any return was computed). Of the three tests, T1
(the last trading day before an NYSE holiday, 17:00 New York open to close) and T2 (the last two trading days) meet every
condition: out-of-sample net t >= 2 with Holm-adjusted one-sided p < 0.05, the in-sample mean positive, positive at 2x costs,
above 38 of 40 placebo means (both 40 of 40). T3 (the first day after, the mirror, whose direction `post-holiday-metals` had
already shown) does not (t 1.26, 37 of 40). **A pass on this bar is not a proven edge, and it is not a gold-book system or a
gate on one** (owner item 44): the in-sample years are weak (T1 +0.034R, t 0.52, negative at 2x costs), the out-of-sample
figure comes mostly from 2017-21, and it rests on about nine events a year. Nothing live changed; any use is the owner's
decision (a forward paper record first).

Data: OANDA mid H1 XAU/USD 2006-03-20 to 2026-11-13 (125,704 candles, a cache outside git), 5,351 days ending 17:00 New York
(`gold-drd-long` `nyDay`). Holidays: `ict/calendar.mjs` `cmeYear` (NYSE full holidays: New Year's Day, MLK, Presidents',
Good Friday, Memorial, Juneteenth from 2022, Independence Day, Labor, Thanksgiving, Christmas; 192 in 2006-26). Judged:
holidays 2007-2016 (in sample, 89) and 2017 to 31 Oct 2026 (out of sample, 92); no event skipped. Long at the day's first H1
open, out at its last H1 close; stop 1.0 x ATR(14) of the 17:00 New York days before the entry day, checked on H1 (a gap
fills at the open); 1R = that ATR. Costs $0.60 an ounce a round trip plus financing `nights` x `FIN.xau.long` (0.000148 of
price a rollover, today's demo rate for every year). The repo's rollover is 22:00 UTC: a one-day hold from the reopen to the
close crosses none (financing 0 out of sample; a few summer days of 2007-16 cross one); T2 pays one night (Wednesday three).

## The tests (R a trade; t per event; month-sum t beside it, not judged)

| Test, window | n | gross % | gross R | gross t | cost R | financing R | net R | net t | month-sum t (months) | net R 2x | won | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 last day before, in sample 2007-16 | 89 | +0.1375 | +0.075 | +1.16 | +0.034 | +0.007 | +0.034 | +0.52 | +0.51 (81) | −0.007 | 47.19 % | 6 |
| T1 last day before, out of sample 2017-26 | 92 | +0.1664 | +0.161 | +2.83 | +0.029 | 0.000 | +0.133 | +2.35 | +2.28 (83) | +0.104 | 60.87 % | 4 |
| T2 last two days before, in sample 2007-16 | 89 | +0.3079 | +0.183 | +2.03 | +0.034 | +0.021 | +0.128 | +1.43 | +1.41 (81) | +0.073 | 52.81 % | 16 |
| T2 last two days before, out of sample 2017-26 | 92 | +0.2735 | +0.258 | +3.00 | +0.028 | +0.014 | +0.216 | +2.53 | +2.52 (81) | +0.174 | 58.7 % | 14 |
| T3 first day after, in sample 2007-16 | 89 | +0.1815 | +0.088 | +1.10 | +0.036 | +0.002 | +0.051 | +0.63 | +0.60 (80) | +0.013 | 51.69 % | 16 |
| T3 first day after, out of sample 2017-26 | 92 | +0.1124 | +0.119 | +1.67 | +0.029 | 0.000 | +0.090 | +1.26 | +1.22 (83) | +0.060 | 52.17 % | 7 |
| Every ordinary day (one-day long), in sample | 2254 | +0.0228 | +0.015 | +1.12 | +0.034 | +0.007 | −0.026 | −1.94 | −1.83 (120) | −0.067 | 48 % | 300 |
| Every ordinary day, out of sample | 2199 | +0.0368 | +0.029 | +2.10 | +0.028 | 0.000 | +0.001 | +0.05 | +0.05 (118) | −0.027 | 50.7 % | 272 |

## The bar

| Test | OOS net t | one-sided p | Holm p | in-sample net R | OOS net R 2x | placebo (beat) | passes |
|---|---|---|---|---|---|---|---|
| T1 | +2.35 | 0.0105 | 0.0209 | +0.034 | +0.104 | 40 of 40 (seed means −0.160 to +0.117, median +0.009) | **yes** |
| T2 | +2.53 | 0.0066 | 0.0197 | +0.128 | +0.174 | 40 of 40 (seed means −0.133 to +0.193, median −0.001) | **yes** |
| T3 | +1.26 | 0.1054 | 0.1054 | +0.051 | +0.060 | 37 of 40 (seed means −0.160 to +0.117, median +0.009) | no |

Placebo: 40 seeds, each drawing per out-of-sample year as many ordinary trading days (not a holiday, not within the two days
before or the day after one) as the test had events that year, traded the same way (T2: an ordinary day and the ordinary day
after it). T1 and T3 draw from the same pool with the same counts, so their seed means are the same.

## Against an ordinary day (net R, Welch t, reported only)

| Test | in sample: minus ordinary | t | out of sample: minus ordinary | t |
|---|---|---|---|---|
| T1 | +0.060 | +0.90 | +0.132 | +2.27 |
| T2 | +0.154 | +1.70 | +0.215 | +2.49 |
| T3 | +0.077 | +0.94 | +0.089 | +1.23 |

## Reported only, chosen after the run (not judged)

| Test | 2017-21 n | net R | t | 2022-26 n | net R | t | OOS without its best holiday | n | net R | t |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 45 | +0.209 | +2.52 | 47 | +0.059 | +0.78 | Christmas Day | 83 | +0.104 | +1.74 |
| T2 | 45 | +0.278 | +2.07 | 47 | +0.157 | +1.45 | Good Friday | 82 | +0.177 | +2.02 |
| T3 | 45 | +0.082 | +0.77 | 47 | +0.097 | +1.01 | New Year's Day | 83 | +0.031 | +0.42 |

## By holiday, 2007-26 (net R, reported only)

| Holiday | T1 n | T1 net R | T1 t | T2 n | T2 net R | T2 t | T3 n | T3 net R | T3 t |
|---|---|---|---|---|---|---|---|---|---|
| Christmas Day | 19 | +0.250 | +2.84 | 19 | +0.318 | +2.29 | 19 | +0.303 | +2.64 |
| Good Friday | 20 | +0.008 | +0.06 | 20 | +0.277 | +1.24 | 20 | +0.111 | +0.94 |
| Independence Day | 20 | −0.030 | −0.19 | 20 | −0.130 | −0.65 | 20 | −0.217 | −1.44 |
| Juneteenth | 5 | −0.234 | −1.58 | 5 | −0.124 | −0.46 | 5 | +0.053 | +0.21 |
| Labor Day | 20 | +0.200 | +1.19 | 20 | +0.217 | +1.11 | 20 | +0.015 | +0.08 |
| Martin Luther King Day | 20 | +0.196 | +1.16 | 20 | +0.340 | +1.43 | 20 | +0.220 | +1.43 |
| Memorial Day | 20 | +0.142 | +1.73 | 20 | +0.003 | +0.02 | 20 | −0.412 | −3.30 |
| New Year's Day | 18 | +0.127 | +1.06 | 18 | +0.184 | +1.08 | 18 | +0.717 | +4.90 |
| Presidents' Day | 20 | −0.030 | −0.26 | 20 | +0.364 | +1.84 | 20 | +0.037 | +0.19 |
| Thanksgiving Day | 19 | −0.017 | −0.14 | 19 | +0.058 | +0.36 | 19 | −0.066 | −0.42 |

## By year (net R a holiday, reported only)

| Year | T1 n | T1 net R | T2 n | T2 net R | T3 n | T3 net R |
|---|---|---|---|---|---|---|
| 2007 | 9 | +0.216 | 9 | +0.622 | 9 | +0.015 |
| 2008 | 9 | −0.272 | 9 | −0.168 | 9 | +0.306 |
| 2009 | 9 | +0.258 | 9 | +0.633 | 9 | −0.021 |
| 2010 | 9 | −0.086 | 9 | +0.091 | 9 | +0.253 |
| 2011 | 8 | +0.048 | 8 | +0.094 | 8 | −0.078 |
| 2012 | 9 | +0.419 | 9 | +0.102 | 9 | +0.255 |
| 2013 | 9 | −0.138 | 9 | −0.221 | 9 | +0.074 |
| 2014 | 9 | −0.063 | 9 | −0.073 | 9 | −0.357 |
| 2015 | 9 | −0.072 | 9 | +0.192 | 9 | −0.319 |
| 2016 | 9 | +0.031 | 9 | +0.004 | 9 | +0.364 |
| 2017 | 9 | +0.088 | 9 | +0.498 | 9 | +0.115 |
| 2018 | 9 | +0.407 | 9 | +0.210 | 9 | −0.040 |
| 2019 | 9 | +0.031 | 9 | +0.448 | 9 | +0.285 |
| 2020 | 9 | +0.277 | 9 | −0.052 | 9 | +0.075 |
| 2021 | 9 | +0.244 | 9 | +0.283 | 9 | −0.024 |
| 2022 | 9 | +0.039 | 9 | −0.174 | 9 | −0.305 |
| 2023 | 10 | +0.114 | 10 | +0.400 | 10 | −0.101 |
| 2024 | 10 | +0.330 | 10 | +0.284 | 10 | +0.229 |
| 2025 | 10 | −0.062 | 10 | +0.295 | 10 | +0.620 |
| 2026 | 8 | −0.173 | 8 | −0.106 | 8 | −0.023 |

## Reading

- The bar was met by T1 and T2 and the result is reported as a pass. What limits it, said plainly: the in-sample decade is
  weak (T1 t 0.52 and negative at 2x costs; T2 t 1.43); 2017-21 carries the out-of-sample figure (T1 t 2.52) while 2022-26
  alone is t 0.78; without Christmas, T1's out-of-sample t is 1.74; T1 and T2 share their last day, so they are not two
  independent confirmations; Holm covers three tests, not the many calendar studies run on gold this week.
- 2017-26 is a strong gold market: an ordinary one-day long made +0.029R gross (t 2.10). The pre-holiday days beat it by
  +0.132R (T1, Welch t 2.27) and +0.215R (T2, t 2.49) out of sample, and the 40 placebo draws of ordinary days, which share
  that drift, all fall below both rules. The drift alone does not explain the result; the small sample can.
- T3 agrees in sign with `post-holiday-metals` (gold rose on the day after US holidays, on UTC days), driven by New Year's
  Day (+0.717R) against Memorial Day (−0.412R); it is a second look at data already seen and does not pass here.
- Equity pre-holiday tests on US indices (`pre-holiday`) and nine other indices (`local-preholiday`) failed; gold is the one
  market in this family where the bar was met. That is reason for a forward paper record, not for money.
- Paper only. Not a gold-book test and never a gate, entry, exit or size on one (owner item 44). Never quote it without n,
  t and the 2022-26 split.

To repeat: `node --use-env-proxy research/edge/gold-pre-holiday/run.mjs fetch <dir>`, then `… full <dir>`.
Test: `tests/gold-pre-holiday.test.mjs`.
