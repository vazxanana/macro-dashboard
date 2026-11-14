# Result: the key reversal day and the outside reversal day on spot gold (14 Nov 2026)

**Verdict: FAIL: 0 of 3 tests pass; shorting a bearish key reversal at a 20-day high lost -0.176R a trade net in 2017-26 (n 90, month t -1.50) and -0.031R in 2008-16.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit c7701cd42). Paper research: nothing live changed and no
proposal follows. **Item 44**: a new stand-alone daily rule judged on 2017-26; it is not a gate, exit, entry or size of the gold
book (Gold trend / Gold daily engulf) and says nothing about it. The live Gold daily engulf (a long-only limit order at a red
base candle's high after a body close above it, above the 20-day average) was neither read nor touched; T3's bullish leg
(range engulf, close above the previous close, market order, both sides, 3 days) is a different rule.

Rule: 17:00 New York trading days built from OANDA mid H1 XAU_USD (`fetch.mjs`, 2006-03-20 to 2026-11-12, 5,351 days;
`gold-drd-long` `days()`). A bearish key reversal = a day whose high is above the highest high of the 20 days before it and
whose close is below the previous close (bullish: the mirror at a 20-day low); an outside reversal = a day whose range takes out
both the previous high and low, closing below (bearish) or above (bullish) the previous close. Entry at the next day's first H1
open; stop $0.30 beyond the signal day's extreme, at least 0.5 x ATR(20) from the entry (a signal whose entry opens past that
level is skipped); stop checked on H1 (a gap fills at the open); otherwise out at the close of the third day; one position at a
time. Costs: $0.30 spread + $0.15 slippage on each of the two market orders ($0.60 a round trip) and `council/fills.mjs`
`FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three) on longs. t = calendar-month sums of net R (every month
counts, 0 when nothing closed), Holm over three.

## Tests

| Test | Window | n | Gross R | Net R | Net R at 2x costs | Cost R | Financing R | Win % | Stops | Stop in ATR | Month t (net) | Month t (gross) | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 short, bearish key reversal (primary) | 2017-2026 | 90 | -0.144 | -0.176 | -0.207 | 0.032 | 0 | 40.00 | 38 | 1.10 | -1.50 | -1.25 | -19.44 |
| T1 short, bearish key reversal (primary) | 2008-2016 | 77 | 0.011 | -0.031 | -0.074 | 0.043 | 0 | 40.26 | 27 | 0.96 | -0.24 | 0.09 | -14.27 |
| T2 long, bullish key reversal | 2017-2026 | 58 | -0.061 | -0.131 | -0.201 | 0.040 | 0.029 | 44.83 | 27 | 0.88 | -0.85 | -0.40 | -12.92 |
| T2 long, bullish key reversal | 2008-2016 | 55 | 0.121 | 0.053 | -0.016 | 0.039 | 0.030 | 45.45 | 18 | 1.01 | 0.32 | 0.75 | -6.79 |
| T3 outside reversal, both sides | 2017-2026 | 263 | 0.048 | 0.003 | -0.042 | 0.031 | 0.014 | 47.53 | 83 | 1.06 | 0.05 | 0.74 | -27.76 |
| T3 outside reversal, both sides | 2008-2016 | 210 | 0.015 | -0.032 | -0.079 | 0.034 | 0.013 | 43.33 | 65 | 1.15 | -0.46 | 0.21 | -14.21 |

2017-2026 = out of sample (decisive, entries 2017-01-01 to 2026-10-31, 118 months); 2008-2016 = in sample (108 months).
T3 out of sample: 127 longs, 136 shorts.

## Checks (all five needed per test)

| Test | OOS n >= 60 | OOS net > 0, t >= 2, Holm p < 0.05 | In-sample net > 0 | OOS net > 0 at 2x costs | Beats >= 38 of 40 placebo means | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | yes | no | no | no | no (17) | 0.9332 | 1 | fail |
| T2 | no (58) | no | yes | no | no (9) | 0.8023 | 1 | fail |
| T3 | yes | no | no | no | no (21) | 0.4801 | 1 | fail |

## Placebo (each OOS trade moved to a random trading day of the same year, same side, same stop in ATR units, held three days, same costs; 40 seeds)

| Test | Rule net R | Seeds beaten | 5th pct | Median | 95th pct | Seed mean |
|---|---|---|---|---|---|---|
| T1 | -0.176 | 17 of 40 | -0.298 | -0.114 | 0.048 | -0.120 |
| T2 | -0.131 | 9 of 40 | -0.338 | -0.072 | 0.140 | -0.062 |
| T3 | 0.003 | 21 of 40 | -0.155 | -0.002 | 0.073 | -0.010 |

Every rule sits inside its placebo: the signal day adds nothing a random day of the same year does not give.

## The next 1-5 days, before costs (reported, decides nothing)

Move in the reversal direction from the next open to the close of day i+h, % of price, every signal (no one-at-a-time rule);
"every day" = gold's mean move up over the same span, all days.

| Signal | Window | n | +1 day | +2 | +3 | +4 | +5 | Every day up, +5 |
|---|---|---|---|---|---|---|---|---|
| Bearish key reversal (short) | 2017-2026 | 91 | -0.055 | +0.008 | -0.056 | -0.178 | -0.115 (t -0.45) | +0.249 |
| Bearish key reversal (short) | 2008-2016 | 78 | +0.071 | -0.036 | -0.017 | -0.114 | -0.073 | +0.101 |
| Bullish key reversal (long) | 2017-2026 | 61 | -0.024 | -0.084 | +0.143 | +0.080 | +0.192 (t 0.94) | +0.249 |
| Bullish key reversal (long) | 2008-2016 | 55 | +0.049 | +0.102 | +0.322 | +0.296 | +0.210 | +0.101 |
| Outside reversal (both) | 2017-2026 | 280 | +0.002 | +0.058 | +0.078 | +0.011 | +0.138 (t 1.04) | +0.249 |
| Outside reversal (both) | 2008-2016 | 231 | -0.068 | -0.116 | -0.226 | -0.249 | -0.243 | +0.101 |

No horizon reaches |t| 2. The 2017-26 short loses about what gold's drift gives an ordinary day; the long's 5-day move is below
gold's ordinary 5-day rise. A refused 20-day high is not followed by a fall on gold, and a refused 20-day low by a rise no larger
than any day's.

## By year (net R a trade)

- T1: positive in 2008-09, 2014-16, 2019-20; negative in 12 of 19 years, every year 2021-26.
- T2: mixed, small samples (1-14 a year); 2021-23 and 2026 negative.
- T3: 7 of 19 years positive (2020 at +0.003R); 2017 (+0.47R, n 30) and 2025 (+0.42R, n 21) carry the out-of-sample sum.

## Reading
The classic key reversal and outside reversal are not tradeable on spot gold as daily rules after costs: the primary short
loses in both windows (worse out of sample, in gold's rally), the long has too few trades and loses out of sample, and the
outside reversal is flat before costs. Costs are small here (0.03-0.04R a trade, wide stops), so the failure is the signal, not
the cost. Not an edge; no proposal; nothing live changed. Combined with `gold-ibs` and `gold-shock-revert`, three daily
reversal readings of gold (range position, shock size, refused extreme) have now failed.

To repeat: `node --use-env-proxy research/edge/gold-key-reversal/fetch.mjs <dir>` (cache out of git), then
`node research/edge/gold-key-reversal/run.mjs <dir>`. Tests: `tests/gold-key-reversal.test.mjs`.
