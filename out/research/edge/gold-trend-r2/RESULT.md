# Result: trend quality (R squared of the 60-day log-price line) on gold's daily chart (14 Nov 2026)

**Verdict: FAIL, 0 of 3: clean-trend days traded with the slope did WORSE than the same month's same-side baseline, -0.126R IS (t -2.66) and -0.094R OOS (t -2.88); the wrong sign for the rule.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). OANDA mid gold daily candles,
council-data `research/daily/xau.json`, weekends folded with `council/fills.mjs` `foldWeekend`, March 2006 to 6 November
2026 (5,364 days). Signal: R squared of an OLS fit of ln(close) on time over the last 60 closes >= 0.70; side = sign of the
slope; entry at the next open, stop 2 x ATR(14) never moved, out at the open 10 days later. Every trade has a stop. Costs
$0.60 a round trip and overnight financing on buys at `FIN.xau.long`. In sample = entries 2007-16, out of sample = 2017 to
6 Nov 2026. A stand-alone rule, not a gate, exit, entry or size of the gold book; owner decision 44 untouched. Nothing live
changed; no proposal.

## T1, the primary test: selection against the same-side baseline

The baseline takes the slope-side trade on EVERY day (IS n 2,601, OOS n 2,547); the rule takes it only on signal days
(22 % of IS days, 28 % of OOS days). Excess = a signal trade's net R minus the mean net R of all baseline trades entered in
the same calendar month, summed by entry month (month t over every calendar month).

| Window | Signal trades n | Signal R a trade, gross | Signal R a trade, net | Excess a trade, net | Excess at 2x costs | Month t |
|---|---|---|---|---|---|---|
| IS 2007-16 | 580 | +0.047 | -0.008 | -0.126 | -0.125 | -2.66 |
| OOS 2017-26 | 716 | +0.101 | +0.044 | -0.094 | -0.092 | -2.88 |
| OOS 2017-21 | 329 | +0.084 | +0.021 | -0.052 | -0.052 | -1.14 |
| OOS 2022-26 | 387 | +0.116 | +0.064 | -0.129 | -0.126 | -2.83 |

Baseline (every day, slope side): IS +0.046R gross, -0.002R net a trade (month t -0.03); OOS +0.109R gross, +0.054R net
(month t 1.07). Gold's drift is in both columns; the excess removes it. Median stop: $37.89 IS, $58.32 OOS on signal trades.
Cost share (cost + financing over gross R): 117 % IS, 56 % OOS for the signal trades. Holm p 0.01 (two-sided: the excess
is reliably NEGATIVE). Placebo: 40 seeded draws of the same number of random days per year give OOS t from -1.88 to +1.96
(median -0.05); the real t -2.88 beats 0 of them (0; 40 below it). The rule's direction is wrong: clean 60-day trends do
not carry on better than an ordinary day's slope; within a month the noisier days did better.

## T2 and T3, the rule stand-alone (one position at a time)

| Test | Window | n | Win | R a trade, gross | R a trade, net | 2x costs | Total net | Worst DD | Median stop | Month t |
|---|---|---|---|---|---|---|---|---|---|---|
| T2 long and short | IS 2007-16 | 85 | 46 % | -0.028 | -0.079 | -0.130 | -6.71R | -10.14R | $38.35 | -0.66 |
| | OOS 2017-26 | 87 | 48 % | +0.131 | +0.073 | +0.015 | +6.36R | -8.38R | $53.70 | 0.62 |
| T3 shorts only | IS 2007-16 | 24 | 33 % | -0.196 | -0.215 | -0.234 | -5.16R | -5.79R | $34.81 | -0.72 |
| | OOS 2017-26 | 18 | 50 % | -0.012 | -0.029 | -0.046 | -0.52R | -4.55R | $44.10 | -0.14 |

T2: Holm p 1.00, cost share 44 % OOS (gross negative IS); placebo (random OOS days, same sides) median +0.030R, beaten by 27
of 40 (27; 40 seeds). T3: Holm p 1.00, 18 OOS trades (descriptive, under 30); placebo median -0.135R, beaten 27 of 40
(27; 40 seeds). The stand-alone rule's OOS profit (69 of 87 trades long) is gold's rise, not the signal: it loses in sample
and its shorts lose in both windows.

## The pass bar, check by check

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS month t >= 2, Holm p < 0.05 | no (t -2.88, wrong sign) | no (t 0.62) | no (t -0.14) |
| IS same sign, positive | no (-0.126) | no (-0.079) | no (-0.215) |
| Positive at 2x costs (T2 OOS) | yes (+0.015) | yes (+0.015) | no (-0.046) |
| Placebo beaten >= 38 of 40 | no (0) | no (27) | no (27) |
| OOS n >= 30 | yes (716) | yes (87) | no (18) |

## What this does and does not say

- Trend quality as defined here is not a trend-following signal on gold: it points the wrong way in both windows.
- The negative excess suggests a fade of "too clean" trends, but that reading was not pre-registered: it is a hypothesis
  for its own pre-registration on other data or markets, never a finding of this study, and nothing is proposed.
- Overlapping 10-day trades in T1 are summed by month; months overlap by at most 10 days, so month t is close to, not
  exactly, independent. Today's financing rate is charged for every year.

To repeat: `node research/edge/gold-trend-r2/run.mjs fetch <dir>` (git show, no network), then `… full <dir>`.
Tests: `tests/gold-trend-r2.test.mjs`.
