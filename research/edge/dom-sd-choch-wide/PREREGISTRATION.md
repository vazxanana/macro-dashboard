# Zones confirmed by a change of character, ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`grid7-wide-core` found that entering WITH a plain lower-timeframe break after an H4 / Daily level loses before costs, and that
fading it wins (`grid7-wide-fade`). The owner's own confirmation is narrower than "any break": after price reaches the zone, the
lower timeframe must turn WITH the zone, i.e. close beyond the last swing that the move INTO the zone left behind (a change of
character, ChoCh). This study tests exactly that confirmation on four zone families, on the wide design of `grid7-wide-core`
(ten markets, discovery 2005-2014, confirmation 2015 to the end of October 2026, judged before costs on month sums), against two
controls: the same ChoCh with no zone, and the zone touch with no ChoCh. 48 cells, fixed below; chance has 48 tries.

## Data

- OANDA mid 5-minute candles through the site's candle proxy, the shared cache (`research/edge/_lib/edgekit.mjs`,
  `fetch-cache.mjs`, `EDGE_DATA` on the machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York
  trading days), 1w.
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.
- Costs (after-cost figures only, never the bar): `combo-grid-2`'s `COSTS`, the demo figures for xau, eurusd, gbpusd, usdjpy,
  audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## Zones (zone timeframe Z = 1d or 4h, closed candles only; first touch only)

Each family gives `{ side, bottom, top, known-at, end }`, imported, never edited:

- **dom**: dominant zone, `combo-grid-3` `buildZones('dom', Z)` (two same-colour candles, the second closing beyond the first's
  extreme; the zone is the first candle's body).
- **sd**: fresh supply / demand, `grid5-sd-eg` `sdZones(Z)` (the base candle before a structure break).
- **eg**: engulf zone, `buildZones('eg', Z)` (`council/eg-methods.mjs` `engulfAt`, completed within 3 candles).
- **ef**: failed engulf zone (a Z close through its far side), traded the OTHER way, `buildZones('ef', Z)`.

Touch: the first candle of the trigger timeframe T (Z = 4h -> T = 15m; Z = 1d -> T = 1h) starting at or after the zone is known
that trades into `[bottom, top]`, before the zone's end (candle k0). Only that visit counts.

## The confirmation: a change of character on T (closed candles only)

Swings: `edgekit.swings(T, 3)` (3 a side), a swing known at the close of its third candle after it.

For a buy zone (a sell mirrors): from k0, at each T candle j (k0 <= j < k0 + 24, closing before the zone's end), the reference
level is the most recent swing HIGH known by the close of candle j-1 (the last swing the move down into the zone left). The
ChoCh is the first j whose close is above that level. If a T candle from k0 to j closes below the zone's bottom first (through the
far side), or no ChoCh comes within the 24 candles, the zone gives no trade.

- Extreme made in the zone: the lowest low of T candles k0..j (highest high for a sell).
- ChoCh leg: close of j minus that extreme (mirrored for a sell), compared with ATR(14) of T at j (`dom-trade-through` `atr14`).

## Trade

- **Stop**: past the extreme made in the zone by 0.1 x ATR(14) of T at j. Every trade has its stop on the losing side of its
  fill; a fill at or past the stop is no trade; a trade whose risk is under the market's round trip is no trade (every set).
- **Entry (two sets)**:
  - **mkt**: market at the open of the first 5-minute candle starting at or after j's close.
  - **lim**: a resting limit at the broken swing level, placed at j's close, filled only when a 5-minute candle trades THROUGH it
    by half the round trip (`dom-trade-through` `findFill`, rule `through`, imported; fill at the level, or the open if it gapped
    beyond), cancelled by a 5-minute close past the stop before the fill or after 24 T candles. On the fill candle only the stop
    counts.
- **Exits (three)**: a target at **1R**, **2R**, or **struct** = the nearer, ahead of the fill, of (a) the zone's leg-out extreme
  (the highest high, lowest low for a sell, of the Z candles from the candle that completed the zone to the last Z candle closed at
  the touch) and (b) the near edge of the nearest zone of the same family and the opposite side known by j's close and still
  standing; struct trades only when that target is 1R or more from the fill (else no struct trade). Time limit: the close of the
  5-minute candle reaching 2 days (1d zones) / 1 day (4h zones) after the fill. A 5-minute candle that opens past the stop or the
  target exits at its open; one that holds both is a stop.
- One trade per (market, family, Z, side, ChoCh candle).
- R before costs; after costs = R - round trip / risk.

## Cells (48)

4 families x 2 zone timeframes x 2 entries x 3 exits; each pools the ten markets.

## Controls (each cell has both, built from its own trades)

- **(i) ChoCh, no zone**: for every real signal, the identical ChoCh search, side, stop rule, entry and exit started 96 T candles
  earlier (k0' = k0 - 96: one day on M15, four on H1), skipped when any candle of its 24-candle window traded into the zone or
  when k0' < 0; no far-side condition (there is no zone). Its struct exit uses the same R multiple as the real trade's struct
  target (none when the real trade has none).
- **(ii) touch, no ChoCh**: at the touch candle k0: mkt = market at the next 5-minute open after k0's close; lim = a trade-through
  limit at k0's close price, placed at k0's close, same expiry and cancel. Stop past the touch candle's extreme in the zone by 0.1
  ATR(14) of T at k0; struct target recomputed for its own fill by the same rule (1R or more, else none).

## The bar (judged BEFORE costs; after-cost figures shown beside)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R a trade > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over the 48 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats control (i) AND control (ii): Welch t (trade R of the cell against trade R of the control) >= 2 in discovery AND in
   confirmation, for each control.

**Verdict**: PASS if at least one cell passes; INCONCLUSIVE if fewer than 12 of the 48 cells reach n >= 300 in both windows and
none passes; FAIL otherwise. Nothing is adopted from a pass: a passing cell would be a candidate for its own forward record and
owner decision, never called an edge before one.

## Also reported (descriptive, not tested)

- Every cell: n, mean R, month t in both windows, before and after costs; both controls' figures and the Welch t.
- Splits of every cell: with / against the Daily MSNR call (`council/eg-methods.mjs` `direction()` on the 1d candles with the 1w
  as the timeframe above, as `grid7-wide-core`; the call of the last 1d candle closed at j's close; a 0 call is in neither), and
  the ChoCh leg under / over 1 ATR. Reported with their own n, R and t; not part of the bar.
- The **side-flipped placebo** of every cell: the same fill, the other side, the stop at the same distance on the other side,
  targets at the same R multiples; judged by bars 1-3.
- Per-market rows for any passing cell.
- A cut test: the signals of several markets computed on candles cut at a date equal the full run's signals known by then.
- One run, no variants. Do not re-test variants of these cells on these years.
