# Wide supply / demand grid: zones by base type on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

Fresh supply / demand zones were tested before only as one family among many (`grid5-sd-eg`, `grid7-wide-core` family (e),
`nearmiss-holdout` SD), always with the zone found from a structure break. The classic reading of a zone is different: a base of
small candles between a leg in and a strong leg out, sorted by its shape (continuation: rally-base-rally, drop-base-drop;
reversal: drop-base-rally, rally-base-drop), traded on the first return. This study fixes that reading in 56 cells, on the
wide design of `grid7-wide-core` (ten markets, discovery 2005-2014, confirmation 2015 to the end of October 2026, judged before
costs, each cell against its own control). Chance has 56 tries.

## Data

- OANDA mid 5-minute candles through the site's candle proxy, the shared cache (`research/edge/_lib/edgekit.mjs`,
  `fetch-cache.mjs`, `EDGE_DATA` on the machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York
  trading days).
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The zone (zone timeframe Z = 1d or 4h, closed candles only)

ATR = ATR(14) of Z (the true-range average of `dom-trade-through`'s `atr14`, imported). A candle j is judged with the ATR of the
candle before it (index j-1), so no candle measures itself.

- **Small candle**: body |close - open| < 0.5 x ATR.
- **Leg out**: the candle o right after the base, with body > 1.5 x ATR in its own colour (one-candle leg out), or, if not,
  candles o and o+1 of the same colour whose joint body |close(o+1) - open(o)| > 1.5 x ATR (two-candle leg out). Its direction
  is its colour. **Strength** = the leg out's body / ATR: "1.5-2.5" or "over 2.5".
- **Base**: the run of consecutive small candles ending at o-1, 1 to 4 candles long (a run of 5 or more small candles is no
  base).
- **Leg in**: the candle right before the base (by construction not small); its direction is its colour.
- **Shapes**: leg in up + leg out up = **RBR** (rally-base-rally, demand, continuation); down + down = **DBD** (drop-base-drop,
  supply, continuation); down + up = **DBR** (drop-base-rally, demand, reversal); up + down = **RBD** (rally-base-drop, supply,
  reversal).
- **Zone** = the base's range (lowest low to highest high of the base candles); side = the leg out's direction (demand = buy,
  supply = sell). Known at the close of the leg out's last candle. One zone per base (the one-candle reading is taken first).
- **Leg-out extreme**: the highest high (demand) or lowest low (supply) of the leg-out candle(s).
- **Life**: the zone serves from its known time until 120 Z candles later. It is **fresh until its first touch**: only the first
  touch counts.

## The first touch and the entry (timeframe T two steps under Z: 1d -> 1h, 4h -> 15m)

- **Touch**: the first T candle starting at or after the known time that trades into [low, high] of the zone, within its life.
  If the touch candle closes beyond the zone's far side, there is no trade (the zone broke on its first touch).
- **(a) touch**: market entry at the open of the first 5-minute candle starting at or after the touch candle's close.
- **(b) break**: the first structure break of the zone's side on T (`edgekit.structure(T, 2)`, BO or ChoCh: a close beyond the
  last confirmed 2-a-side swing) among the 24 T candles starting with the touch candle, before any T close beyond the zone's far
  side; market entry at the open of the first 5-minute candle starting at or after that break candle's close.

## Trade

- **Stop**: past the zone's far side by 0.1 x ATR of Z (the ATR at the leg out's last candle). Every trade has its stop on the
  losing side of the fill; a fill at or past the stop is no trade. A trade whose risk is smaller than the market's round-trip
  cost is no trade (the same rule for every cell and the controls).
- **Exits** (three): a target at **1R**, at **2R**, or at the **leg-out extreme** ("ext"; only when it is 1R or more beyond the
  fill, otherwise that trade is not in the ext cells); the stop; or the close of the 5-minute candle that reaches the time limit
  (10 days for 1d zones, 3 days for 4h zones). A 5-minute candle that opens past the stop or the target exits at its open; one
  that holds both is a stop.
- One trade per (market, cell, entry candle, side): two zones met by the same entry count once in a cell.
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (the demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Cells (56)

- **48 shape cells**: 4 shapes (RBR, DBD, DBR, RBD) x 2 zone timeframes (1d, 4h) x 2 entries (touch, break) x 3 exits (1R, 2R,
  ext), every strength.
- **8 strength cells**: 2 strengths (1.5-2.5, over 2.5) x 2 zone timeframes x 2 entries, the four shapes pooled, 2R exit.

Each cell pools the ten markets.

## The control (one per cell)

For every real zone, three **random bands** (seeds 1-3) of the same side and the same height, made at the same known time: the
near edge sits u x ATR from the close of the leg out's last candle on the zone's side (below it for demand, above it for supply),
u drawn from the near-edge distances (in ATR) of the last 500 earlier real zones of the same market and zone timeframe (none
before 50 such zones). A band has the same life, the same first-touch rule, the same two entries, the same stop rule (its far
side + 0.1 ATR), the same 1R / 2R exits, and for ext a target the same distance past its near edge as the real zone's extreme
is past the real zone's near edge (only when 1R or more beyond the fill). A cell's control = the bands made from that cell's
zones, the three seeds pooled. The bands are touched at times matched by construction (same birth, same distance pool, same
life).

## The bar (judged BEFORE costs; after-cost figures shown beside)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R a trade > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over all 56 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats its own control: Welch t (trade R of the cell against trade R of its control) >= 2 in discovery AND in
   confirmation.

**Verdict**: PASS if at least one cell passes; FAIL if none does. Nothing is adopted from a pass: a passing cell would be a
candidate for its own forward record and owner decision.

## Also reported

- Every cell: n, mean R, month t in both windows, before and after costs; its control's figures and the Welch t.
- The **side-flipped placebo** of every cell: the same entry candle and fill, the other side, the stop the same distance on the
  other side of the fill, targets at the same R multiples. Judged by bars 1-3 (expected: about nothing passes).
- Per-market rows for any passing cell.
- A cut test: the trades of several markets computed on candles cut at a date equal the full run's trades known by that date.
- One run, no variants. Do not re-test variants of these cells on these years.
