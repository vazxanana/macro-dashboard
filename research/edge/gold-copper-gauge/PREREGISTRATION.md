# Pre-registration: the gold / copper ratio as a fear gauge for spot gold (14 Nov 2026)

Written and committed alone, before any return of this study was computed. Only the number of signals per window was counted
(below), to check the 100-a-window floor. Paper research only: a **stand-alone rule on spot gold**. It is not a gate, entry,
exit or size of the live gold book, it does not use the book's 2006-17 positions or window as evidence (owner decision 44), and
no live rule, size, filter, stop, config, cost constant or council member changes whatever the verdict. A PASS would only allow
a written proposal for a paper shadow; a FAIL ends it.

## The idea

A common macro reading: copper is a growth metal and gold a fear metal, so the gold / copper ratio is a growth-versus-fear
gauge. When the ratio makes a new high, fear is gaining on growth; the claim tested here is that this leads gold itself over the
next week (more haven buying to come), and that a new ratio low (growth gaining) leads gold lower. The third test isolates the
part of the gauge gold has NOT already shown: the ratio at an extreme while gold itself is not at its own extreme the same way
(the move is copper's, so the fear signal has not yet been priced in gold).

How this differs from the studies already on file: `copper-gold` used the copper / gold ratio's 13-week trend to time US index
longs (target: indices, not gold). `gold-oil-lead` traded gold after single big WTI or copper DAYS (a one-day return shock, not
a ratio state). `gold-brent-ratio` faded the gold / Brent ratio's 250-day z extremes back toward the mean (reversion, oil, n 14).
`gold-commodity-inflation` used an eight-commodity basket's 4- and 13-week return. `gold-metals-rank` ranked gold among the
four precious metals (copper not in it). Here the ratio is against copper alone, read as a 20-day breakout of the ratio, and
traded WITH the gauge (fear high -> buy gold).

## Data

OANDA mid daily candles (UTC) from council-data `research/daily/xau.json` and `research/daily/xcu.json` (`git show
origin/council-data:…`, commit `bd4865a8`, no network), weekends folded into the next weekday with `council/fills.mjs`
`foldWeekend`. Days matched by UTC day stamp; a gold day without a copper candle has no ratio row. Candle cache kept out of git
and deleted at the end.

## The rule

- **Ratio** Q(d) = ln(gold close / copper close) on each matched day d.
- **Ratio high** at d: Q(d) is above every Q of the 19 matched rows before d (a new 20-row high). **Ratio low**: below every one.
- **Gold high** at d: gold's close above each of its 19 previous closes; **gold low**: below each.
- Signals read only candles at or before d.
- **T1 (primary)**: ratio high -> BUY gold.
- **T2**: ratio low -> SELL gold.
- **T3**: ratio high and NOT gold high -> BUY; ratio low and NOT gold low -> SELL (the copper-driven part, both sides).
- **Trade**: enter at the open of gold's first candle after d; stop = entry ∓ 2 x ATR(20) of the 20 gold candles before the
  entry candle; out at the close of the 5th candle (the entry candle counts as the 1st), or at the stop: a candle whose low
  (high for a sell) reaches the stop exits at the stop, an open beyond the stop exits at that open. One position at a time per
  test: a signal while the test holds a position is skipped. R = side x (exit − entry) / (2 x ATR).
- **Costs**: $0.60 a round trip on every trade ($0.30 spread + half a spread of slippage each side), plus on buys financing
  `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD rate of 11 Nov 2026, charged
  for every year) x entry price, in R. Sells pay and receive nothing.

Signals counted before this file (non-overlapping trades by the rule above, no return looked at): T1 127 in sample / 116 out of
sample; T2 131 / 129; T3 208 / 193. Every test clears 100 a window.

## Windows

Signal date decides: **in sample 2007-01-01 to 2016-12-31**, **out of sample 2017-01-01 to 2026-10-31** (decisive).

## What is measured

- **Baseline (same side, every day)**: in the same window, a trade of the same side on EVERY eligible day (overlapping, the same
  entry, stop, hold and costs). Its mean net R is the baseline of that side and window.
- **Excess** of a trade = its net R − the baseline mean net R of its side and window. Per test and window: n, longs / shorts,
  gross and net R a trade, baseline, excess a trade, net and excess at 2x costs, and the t of the calendar-month sums of net R
  and of excess R (empty months count as 0; months from the window's start to its end).
- **Holm** over T1-T3 on the one-sided normal p of the OOS excess month t.
- **Placebo**: 40 seeds (1-40). Each draws, from the OOS eligible days, as many days as the test had trades, with the test's
  sides shuffled, and runs them one at a time. Reported: how many of the 40 placebo excess month t's the real one beats.
- **Control (drift and volatility kept, the signal's information removed)**: 40 seeds (101-140). Each real OOS trade is moved
  to a random eligible day of the SAME calendar year with the same side (so each year's drift and volatility, and the side mix,
  are kept), then run one at a time. Reported: how many of the 40 control excess month t's the real one beats, and the control
  mean excess.

## The pass bar (all of these, for a test)

1. OOS excess month t ≥ 2 and Holm-adjusted p < 0.05.
2. In sample excess R a trade > 0 (same sign).
3. OOS net R a trade at 2x costs > 0, and OOS excess at 2x costs > 0.
4. The real OOS excess month t beats at least 38 of 40 placebo draws AND at least 38 of 40 control draws.
5. n ≥ 100 in each window.

**PASS** if T1 passes; **PARTIAL** if only T2 or T3 does; otherwise **FAIL**. No parameter (20 rows, 5 candles, 2 x ATR(20),
costs, the windows, the seeds) is changed after this file.
