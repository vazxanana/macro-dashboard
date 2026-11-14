# Result: spot gold around the Shanghai Gold Exchange's long Chinese holidays (2026-11-14)

**Verdict: FAIL (tOos, placebo not met): long gold the 10 days before the Lunar New Year closure makes +0.224R a year net out of sample 2017-26 (n 10, t +1.38).**

Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any candle was read). A standalone calendar study of one industry claim about Chinese physical demand, **not** a gate, exit, entry or size of any gold-book system (owner item 44). Nothing live changed and no proposal follows.

Data: OANDA mid daily candles (UTC days), council-data research/daily/xau.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend), 2006-03-20 to 2026-11-06. Shanghai Gold Exchange closures 2008-2026 in `dates.mjs` (official holiday schedule of each year; 3 closures also checked against press reports of the SGE's own notice: 2020-01-24, 2024-02-12, 2026-02-16). Years dropped for uncertain dates: none. Windows the data does not cover: none. Long at a window's entry close, out at its last close, stop 3 x ATR(20) below (every trade has one); cost $0.60 an ounce round trip ($0.30 spread + half a spread of slippage on each order); financing `FIN.xau.long` 0.000148 of price a rollover. In sample 2008-2016, out of sample 2017-2026: **about 9-10 events a window, thin**: only a large effect could pass.

## The four tests

| Test, window | n | gross % | gross R | gross t | cost R | financing R | net R | net t | p (OOS: Holm) | net R 2x | won | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Lunar New Year, 10 days before the closure (claim a), in sample | 9 | +1.009 | +0.169 | +0.62 | +0.011 | +0.042 | +0.116 | +0.43 | 0.679 | +0.106 | 56 % | 1 |
| T1 Lunar New Year, 10 days before the closure (claim a), out of sample | 10 | +1.124 | +0.295 | +1.80 | +0.011 | +0.060 | +0.224 | +1.38 | 0.805 | +0.213 | 70 % | 0 |
| T1 Lunar New Year, 10 days before the closure (claim a), whole | 19 | +1.069 | +0.235 | +1.56 | +0.011 | +0.052 | +0.173 | +1.15 | 0.264 | +0.163 | 63 % | 1 |
| T2 Lunar New Year, while Shanghai is shut (claim b predicts <= 0), in sample | 9 | +1.880 | +0.329 | +1.48 | +0.010 | +0.021 | +0.298 | +1.34 | 0.217 | +0.288 | 78 % | 1 |
| T2 Lunar New Year, while Shanghai is shut (claim b predicts <= 0), out of sample | 10 | +0.624 | +0.125 | +0.68 | +0.010 | +0.030 | +0.085 | +0.47 | 1.000 | +0.075 | 50 % | 0 |
| T2 Lunar New Year, while Shanghai is shut (claim b predicts <= 0), whole | 19 | +1.219 | +0.222 | +1.58 | +0.010 | +0.026 | +0.186 | +1.32 | 0.203 | +0.176 | 63 % | 1 |
| T3 Lunar New Year, 5 days after the reopening (claim c), in sample | 9 | −0.014 | −0.031 | −0.19 | +0.010 | +0.019 | −0.060 | −0.37 | 0.724 | −0.070 | 33 % | 1 |
| T3 Lunar New Year, 5 days after the reopening (claim c), out of sample | 10 | +0.577 | +0.151 | +0.95 | +0.010 | +0.029 | +0.112 | +0.71 | 1.000 | +0.102 | 70 % | 0 |
| T3 Lunar New Year, 5 days after the reopening (claim c), whole | 19 | +0.297 | +0.065 | +0.58 | +0.010 | +0.024 | +0.031 | +0.27 | 0.787 | +0.021 | 53 % | 1 |
| T4 Golden Week, the three windows pooled (secondary), in sample | 27 | +0.562 | +0.133 | +1.10 | +0.011 | +0.029 | +0.093 | +0.77 | 0.446 | +0.082 | 59 % | 2 |
| T4 Golden Week, the three windows pooled (secondary), out of sample | 30 | +0.330 | +0.106 | +0.86 | +0.009 | +0.035 | +0.062 | +0.51 | 1.000 | +0.054 | 50 % | 3 |
| T4 Golden Week, the three windows pooled (secondary), whole | 57 | +0.440 | +0.119 | +1.39 | +0.010 | +0.032 | +0.077 | +0.90 | 0.372 | +0.067 | 54 % | 5 |

Golden Week by window (reported only):

| Window | n | gross R | net R IS | net R OOS | net t OOS |
|---|---|---|---|---|---|
| pre | 19 | −0.054 | +0.048 | −0.260 | −1.16 |
| shut | 19 | +0.106 | +0.093 | +0.057 | +0.37 |
| post | 19 | +0.304 | +0.138 | +0.390 | +1.78 |

## Pass bar (T1 only)

| Condition | Holds |
|---|---|
| OOS net t >= 2 and Holm p < 0.05 | no (t +1.38, Holm p 0.8052) |
| In sample positive too | yes (IS +0.116R, OOS +0.224R) |
| OOS positive at 2x cost | yes (+0.213R) |
| Above at least 36 of 40 placebo seeds | no (31) |

## Against ordinary 10-day windows and the placebo

Welch t of the pre-Lunar-New-Year windows against every 10-trading-day hold of the same years that touches no holiday window: in sample +0.59 (ordinary −0.043R, 1743 windows), out of sample +1.10 (ordinary +0.045R, 1887 windows). Placebo: 40 seeds, one random ordinary window per out-of-sample year; the real +0.224R is above 31 of them (seed means −0.531R to +0.391R).

## Each Lunar New Year (net R)

| Year | first shut | reopen | pre | shut | post |
|---|---|---|---|---|---|
| 2008 | 2008-02-06 | 2008-02-13 | −0.09 | +0.29 | +0.32 |
| 2009 | 2009-01-26 | 2009-02-02 | +0.61 | +0.34 | −0.21 |
| 2010 | 2010-02-15 | 2010-02-22 | +0.16 | +0.38 | −0.05 |
| 2011 | 2011-02-02 | 2011-02-09 | −1.05 | +0.30 | +0.12 |
| 2012 | 2012-01-23 | 2012-01-30 | +0.48 | +0.98 | −0.20 |
| 2013 | 2013-02-11 | 2013-02-18 | +0.08 | −1.04 | −1.02 |
| 2014 | 2014-01-31 | 2014-02-07 | −0.01 | +0.19 | +0.80 |
| 2015 | 2015-02-18 | 2015-02-25 | −0.85 | −0.10 | −0.04 |
| 2016 | 2016-02-08 | 2016-02-15 | +1.71 | +1.35 | −0.25 |
| 2017 | 2017-01-27 | 2017-02-03 | −0.30 | +0.58 | +0.23 |
| 2018 | 2018-02-15 | 2018-02-22 | +0.13 | −0.59 | −0.23 |
| 2019 | 2019-02-04 | 2019-02-11 | +1.05 | −0.19 | +0.17 |
| 2020 | 2020-01-24 | 2020-02-03 | +0.09 | +0.48 | −0.36 |
| 2021 | 2021-02-11 | 2021-02-18 | −0.03 | −0.82 | +0.29 |
| 2022 | 2022-01-31 | 2022-02-07 | −0.58 | +0.23 | +0.88 |
| 2023 | 2023-01-23 | 2023-01-30 | +0.80 | −0.01 | −0.89 |
| 2024 | 2024-02-12 | 2024-02-19 | +0.02 | −0.22 | +0.31 |
| 2025 | 2025-01-28 | 2025-02-05 | +0.79 | +1.13 | +0.58 |
| 2026 | 2026-02-16 | 2026-02-24 | +0.27 | +0.25 | +0.14 |

## Reading

- Claim (a), the pre-holiday buying: positive out of sample (+0.224R, t +1.38) and positive in sample (+0.116R, t +0.43). Gold rose in most years from 2008 (its trend is in every long window); against ordinary 10-day windows the out-of-sample difference has a Welch t of +1.10, and it is above only 31 of 40 placebo seeds: these ten days are not shown to differ from any other ten days of the same years.
- Claim (b), the lull while Shanghai is shut: the shut window made +0.085R out of sample (t +0.47) and +0.298R in sample: no sign of a lull. Only daily closes were read; an intraday Asian-hours test was not run.
- Claim (c), the return of Chinese buyers: +0.112R out of sample (t +0.71), −0.060R in sample.
- Golden Week, three windows pooled: +0.062R a window out of sample (t +0.51).
- One event a year per window: ten out-of-sample observations cannot show a modest effect; a FAIL here means "not shown", not "shown absent".
- Paper only. Not a gold-book test and never a gate on one. Never call this an edge without its n and t.

To repeat: `node research/edge/gold-china-holidays/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/gold-china-holidays.test.mjs`.
