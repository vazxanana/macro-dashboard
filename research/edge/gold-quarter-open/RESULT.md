# Result: the quarterly open as a level on gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a touch of the quarter open after a 2 ATR move lost -0.249R a trade net out of sample (n 28, t -1.50) and in sample; the break and the magnet lose too.**

Pre-registered in `PREREGISTRATION.md` (pushed alone, e3a3c4ad5, before the candle file was read for this study). A
stand-alone rule on spot gold: not a gate, exit, entry or size of the live gold book, and none of its positions read
(owner decision 44 untouched). Not an edge; nothing live changed and no proposal is written.

Data: council-data `research/daily/xau.json` (OANDA mid, UTC days, weekends folded with `council/fills.mjs` `foldWeekend`),
20 March 2006 to 6 November 2026 (5,364 days, 80 quarters from Q1 2007). Every trade has a stop of 1.5 x ATR(14), never
moved. Net of $0.60 a round trip and overnight financing on buys (`nights` x `FIN.xau.long`). In sample = entries 2007-16,
out of sample = 2017 to 6 Nov 2026. t on calendar-month sums of net R (120 / 119 months); Holm over the three tests.

| Test | Window | n | Win | R gross | R net | R net, 2x costs | Total net | Worst DD | Median stop | Month t |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 the open holds (primary) | IS 2007-16 | 32 | 41 % | -0.004 | -0.050 | -0.097 | -1.61R | -8.55R | $24.81 | -0.24 |
| | OOS 2017-26 | 28 | 32 % | -0.201 | -0.249 | -0.298 | -6.98R | -8.63R | $29.07 | -1.50 |
| T2 the open breaks | IS 2007-16 | 27 | 44 % | -0.073 | -0.117 | -0.161 | -3.17R | -6.17R | $24.47 | -0.95 |
| | OOS 2017-26 | 22 | 36 % | +0.186 | +0.143 | +0.100 | +3.15R | -6.36R | $31.03 | 0.53 |
| T3 the open pulls (magnet) | IS 2007-16 | 193 | 40 % | -0.028 | -0.074 | -0.120 | -14.20R | -21.13R | $27.86 | -0.81 |
| | OOS 2017-26 | 196 | 34 % | -0.168 | -0.200 | -0.232 | -39.18R | -50.46R | $37.46 | -2.00 |

Costs, measured: the $0.60 round trip is 0.018-0.025R a trade (median stops $24-37, above the $10 floor) and financing on
the buys 0.014-0.028R a trade on average, as estimated in the pre-registration. The losses are in the gross R, not in the
costs.

## The pass bar, check by check

| Check | T1 (primary) | T2 | T3 |
|---|---|---|---|
| OOS net > 0, month t >= 2, Holm p < 0.05 | no (-0.249R, t -1.50, Holm p 0.27) | no (+0.143R, t 0.53, Holm p 0.60) | no (-0.200R, t -2.00: wrong sign, Holm p 0.14) |
| IS net > 0 | no (-0.050R) | no (-0.117R) | no (-0.074R) |
| OOS net > 0 at 2x costs | no (-0.298R) | yes (+0.100R) | no (-0.232R) |
| Beats >= 38 of 40 placebos | no (5; placebo median -0.039R) | no (20; placebo median +0.149R) | no (3; placebo median -0.126R) |
| OOS n >= 30 | no (28) | no (22) | yes (196) |

Placebo: each quarter's level moved by 1-3 ATR(14) up or down at random (seeds 1-40), the same rules run on it. The real
quarter open does WORSE than most nearby arbitrary levels on T1 and T3 (it beats 5 and 3 of 40) and no better than the
median on T2 (20 of 40).

## What it says

- **T1 (primary), the open as support / resistance**: fewer setups than expected (60 in 20 years: a 2 ATR close away and
  then a return inside the same quarter is rare), and they lost in both windows and in both OOS halves (2017-21 -0.212R,
  n 15; 2022-26 -0.293R, n 13); OOS buys -0.255R (n 18), sells -0.240R (n 10). No sign that the level holds.
- **T2, the break**: positive only out of sample and only in 2022-26 (+0.489R, n 11; 2017-21 -0.202R, n 11), driven by 8
  buys in gold's 2022-26 rise; negative in sample. Too few trades, and the placebo levels did as well.
- **T3, the magnet**: price 3 ATR from the quarter open does not come back to it more than chance; it lost -0.200R a trade
  out of sample (n 196), a month t of -2.00 against the hypothesis, and lost in sample. Sells (162 of 196 out of sample)
  fought gold's trend; buys lost too (-0.189R, n 34).
- The quarter open is no more special than a level 1-3 ATR away from it. Do not use it as a level, a gate or a target.

To repeat: `node research/edge/gold-quarter-open/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/gold-quarter-open/run.mjs full <dir>`. Tests: `tests/gold-quarter-open.test.mjs`.
