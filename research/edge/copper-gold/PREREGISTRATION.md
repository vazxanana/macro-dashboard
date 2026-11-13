# Pre-registration: the copper / gold ratio as a risk-on signal for US indices (13 Nov 2026)

Written and committed alone, before any return of this study was computed. Paper research only: a stand-alone long / flat
rule on two US index CFDs. It is not a gate, size or exit of the gold book (owner decision 44 untouched), and no live rule,
size, filter, stop, config, cost constant or mirror setting changes whatever the verdict. A PASS would only allow a written
proposal for a paper shadow; a FAIL ends it.

## The idea

A widely cited macro reading: copper is a growth metal, gold a fear metal, so a rising copper / gold ratio signals growth
(risk-on) and is said to lead equities and yields. Tested here as a weekly timing rule on SPX500 and NAS100.

## Data

OANDA mid daily candles from council-data `research/daily/<key>.json` (`git show origin/council-data:…`, no network):
`xcu` (copper, from 2003), `xau` (gold, from March 2006), `spx500`, `nas100` (from 2003). Weekend candles folded into the next
weekday with `council/fills.mjs` `foldWeekend`. A missing file drops that market and the report says so. Financing rate: FRED
`DGS2` from council-data `macro/cache.json` (`score.fred.DGS2`, as-of lookup, floored at 0).

## The rule

- **Week end** = the last daily candle of each Monday-Sunday UTC week (normally Friday). A week counts only when xcu, xau and
  the index all have a week-end candle, and the signal uses that week's own candle of each.
- **Signal at a week end f**: ratio R = xcu close / xau close. ON when R(f) / R(f − 13 weeks) − 1 > 0, else OFF. Reads only
  candles at or before f.
- **Rule**: while ON, long the index; acted on at the open of the first candle after f (normally Monday). Kept while the next
  week end is ON (no new cost); closed at the open after the first OFF week end.
- **Stop (every position has one)**: week-end close − 3 × ATR(20) of daily candles up to f, set at entry and raised (never
  lowered) at each week end the position is kept. A candle whose low reaches the stop exits at the stop; an open through the
  stop exits at that open. A stopped market stays flat until the next week end, then follows its signal again.
- **Costs**: a stated spread on every entry and every exit: SPX500 0.5 points, NAS100 1.5 points (the sibling index studies'
  figures). Financing every night held (`council/fills.mjs` `nights`, Wednesday three) at (DGS2 + 2.5 % a year) / 365 of price.
- **Benchmark**: always long, the same weekly stop rule (stopped = flat to the next week end, then back in, paying the spread)
  and the same costs.

## Windows

The week's signal date decides the window: **W1 2008-01-01 to 2015-12-31** (check), **W2 2016-01-01 to the last complete week
on file** (decisive). The 13-week look-back may reach before a window's start.

## What is measured

1. **Signal test** (no costs, no stop: the raw idea). For each week end f, the next-week return of the index = open of the
   first candle after the next week end / open of the first candle after f − 1. Primary series: the equal-weight average of the
   two indices' next-week returns (one observation a week; pooling both indices as separate observations would count each week
   twice). Statistic: mean(next week | ON) − mean(next week | OFF), Welch t; a Newey-West (4 lags) t of the same difference
   (regression of the weekly return on the ON dummy) is shown beside it. Per index the same figures, with Holm-adjusted p over
   the two indices (shown only, not part of the bar).
2. **Rule against benchmark** (costs, stop, financing): daily returns of one unit of notional, equal-weight book of the two
   indices, Sharpe (daily, x √252), CAGR, worst drawdown, time in market, switches, stops.
3. **Placebo**: 40 seeds (1 to 40), each a random ON / OFF series over the W2 weeks with the real ON share (the same number of
   ON weeks, shuffled). The share of placebo Welch t's at or above the real one is reported. Shown, not part of the bar.

## The pass bar (all three)

1. W2: the equal-weight on-minus-off difference > 0 with Welch t ≥ 2.
2. W1: the same difference > 0 (same sign).
3. W2: the rule book's Sharpe ≥ the benchmark book's Sharpe (after costs and financing).

Otherwise FAIL. No parameter (13 weeks, the zero threshold, 3 × ATR(20), spreads, the markup) is changed after this file.
Never call the rule an edge without n and t; a PASS is evidence for a paper shadow, not a proven edge.

## Files

`run.mjs` (`fetch <dir>` then `full <dir>`), `result.json`, `RESULT.md` (verdict first), `tests/copper-gold.test.mjs` (offline).
