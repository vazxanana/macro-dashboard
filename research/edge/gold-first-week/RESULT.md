# Result: spot gold's first week of the month, followed to the month's end (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following gold's first-week direction to the month's end made +0.091R a trade net out of sample (n 118, month t 0.84), +0.143R in sample; 29 of 40 placebos.**

A stand-alone calendar-direction rule on spot gold: no rule or position of the live gold book was read, tested or
touched (docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code:
`run.mjs`. Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing here is called an edge;
nothing live changed and no proposal is written.

## Data and rule

Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 2006-03-20 to 2026-11-06, 5364 trading days. Signal at the close of
the month's k-th trading day: the sign of that close against the previous month's last close; trade that way to the
month's last close. Stop 2 x ATR(20) (a gap through it fills at the open). $0.60 a round trip and
`FIN` financing (0.000148 of price a rollover) on buys; 2x costs = $1.20 and twice the financing.
In sample: months 2007-01 to 2016-12; out of sample: 2017-01 to 2026-10. t on calendar-month sums, one-sided, Holm over three.

- **T1**: sign of the first 5 trading days (TD-1 close -> TD+5 close), held to the month's last close.
- **T2**: sign of the first 10 trading days, held to the month's last close.
- **T3**: as T1, only when the first-week move is at least 1 x ATR(20).

## The tests (R a trade)

| Test | Window | n | Net R | Month t | Gross R | Gross t | Win % | Stops | Longs | Total R | Worst DD R | Net at 2x | Median stop $ | Median cost R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | in sample | 120 | +0.143 | 1.24 | +0.209 | 1.79 | 45.83 | 47 | 63 | +17.12 | −9.50 | +0.077 | 37.78 | +0.039 |
| T1 | out of sample | 118 | +0.091 | 0.84 | +0.167 | 1.51 | 49.15 | 44 | 65 | +10.73 | −10.31 | +0.015 | 47.92 | +0.042 |
| T2 | in sample | 120 | +0.010 | 0.11 | +0.060 | 0.67 | 50 | 41 | 65 | +1.15 | −9.28 | −0.041 | 37.27 | +0.036 |
| T2 | out of sample | 118 | +0.079 | 0.83 | +0.144 | 1.49 | 48.31 | 33 | 71 | +9.32 | −8.15 | +0.014 | 46.93 | +0.058 |
| T3 | in sample | 59 | +0.283 | 1.63 | +0.361 | 2.04 | 49.15 | 20 | 37 | +16.72 | −3.30 | +0.206 | 34.29 | +0.070 |
| T3 | out of sample | 57 | +0.135 | 0.83 | +0.214 | 1.27 | 49.12 | 23 | 34 | +7.69 | −9.64 | +0.056 | 48.04 | +0.047 |

| Test | OOS one-sided p | Holm p | Placebo beaten (of 40) | Placebo mean / max | Pass |
|---|---|---|---|---|---|
| T1 | 0.1999 | 0.5997 | 29 | +0.009 / +0.182 | no |
| T2 | 0.2031 | 0.5997 | 36 | −0.041 / +0.157 | no |
| T3 | 0.206 | 0.5997 | 35 | −0.049 / +0.312 | no |

## Longs, shorts and the unconditional baselines (net R a trade, n)

Same months, same entry day, hold, stop and costs. "Always long / short" trades every month of the window; "long in the
rule's short months" is the always-long trade in the months the rule sold (the side it skipped).

| Test | Window | Rule longs | Rule shorts | Always long | Always short | Long in the rule's short months | Short in the rule's long months |
|---|---|---|---|---|---|---|---|
| T1 | in sample | +0.145 (63) | +0.140 (57) | +0.016 (120) | −0.063 (120) | −0.127 (57) | −0.247 (63) |
| T1 | out of sample | +0.265 (65) | −0.123 (53) | +0.180 (118) | −0.225 (118) | +0.076 (53) | −0.308 (65) |
| T2 | in sample | −0.013 (65) | +0.036 (55) | −0.044 (120) | −0.031 (120) | −0.082 (55) | −0.087 (65) |
| T2 | out of sample | +0.206 (71) | −0.113 (47) | +0.077 (118) | −0.172 (118) | −0.119 (47) | −0.212 (71) |
| T3 | in sample | +0.396 (37) | +0.094 (22) | +0.246 (59) | −0.211 (59) | −0.006 (22) | −0.392 (37) |
| T3 | out of sample | +0.420 (34) | −0.286 (23) | +0.311 (57) | −0.322 (57) | +0.150 (23) | −0.345 (34) |

## Checks of the pass bar (T1)

- Out-of-sample net R > 0: yes (+0.091).
- Out-of-sample month t >= 2: no (0.84).
- Holm p < 0.05: no (0.5997).
- In-sample net R > 0: yes (+0.143).
- Out of sample positive at 2x costs: yes (+0.015).
- Above at least 38 of 40 placebos: no (29).

## Net R a trade by entry year (T1)

| Year | n | Net R |
|---|---|---|
| 2007 | 12 | −0.226 |
| 2008 | 12 | −0.397 |
| 2009 | 12 | +0.294 |
| 2010 | 12 | −0.158 |
| 2011 | 12 | +0.988 |
| 2012 | 12 | +0.113 |
| 2013 | 12 | +0.460 |
| 2014 | 12 | +0.392 |
| 2015 | 12 | −0.108 |
| 2016 | 12 | +0.070 |
| 2017 | 12 | −0.549 |
| 2018 | 12 | +0.016 |
| 2019 | 12 | +0.191 |
| 2020 | 12 | −0.039 |
| 2021 | 12 | +0.509 |
| 2022 | 12 | −0.217 |
| 2023 | 12 | +0.033 |
| 2024 | 12 | +0.022 |
| 2025 | 12 | +0.261 |
| 2026 | 10 | +0.798 |

## Reading

- T1 does not pass the pre-registered bar; T2 does not, T3 does not. Out of sample T1 is +0.091R a trade net (gross +0.167R, month t 0.84, n 118); in sample +0.143R (t 1.24, n 120).
- Against being long every month (out of sample +0.180R, n 118) the rule's buys made +0.265R (n 65) and its sells −0.123R (n 53); in the months it sold, a buy would have made +0.076R. The coin-flip placebo averaged +0.009R; T1 beat 29 of 40.
- Costs: median stop $47.92 out of sample ($37.78 in sample); median cost +0.042R a trade (buys carry the financing).
- Not an edge: never a council rule, filter, gate or size of the gold book. A further test of this idea needs its own pre-registration on other data.

To repeat: `node research/edge/gold-first-week/run.mjs` (reads council-data with `git show`, no network). Test:
`tests/gold-first-week.test.mjs`.
