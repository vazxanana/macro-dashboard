# The H4 inside-bar breakout on spot gold: result (2026-11-14)

**Verdict: FAIL, 0 of 3: the gold H4 inside-bar breakout (T1, 2R) made −0.011R a trade net out of sample (n 1146, month t −0.32), +0.016R in sample.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before `run.mjs` existed). A new stand-alone rule, not a gate, exit,
entry or size of the gold book (docs/owner-decisions.md item 44); none of that book's positions was read. Paper research
only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.

## Rule (as pre-registered)

- OANDA mid XAU/USD H1 candles, H4 on fixed UTC boundaries 22 / 02 / 06 / 10 / 14 / 18 (Sunday hours before 22:00 with the
  Sunday 22:00 candle). Inside bar: high and low strictly inside the previous (mother) H4 candle, mother range >= 1 x ATR(14).
- At the inside candle's close: buy stop at the mother high, sell stop at the mother low, one-cancels-other, live 24 H1 candles.
  **Stop = the other side of the mother candle on every trade.** Fills, stops and targets run on H1 candles; a gapped fill at the
  open; one candle through both levels = the side nearer its open and a full loss; the fill candle reaching the stop = a full
  loss. T1 / T3 target 2R, T2 none; time exit at the close of the 24th H1 candle from the fill. One bracket or trade at a time.
- Costs $0.60 a round trip (2x = $1.20); buys pay `nights` x `FIN.xau.long` (0.000148) financing.
- In sample: fills 2007-01-01 to 2016-12-31; out of sample (decisive): 2017-01-01 to 2026-10-31. t on calendar-month sums of
  net R, Holm over the three OOS p values; baseline / placebo = 40 seeds of a same-side trade at a random H1 candle of the same
  year with the same risk (as a fraction of price), target and hold.
- Detail fixed in code, not named in the pre-registration: the target is read from the candle after the fill candle (on the
  fill candle only the stop is read, so a fill candle that also ran to the target is not booked as a win).

Data: OANDA mid H1 XAU_USD via the site proxy, aggregated to H4 on fixed UTC boundaries 22/02/06/10/14/18; 2006-03-19 to 2026-11-13, 125704 H1 / 32312 H4 candles.

## Results

| Test | Window | n | Gross R | Net R | Net at 2x | Win % | Total net R | Worst DD R | Month t gross | Month t net | Median risk $ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2007-16 | 1230 | +0.084 | +0.016 | −0.052 | 45.61 | +20.02 | −35.60 | +2.86 | +0.56 | 11.17 |
| T1 | OOS 2017-26 | 1146 | +0.050 | −0.011 | −0.071 | 45.38 | −12.22 | −49.68 | +1.50 | −0.32 | 13.76 |
| T2 | IS 2007-16 | 1193 | +0.117 | +0.048 | −0.022 | 45.6 | +56.79 | −30.98 | +3.52 | +1.43 | 11.05 |
| T2 | OOS 2017-26 | 1118 | +0.047 | −0.015 | −0.076 | 44.72 | −16.30 | −59.06 | +1.38 | −0.42 | 13.66 |
| T3 | IS 2007-16 | 823 | +0.020 | −0.059 | −0.138 | 43.38 | −48.84 | −70.65 | +0.61 | −1.75 | 10.59 |
| T3 | OOS 2017-26 | 745 | +0.054 | −0.018 | −0.091 | 45.37 | −13.54 | −50.88 | +1.25 | −0.42 | 12.8 |

Tests: T1 = both sides, target 2R; T2 = both sides, no target, time exit after 24 H1 candles; T3 = buy stop only, target 2R.
Signals (whole file): T1 2655 brackets, 195 unfilled; T2 2578 brackets, 184 unfilled; T3 2675 brackets, 1052 unfilled.

## The checks

| Test | OOS net > 0, t >= 2, Holm p < 0.05 | Holm p | IS net > 0 | OOS at 2x > 0 | Beats >= 38 of 40 placebos | OOS n >= 30 | Pass |
|---|---|---|---|---|---|---|---|
| T1 | no | 1 | yes | no | no | yes | no |
| T2 | no | 1 | yes | no | no | yes | no |
| T3 | no | 1 | no | no | no | yes | no |

## Same-side baseline and placebo (out of sample, 40 seeds)

Each seed puts every real OOS trade at a random H1 candle of the same year, same side, same risk as a fraction of price, same target and hold, same costs.

| Test | Real net R a trade | Baseline (mean of seeds) | Seeds beaten | 5th pct | Median | 95th pct |
|---|---|---|---|---|---|---|
| T1 | −0.011 | −0.042 | 34 of 40 | −0.091 | −0.045 | +0.002 |
| T2 | −0.015 | −0.039 | 30 of 40 | −0.099 | −0.043 | +0.014 |
| T3 | −0.018 | −0.003 | 14 of 40 | −0.056 | −0.010 | +0.060 |

## Buys and sells (out of sample; reported, not judged)

| Test | Side | n | Gross R | Net R | Month t net |
|---|---|---|---|---|---|
| T1 | buys | 595 | +0.098 | +0.027 | +0.58 |
| T1 | sells | 551 | −0.002 | −0.051 | −1.14 |
| T2 | buys | 587 | +0.094 | +0.021 | +0.44 |
| T2 | sells | 531 | −0.004 | −0.054 | −1.17 |
| T3 | buys | 745 | +0.054 | −0.018 | −0.42 |

## T1 by year (net R a trade)

| Year | n | Net R |
|---|---|---|
| 2007 | 122 | −0.066 |
| 2008 | 121 | +0.297 |
| 2009 | 123 | +0.094 |
| 2010 | 129 | −0.081 |
| 2011 | 128 | −0.035 |
| 2012 | 120 | −0.095 |
| 2013 | 123 | +0.196 |
| 2014 | 124 | −0.057 |
| 2015 | 117 | −0.034 |
| 2016 | 123 | −0.051 |
| 2017 | 123 | −0.145 |
| 2018 | 109 | −0.167 |
| 2019 | 135 | +0.130 |
| 2020 | 114 | +0.137 |
| 2021 | 109 | −0.205 |
| 2022 | 111 | −0.081 |
| 2023 | 110 | +0.036 |
| 2024 | 120 | −0.045 |
| 2025 | 116 | +0.116 |
| 2026 | 99 | +0.102 |

## Reading

Before costs the bracket has a small positive drift (T1 +0.050R a trade out of sample, month t +1.50; +0.084R in sample), but with a median risk of $13.76 the $0.60 round trip and the buys' financing take 0.061R a trade and leave −0.011R (t −0.32); at 2x costs −0.071R. The gross drift is the buys (out of sample +0.098R gross, +0.027R net, n 595) while the sells make −0.002R gross: the same pattern as gold's rise over 2017-26, not a property of the inside bar. T1 beat 34 of 40 same-side random trades of equal size and hold (baseline −0.042R), short of the 38 needed. T2 (no target) and T3 (buy stop only) fail too: T3 −0.018R out of sample against a random-buy baseline of −0.003R (beaten by 14 of 40) and −0.059R in sample; T2 −0.015R. Like the daily inside day (`gold-inside-day`), the H4 inside bar is not an edge on gold after costs; no follow-up is proposed.

To repeat: `node --use-env-proxy research/edge/gold-h4-inside-bar/run.mjs fetch <dir>` (candles outside git), then
`node research/edge/gold-h4-inside-bar/run.mjs full <dir>`. Test: `tests/gold-h4-inside-bar.test.mjs`.
