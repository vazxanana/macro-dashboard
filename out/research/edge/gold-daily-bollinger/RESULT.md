# Result: gold's daily close outside its Bollinger band, fade or follow? (14 Nov 2026)

**Verdict: FAIL: 0 of 3 pass; following a close above the upper band made +0.349R a trade net in 2017-26 (n 70, month t 1.60, Holm p 0.17); both fades lost.**

Pre-registered in PREREGISTRATION.md (pushed alone first, before any number was computed). The test ran once; nothing was changed
after the result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and says nothing about it. None
of the 14 Nov backlog's ranked candidates is a stand-alone gold rule, so this rule is the study's own, as the pre-registration says.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-06, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,364 trading days. Band = SMA20 +/- 2 population sd of
the 20 closes ending at the signal day. Entry at the next day's open, stop 1.5 x ATR(14) on the losing side (gap fills at the
open), out at the first close back on the target side of that day's middle band, else the close of the 10th day; one position at
a time per test (a signal whose 10-day window runs past the last candle on file is not taken: none inside the windows below is
affected, the data run to 6 Nov 2026 and the last OOS entry dates are in October). Costs: $0.60 a round trip and `FIN.xau.long` financing on buys (`nights` x 0.000148 of price); sells pay nothing.
t = calendar-month sums of net R (every month counts), one-sided, Holm over three. Placebo: the same OOS entry days and days held,
the side drawn at random, 40 seeds.

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t | Holm p | OOS 2x costs | OOS 2017-21 | OOS 2022-26 | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 fade the low (buy) | 77 | +0.069 | -0.004 | -0.03 | 65 | +0.058 | -0.018 | -0.16 | 1 | -0.095 | -0.022 | -0.014 | 22 of 40 | no |
| T2 fade the high (sell) | 97 | -0.090 | -0.115 | -0.91 | 119 | -0.222 | -0.242 | -2.18 | 1 | -0.261 | -0.193 | -0.284 | 0 of 40 | no |
| T3 follow the high (buy) | 62 | +0.259 | +0.165 | 0.96 | 70 | +0.455 | +0.349 | 1.60 | 0.1659 | +0.242 | +0.200 | +0.506 | 40 of 40 | no |

OOS gross month t: T1 0.50, T2 -2.03, T3 2.02. Baseline (buy every day's open, same stop, 1 day): OOS +0.028R gross (month t
3.02, gold's rise), -0.001R net (t -0.11); IS -0.019R net. Placebo medians: T1 -0.033R, T2 -0.017R, T3 +0.069R (max +0.280R).
OOS costs over the test: T3 1.39R of spread and 6.05R of financing (7.5 days held on average); T1 1.21R and 3.76R; T2 2.31R.

## Reading
- **Fading the band does not work on daily gold.** Selling a close above the upper band lost in both windows (OOS -0.242R a trade,
  t -2.18, under all 40 placebos; 2024 alone -10.2R): in a market that rose most of 2017-26, a sell into strength is stopped out
  (73 of 119 trades). Buying a close below the lower band is flat before costs and loses the spread and financing.
- **Following the upper band is the near miss, and it is not enough.** T3 is positive in both windows and at twice the costs and
  beats all 40 placebos, but its OOS month t is 1.60 (Holm p 0.17), short of t 2. The placebo draws a random side on an asset
  that rose, so beating it partly measures gold's drift, not the signal; 18.1R of T3's 24.4R OOS total came in 2024-26 (2017-23:
  +6.3R on 48 trades). n is small (70 OOS trades): it is a reading, not a lead.
- T3 is a short-hold breakout buy on gold, the same family as the live Gold trend rule (a 20-day high breakout). By item 44 it is
  not offered as a gate, exit, entry or size of that book, and no proposal follows.

## Files
`run.mjs` (`fetch <dir>`, then `full <dir>`; the candle cache stays out of git), `result.json`, test
`tests/gold-daily-bollinger.test.mjs`.
