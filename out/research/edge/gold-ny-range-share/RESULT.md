# Gold: the share of the day's range New York made, followed or faded for 2-5 days. Result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following a New York-made gold day for 5 days beat the same side out of sample (excess +0.138R, month t +2.63, n 198) but not in sample (-0.012R, t -0.25).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A stand-alone rule on spot gold, not a
gate, exit, entry or size of the live gold book; none of the book's 2006-17 positions read (docs/owner-decisions.md item 44).
Paper research only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- OANDA mid XAU/USD H1 via the candle proxy, 19 Mar 2006 to 30 Oct 2026 (125,474 candles); UTC days, weekend candles to Monday.
- NY share = 1 - (00-13 UTC range) / (00-21 UTC range): the part of the day's range New York added beyond what Asia and
  London had made. Median over 5,236 eligible days: 0.275.
- T1: NY share >= 0.60 → follow New York's move, 5 days. T2: NY share <= 0.10 → fade the 00-13 UTC move, 5 days. T3: T1, 2 days.
- Entry at the next day's first H1 open, stop 2 x ATR(14) of the daily candles, out at the close of the last day or the stop.
- Costs: $0.60 a round trip, plus `nights x FIN.xau.long x entry` on buys (`council/fills.mjs`, 0.000148 a rollover).
- Excess = net R minus the mean net R of the every-day trade of the same side in the same calendar year; t on calendar-month
  sums; Holm over the three out-of-sample p.

## Tests (R of the 2 x ATR stop)

| Test | Window | n | Gross R | Net R | Excess R | Month t (excess) |
|---|---|---|---|---|---|---|
| T1 follow NY, 5 days | IS | 258 | -0.025 | -0.056 | -0.012 | -0.25 |
| T1 follow NY, 5 days | OOS | 198 | +0.157 | +0.121 | +0.138 | +2.63 |
| T2 fade pre-NY, 5 days | IS | 663 | -0.026 | -0.057 | -0.020 | -0.70 |
| T2 fade pre-NY, 5 days | OOS | 635 | -0.045 | -0.076 | -0.051 | -1.98 |
| T3 follow NY, 2 days | IS | 258 | +0.002 | -0.020 | +0.007 | +0.25 |
| T3 follow NY, 2 days | OOS | 198 | +0.084 | +0.063 | +0.081 | +2.34 |

| Test | OOS net month t | Holm p | 2x costs (excess / net) | Placebo beaten | Control beaten | Failed checks |
|---|---|---|---|---|---|---|
| T1 | +2.17 | 0.029 | +0.137 / +0.085 | 40 of 40 | 40 of 40 | in-sample excess negative |
| T2 | -2.78 | 0.051 | -0.051 / -0.106 | 3 of 40 | 0 of 40 | all but n |
| T3 | +1.75 | 0.042 | +0.083 / +0.041 | 40 of 40 | 40 of 40 | net month t under 2 |

Out-of-sample halves, T1: 2017-21 excess +0.121R (n 101, t +1.81), 2022-26 +0.155R (n 97, t +1.91).
Baseline every-day trade out of sample, 5 days: long +0.062R net (t +1.89), short -0.107R (t -3.51).
Placebo = the real signal days with seeded random sides; control = per year as many random days on their own rule side
(median control t +0.30 for T1).

## Reading

T1 is the cleanest out-of-sample result of this rule family: New York-made days were followed by a move the same way that
beat the every-day trade of the same side by about 0.14R, in both halves of 2017-26, beyond all 40 placebo and 40 control
draws. But the pre-registered bar requires the same sign in 2007-16, and there it was flat to negative (-0.012R, t -0.25).
A result that appears in only one of two decades is not an edge; picking the window it works in would be the error the
pre-registration exists to prevent. T2 (fade a range New York did not extend) loses in both windows. T3 is T1 over two
days: positive out of sample, flat in sample, net t under 2. Nothing here is a council rule. A follow-up would need new
data the rule has not seen (another metal, or gold after October 2026 as a forward record) and its own pre-registration.

## Files

`run.mjs` (fetch / count / full), `result.json`, `tests/gold-ny-range-share.test.mjs`. Candles kept out of git and deleted.
To repeat: `node --use-env-proxy research/edge/gold-ny-range-share/run.mjs fetch <dir>`, then `… full <dir>`.
