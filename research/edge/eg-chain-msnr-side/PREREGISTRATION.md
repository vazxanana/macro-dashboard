# The H4 > H1 > M15 engulf chain, side taken WITH or AGAINST the H4 direction call (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run on real candles. Research only: nothing live reads it, nothing is placed, no rule is
proposed, no order code is touched.

## Why

The Engulfing desk's three-timeframe reading (`council/eg-methods.mjs` `sopTrades3`) takes its side from the marking zone alone: a
buy engulf zone on H4 means buys. The desk's direction call (`direction()`: the side switches only after a key level of the
timeframe above was tapped and the working chart then closed beyond the turn of its closes that stood before the tap) is meant to
be the bias every entry takes, yet no study has asked the chain this one question: of the chain's own orders, do the ones whose
side EQUALS the call made on the chain's own top timeframe (H4 working, Daily key levels) make money, and do they do better than
the ones whose side is the OPPOSITE of that call?

## What exists already (checked before writing this)

- `eg-chain-50` (gold, H1 > M15 > M5, close-based cut, roadblock target): FAIL.
- `eg-3tf-chain-2020` (the desk code on 18 markets, 2020 on): FAIL after costs.
- `desk-rigor` (the desks' readings 2020-25): FAIL, and "with against the direction" picked nothing.
- `grid7-wide-eg-chain` (the three chains, ten markets, 2005-26, market and trade-through limit, each also with the DAILY call
  (D1 working, weekly key levels) agreeing): FAIL, 0 of 36.
- `grid7-msnr-filter` (plain triggers WITH against AGAINST the call on three ladders): FAIL.

Not tested anywhere: this chain split by the **H4-working call with Daily key levels** (the ladder that sits on the chain's own
top timeframe), as WITH against AGAINST, and the desk's own TOUCH-filled limit beside the trade-through limit on 2005-26. That is
this study. One chain only (H4 > H1 > M15), 12 cells.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, read only), loaded from 2004-01-01 for
  warm-up. Markets (5): xau, eurusd, gbpusd, usdjpy, audusd (gold from where OANDA's history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York
  trading days).
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The chain (closed candles only)

`research/edge/grid7-wide-eg-chain/run.mjs` `chainSignals` is imported unchanged and only its chain B (H4 > H1 > M15) is read;
it uses `council/eg-methods.mjs` `zones` (an engulf: a candle closing beyond the high / low of the last candle of the other
colour, at most 3 candles back; the zone is that base candle, wick to wick; it dies at a close through its far side). In words:

1. A live H4 engulf zone gives the chain's side d (a buy zone: +1).
2. After the zone is known, an H1 candle trades into it; from that candle's close on, an H1 engulf of side d completes while the
   H4 zone is alive, its zone overlapping the H4 zone (the most recent H4 zone that fits).
3. Within 24 M15 candles of that, an M15 engulf of side d completes whose zone overlaps the H1 zone, both higher zones alive
   (the most recent H1 engulf that fits). One order per M15 zone, known at that M15 close, K.

## The call

`direction(work, keyOf, 86400)` imported from `council/eg-methods.mjs`, unchanged: work = the 4h candles, key levels from the 1d
candles (`keyOf` = the start of the 1d candle holding the 4h candle, as `grid7-msnr-filter`). The call of an order = the call of
the last 4h candle CLOSED by K. **WITH**: d equals the call. **AGAINST**: d is the opposite of the call. Call 0 (before the first
switch): in neither.

## The trade

- **Entry (2)**: a limit at the middle (50 %) of the M15 zone, resting from K for 24 M15 candles, cancelled earlier by an M15
  close past the stop.
  - `touch`: filled by the first 5-minute candle starting at or after K that trades to the entry (the desk's fill).
  - `through`: filled only when a 5-minute candle trades THROUGH the entry by half the market's round-trip cost.
  The fill is the better of the entry and the candle's open. On the fill candle only the stop counts; a fill candle that opens
  past the stop is booked at -1R.
- **Stop**: past the far side of the H1 zone by 0.1 x ATR(14) of H1 at its last candle closed by K (the desk uses a fixed
  buffer; said here). Always on the losing side of the entry (an entry at or past the stop is no order). A trade whose risk is
  under the round-trip cost is no trade.
- **Exits (3)**: `1R`, `2R` (the desk's), `opp` = the near side of the nearest live H4 engulf zone of the other side ahead of
  the entry at K, only when 1R or more away (else no trade in that cell). R from the fill. A 5-minute candle that opens past
  the stop or the target exits at its open; one that holds both is a stop. Time limit: the close of the 5-minute candle
  reaching 3 days after the fill.
- Overlapping trades are allowed (no one-position rule; month sums carry the dependence).
- Costs: `combo-grid-2`'s `COSTS` round trip (the demo account's figures for these five markets), in R of each trade's own
  risk. Every cell is reported before and after costs.

## Cells (12 judged)

2 sides (WITH, AGAINST) x 2 entries (touch, through) x 3 exits (1R, 2R, opp), the five markets pooled.

## The bar (judged AFTER costs)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R after costs > 0 and calendar-month-sum t (after costs) >= 2 in discovery AND in confirmation;
3. Holm over the 12 confirmation tests (one-sided p of the confirmation after-cost month-sum t, df = months - 1): adjusted
   p < 0.05.

**Verdict**: PASS if at least one cell passes; INCONCLUSIVE if no cell reaches n >= 300 in both windows; FAIL otherwise. "Best
cell" in the report = the cell with the highest confirmation after-cost month t. Nothing is adopted from a pass: it would be a
candidate for its own forward record and an owner decision, never called an edge.

## Reported beside, not judged

- Every cell: n, mean R before and after costs, month t before and after costs, win rate, both windows.
- WITH against AGAINST for each entry x exit: difference of mean R before costs and Welch t, both windows.
- The same six entry x exit cells with no call condition (every chain order), and the share of orders with call 0.
- Per-market rows of the best cell.
- A cut test: on five dates per market, the orders (side, K, entry, stop, call) known by the date, computed on candles cut
  there, equal the full run's.
- One run, no variants. Do not re-test variants of these cells on these years.
