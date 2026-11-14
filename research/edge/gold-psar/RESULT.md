# Result: gold's daily Parabolic SAR stop-and-reverse, both sides (14 Nov 2026)

**Verdict: FAIL: the daily SAR stop-and-reverse made +0.167R a trade net in 2017-26 (n 213) but month t 1.97, Holm p 0.073 and 36 of 40 placebos beaten; 0 of 3 tests pass.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit d0363492a). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf), reads none of its positions and
says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-06, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,364 trading days. Wilder's Parabolic SAR on those
days; a day whose range reaches the SAR reverses the trend (a flip). Entry at the next day's open in the new trend's direction,
stop = the SAR of each day (it trails), exit at its touch (gap fills at the open), at the latest the close of the 60th day; one
position at a time per test; a trade whose entry opened beyond its first stop is skipped. T1 AF 0.02 / 0.02 / 0.20, T2 0.01 /
0.01 / 0.10, T3 as T1 with a flip taken only on the side of the close against its 200-day average. Costs: $0.60 a round trip and
`FIN.xau.long` financing on buys (`nights` x 0.000148 of price); sells pay nothing. t = calendar-month sums of net R (every month
counts), one-sided, Holm over three. Placebo: the same OOS entry days, risk and exit days with the side drawn at random and a fixed
stop, 40 seeds.

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t | Holm p | OOS 2x costs | OOS 2017-21 | OOS 2022-26 | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 SAR 0.02/0.20 (primary) | 220 | +0.120 | +0.061 | 0.76 | 213 | +0.243 | +0.167 | 1.97 | 0.0729 | +0.090 | +0.050 | +0.300 | 36 of 40 | no |
| T2 SAR 0.01/0.10 | 142 | -0.003 | -0.059 | -0.83 | 135 | +0.039 | -0.032 | -0.35 | 0.6352 | -0.102 | -0.149 | +0.103 | 20 of 40 | no |
| T3 T1 with the 200-day average | 105 | +0.205 | +0.142 | 1.15 | 107 | +0.350 | +0.253 | 1.81 | 0.0729 | +0.156 | +0.017 | +0.503 | 35 of 40 | no |

T1 fails two of the five pre-registered checks: month t 1.97 with Holm p 0.073 (bar t >= 2 and p <= 0.0228) and 36 of 40 placebo
draws beaten (bar 38). It passes the other three: positive OOS, positive in sample (+0.061R), positive at 2x costs (+0.090R).

Cost share of R, OOS (stated in advance at about 0.03-0.06R): T1 0.077R a trade (0.018R round trip, 0.058R financing on the
buys), T2 0.070R, T3 0.097R: above the stated range, because the buys are held a median 11-17 days. Median stop $39.81 (T1;
smallest $4.30), median hold 11 days (T1, T3) and 17 days (T2). T1's OOS exits: 211 at the SAR, 2 by a gap, none by time.

Buys and sells apart, OOS net, against the unconditional same-side baseline (every day's open, 2 x ATR stop, 10-day hold; buys n
295, +0.097R net, month t 1.59, +0.180R gross with t 2.90: gold's rise; sells n 322, -0.193R net, t -3.37):
- T1 buys n 106, +0.378R (vs the buy baseline +0.280R, Welch t 1.75); sells n 107, -0.042R (+0.151R, t 1.35).
- T2 buys n 67, +0.204R (+0.106R, t 0.63); sells n 68, -0.263R (-0.070R, t -0.71).
- T3 buys n 75, +0.362R (+0.264R, t 1.36); sells n 32, -0.001R (+0.192R, t 1.02).

T1 by year (net R): 2017 +11.7, 2018 -5.0, 2019 -3.2, 2020 +0.2, 2021 +2.0, 2022 +8.1, 2023 +2.8, 2024 +8.0, 2025 +8.0,
2026 +2.8; in sample 2007-16 five of ten years positive, +13.5R in all.

## Reading
- The positive figure is the buy side. T1's sells lose (-0.042R) and its buys make +0.378R; a coin-flip side on the same entry
  days, risks and exit days already makes +0.086R (placebo median), so most of T1's +0.167R is the holding period in a market
  that rose, not the direction of the flip. The flip's own share, the placebo gap, is inside the range of chance: 4 of 40 draws
  match or beat it (largest +0.209R).
- Nearly all of the out-of-sample result is 2022-26 (+0.300R a trade, gold's long rise); 2017-21 is +0.050R (t 0.43). In sample
  the rule made +0.061R, t 0.76.
- The slower SAR (T2) loses net in both windows; the trend-filtered one (T3) has the larger figure but on 107 trades, with
  2017-21 at +0.017R and a lower placebo count (35 of 40).
- Not an edge, never call it one. The buys' advantage over buying any day (+0.28R, Welch t 1.75) is a hypothesis at most and
  would need its own pre-registration on other data; nothing live changes, and no council rule, filter or proposal follows.

Files: `run.mjs` (`fetch <dir>`, `full <dir>`), `result.json`; tests `tests/gold-psar.test.mjs`.
