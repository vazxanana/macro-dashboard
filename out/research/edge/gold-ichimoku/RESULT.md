# Result: the standard Ichimoku signals on gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests pass: the best, the daily Tenkan / Kijun cross, made +0.39R a trade net out of sample (n 50, month t 1.49, Holm p 0.21), most of it in 2025.**

Pre-registered in PREREGISTRATION.md, pushed alone before any number was computed. Ichimoku 9 / 26 / 52 with the cloud shifted
26 candles forward, a stop of 2 x ATR(14) on every trade, fills at the next open, one position at a time, $0.60 a round trip and
overnight financing on buys (`council/fills.mjs` `nights` x `FIN.xau.long`). In sample 2008-16, out of sample 2017 to October
2026, t on calendar-month sums of net R with Holm over the three tests. A stand-alone rule: not a gate, exit, entry or size of the
live gold book (item 44), and it reads nothing of it. Not an edge; no proposal; nothing live changed.

| Test, after costs and financing | Window | n | R a trade gross | R a trade net | Total net R | Net R at 2x costs | Month t gross | Month t net | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|---|
| T1 daily cloud breakout | 2008-16 | 62 | -0.029 | -0.117 | -7.26 | -12.73 | -0.19 | -0.83 | -11.96 |
| T1 daily cloud breakout | 2017-26 | 66 | +0.098 | -0.029 | -1.92 | -10.28 | 0.56 | -0.19 | -10.29 |
| T2 daily TK cross with the cloud | 2008-16 | 42 | +0.179 | +0.102 | +4.30 | +1.07 | 0.79 | 0.48 | -5.10 |
| T2 daily TK cross with the cloud | 2017-26 | 50 | +0.527 | +0.389 | +19.47 | +12.58 | 1.90 | 1.49 | -5.57 |
| T3 H4 cloud breakout | 2008-16 | 399 | +0.163 | +0.087 | +34.71 | +4.28 | 1.75 | 0.94 | -21.84 |
| T3 H4 cloud breakout | 2017-26 | 450 | +0.096 | +0.018 | +8.30 | -26.41 | 1.04 | 0.20 | -43.11 |

Checks on the out-of-sample window (all required for a pass):

| Check | T1 | T2 | T3 |
|---|---|---|---|
| Net total > 0 | no (-1.92R) | yes (+19.47R) | yes (+8.30R) |
| Month t >= 2 with Holm p < 0.05 | no (t -0.19, p 0.84) | no (t 1.49, p 0.21) | no (t 0.20, p 0.84) |
| In sample positive (same sign) | no (-7.26R) | yes (+4.30R) | yes (+34.71R) |
| Both halves positive (2017-21, 2022-Oct 2026) | no (-5.24R, +3.32R) | no (-0.03R, +19.50R) | no (-16.17R, +24.47R) |
| Positive at 2x costs | no (-10.28R) | yes (+12.58R) | no (-26.41R) |
| Beats at least 38 of 40 placebos | no (22; median -2.68R) | yes (39; median +4.08R) | no (33; median -14.60R) |
| n >= 30 | yes (66) | yes (50) | yes (450) |

- **T1, the daily cloud breakout** loses in both windows after costs; even before costs it is flat (t -0.19 and 0.56). It exits
  fast (median 3 to 6 days, 55 of 62 and 59 of 66 trades by a close back in the cloud) and wins one trade in five or six.
- **T2, the daily Tenkan / Kijun cross on the cloud's side** is the only one near the bar, and not near enough: month t 1.49
  out of sample (Holm p 0.21), the 2017-21 half flat (-0.03R on 22 trades), and 2025 alone gave +17.06R of the +19.47R (the
  other 43 trades +2.41R). Longs made +18.52R of it, shorts +0.95R: the result follows gold's 2024-25 rise. It does beat 39 of
  40 placebos, so the entries are not random, but with about five trades a year it cannot be told from one good year.
- **T3, the cloud breakout on H4** has a positive gross result in both windows (t 1.75 and 1.04) that costs and financing eat:
  450 trades out of sample at $0.60 each and 18.2R of financing take it from +43.0R to +8.3R, and doubled costs to -26.4R.
  2018-19 lost 33.7R; its worst drawdown out of sample is 43R.
- **Buy-and-hold** (reported, not judged): gold 1x gained +38.0 % of its 2008 price over 2008-16 (-35.9 % after the same
  financing; worst drawdown -44.8 % from the peak) and +236.9 % over 2017-Oct 2026 (+139.1 % after financing; worst drawdown
  -29.7 %). The rules' summed % of price out of sample after costs: T1 -1.0 %, T2 +54.1 %, T3 -13.6 %. None comes near holding gold.

H4 candles: built from the OANDA mid H1 cache, anchored to 17:00 New York (17, 21, 01, 05, 09, 13 New York time), spot-shut
hours dropped (31,999 candles, 28,603 with four hours, 3,255 with three: the 17:00 New York daily halt hour is not in the feed).
Daily candles: council-data `research/daily/xau.json`, weekends folded with `foldWeekend` (5,364 trading days, March 2006 to
6 Nov 2026). Trades still open at the end of the data are left out. Financing is today's demo rate charged for every year.

Year by year, net R (T1 | T2 | T3): in result.json `tests.<T>.years`. Not tested and not proposed: other periods (any choice of
period after this result would be chosen on it), other markets, Ichimoku as a filter on any council system.

To repeat: `node research/edge/gold-ichimoku/run.mjs full <xau-h1.json>` (the H1 cache of the gold-drd-long study's `fetch`,
kept out of git; the daily file is read with `git show origin/council-data:research/daily/xau.json`, no network).
Tests: `tests/gold-ichimoku.test.mjs`.
