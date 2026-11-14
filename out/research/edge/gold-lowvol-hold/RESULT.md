# Result: gold bought in its quiet stretches, held wide (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold on quiet days for 20 days beat every-day buys by +0.152R a trade out of sample (n 906, month t 1.14), -0.084R in sample; 40 of 40 placebos.**

A stand-alone daily rule of its own: no rule or position of the live gold book was read, tested or touched
(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.
Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no
proposal is written.

## Data and rule

Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 2006-03-20 to 2026-11-13, 5369 trading days; first day with a full year of volatility 2007-04-04.
rv20 = sd of 20 daily log returns; pct = share of the 252 previous rv20 below today's; quiet = pct < 1/3, loud = pct >= 2/3.
Days by entry month: in sample 2007-01 to 2016-12 2535 (968 quiet, 878 loud), out of sample
2017-01 to 2026-10 2552 (916 quiet, 899 loud). Buy at the day's close, every qualifying day a trade
(overlapping), stop 3 x ATR(20) (a gap through it fills at the open), $0.60 a round trip and `FIN` financing
(0.000148 of price a rollover); 2x costs = $1.20 and twice the financing. Excess = a trade's net R minus the mean net R of
the same trade entered on every trading day of its year. t on calendar-month sums of the excess, Newey-West (lag 1 for 20 days,
3 for 60), one-sided, Holm over the three tests. (The pre-registration counted out-of-sample days to the file's end, 13 Nov;
the windows here end with October entries as pre-registered, so two November quiet days drop out.)

## The tests (R a trade)

| Test | Rule | Window | n | Months | Net R | Every-day net R | Excess | Month t (NW) | Plain t | Gross excess | Gross t | Net at 2x | Excess at 2x | Stops | Holm p | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | buy on a quiet day (rv20 in the lowest third of the past year), out after 20 days | in sample | 968 | 77 | -0.002 | +0.034 | -0.084 | -0.74 | -0.81 | -0.074 | -0.64 | -0.107 | -0.094 | 315 | | | |
| T1 | buy on a quiet day (rv20 in the lowest third of the past year), out after 20 days | out of sample | 906 | 80 | +0.275 | +0.145 | +0.152 | 1.14 | 1.14 | +0.164 | 1.21 | +0.149 | +0.141 | 284 | 0.384 | 40 | no |
| T2 | buy on a quiet day, out after 60 days (the wide exit) | in sample | 968 | 77 | +0.169 | +0.096 | -0.008 | -0.04 | -0.05 | +0.001 | 0.01 | -0.047 | -0.017 | 501 | | | |
| T2 | buy on a quiet day, out after 60 days (the wide exit) | out of sample | 893 | 78 | +0.581 | +0.413 | +0.212 | 1.09 | 1.05 | +0.234 | 1.11 | +0.295 | +0.191 | 403 | 0.384 | 40 | no |
| T3 | buy on a loud day (rv20 in the top third), out after 20 days (contrast) | in sample | 878 | 63 | +0.029 | +0.034 | +0.024 | 0.28 | 0.29 | +0.012 | 0.14 | -0.040 | +0.037 | 211 | | | |
| T3 | buy on a loud day (rv20 in the top third), out after 20 days (contrast) | out of sample | 899 | 68 | +0.017 | +0.145 | -0.173 | -1.99 | -2.30 | -0.187 | -2.11 | -0.072 | -0.158 | 132 | 0.9744 | 0 | no |

Financing a trade (out of sample, R): T1 +0.114 over 23.9 nights, T2 +0.274 over 57.57 nights, T3 +0.082 over 26.02 nights. Dropped because the exit is not on file yet: T1 10, T2 23, T3 0.

## Checks of each test (all must hold)

| Test | OOS excess > 0, t >= 2 | Holm p < 0.05 | OOS net > 0 | in-sample excess > 0 | > 0 at 2x costs | >= 38 of 40 placebos |
|---|---|---|---|---|---|---|
| T1 | no | no | yes | no | yes | yes |
| T2 | no | no | yes | no | yes | yes |
| T3 | no | no | yes | yes | no | no |

## Placebo (40 seeded draws, out of sample)

Every out-of-sample rule trade replaced by the same buy entered on a random trading day of the same calendar year; statistic = mean excess.

| Test | Rule excess | Placebo mean | min | max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | +0.152 | -0.004 | -0.076 | +0.066 | 40 of 40 |
| T2 | +0.212 | -0.007 | -0.152 | +0.107 | 40 of 40 |
| T3 | -0.173 | +0.000 | -0.052 | +0.058 | 0 of 40 |

## One position at a time (T1, reported, not judged)

| Window | n | Net R | Excess | Plain month t |
|---|---|---|---|---|
| in sample | 77 | -0.004 | -0.049 | -0.48 |
| out of sample | 77 | +0.291 | +0.175 | 1.32 |

## T1 by year (net R a trade)

| Year | n | Quiet-day buys | Every-day buys | Excess |
|---|---|---|---|---|
| 2007 | 105 | -0.142 | +0.349 | -0.490 |
| 2008 | 1 | -1.025 | -0.097 | -0.928 |
| 2009 | 177 | +0.476 | +0.335 | +0.141 |
| 2010 | 95 | +0.526 | +0.224 | +0.302 |
| 2011 | 78 | +0.174 | +0.293 | -0.119 |
| 2012 | 140 | -0.055 | -0.066 | +0.011 |
| 2013 | 42 | -0.897 | -0.429 | -0.468 |
| 2014 | 180 | -0.194 | -0.134 | -0.060 |
| 2015 | 74 | -0.579 | -0.277 | -0.302 |
| 2016 | 76 | -0.146 | +0.142 | -0.287 |
| 2017 | 180 | +0.200 | +0.047 | +0.152 |
| 2018 | 113 | -0.222 | -0.211 | -0.011 |
| 2019 | 68 | +1.098 | +0.378 | +0.720 |
| 2020 | 39 | +1.385 | +0.169 | +1.216 |
| 2021 | 153 | -0.205 | -0.153 | -0.052 |
| 2022 | 48 | +0.263 | +0.009 | +0.255 |
| 2023 | 125 | -0.138 | +0.006 | -0.144 |
| 2024 | 68 | +0.512 | +0.485 | +0.027 |
| 2025 | 99 | +1.244 | +0.875 | +0.368 |
| 2026 | 13 | -0.940 | -0.244 | -0.696 |

## Reading

Not an edge. T1 fails: out-of-sample excess > 0 with month t >= 2; Holm p < 0.05; in-sample excess > 0. T2 and T3 fail too. Gold's quiet stretches pick no better moment to buy than any other day of the same year once the year's drift is taken out. No proposal; nothing live changed.

