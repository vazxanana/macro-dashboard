# Which engulf zones hold? Zone qualities on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`grid7-wide-core` found that an engulf (EG) zone followed by a lower-timeframe break, traded with the zone, loses a little before
costs on ten markets in both windows, and the side-flipped trade wins. That study took every zone alike. This one asks whether
some kinds of zone hold better than others: the number of candles the engulf took, the zone's height, whether price left it
with force, whether it formed at an earlier level, the first or second return, and the Daily MSNR call. Each quality is a split
fixed below; the level that did best in discovery is tested against the level that did worst in confirmation. The entry is
simple (a close inside the zone on its first return) so the zone itself is what is judged. The fade of the same moment is a
second pre-registered set, since `grid7-wide-core` and `grid7-wide-fade` found fading short-term moves wins before costs.

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the machine
  that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver start where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York
  trading days), 1w.
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31** (142
  months). Month sums count every calendar month of the window, an empty month as 0.

## Zones (level timeframe L = 1d or 4h, closed candles only)

- Engulf zones of `combo-grid-3`'s `egZones(L, 3)` (imported; `council/eg-methods.mjs` `engulfAt`, imported, never edited): the
  base candle is the last candle of the other colour, a candle at most 3 candles after it closing beyond its high (buy) / low
  (sell) completes it; the zone is the base candle wick to wick, known from the close of the completing candle, alive until an L
  close through its far side or 120 L candles.
- Trigger / entry timeframe T: **H1 for a D1 zone, M15 for an H4 zone**.

## Visits and entry

- **Visit 1**: the first T candle starting at or after the zone is known that trades into `[bottom, top]` (the touch). The visit
  lasts until the first later T candle wholly outside the zone on its near side (buy zone: low above the top; sell: high below
  the bottom). **Visit 2**: the next T candle after visit 1 ended that trades into the zone, while the zone stands, lasting the
  same way. Later visits are not used.
- **Entry of a visit**: the first T candle of the visit, within 24 T candles of its touch, whose CLOSE is inside `[bottom, top]`,
  and before any T close beyond the zone's far side (that ends the visit with no trade). Market fill at the open of the first
  5-minute candle starting at or after that close.
- **Set "with"**: the zone's side. Stop = the zone's far side minus (buy) / plus (sell) 0.1 x ATR(14) of L at the completing
  candle.
- **Set "fade"** (second set): the other side at the same moment. Stop = the extreme of the T candles from the touch to the entry
  candle (the highest high for a sell, the lowest low for a buy) plus / minus 0.1 x ATR(14) of L.
- Every trade has its stop on the losing side of the fill; a fill at or past the stop is no trade; a trade whose risk is under
  the market's round-trip cost is no trade (both sets, every cell).
- **Exits**: a target at **1R** or **2R**, the stop, or the close of the 5-minute candle that reaches the time limit (2 days for
  D1 zones, 1 day for H4 zones). A 5-minute candle opening past the stop or target exits at its open; one holding both is a stop
  (`grid7-wide-core`'s `exits`, imported).
- One trade per (stream, entry T candle, side): two zones giving the same entry count once (the zone known first keeps it).
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

Streams: 2 sets x 2 level timeframes x 2 exits = **8 streams**.

## Qualities (each a split; all known at the entry candle's close)

- **Q1 span**: candles the engulf took (completing index minus base index): **1** / **2-3**.
- **Q2 height**: (top - bottom) / ATR(14) of L at the completing candle: **under 0.5** / **0.5-1** / **over 1**.
- **Q3 move away**: from the base's next candle up to the touch (the L candles from base+1 to the completing candle, then the T
  candles from the zone's known time to the touch, excluded), did price reach top + 2 ATR (buy) / bottom - 2 ATR (sell), ATR of
  L at the completing candle: **reached** / **not**.
- **Q4 at a level**: the zone overlaps, on the same side, a V / A turn of the closes (`combo-grid-3` `buildZones('av', L)`) or an
  earlier engulf zone of L, that was known at or before this zone and still standing when this zone became known: **yes** / **no**.
- **Q5 return**: **first** visit / **second** visit.
- **Q6 Daily MSNR call**: `council/eg-methods.mjs` `direction()` (via `grid7-wide-core`'s `dailyCalls`, 1d candles, 1w key
  levels), the call of the last 1d candle closed at the entry candle's close: **with** (equal to the zone's side) / **against**
  (anything else, including no call).

For Q1-Q4 and Q6 only visit-1 trades are counted; Q5 compares visit 1 with visit 2. The "fade" set keeps the zone's labels (Q6
compares the call with the ZONE's side).

Cells: per stream, an "all" cell (visit-1 trades) and one cell per quality level (13 levels) = 14 cells x 8 streams = **112 cells**.

## Control (a random band)

For each real zone, a band of the same height, same side, at a matched distance: with D = distance from the completing candle's
close to the zone's near side, the control band's near side sits at distance u x D from that close (u uniform in [0.5, 1.5],
seeded per market), same life and end rule (its own close through its far side, or 120 L candles). It inherits the zone's Q1,
Q2, Q4 labels, and goes through the same visits, entry, both sets, exits, Q3, Q5 and Q6 computed for the band. Every cell has its
control cell (same stream and level).

## Primary tests (judged BEFORE costs; after-cost figures beside)

- **(A) Quality split, 48 tests** (6 qualities x 8 streams): in discovery, the level with the highest mean R a trade is "best"
  and the lowest "worst" (only levels with n >= 30 in discovery; otherwise the test is p = 1). In confirmation: Welch t of trade R,
  best minus worst; one-sided p. A split passes if the confirmation Welch t >= 2, Holm-adjusted p < 0.05, and the same difference
  in the control cells is smaller (best minus worst in the real trades exceeds that in the control by Welch t >= 1 on the
  difference of differences, approximated as (dReal - dCtl) / sqrt(seReal^2 + seCtl^2)).
- **(B) Cells, 112 tests**: a cell passes if n >= 300 in discovery AND confirmation, mean R > 0 and month-sum t >= 2 in BOTH
  windows, Holm-adjusted p < 0.05 (one-sided p of the confirmation month-sum t, df = months - 1), and it beats its own control
  cell in confirmation (Welch t of trade R >= 2).
- **Holm over all 160 confirmation tests** (48 + 112) together.

Verdict: **PASS** if at least one (A) or (B) passes; **FAIL** otherwise; **INCONCLUSIVE** if fewer than 300 confirmation trades
exist in the "all" cell of every stream (data too thin to judge).

## Checks reported

- Cut test: on two markets and five cut dates, the trades whose entry close is at or before the cut, computed on candles cut
  there, equal the full run's (entry time, side, stop, labels).
- Every cell's n, mean R and month t in both windows, before and after costs, and its control; per-market rows for any pass.

## Limits said in advance

- OANDA mid candles, not broker ticks; costs assumed for five markets; market fills at the next 5-minute open.
- A quality that passes is a candidate for its own holdout or forward record, not a rule. Never called an edge before that.
- One run, no variants.
