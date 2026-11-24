# Pre-registration: vb-msnr-side (24 Nov 2026)

Written and committed alone, before any breakout trade is split by the direction call. No code of this study exists yet and no
candle has been read for it. Research only: nothing live changes, no rule is proposed, the forward records run on unchanged.

## Question
The daily volatility breakout T1 on gold and on USD/JPY (the two rules of this repository that pass at measured costs) fills
either as a buy or as a sell each day. Does the desk's key-level direction call (H4 working chart, Daily key levels), known
before the day opens, tell the good breakouts from the bad ones: do breakouts WITH the call do better than breakouts AGAINST it?

## What was tested before, and why this is not the same
- `vb-structure-filter` (FAIL): the same trades split by the plain H4 swing-structure side (last break of a 3-a-side swing).
- `gold-vol-breakout-h4-side` (FAIL): gold only, a 20-close H4 channel side.
- `grid7-msnr-filter`, `msnr-direction`, `msnr-direction-wide` (FAIL): the key-level direction call on other triggers and as a
  forecast of returns, never on the breakout's trades.
- `dom-vb-side`, `fvg-vb-side`, `vb-rate-side`, `vb-dollar-confirm`: other side filters of the breakout.
No study has split the breakout's trades by the key-level direction call. That split is the only new thing here: the breakout's
own trades have been read on every year used below, so this judges the SPLIT, not the breakout.

## Data
The shared toolkit's OANDA mid 5-minute cache (`research/edge/_lib/edgekit.mjs` `load`), gold (from March 2006) and USD/JPY
(from January 2005), read only. No fetch.

## Base rule (imported, never edited)
T1, k 0.5, both sides: O = the open of the day's first 5-minute candle (00:00 UTC hour); a buy stop at O + 0.5 x the previous
folded UTC day's range and a sell stop at O - 0.5 x it; the first level traded is the day's one trade; its stop is O (a stop
inside the fill candle counts as hit; a candle that opens past the stop exits at its open); otherwise out at the close of the
last candle before 21:00 UTC. Every trade has its stop on the losing side by construction.
- Gold: `gold-vol-breakout-hourcost/costs.mjs` `daysOf` + `tradesIn` (a verbatim copy of the original harness).
- USD/JPY: `usdjpy-vol-breakout-early/run.mjs` `trades` (the same T1 through `index-vol-breakout/original.mjs`, no year filter).

## Costs (each study's measured cost)
- Gold: `gold-vol-breakout-hourcost` condition C1 through its own `charge`: half the demo broker's median quoted spread of the
  fill hour + half that of hour 20 + the commission (hour profile and commission read from that study's committed `result.json`),
  as a share of the entry, plus stop-entry slippage 0.05 x the median range of the 12 five-minute candles up to the fill.
- USD/JPY: `fx-vol-breakout` `charge`: 0.000045 of the entry + 0.5 pip a round trip (the demo's commission and quote).
Today's cost is charged on every year. Before-cost and after-cost R are reported for every cell.

## Harness gate (no verdict without it)
On the cache the unsplit rules at these costs must reproduce the published results, trade count within 2 % and net R a trade
within 0.01R: gold C1 2007-11 (n 929, +0.202R), 2012-15 (728, +0.170R), 2016-20 (935, +0.094R), 2021-01-01 to 2026-11-12
(1,121, +0.105R); USD/JPY 2005-01-04 to 2015-12-31 (2,089, +0.079R) and 2016-01-01 to 2026-11-19 (2,079, +0.063R). A miss is
reported and the study is INCONCLUSIVE.

## The direction call (one reading, fixed)
- `council/eg-methods.mjs` `direction(work, keyOf, 86400)`, imported unchanged, with its own constants.
- Working chart: H4 candles = the toolkit's `resample(m5, 14400)` (UTC-aligned blocks, every block kept), over the whole history
  of the market in the cache (the call needs its past).
- Key levels: the Daily candles `direction` builds itself from the H4 candles with `research/edge/msnr-entry/run.mjs` `dayKey`
  (the UTC day; Saturday and Sunday belong to Monday), the desk's own day key.
- A day's call = the call after the last H4 candle that CLOSED at or before that day's 00:00 UTC (+1 buy, -1 sell, 0 none yet).
  The candle holding 00:00 is never read. It is known before both stop orders are placed.

## Groups
Both stop orders are placed as in the base rule and the day's first fill is the day's trade. WITH = its side equals the day's
call; AGAINST = its side is the opposite of the call; NONE = the call is 0 (reported, never judged). No other change: entry,
stop, exit and costs are the base rule's.

## Cells (6, all fixed)
| Cell | Market | Group |
|---|---|---|
| xau WITH | gold | WITH |
| xau AGAINST | gold | AGAINST |
| usdjpy WITH | USD/JPY | WITH |
| usdjpy AGAINST | USD/JPY | AGAINST |
| both WITH | gold + USD/JPY, each trade 1R | WITH |
| both AGAINST | gold + USD/JPY | AGAINST |

## Windows
Discovery 2005-01-01 to 2014-12-31 (gold from its first tradable day in 2006); confirmation 2015-01-01 to 2026-10-31. By the
day of the trade.

## Statistics
Mean R a trade before and after costs; t of calendar-month sums of after-cost R (months with a trade), one-sided p by the normal
approximation; Holm over the six cells on the confirmation p. WITH against AGAINST: difference of after-cost mean R with a
Welch t on trades, per market set and window.

## Pass bar
A cell meets the profit bar when, in BOTH windows, n >= 300, mean R after costs > 0 and month t >= 2, and its Holm p in
confirmation is < 0.05. Because every cell is a subset of a rule that already passes, the profit bar alone says nothing about
the call. So:
- **PASS**: a WITH cell meets the profit bar AND, for its market set, WITH minus AGAINST is > 0 with Welch t >= 2 in BOTH windows.
- **FAIL**: no WITH cell does. If WITH cells meet the profit bar but the difference does not hold, the result says in words
  that the call adds nothing that can be told from chance.
- **INCONCLUSIVE**: the harness gate misses, or every WITH cell has under 300 trades in a window.
An AGAINST cell meeting the profit bar is reported and is never a pass. A pass on one market alone would be a hypothesis for its
own test, never an edge.

## Reported
Per cell and window: n, before-cost R, after-cost R, month t, months; Holm p; WITH minus AGAINST with Welch t; the NONE group;
buys and sells within WITH and AGAINST (USD/JPY's buys carry most of its result, so a call that only says "buy" must not be
mistaken for skill); the share of days by call; the gate table. One run, no variants.

## Files
`research/edge/vb-msnr-side/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}` and `tests/vb-msnr-side.test.mjs`. Nothing
else is touched.
