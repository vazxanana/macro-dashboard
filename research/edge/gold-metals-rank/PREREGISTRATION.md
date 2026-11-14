# Pre-registration: gold's place among the four precious metals by 20-day return (14 Nov 2026)

Written and pushed alone, before any outcome of this study is computed. Only the number of signal days and of one-at-a-time
entries per window was counted beforehand (to meet the 100-event floor); no return, R, win rate or excess was looked at.

Paper research only: a **stand-alone rule on spot gold**. It is not a gate, entry, exit or size of the live gold book, it never
reads that book's 2006-17 positions, and nothing here is compared with or applied to that book (owner decision 44). No live
rule, size, filter, stop, config, cost constant or council member changes. Silver, platinum and palladium are read, never traded.

## Why, and how this differs from the metals studies already run

The four precious metals share their main drivers (dollar, real rates, investment demand), so their 20-day returns usually move
together; their ORDER over a month says which one the complex has left behind or put in front. Two readings, both tested here:
a laggard catch-up (gold last of the four over 20 days is bought, expecting it to close part of the gap) and a leader
over-extension or leader momentum (gold first of the four is sold, and, as the opposite reading, bought).

Read before writing (all FAIL): `gold-platinum-catchup` (platinum above its own SMA20 while gold is below its own; a two-market
trend STATE, platinum and silver only), `gold-platinum-ratio` (z-score of the gold / platinum and gold / palladium log ratio
against 250 days), `gold-metals-confirm` (a gold 20-day closing breakout confirmed by same-side breakouts of the others),
`gold-silver-ratio-trend`, `gold-silver-reversal-day`, and the multi-market cross-sectional books (`commodity-xs-momentum`,
`metals-*`, `drd-metals-book`), which rank whole sets on 1-12 month returns and trade the set. None ranks gold within the four
precious metals by its 20-day return and trades gold alone on that rank, both ends, against the same-side every-day baseline.

## Data (fixed now)

- OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `xag.json`, `xpt.json`, `xpd.json` at commit
  `338cfb45` of `origin/council-data`, weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`.
- Market set: gold is traded; silver (`xag`), platinum (`xpt`) and palladium (`xpd`) are read only. Nothing else.
- A common day = a UTC day stamp where all four have a candle. Days are matched by stamp, never by row number.

## The rule

- R20(x, d) = close(x, d) / close(x, the 20th common day before d) − 1, closes known at day d's close only.
- Rank of gold on common day d = how many of the other three have a strictly higher R20 (0 = gold first, 3 = gold last).
- **T1 (primary)**: gold last (rank 3) on day d → **buy** gold.
- **T2**: gold first (rank 0) → **sell** gold.
- **T3**: gold first (rank 0) → **buy** gold (the opposite reading of T2, leader momentum).
- Trade: market order at the next gold daily open after d; stop = 2 x ATR(20) (true range of the 20 gold candles before the
  entry candle) from the entry, fixed; an open through the stop fills at that open; out at the close of the 5th candle (entry
  candle = 1). One position at a time per test: a signal while that test's trade is open is skipped.
- Costs: $0.60 a round trip ($0.30 spread + $0.15 slippage on each of two market orders, as the earlier gold studies) plus, on
  buys only, financing `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap.long
  of 11 Nov 2026, `council/fills.mjs`) x entry / risk; sells pay and are credited nothing (the council's cost rule). Today's rate
  for every year.

Counted beforehand (signal days / one-at-a-time entries, 5-day hold): T1 in sample 515 / about 150, out of sample 489 / about
140; T2 and T3 604 / about 159 and 619 / about 170. A 10-day hold was counted first and gave under 100 entries per window
(98 / 87 for T1), so the hold is 5 days.

## Windows

In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.

## Statistics

- Per test and window: n, win %, gross and net R a trade, net at 2x costs, total net R, t on calendar-month sums of net R
  (every month of the window counted, empty months 0; a trade belongs to its exit month).
- **Baseline (same side, same year)**: for each calendar year, the mean net R of the same 5-candle trade (same side, stop,
  costs) entered after EVERY common day of that year (overlap allowed). Excess of a trade = its net R − its signal year's
  baseline. Excess t = t on calendar-month sums of excess.
- **Holm** over the three tests' OOS excess t (one-sided normal p).
- **Placebo** (40 seeds, seed 1-40): per year, as many entry days as the real signal days, drawn at random from all common days
  of that year, same side, same one-at-a-time simulation; the real OOS excess t is compared with the 40 placebo values.
- **Control that keeps gold's drift and volatility but removes the signal's information** (40 seeds): within each calendar year
  the triplets of R20 of silver, platinum and palladium are shuffled across that year's common days (gold's own R20, price path
  and every trade mechanic unchanged); the rank is recomputed and the test re-run. The real OOS excess t is compared with the 40
  control values.

## Pass bar (per test; the verdict follows T1)

All of: OOS excess t >= 2 with Holm p < 0.05; in-sample excess > 0; OOS net R a trade > 0 at 2x costs; real OOS excess t above
at least 38 of 40 placebo draws AND at least 38 of 40 control draws; OOS n >= 100. **PASS** if T1 passes; **PARTIAL** if only T2
or T3 passes; else **FAIL**. A pass is a paper hypothesis for the owner, never a live rule.
