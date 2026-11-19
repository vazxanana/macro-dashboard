# Result: the weekly open as a level on gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests: the bullish-week long T1 made +0.066R a trade net out of sample (n 79, month t 0.57, Holm p 0.85) and beat 24 of 40 placebos; T2 and T3 lose in both windows.**

PREREGISTRATION.md was committed and pushed alone (c6901dd42) before any candle was fetched; the study ran once and nothing was
changed after the result. A new stand-alone rule on spot gold, decided on 2021 to now with 2016-20 in sample, no candle before
1 January 2016 read (owner decision 44): not a test of the gold book. Nothing live changes and no proposal is written.

## What was tested
The weekly-profile idea of the owner's ICT / market-maker material, written as three mechanical rules (full wording in
PREREGISTRATION.md). W0 = the Sunday 18:00 New York weekly open; A = the mean true range of the 14 previous weeks.
- **T1 (primary)**: prior week closed up -> a buy limit at W0 - 0.25 A on Tuesday-Wednesday (New York), stop 0.5 A under the
  fill, out at Friday's last candle before 16:00 New York.
- **T2**: the mirror sell after a down week.
- **T3**: a buy limit at W0 - 0.5 A and a sell limit at W0 + 0.5 A from the open through Wednesday, first fill wins, stop 0.5 A
  beyond it, target W0, else out Friday.

Costs: $0.30 a round trip, $0.15 slippage on every stop and time exit (limit entries and target exits pay none), financing on
buys by `council/fills.mjs` (`FIN.xau.long`, today's demo rate for every year). t on calendar-month sums of net R.

## The tests

| Test | Window | n | Gross R a trade | Net R a trade | PF | Total net | Month t (net) | Worst drawdown |
|---|---|---|---|---|---|---|---|---|
| T1 long, up weeks | 2016-20 (in sample) | 73 | +0.089 | +0.016 | 1.04 | +1.16R | 0.14 | -9.23R |
| T1 long, up weeks | 2021-now (out of sample) | 79 | +0.117 | +0.066 | 1.20 | +5.20R | 0.57 | -7.99R |
| T2 short, down weeks | 2016-20 | 52 | -0.090 | -0.116 | 0.74 | -6.05R | -0.92 | -8.41R |
| T2 short, down weeks | 2021-now | 65 | -0.166 | -0.178 | 0.60 | -11.59R | -1.60 | -18.95R |
| T3 back to the open | 2016-20 | 127 | -0.045 | -0.086 | 0.80 | -10.90R | -1.05 | -12.88R |
| T3 back to the open | 2021-now | 167 | -0.107 | -0.131 | 0.70 | -21.81R | -1.94 | -27.29R |

| Check (all required) | T1 | T2 | T3 |
|---|---|---|---|
| OOS net > 0, month t >= 2, Holm p <= 0.05 | no (t 0.57, Holm p 0.853) | no (t -1.60, Holm p 1) | no (t -1.94, Holm p 1) |
| In sample net > 0 | yes (+0.016) | no | no |
| OOS net > 0 at 2x costs | yes (+0.015) | no (-0.191) | no (-0.154) |
| OOS n >= 60 | yes (79) | yes (65) | yes (167) |
| Beats >= 38 of 40 placebos (OOS mean net) | no (24; median +0.049) | no (3; median -0.114) | no (8; median -0.063) |

## What it shows
- **T1's small plus is gold's drift, not the weekly open.** The same buy anchored to a random candle of Sunday-Monday made
  +0.049R a trade in the median placebo (range -0.037 to +0.141); the weekly open adds +0.017R, about nothing. Year by year
  it changes sign (2018 -4.83R, 2021 +4.92R, 2022-23 negative, 2024 +4.61R, 2025-26 negative).
- **The bearish mirror loses** in both windows (-0.178R out of sample, 2022-25 every year negative): in a market that rose
  most of the decade, selling an early-week rally above the open was a losing side; it does worse than its own placebos.
- **The open is not a magnet.** Fading a 0.5 A excursion back to W0 lost before costs (-0.107R gross out of sample); only 39 of
  167 trades reached the open, 63 were stopped; buys -0.086R (n 75), sells -0.167R (n 92). No week had both limits in one
  candle.
- Median stop (0.5 A): $16.74 in 2016-20, $31.46 out of sample, so the $0.45 of spread and slippage is about 0.02R a trade;
  the result is the market's, not the costs'.

Not tested, and not to be read into this: other distances (0.1 A, 0.5 A for T1), a Monday entry, a target at the week's high,
the daily or monthly open, other markets. Any follow-up needs its own pre-registration.

Data: OANDA mid H1 XAU/USD, 3 Jan 2016 to 13 Nov 2026 (64,266 candles, 567 weeks), New York time and CME shut periods from
`ict/calendar.mjs` (`nyParts`, `cmeShut`). To repeat: `node --use-env-proxy research/edge/gold-weekly-open/fetch.mjs <dir>`
(candles outside git), then `node research/edge/gold-weekly-open/run.mjs <dir>`. Tests: `tests/gold-weekly-open.test.mjs`.
