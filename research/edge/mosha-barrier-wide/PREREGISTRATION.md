# The Mosha barrier entry, market fills, ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The barrier entry was tested on gold only (`desk-rigor`, `mosha-barrier-6r`: FAIL) and always with a RESTING LIMIT at the broken
level. On mid candles a limit is filled on a touch, which flatters it (`research/edge/dom-trade-through`). This study keeps the
desk's barrier reading and its QM confirmation, takes every trade at MARKET on the next 5-minute open after the QM's close,
and runs it on ten markets over 22 years against a control that has no barrier. 36 cells, all fixed below.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up; OANDA daily candles (1d) from the same cache.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- 15m, 1h, 4h candles grouped from the 5-minute ones in UTC buckets (a bucket is used only once complete), as
  `mosha-barrier-6r` `group`.
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## Barriers (the desk's reading, `assets/mosha-sop.js` `zonesOf`, imported, never edited)

On the barrier timeframe zt = H4 or H1, with the page's own `msAnalyze` / `msInternal` (loaded by `council/mosha-desk.mjs`
`loadFns`), the desk's three kinds of barrier box:

- **bo**: the origin box of a major BO (`msAnalyze(H, 6)`): from the level the break took to the extreme of its leg;
- **ibo**: the origin box of an internal BO (`msInternal(H, n, 3)`);
- **eg**: an engulf (EG) zone (`egBoxes`: the base candle wick to wick, completed within 3 candles).

A box serves from the close of the candle that completes it. **First return only**: the first later zt candle that trades into
it (`touch`); the exact moment is the first 5-minute candle inside that zt candle that trades into the box (as the desk reads it
on its finest candles). A box narrower than the desk's smallest barrier (`zmin`) is skipped.

## Confirmation (the barrier table: H4 barrier on M15, H1 barrier on M5)

From the confirmation-timeframe candle holding the return moment, for at most 60 of its candles (`BARRIER_WATCH`): the first
**QM (BO Structure) with the barrier**, read exactly as the desk reads it: on each closed candle i, the small-swing breaks
(the page's `msAnalyze(W, 3)` on the 241 candles ending at i, the desk's `swingEv`), the last event must break at i, be a
structure break in the barrier's direction, and come from a swing no older than 30 candles before the return. A close more than
one box height through the far side of the box ends the watch with no trade.

## Trade

- Entry: **market**, at the open of the first 5-minute candle starting at or after the QM candle's close. No resting limit.
- Stop: past the extreme made at the barrier from the return to the QM close (the desk's `x`) by the desk's buffer: $0.30 on
  gold; on every other market the same share of its own price ($0.30 / 4000 x price), as the desk's `sizes` scales it.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop is no trade.
- The desk's risk limits apply (risk above `rmin` and at most `rmax`, scaled the same way); a risk under the market's round trip
  is no trade.
- Exits: a target at **1R**, **3R** or **6R**, the stop, or the close of the 5-minute candle that reaches 5 days. A 5-minute
  candle that opens past the stop or the target exits at its open; one that holds both is a stop.
- One trade per (market, side, fill time, stop) within a cell.
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (demo figures for xau, eurusd, gbpusd, usdjpy,
  audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Direction split (the desk's `withDir`)

The structure trend (`msAnalyze(…, 6).trend` on the last 1,500 candles) of the timeframe above the barrier (D1 over H4, H4 over
H1), on its candles CLOSED at the return. **with** = the trend equals the barrier's side, **against** = it is the other side; a
reading with no trend is in no cell (counted).

## Cells (36)

2 barrier timeframes (H4, H1) x 3 kinds (bo, ibo, eg) x 2 directions (with, against) x 3 exits (1R, 3R, 6R). Each cell pools
the ten markets.

## Control (no barrier)

For every barrier box, one control band: the same side, the same height, placed on the same side of price at a matched
distance. At the close that completes the box (price P), the box's near edge is D away from P (D at least the box height); the
control's near edge is at u x D from P, u uniform in [0.5, 1.5] from a seed fixed by (market, timeframe, kind, time, side). The
band is run through exactly the same steps (first return, the same QM confirmation, entry, stop, exits) and the same direction
split; its cell is the same cell index. It is not checked to be free of barriers: it is a band at random, not one the reading
drew.

## The bar (judged BEFORE costs; after-cost figures beside)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R a trade > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over all 36 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats its control cell: Welch t (trade R of the cell against trade R of its control) >= 2 in discovery AND in confirmation.

PASS = at least one cell passes; else FAIL.

## Also reported (no verdict rests on them)

- Every cell with both windows, after-cost figures, the control and the Welch t.
- **Side-flipped check**: each real trade taken the other way from the same fill, stop 1R away on the other side, same R target;
  how many flipped cells pass bars 1-3.
- Per-market rows for any passing cell.
- A cut test: the trades known by a date, computed on candles cut there, equal the full run's (5 dates, at least 2 markets).

## Known limits, said now

- Mid candles; the spread is charged only through the round trip after the fact.
- The direction reading uses OANDA's own daily candles for D1.
- One reading of the method (major / internal BO origin boxes and EG zones, the simple QM, market entry); the Janda, the sweeps,
  later visits, the M1 tap and the repeat of the SOP are not in it.
- Never call a result an edge without n and t.
