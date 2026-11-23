# The MSNR plan with market entries on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The MSNR desk's gold plan (a Daily rejection confirmed by an H4 break gives the side; a 15- / 30-minute engulf or QM inside an H4
zone of that side is the trigger; a resting limit at the trigger zone) made +0.079R a trade out of sample on gold in
`research/edge/desk-rigor` (n 775, t 1.31) and -0.042R in sample. Resting limits are flattered on mid candles by touch fills
(`research/edge/dom-trade-through`). This study asks the plan's question cleanly: with an entry that cannot be flattered by a
touch fill (market at the next 5-minute open), on ten markets, over 22 years, does the plan pick better triggers than the same
triggers taken anywhere?

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`), loaded from 2004-01-01 for
  warm-up (OANDA's 5-minute history starts in 2005; gold and silver in 2005-2006: what the cache holds is used).
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Candles for the plan as the desk builds them: 15m, 30m (from 15m, `m30` as the desk's), 4h UTC buckets, 1d UTC days with the
  weekend folded into Monday (`council/fills.mjs` `foldWeekend`, as the desk). The Daily MSNR call uses `grid7-wide-core`'s
  `dailyCalls` (imported: `direction()` on 17:00 New York days with weekly levels).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month, an empty month as 0.

## The plan (imported from `council/eg-methods.mjs`, never edited)

- **Side**: `snrSides(D1, H4)` (imported): a Daily candle rejects a fresh Daily V / A turn of the closes or an open-close level
  and an H4 candle closes beyond the last H4 A / V level that stood before the tap, within 3 trading days. The side in force at a
  moment is the latest such side known by then (as the desk's `sideAt`).
- **H4 zone**: `zones(H4, '4h')` + `turnBack` (imported): an H4 engulf zone of the side still standing, or an opposite H4 zone
  that failed and has not been closed back through (20 days at most), formed at most 20 days before the side (the desk's own
  test, re-written here because the desk's helper is not exported).
- **Triggers** (re-written from the desk's non-exported `triggers`, on the imported `zones`; a unit test checks it):
  - **EG**: a 15- or 30-minute engulf zone of the side, known at the completing candle's close, whose trigger candle trades into
    the H4 zone (the desk's `inZ`).
  - **EF**: an opposite 15- or 30-minute engulf zone that failed (a close through it), traded the side's way from that close,
    its own box as the zone, the failing candle in the H4 zone.
  - **QM**: `qmSetups(M15)` (imported: 15- and 30-minute QM), its head in an H4 zone of the side.
- **Control (same trigger anywhere)**: every trigger of the same type with its own side, no Daily side and no H4 zone needed, at
  **matched times**: only triggers whose (calendar month, UTC hour of the trigger close) occurs among the plan cell's own trades.

## Trade

- **Market set (primary)**: entry at the open of the first 5-minute candle starting at or after the trigger is known.
- **Limit set (second)**: a limit at the trigger zone's near edge (buy: its top; sell: its bottom; QM: the shoulder level, as
  `qmSetups` gives it), filled only when a 5-minute candle trades through it by half the market's round trip (buy: low <=
  entry - cost / 2), within 24 five-minute candles (the desk's two hours); fill at the limit price. On the fill candle only the
  stop counts.
- **Stops** (two): **pips** = 30 pips in the market's own pip past the entry (a pip is ten points: gold 0.10, silver 0.01, a
  five-decimal pair 0.0001, a yen pair 0.01; `council/eg-methods.mjs` `PIP` for gold and silver, the same rule for the pairs);
  **zone** = past the trigger zone's far side by 0.1 x ATR(14) of the 15-minute candles at the trigger.
- Every trade has its stop on the losing side of the fill; a fill at or past the stop, or a risk under the round trip, is no
  trade (the same rule for every cell).
- **Exits** (three, one pass): a target at **1R, 2R or 3R**, the stop, or the close of the 5-minute candle that reaches 5 days
  after the fill. A candle that opens past the stop or target exits at its open; a candle that holds both is a stop.
- One trade per (market, trigger type, trigger time, side) in a cell (no visit or 2-a-day caps: every trigger the plan allows).
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Cells (54, fixed)

- Market set: 3 triggers (EG, EF, QM) x 2 stops x 3 exits x 2 MSNR conditions (all; the Daily MSNR call of the last closed day at
  the trigger agreeing with the side) = 36.
- Limit set: 3 triggers x 2 stops x 3 exits, MSNR all = 18.
- Each cell pools the ten markets and has its own control (same trigger type, entry, stop, exit, MSNR condition, anywhere, at
  matched times). Controls are not cells: they take no part in Holm.

## The bar (judged BEFORE costs; after-cost figures beside)

A cell passes only if ALL hold:

1. n >= 300 in discovery AND in confirmation;
2. mean R > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over the 54 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. Welch t of the cell's trade R against its control's >= 2 in discovery AND in confirmation.

**Verdict**: PASS if at least one cell passes, FAIL if none, INCONCLUSIVE if no cell reaches n >= 300 in both windows. Nothing is
adopted from a pass: a passing cell would be a candidate for its own forward record and an owner decision.

## Also reported

- Every cell: n, mean R, month t in both windows, before and after costs; its control; the Welch t.
- The **side-flipped check** of every market-set cell: the same fill, the other side, the stop the same distance on the other
  side, the same exits; judged by bars 1-3 (expected: about nothing passes).
- Per-market rows for any passing cell.
- A cut test: the plan's signals of several markets computed on candles cut at a date equal the full run's signals known by then.
- One run, no variants. Do not re-test variants of these cells on these years.
