# Inside week, narrow week and the held Monday range on spot gold: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the inside-week breakout made +0.177R a trade net out of sample (n 67, month t 0.94) but lost in sample (−0.087R, n 50); the NR4-week and Monday-range tests fail too.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone rule, not a gate, exit,
entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read. Paper research only: nothing
live changed and no proposal is written.

## Rule (as pre-registered)

- Spot gold, OANDA mid XAU/USD daily candles (council-data `research/daily/xau.json`, March 2006 to 6 Nov 2026), UTC days folded
  with `council/fills.mjs` `foldWeekend` (the Sunday stub is part of Monday), weeks Monday to Friday; a signal week needs 4+
  trading days.
- OCO bracket: buy stop at the range high, sell stop at the range low, first traded wins; **stop = the other side of the range
  on every trade**; gaps fill at the open (worse); a day that trades both levels is a full loss.
- T1 (primary) inside week: orders all next week, exit at the last close of the week after. T2 the narrowest week of four
  (NR4 week): the same. T3 Monday's range held by Tuesday and Wednesday: orders Thursday and Friday, exit Friday's close.
- Costs: $0.30 spread + $0.15 slippage on the entry and on the exit ($0.60 a trade, 2× = $1.20); buys pay `nights` ×
  `FIN.xau.long` (0.000148 a rollover, the demo broker's swap of 11 Nov 2026, every year) × entry / risk.
- In sample 2008-2016, out of sample (decisive) 2017 to October 2026; t on calendar-month sums of net R; Holm over the three
  out-of-sample p values; placebo = the same bracket on 40 seeded draws of random weeks.

## Results

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Month t (net) | Median risk $ | Both-levels days |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 inside week (primary) | IS 2008-16 | 50 | −0.034 | −0.087 | −0.106 | 42.0 | −4.35 | −11.98 | −0.83 | 36.11 | 1 |
| T1 inside week (primary) | OOS 2017-26 | 67 | +0.236 | +0.177 | +0.159 | 43.3 | +11.87 | −8.08 | 0.94 | 35.53 | 1 |
| T2 NR4 week | IS 2008-16 | 102 | +0.052 | −0.002 | −0.022 | 45.1 | −0.22 | −6.72 | −0.17 | 31.27 | 1 |
| T2 NR4 week | OOS 2017-26 | 101 | +0.146 | +0.077 | +0.058 | 41.6 | +7.78 | −10.58 | 0.54 | 35.01 | 1 |
| T3 Monday held to Wednesday | IS 2008-16 | 18 | +0.187 | +0.158 | +0.132 | 55.6 | +2.84 | −0.91 | 1.46 | 22.46 | 0 |
| T3 Monday held to Wednesday | OOS 2017-26 | 19 | −0.167 | −0.193 | −0.215 | 47.4 | −3.67 | −3.86 | −1.37 | 29.98 | 2 |

Signals: T1 53 / 71 (3 / 4 never triggered), T2 105 / 107 (25 / 23 skipped while a trade was open), T3 26 / 29 (8 / 10 never
triggered). Out-of-sample one-sided p: T1 0.174, T2 0.295, T3 0.914; none is significant after Holm.

## The checks

| Test | OOS net > 0 | OOS t ≥ 2 | Holm | IS same sign | OOS at 2× costs > 0 | Above placebo p95 | Pass |
|---|---|---|---|---|---|---|---|
| T1 | yes | no | no | no | yes | yes (just) | no |
| T2 | yes | no | no | no | yes | no | no |
| T3 | no | no | no | yes | no | no | no |

## Placebo (out of sample, 40 seeds, random weeks, same bracket, exit and costs)

| Test | Real net R a trade | Placebo median | Placebo p95 | Min / max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | +0.177 | +0.018 | +0.174 | −0.238 / +0.300 | 38 of 40 |
| T2 | +0.077 | +0.019 | +0.164 | −0.202 / +0.174 | 27 of 40 |
| T3 | −0.193 | −0.027 | +0.153 | −0.212 / +0.294 | 1 of 40 |

## What it says

- **T1 out of sample is a long-gold effect, not a breakout effect.** Its buys made +0.431R a trade (n 34, t 1.34) and its sells
  −0.085R (n 33); in sample, when gold went sideways to down after 2011, buys made −0.035R and sells −0.173R. Year by year it
  changes sign (2012 −5.99R, 2013 −2.75R, 2024 −5.89R; 2020 +6.71R, 2026 +6.97R). Beating the placebo's 95th percentile by
  0.003R on 67 trades with a month t under 1 is not evidence.
- **T2 is a weaker copy of T1**: out of sample buys +0.248R (n 63), sells −0.207R (n 38); flat in sample.
- **T3, the MMXM / ICT note** (a Monday range held through Wednesday precedes a Thursday / Friday expansion): it is rare on gold
  (about three weeks a year), and the break of that range lost out of sample (−0.193R, n 19), below the placebo median.
- The stops are wide (median $30-36 on the weekly tests), so the $0.60 cost is about 0.02R: costs are not why these fail.

Not tested, and not to be read into this: other markets, H1 execution or an intraday stop, a target, the weekly open (another
study), a narrower stop inside the range. Not an edge; never a council rule.

To repeat: `node research/edge/gold-inside-week/run.mjs` (reads `origin/council-data` with git, no network). Tests:
`tests/gold-inside-week.test.mjs`.
