# Result: gold after a weekly spring (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold the week after a weekly spring made +0.040R a trade net 2017-26 (n 218, month t 0.49), +0.030R over the same-side baseline.**

Pre-registered in `PREREGISTRATION.md` (pushed alone first, commit 5dbb880dd); the test ran once and nothing was changed after the result. Paper research only. A stand-alone weekly rule: not a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and none of that book's 2006-17 positions was read (owner decision 44). Nothing live changed and no proposal follows. Not an edge without n and t.

## Data and rule

OANDA mid daily XAU_USD, council-data `research/daily/xau.json` at `67bac79eb` (`git show`, no network), 2006-03-20 to 2026-11-13, weekend candles folded into the next weekday (`foldWeekend`): 5369 trading days, 1078 weeks. Spring: a week of 4+ days whose low is below the lowest low of the four weeks before and whose close is in the top half of its own range (buy); upthrust: the mirror (sell). One trade at the open of every trading day of the next week (the signal is too rare for 100 single entries a window, so the daily entries inside the week are the trades), stop 2 x ATR(20) (daily, up to the day before the entry), gap fills at the open, out at the last close of that week (T1, T3) or the week after (T2). Costs: $0.60 a round trip and, on buys, `nights` x `FIN.xau.long` (0.000148 of price a rollover) x entry. Baseline: the same-side trade with the same stop at every trading day's open of the same year, out at the last close of its own week (T1, T3) or the next week (T2); excess = net R minus that year's same-side baseline mean. t on calendar-month sums of net R by exit month (empty months count), one-sided, Holm over three. Placebo: each OOS signal week replaced by a random week of the same year, same entries, 40 seeds.

## Tests (R a trade; IS 2007-01 to 2016-12, OOS 2017-01 to 2026-10)

| Test | Window | Signal weeks | n (buy / sell) | Gross R | Net R | Spread R | Financing R | Won | Stopped | Month t net | Month t gross | Total net R | Worst DD R | Baseline R | Excess R (t) | 2x costs net R | Holm p | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 spring, buy, out at the end of the next week (primary) | IS | 37 | 184 (184 / 0) | +0.010 | -0.022 | 0.018 | 0.015 | 54.9% | 10.9% | -0.31 | +0.14 | -4.09 | -13.73 | +0.014 | -0.037 (-0.99) |  |  |  |  |
|  | OOS | 44 | 218 (218 / 0) | +0.073 | +0.040 | 0.015 | 0.019 | 49.5% | 3.7% | +0.49 | +0.90 | +8.64 | -12.59 | +0.009 | +0.030 (+0.81) | +0.006 | 0.936 | 32 of 40 | no |
| T2 spring, buy, out at the end of the week after | IS | 38 | 189 (189 / 0) | +0.098 | +0.037 | 0.018 | 0.043 | 49.2% | 23.3% | +0.28 | +0.73 | +6.90 | -12.55 | +0.013 | +0.024 (+0.39) |  |  |  |  |
|  | OOS | 44 | 218 (218 / 0) | +0.106 | +0.038 | 0.015 | 0.054 | 43.6% | 25.7% | +0.26 | +0.70 | +8.31 | -26.94 | +0.032 | +0.007 (+0.10) | -0.030 | 0.936 | 25 of 40 | no |
| T3 upthrust, sell, out at the end of the next week | IS | 48 | 240 (0 / 240) | -0.036 | -0.054 | 0.017 | 0.000 | 47.1% | 7.5% | -0.75 | -0.51 | -12.88 | -22.54 | -0.075 | +0.022 (+0.60) |  |  |  |  |
|  | OOS | 60 | 297 (0 / 297) | -0.012 | -0.025 | 0.013 | 0.000 | 48.5% | 10.1% | -0.41 | -0.19 | -7.32 | -12.52 | -0.096 | +0.071 (+2.20) | -0.038 | 0.936 | 38 of 40 | no |

Pass bar (pre-registered, each test): OOS month t >= 2 and Holm p < 0.05, in-sample net > 0, OOS net > 0 at 2x costs, OOS excess over the same-side baseline > 0, OOS t above at least 38 of 40 placebos. The verdict follows T1.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isPositive | no | yes | no |
| x2Positive | yes | no | no |
| excessPositive | yes | yes | yes |
| beats38of40 | no | no | yes |

## Baseline (every trading day of the window, same stop, costs and hold shape; net R a trade)

| Hold | IS n | IS net R | OOS n | OOS net R |
|---|---|---|---|---|
| to its week end buy | 2602 | +0.018 | 2562 | +0.042 |
| to its week end sell | 2602 | -0.063 | 2562 | -0.083 |
| to next week end buy | 2602 | +0.031 | 2557 | +0.104 |
| to next week end sell | 2602 | -0.099 | 2557 | -0.152 |

## Placebo (40 seeds, OOS month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | -1.42 | -0.01 | +1.40 | +2.86 | +0.49 | 32 of 40 |
| T2 | -1.60 | +0.09 | +1.36 | +3.26 | +0.26 | 25 of 40 |
| T3 | -2.77 | -1.64 | -0.07 | +0.66 | -0.41 | 38 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2007 | 20 | +2.95 | 25 | -0.61 | 25 | -14.27 |
| 2008 | 5 | +0.16 | 5 | -0.75 | 40 | -5.19 |
| 2009 | 24 | +0.60 | 20 | +2.47 | 25 | +8.31 |
| 2010 | 15 | +1.62 | 19 | +11.00 | 30 | -3.66 |
| 2011 | 10 | +0.71 | 10 | +3.18 | 30 | -0.39 |
| 2012 | 20 | -5.43 | 20 | -0.68 | 10 | -0.96 |
| 2013 | 20 | -5.07 | 20 | -7.98 | 10 | +2.68 |
| 2014 | 40 | +8.20 | 40 | +9.71 | 35 | +1.99 |
| 2015 | 20 | -9.01 | 20 | -11.43 | 15 | +1.79 |
| 2016 | 10 | +1.19 | 10 | +1.99 | 20 | -3.18 |
| 2017 | 25 | +8.88 | 25 | +11.92 | 34 | -1.67 |
| 2018 | 30 | -6.63 | 30 | -18.79 | 20 | -4.77 |
| 2019 | 25 | -5.96 | 25 | -5.24 | 35 | +8.91 |
| 2020 | 10 | +1.78 | 10 | +2.66 | 34 | -6.60 |
| 2021 | 29 | +1.48 | 29 | +2.86 | 15 | +3.68 |
| 2022 | 30 | +6.49 | 30 | +3.73 | 40 | -3.26 |
| 2023 | 25 | +11.29 | 25 | +28.76 | 30 | +7.09 |
| 2024 | 5 | +1.56 | 5 | +7.03 | 29 | -0.09 |
| 2025 | 5 | +1.55 | 5 | +1.08 | 40 | -7.38 |
| 2026 | 34 | -11.80 | 34 | -25.69 | 20 | -3.23 |

## Reading

- **Buying the week after a spring (T1) is flat and not separate from noise.** Out of sample +0.040R a trade net (218 daily entries in 44 signal weeks, month t 0.49; +0.073R gross, month gross t 0.90); in sample -0.022R (184 entries, 37 weeks, t -0.31). Spread and slippage take 0.015R and financing 0.019R a trade out of sample; at 2x costs +0.006R. Holm p 0.936; it beat 32 of 40 random-week placebos of the same years (95th percentile t 1.40).
- **Against an ordinary buy of the same year it adds about nothing.** Excess over the same-side baseline +0.030R out of sample (t 0.81) and -0.037R in sample (t -0.99): the sign flips between the windows. **Two weeks (T2)** +0.038R out of sample (t 0.26), +0.007R over its baseline, negative at 2x costs.
- **Selling after an upthrust (T3) loses** (-0.025R a trade out of sample, n 297 in 60 weeks, t -0.41; -0.054R in sample), as every gold sell has. It loses less than an ordinary sell of the same years (excess +0.071R, t 2.20 out of sample; +0.022R in sample) and beat 38 of 40 placebos, but those placebos are random sells that lose too (median t -1.64): a smaller loss is not a rule. Not a test that passes, not pursued.
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. No other lookback, close cut, hold or stop was run.
