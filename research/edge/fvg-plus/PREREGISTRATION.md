# Fair-value gap plus: what the gap entry lacks, judged after costs (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`grid7-fvg-wide` (23 Nov 2026) passed 4 of 54 cells before costs: a market entry at the first M15 close back inside an H1 or
H4 fair-value gap, about +0.035R a trade, beating random bands of the same height. Every one of them lost after costs
(-0.02R to -0.11R). What is missing is not a signal but room: the gap's stop is small, so the round trip is a large share of
1R. This study asks whether the same entry clears costs when (1) the gap is on a higher timeframe, (2) the stop is wider, so
the cost is a smaller share of the risk, and (3) another tested-but-plain piece is added: the structure side of the gap's own
timeframe or of the timeframe above. It is judged AFTER costs, and anything that passes is then run once on eight markets no
gap study has read.

Honest limit, said first: stage 1 runs on the same ten markets and years that `grid7-fvg-wide` read, so a stage-1 pass is
selection, not evidence. Only stage 2 (new markets) can make a candidate.

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`), loaded from 2004-01-01.
- Stage 1 markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Stage 2 markets (8, never read by a gap study): nas100, spx500, de40, gbpjpy, audjpy, cadjpy, eurgbp, euraud.
- Timeframes from the 5-minute candles: 15m, 1h, 4h (`edgekit.resample`, UTC), 1d (`edgekit.dailyNY`), 1w (`combo-grid-3`
  `weekly`).
- Exclusions: `combo-grid-2` `exclusions(market)`.
- Windows by fill time: discovery 2005-01-01 to 2014-12-31 (120 months), confirmation 2015-01-01 to 2026-10-31 (142 months).

## The trade (one per gap)

- Gap: `grid6-smc-market` `gapZones` on G = 1h, 4h or 1d (closed candles; known at the close of its third candle). Its life:
  until an M15 close through its far side, or 120 G candles.
- Entry: `grid7-fvg-wide`'s passing entry, unchanged: the first M15 close inside the gap before any close through its far
  side; market with the gap's side at the next 5-minute open.
- Stop (two): **gap** = the far side of the gap + 0.1 x ATR(14) of G (as in `grid7-fvg-wide`); **wide** = the far side of the
  gap + 1.0 x ATR(14) of G.
- Direction (three): **none**; **tf** = `edgekit.structure(G, 2)` side at the last G candle closed by the entry signal equals
  the gap's side; **up** = the same on the timeframe above (1h -> 4h, 4h -> 1d, 1d -> 1w).
- Exits (two): target **1R** or **2R**, the stop, or the close of the 5-minute candle at the time limit (1h gaps 2 days, 4h
  5 days, 1d 10 days). A candle opening past stop or target exits at its open; one holding both is a stop
  (`dom-trade-through` `manage`).
- Every trade has its stop on the losing side; a fill at or past the stop, or a risk under the round trip, is no trade.
- Costs: `combo-grid-2` `COSTS` (demo figures for xau, eurusd, gbpusd, usdjpy, audusd; **ASSUMED, not measured** for every other
  market, all eight stage-2 markets included). After costs = R - round trip / risk.

## Stage 1: 36 cells (3 timeframes x 2 stops x 3 directions x 2 exits), ten markets pooled

A cell passes stage 1 only if, **after costs**:
1. n >= 300 in discovery AND confirmation;
2. mean net R > 0 and month-sum t (of net R) >= 2 in discovery AND confirmation;
3. Holm over the 36 confirmation tests (one-sided p, df = months - 1): adjusted p < 0.05.

Before-cost figures are reported beside.

## Stage 2: eight new markets, 2005-01-01 to 2026-10-31 in one window

Every stage-1 passing cell is run once on the eight new markets pooled. It passes if, after costs, n >= 300, mean net R > 0 and
the month-sum t of net R >= 2 (Holm over the stage-2 cells run). If no cell passes stage 1, the single cell with the highest
min(discovery net t, confirmation net t) is run on the new markets and reported, but it cannot pass.

**Verdict**: PASS if at least one cell passes stage 1 AND stage 2; FAIL otherwise. A PASS is a candidate for its own forward
record and an owner decision, nothing more, and the after-cost figures of stage 2 rest on ASSUMED costs.

## Also reported

Every cell's n, mean R before and after costs, month t, both windows; per-market rows for the stage-2 cells; a cut test (entries
known by several dates on cut candles equal the full run's). One run, no variants.
