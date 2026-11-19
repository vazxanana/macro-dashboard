# Result: spot gold's mid-month turn against the month-to-date move (14 Nov 2026)

**Verdict: FAIL, 0 of 3: selling after an up and buying after a down first half of the month, held 5 days, made −0.097R a trade net out of sample (n 118, month t −1.47), +0.009R in sample; 7 of 40 placebos.**

A stand-alone calendar reversal rule on spot gold: no rule or position of the live gold book was read, tested or
touched (docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code:
`run.mjs`. Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing here is called an edge;
nothing live changed and no proposal is written.

## Data and rule

Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 2006-03-20 to 2026-11-06, 5364 trading days. Signal at the close of
the month's k-th trading day: the sign of that close against the previous month's last close; trade the OTHER way for h
trading days. Stop 2 x ATR(20) (a gap through it fills at the open). $0.60 a round trip and
`FIN` financing (0.000148 of price a rollover) on buys; 2x costs = $1.20 and twice the financing.
In sample: months 2007-01 to 2016-12; out of sample: 2017-01 to 2026-10. t on calendar-month sums, one-sided, Holm over three.

- **T1**: against the month-to-date move at the TD+10 close (TD-1 close -> TD+10 close), held 5 trading days.
- **T2**: as T1, only when the month-to-date move is at least 1 x ATR(20).
- **T3**: against the month-to-date move at the TD+8 close, held 7 trading days (the same TD+15 exit).

## The tests (R a trade)

| Test | Window | n | Net R | Month t | Gross R | Gross t | Win % | Stops | Longs | Total R | Worst DD R | Net at 2x | Median stop $ | Median cost R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | in sample | 120 | +0.009 | 0.12 | +0.040 | 0.55 | 47.5 | 19 | 55 | +1.02 | −8.12 | −0.022 | 37.27 | +0.023 |
| T1 | out of sample | 118 | −0.097 | −1.47 | −0.068 | −1.02 | 44.92 | 27 | 47 | −11.47 | −18.37 | −0.127 | 46.93 | +0.022 |
| T2 | in sample | 76 | +0.002 | 0.02 | +0.032 | 0.33 | 44.74 | 15 | 33 | +0.14 | −5.46 | −0.028 | 35.46 | +0.023 |
| T2 | out of sample | 71 | −0.153 | −1.78 | −0.125 | −1.44 | 42.25 | 19 | 24 | −10.86 | −16.32 | −0.181 | 45.84 | +0.016 |
| T3 | in sample | 120 | −0.149 | −1.95 | −0.115 | −1.50 | 41.67 | 41 | 57 | −17.84 | −22.94 | −0.183 | 37.21 | +0.022 |
| T3 | out of sample | 118 | −0.056 | −0.75 | −0.023 | −0.30 | 50 | 34 | 42 | −6.66 | −16.92 | −0.090 | 46.74 | +0.020 |

| Test | OOS one-sided p | Holm p | Placebo beaten (of 40) | Placebo mean / max | Pass |
|---|---|---|---|---|---|
| T1 | 0.9282 | 1 | 7 | −0.033 / +0.100 | no |
| T2 | 0.9605 | 1 | 4 | −0.015 / +0.173 | no |
| T3 | 0.7713 | 1 | 9 | +0.006 / +0.180 | no |

## Longs, shorts and the unconditional baselines (net R a trade, n)

Same entry day, hold, stop and costs. "Always long / short" trades every month of the window (the unconditional
same-side baseline); "long in the rule's short months" is the buy the rule skipped when it sold, and the reverse.

| Test | Window | Rule longs | Always long | Rule shorts | Always short | Long in the rule's short months | Short in the rule's long months |
|---|---|---|---|---|---|---|---|
| T1 | in sample | +0.046 (55) | +0.019 (120) | −0.023 (65) | −0.030 (120) | −0.003 (65) | −0.039 (55) |
| T1 | out of sample | +0.024 (47) | +0.072 (118) | −0.177 (71) | −0.146 (118) | +0.104 (71) | −0.099 (47) |
| T2 | in sample | −0.073 (33) | −0.037 (76) | +0.060 (43) | +0.091 (76) | −0.008 (43) | +0.131 (33) |
| T2 | out of sample | +0.141 (24) | +0.181 (71) | −0.303 (47) | −0.259 (71) | +0.202 (47) | −0.173 (24) |
| T3 | in sample | −0.028 (57) | +0.020 (120) | −0.258 (63) | −0.080 (120) | +0.064 (63) | +0.116 (57) |
| T3 | out of sample | +0.133 (42) | +0.144 (118) | −0.161 (76) | −0.167 (118) | +0.151 (76) | −0.176 (42) |

## Checks of the pass bar (T1)

- Out-of-sample net R > 0: no (−0.097).
- Out-of-sample month t >= 2: no (−1.47).
- Holm p < 0.05: no (1).
- In-sample net R > 0: yes (+0.009).
- Out of sample positive at 2x costs: no (−0.127).
- Above at least 38 of 40 placebos: no (7).

## Net R a trade by entry year (T1)

| Year | n | Net R |
|---|---|---|
| 2007 | 12 | −0.226 |
| 2008 | 12 | +0.651 |
| 2009 | 12 | −0.143 |
| 2010 | 12 | +0.115 |
| 2011 | 12 | −0.075 |
| 2012 | 12 | +0.009 |
| 2013 | 12 | −0.355 |
| 2014 | 12 | +0.181 |
| 2015 | 12 | −0.014 |
| 2016 | 12 | −0.058 |
| 2017 | 12 | +0.382 |
| 2018 | 12 | −0.082 |
| 2019 | 12 | +0.106 |
| 2020 | 12 | −0.163 |
| 2021 | 12 | −0.201 |
| 2022 | 12 | +0.175 |
| 2023 | 12 | −0.140 |
| 2024 | 12 | −0.476 |
| 2025 | 12 | −0.359 |
| 2026 | 10 | −0.237 |

## Reading

- T1 does not pass the pre-registered bar; T2 does not, T3 does not. Out of sample T1 is −0.097R a trade net (gross −0.068R, month t −1.47, n 118); in sample +0.009R (t 0.12, n 120).
- Out of sample the rule's buys made +0.024R (n 47) against +0.072R for being long every month (n 118); its sells −0.177R (n 71) against −0.146R for always-short; a buy in the months it sold would have made +0.104R. The coin-flip placebo averaged −0.033R; T1 beat 7 of 40.
- Costs: median stop $46.93 out of sample ($37.27 in sample); median cost +0.022R a trade (buys carry the financing).
- Not an edge: never a council rule, filter, gate or size of the gold book. A further test of this idea needs its own pre-registration on other data.

To repeat: `node research/edge/gold-mid-month-turn/run.mjs` (reads council-data with `git show`, no network). Test:
`tests/gold-mid-month-turn.test.mjs`.
