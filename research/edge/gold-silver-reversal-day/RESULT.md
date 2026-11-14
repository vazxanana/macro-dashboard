# Result: gold after a large intraday reversal in silver (14 Nov 2026)

**Verdict: FAIL, 0 of 3: trading gold the way silver closed after a large silver reversal made -0.107R a trade below gold's same-side every-day trade in 2017-26 (n 198, month t -1.86); +0.093R in 2007-16.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any gold return was computed). Paper research
only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here reads that book's
positions or uses its 2006-17 window as a book test (owner decision 44). No live rule, size, filter, stop, config, cost constant or
council member changed. No proposal is written. Not an edge; never a council rule or filter.

## What was tested
- Data: OANDA mid daily candles (UTC), council-data `research/daily/` `xau` and `xag` (commit `b7d716ad7`), weekend candles folded
  into the next weekday (`foldWeekend`); 5,369 common days, 20 Mar 2006 to 13 Nov 2026.
- Event: silver runs at least 0.5 x its ATR(20) above its previous close and closes below it (bearish: sell gold), or the mirror
  (bullish: buy gold). Gold enters at the next open, stop 2 x gold ATR(20), out at the close of the 5th candle, one at a time.
- Costs $0.60 a round trip plus `nights` x `FIN.xau.long` x entry on buys. Each trade is measured against the same trade entered
  after every common day of its window (same side, stop, hold, costs): the **excess**.
- Signal days: 2007-16 292 (120 bearish, 172 bullish), 2017-26 276 (119, 157); trades after the one-at-a-time rule 192 and 198.

## Tests (t on calendar-month sums; Holm over three)

| Test | Window | n | gross R | net R | excess R | month t | Holm p |
|---|---|---|---|---|---|---|---|
| T1 primary: all reversals, excess | 2007-16 | 192 | +0.103 | +0.068 | +0.093 | 1.71 | |
| | 2017-26 | 198 | -0.077 | -0.113 | -0.107 | -1.86 | 1 |
| T2: gold did not itself reverse, excess | 2007-16 | 70 | +0.129 | +0.095 | +0.126 | 1.48 | |
| | 2017-26 | 70 | -0.199 | -0.229 | -0.209 | -2.17 | 1 |
| T3: the T1 stream, raw net R | 2007-16 | 192 | +0.103 | +0.068 | | 1.24 | |
| | 2017-26 | 198 | -0.077 | -0.113 | | -1.98 | 1 |

Gross month t of the T1 stream: 1.87 in sample, -1.35 out of sample. At 2x costs (baseline recomputed) the OOS excess is
-0.107R and the raw net -0.149R.

T1's pass bar: OOS t >= 2 after Holm (no: -1.86), in-sample excess > 0 (yes, +0.093R), OOS excess > 0 at 2x costs (no), OOS t
above 38 of 40 placebo draws (no: it beats 6 of 40), median stop $10 or more (yes, $47.26). **FAIL.** T2 and T3 are no leads.

## Placebo (40 seeded draws)
Random OOS common days, 118 buys and 80 sells as in the T1 stream, same simulation and baseline: month t median -0.63, 95th
percentile 0.87; the real T1 t (-1.86) beats 6 of 40.

## What it shows
- The idea held in 2007-16 (excess +0.093R, t 1.71; driven by 2008-11) and turned against itself in 2017-26 (every year 2017-24
  negative). Trading WITH silver's failed thrust instead (a mirror figure, not a test) made +0.126R excess out of sample (n 198,
  month t 1.99) and -0.064R in sample: the sign flips between the windows either way, which is what noise around zero looks like.
- Days where gold had not reversed itself (T2) were the worst out of sample (-0.209R excess): silver's reversal does not tell
  what gold has not yet shown.
- Baselines (mean net R of the every-day trade): 2007-16 long +0.000, short -0.065; 2017-26 long +0.063, short -0.109.
- Costs are about 6 % of the mean absolute gross R (stops median $38.32 in sample, $47.26 out of sample); the result is not a
  cost story.
- Worst drawdown out of sample -24.9R.

Not an edge. Do not use a silver reversal day as a gold signal, gate or filter. To repeat:
`node research/edge/gold-silver-reversal-day/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`… full <dir>`. Tests: `tests/gold-silver-reversal-day.test.mjs`.
