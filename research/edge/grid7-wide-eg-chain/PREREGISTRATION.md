# Wide grid: the three-timeframe engulf chain, market and trade-through entries (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The Engulfing desk's three-timeframe reading (`council/eg-methods.mjs` `sopTrades3`: a marking engulf zone, an engulf of the
same side at it one timeframe lower, a confirming engulf one more timeframe lower) has only been looked at as a desk record:
a resting limit at the middle of the confirmation zone, filled on a touch of mid candles, which flatters a limit
(`research/edge/dom-trade-through`). This study asks one question in the wide design of `research/edge/grid7-wide-core` (few
cells fixed in advance, ten markets, discovery 2005-2014, confirmation 2015 to October 2026, each cell against a control): do
trades taken after the full chain do better than the same entry on a confirmation-timeframe engulf with no higher zones?
Entries are a market order or a limit that fills only when price trades THROUGH it.

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver start where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New
  York trading days, `dailyNY`; the desk reads raw UTC days with the weekend folded, said here), 1w.
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one
  is dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0 (`grid7-wide-core`'s `mstat`).

## The chain (closed candles only; `council/eg-methods.mjs` `zones` imported, never edited, its default 3-candle span)

Three chains [zone, engulf, confirmation]: **A = D1 -> H4 -> H1**, **B = H4 -> H1 -> M15**, **C = H1 -> M15 -> M5**. As
`sopTrades3` reads them, written again here (its code is one pipeline with a touch-filled limit, so the steps are re-implemented
with the same rules and the same `zones`):

1. Marking zone: an engulf zone on the zone timeframe (the base candle of a close beyond it within 3 candles, wick to wick),
   alive (not closed through, within its life). Its side is the trade's side.
2. Price comes back into it: the first engulf-timeframe candle, starting after the zone is known, that trades into it (its
   close = the return). From the return on, an engulf of the same side completes on the engulf timeframe while the marking
   zone is alive, its zone overlapping the marking zone (the most recent marking zone that fits).
3. Confirmation: an engulf of the same side completes on the confirmation timeframe after that engulf is known, its zone
   overlapping the engulf zone, both higher zones alive, within 24 confirmation candles of the engulf (`SOP3.wait`; the most
   recent engulf zone that fits). One order per confirmation zone. Known at the confirmation engulf's close, K.

## Trade

- **Entry (2)**:
  - `mkt`: market, at the open of the first 5-minute candle starting at or after K.
  - `lim50`: a limit at the middle of the confirmation zone, resting from K for 24 confirmation candles, cancelled by a
    confirmation-timeframe close past the stop. It fills only when a 5-minute candle TRADES THROUGH it by half the market's
    round-trip cost (a buy: low <= entry - cost/2); the fill is the better of the entry and the candle's open. On the fill
    candle only the stop counts; a fill candle that opens past the stop is a -1R loss.
- **Stop**: past the far side of the ENGULF (second) timeframe's zone by 0.1 x ATR(14) of the engulf timeframe at its last
  candle closed by K. Every trade has its stop on the losing side of the fill; a market fill at or past the stop is no trade. A
  trade whose risk is under the round-trip cost is no trade (every cell alike).
- **Exits (3)**: `1R`, `2R`, or `opp` = the near side of the NEAREST engulf zone of the other side on the ZONE (first)
  timeframe, alive at K, ahead of the entry, only when it is 1R or more from the entry (else no trade in the `opp` cells). R
  is counted from the fill. A 5-minute candle that opens past the stop or the target exits at its open; one that holds both is a
  stop. Time limit: the close of the 5-minute candle reaching 10 days (chain A), 3 days (B), 1 day (C) after the fill.
- Overlapping trades are allowed (no one-position rule; month sums carry the dependence).
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (the demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Cells (36 judged)

3 chains x 2 entries x 3 exits = 18, and the same 18 keeping only trades where the **Daily MSNR call agrees** with the side
(`council/eg-methods.mjs` `direction()` on the 1d candles with 1w as the timeframe above, `grid7-wide-core`'s `dailyCalls`; the
call of the last 1d candle closed at K equal to the side): **36 cells**, each pooling the ten markets.

## The control (one per cell, a comparator only)

For each chain signal, ONE control signal drawn at random (seeded per market) from the confirmation-timeframe engulf zones of
the same market, the same side and the same calendar month that are NOT a confirmation of that chain (no higher zones
required); drawn with replacement; none available = no control for that signal. The control takes the same entry and exits
from its own zone and its own K, with a stop at the same distance in ATR(14) of the engulf timeframe as its matched signal
(risk = the signal's risk / its ATR x the control's ATR), its `opp` target from the zone timeframe's zones alive at its K, and
its own Daily call for the MSNR cells. The control cell of a cell = the same chain, entry, exit and MSNR condition.

## The bar (judged BEFORE costs; after-cost figures beside)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over the 36 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats its control: Welch t (trade R of the cell against trade R of its control cell) >= 2 in discovery AND in
   confirmation.

**Verdict**: PASS if at least one cell passes; FAIL if none does; INCONCLUSIVE if no cell reaches n >= 300 in both windows.
Nothing is adopted from a pass: a passing cell would be a candidate for its own forward record and an owner decision.

## Also reported

- Every cell: n, mean R, month t, win rate in both windows, before and after costs; its control's figures and the Welch t.
- The **side-flipped check** of every cell: the same fill time and price, the other side, the stop the same distance on the
  other side, targets at the same R multiples (the `opp` target at the real trade's R multiple). Judged by bars 1-3 (expected:
  about nothing passes).
- Per-market rows for any passing cell.
- A cut test: the chain signals of several markets computed on candles cut at a date equal the full run's signals known by
  that date (chain, side, K, entry, stop, call).
- One run, no variants. Do not re-test variants of these cells on these years.
