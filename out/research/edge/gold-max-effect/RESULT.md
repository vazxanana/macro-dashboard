# Result: the MAX (lottery) effect on gold's own daily returns (14 Nov 2026)

**Verdict: FAIL: 0 of 3 tests pass; selling after an unusually large day in the last 20 lost -0.115R a trade net in 2017-26 (n 133, month t -1.55), no better than selling any day.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 285927de7). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (read from the branch, no network), 2006-03-20 to 2026-11-13,
weekend candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,369 trading days, 5,099 with the rank's
history. MAX20 = the largest daily close-to-close return of the last 20 days; its rank = the share of the previous 250 MAX20
values below it; HIGH = rank >= 0.80 (989 days), LOW = rank <= 0.20 (1,232 days). Entry at the next day's open, stop 1.5 x
ATR(14) on the losing side, gap fills at the open, out at the close of the last day held; one position at a time per test.
Costs: $0.60 a round trip and `FIN.xau.long` financing on buys (`nights` x 0.000148 of price); sells pay nothing. t =
calendar-month sums of net R (every month counts), one-sided, Holm over three. Excess = OOS net R a trade minus the same side,
stop and hold taken on every eligible day (Welch t). Placebo: as many random OOS entry days as the test had, 40 seeds.

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t | Holm p | OOS 2x costs | OOS excess | Excess t | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 sell after a HIGH 20-day MAX, hold 5 days | 112 | -0.091 | -0.107 | -1.50 | 133 | -0.102 | -0.115 | -1.55 | 1 | -0.128 | +0.015 | 0.18 | 19 of 40 | no |
| T2 sell after a HIGH 20-day MAX, hold 10 days | 69 | -0.227 | -0.244 | -1.72 | 86 | -0.145 | -0.159 | -1.49 | 1 | -0.172 | +0.046 | 0.35 | 21 of 40 | no |
| T3 buy after a LOW 20-day MAX, hold 5 days | 174 | -0.008 | -0.078 | -1.04 | 144 | +0.238 | +0.162 | 1.89 | 0.0873 | +0.087 | +0.102 | 1.09 | 36 of 40 | no |

Drift baselines (every eligible day, one at a time): sell 5 days OOS n 590, -0.131R net (month t -3.48), IS -0.064R; sell 10
days OOS -0.204R net, IS -0.096R; buy 5 days OOS n 572, +0.125R gross (month t 2.94: gold's rise), +0.060R net (t 1.42), IS
-0.005R net (n 573). OOS halves (2017-21 | 2022-26): T1 -0.085R (n 50) | -0.134R (n 83); T2 -0.112R (n 31) | -0.185R (n 55);
T3 +0.178R (n 74) | +0.145R (n 70). Placebo medians: T1 -0.092R, T2 -0.168R, T3 +0.086R (max +0.269R). T2 has fewer than 100
trades a window (one 10-day position at a time), as the pre-registration's hold implies.

## Reading
- Selling after a lottery-like day in gold loses in both windows (T1 -0.107R IS, -0.115R OOS; T2 worse). It beats the sell
  taken on every day by only +0.015R / +0.046R (Welch t 0.18 / 0.35) and sits in the middle of the placebo draws: the loss is
  gold's rise, and a recent extreme day says nothing about the next one or two weeks.
- HIGH days are mostly high-volatility days (81 % of them have ATR / price above the median of all days, LOW days 27 %), so
  MAX20 here largely ranks volatility, as the cross-currency MAX study (`fx-max-effect`, FAIL) also found.
- Buying after a quiet month (T3) made +0.162R net OOS (month t 1.89, Holm p 0.087) but lost in sample (-0.078R net, -0.008R
  gross), beat the every-day buy by only +0.102R (Welch t 1.09) and 36 of 40 placebo draws: most of its OOS gain is gold's
  2017-26 drift on calm days, with 2025 alone +10.6R of the +23.4R. Not an edge, and not to be re-tried with other ranks,
  windows or holds on this data: that would be choosing after the result.
