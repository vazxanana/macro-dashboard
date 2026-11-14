# Result: gold after a week that closed at its high or its low (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following a gold week that closed at its high or low made +0.053R a trade net 2017-26 (n 121, month t 0.80), +0.024R over the same-side baseline.**

Pre-registered in `PREREGISTRATION.md` (pushed alone first, commit 2122e21a7); the test ran once and nothing was changed after the result. Paper research only. A stand-alone weekly rule: not a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and none of that book's 2006-17 positions was read (owner decision 44). Nothing live changed and no proposal follows. Not an edge without n and t.

## Data and rule

OANDA mid daily XAU_USD, council-data `research/daily/xau.json` at `d8d68407b` (`git show`, no network), 2006-03-20 to 2026-11-13, weekend candles folded into the next weekday (`foldWeekend`): 5369 trading days, 1078 weeks. A week of 4+ days that closed in the top F of its own high-low range is a buy, in the bottom F a sell. Entry at the next week's first open, stop 2 x ATR(20) (daily, up to the signal week's last day), gap fills at the open, out at the last close of the next week (T1, T2) or the week after (T3; one position at a time). Costs: $0.60 a round trip and, on buys, `nights` x `FIN.xau.long` (0.000148 of price a rollover) x entry. Baseline: the same-side trade with the same stop at every trading day's open of the same year, held 5 (T1, T2) or 10 (T3) trading days; excess = net R minus that year's same-side baseline mean. t on calendar-month sums of net R by exit month (empty months count), one-sided, Holm over three. Placebo: every OOS trade keeps its side, its signal week drawn at random from the same year's weeks, 40 seeds.

## Tests (R a trade; IS 2007-01 to 2016-12, OOS 2017-01 to 2026-10)

| Test | Window | n (buy / sell) | Gross R | Net R | Spread R | Financing R | Won | Stopped | Month t net | Month t gross | Total net R | Worst DD R | Baseline R | Excess R (t) | 2x costs net R | Holm p | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 F 0.10, hold one week (primary) | IS | 115 (87 / 28) | +0.118 | +0.080 | 0.018 | 0.021 | 54.8% | 17.4% | +1.13 | +1.67 | +9.15 | -4.44 | +0.019 | +0.060 (+0.82) |  |  |  |  |
|  | OOS | 121 (85 / 36) | +0.090 | +0.053 | 0.014 | 0.023 | 49.6% | 15.7% | +0.80 | +1.33 | +6.45 | -4.96 | +0.030 | +0.024 (+0.33) | +0.017 | 0.636 | 31 of 40 | no |
| T2 F 0.20, hold one week | IS | 242 (151 / 91) | +0.065 | +0.030 | 0.018 | 0.017 | 52.9% | 18.2% | +0.64 | +1.38 | +7.28 | -6.86 | -0.001 | +0.031 (+0.65) |  |  |  |  |
|  | OOS | 216 (142 / 74) | +0.045 | +0.010 | 0.014 | 0.022 | 47.7% | 14.4% | +0.21 | +1.00 | +2.06 | -6.25 | +0.024 | -0.014 (-0.29) | -0.026 | 0.653 | 21 of 40 | no |
| T3 F 0.10, hold two weeks | IS | 90 (67 / 23) | +0.081 | +0.024 | 0.018 | 0.038 | 48.9% | 34.4% | +0.25 | +0.81 | +2.20 | -3.99 | +0.041 | -0.016 (-0.15) |  |  |  |  |
|  | OOS | 94 (66 / 28) | +0.107 | +0.049 | 0.014 | 0.044 | 44.7% | 31.9% | +0.45 | +0.98 | +4.61 | -9.25 | +0.054 | -0.005 (-0.04) | -0.009 | 0.653 | 28 of 40 | no |

Pass bar (pre-registered, each test): OOS month t >= 2 and Holm p < 0.05, in-sample net > 0, OOS net > 0 at 2x costs, OOS excess over the same-side baseline > 0, OOS t above at least 38 of 40 placebos. The verdict follows T1.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isPositive | yes | yes | yes |
| x2Positive | yes | no | no |
| excessPositive | yes | no | no |
| beats38of40 | no | no | no |

## Buys and sells apart (reported, not tests)

| Test | Window | Buy n | Buy gross R | Buy net R | Buy t | Buy excess R | Sell n | Sell gross R | Sell net R | Sell t | Sell excess R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS | 87 | +0.084 | +0.039 | +0.52 | -0.001 | 28 | +0.224 | +0.207 | +1.19 | +0.252 |
|  | OOS | 85 | +0.112 | +0.066 | +0.78 | -0.015 | 36 | +0.037 | +0.023 | +0.23 | +0.114 |
| T2 | IS | 151 | +0.065 | +0.020 | +0.33 | -0.008 | 91 | +0.064 | +0.047 | +0.63 | +0.097 |
|  | OOS | 142 | +0.111 | +0.063 | +1.02 | -0.023 | 74 | -0.080 | -0.094 | -1.43 | +0.003 |
| T3 | IS | 67 | +0.075 | +0.005 | +0.04 | -0.070 | 23 | +0.099 | +0.082 | +0.40 | +0.139 |
|  | OOS | 66 | +0.237 | +0.161 | +1.15 | +0.031 | 28 | -0.199 | -0.214 | -1.31 | -0.088 |

## Baseline (every trading day, same stop and costs; net R a trade)

| Hold | IS n | IS net R | OOS n | OOS net R |
|---|---|---|---|---|
| 5d buy | 2602 | +0.005 | 2558 | +0.070 |
| 5d sell | 2602 | -0.064 | 2558 | -0.108 |
| 10d buy | 2602 | +0.021 | 2553 | +0.120 |
| 10d sell | 2602 | -0.100 | 2553 | -0.166 |

## Placebo (40 seeds, OOS month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | -0.97 | +0.13 | +1.76 | +2.03 | +0.80 | 31 of 40 |
| T2 | -1.11 | +0.13 | +1.72 | +1.81 | +0.21 | 21 of 40 |
| T3 | -2.10 | +0.15 | +1.91 | +2.20 | +0.45 | 28 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2007 | 17 | -1.24 | 30 | -5.29 | 12 | +0.06 |
| 2008 | 12 | -0.40 | 24 | +0.27 | 11 | -1.42 |
| 2009 | 12 | +1.90 | 28 | +2.69 | 9 | +1.59 |
| 2010 | 13 | +1.08 | 24 | +2.30 | 11 | -0.82 |
| 2011 | 13 | +0.41 | 23 | +5.50 | 9 | +0.15 |
| 2012 | 12 | -2.23 | 24 | -2.55 | 9 | -0.05 |
| 2013 | 5 | +1.43 | 20 | +0.46 | 4 | -0.46 |
| 2014 | 13 | -0.97 | 24 | +0.51 | 10 | -1.05 |
| 2015 | 9 | +4.48 | 21 | +1.63 | 7 | +1.54 |
| 2016 | 9 | +4.71 | 24 | +1.76 | 8 | +2.65 |
| 2017 | 12 | -1.68 | 24 | +0.64 | 8 | -3.96 |
| 2018 | 6 | -2.37 | 14 | -2.98 | 7 | +1.45 |
| 2019 | 15 | +0.31 | 24 | +2.34 | 11 | -4.63 |
| 2020 | 9 | +2.29 | 27 | -3.05 | 7 | +1.31 |
| 2021 | 12 | +1.44 | 21 | +3.16 | 9 | +1.46 |
| 2022 | 14 | +0.02 | 24 | -3.45 | 13 | +0.50 |
| 2023 | 14 | +0.38 | 19 | +1.90 | 10 | +0.28 |
| 2024 | 14 | +4.81 | 22 | +4.22 | 10 | +1.96 |
| 2025 | 12 | +0.29 | 22 | -0.69 | 10 | +3.01 |
| 2026 | 13 | +0.96 | 19 | -0.02 | 9 | +3.22 |

## Reading

- **Following a week that closed at its extreme (T1) is small, positive and not separate from noise.** Out of sample +0.053R a trade net (n 121, month t 0.80; +0.090R gross, month gross t 1.33); in sample +0.080R (n 115, t 1.13). Spread and slippage take 0.014R and financing on the buys 0.023R out of sample. At 2x costs +0.017R a trade. Holm p 0.636; it beat 31 of 40 random-week placebos (95th percentile t 1.76).
- **Most of it is gold's drift, not the close location.** Against the same-side trade on every day of the same year the excess is +0.024R out of sample (t 0.33) and +0.060R in sample (t 0.82). The buys after a week that closed at its high made +0.066R out of sample, -0.015R against every-day buys of the same years; the sells after a week that closed at its low were better than every-day sells (+0.114R out of sample) only because every-day sells lost (-0.108R a trade on 5-day holds in 2017-26).
- **The looser cut (T2, top / bottom fifth) is flat**: +0.010R out of sample (n 216, t 0.21), -0.014R against the baseline, -0.026R at 2x costs. **Two weeks (T3)** +0.049R (n 94, t 0.45), -0.005R against the baseline; its sells lost -0.214R. T3 had 90 trades in sample, under the 100 the pre-registration counted, because one position at a time skips a signal inside a held two-week position (115 signal weeks).
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. No other cut, hold or stop was run.
