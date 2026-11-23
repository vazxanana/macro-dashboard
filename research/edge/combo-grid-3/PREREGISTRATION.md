# Combination grid 3: the pieces the documents and the owner's charts add (pre-registration)

Written 23 Nov 2026, before any run. The owner's course documents (28 documents, 202 pages) and his marked charts were read
into a private catalogue; this grid adds the pieces no earlier grid tested. Engine and bar as `research/edge/combo-grid`
(chains, zones, touches, entries, the one-pass exit simulation, costs, windows, the pass bar), with these changes.

## Pieces

1. **Chains (11)**: D1>H4, D1>H1, H4>H1, H4>M30, H4>M15, H1>M30, H1>M15, H1>M5, M30>M15, M30>M5, M15>M5 (M30 built from
   the 5-minute candles).
2. **Zones (9)**: the nine of grid 2 (EG, next-candle EG, EF, DOM, A/V, barrier, QM zone, box half, body engulf). First and
   second touch together.
3. **Filters (14, one at a time)**: grid 2's eleven, plus
   - sideways: the zone was not touched by the 2 key-timeframe candles closed after it formed;
   - the half: a buy only when the reference price is in the lower half of the range between the last confirmed swing high
     and swing low of the timeframe above the key timeframe (a sell in the upper half);
   - a confirmed side: the key timeframe's last structure event in the trade's direction is a BO, not a ChoCh.
4. **Triggers (6)**: EG, EF, structure break, QM, VR -> CF (any breaks), VR -> CF where both breaks are QMs; and none.
5. **Entries x stops**: entries at the trigger's close, 50 % of the trigger zone, its near edge; stops past the trigger zone,
   past the key zone, past the extreme since the touch, a fixed 30 pips from the entry (a pip: gold 0.10, silver 0.01, a
   5-decimal pair 0.0001, a yen pair 0.01, an index 1 point), and past the key zone by a quarter of the key timeframe's
   ATR(14) (a stop outside the zone's noise). With no trigger: a limit at the key zone's near edge or 50 %, with the
   zone, fixed-30 or zone+ATR stop.
6. **Exits (9)**: 1R, 2R, 3R, 4R, 6R; the nearest opposite zone of the same kind (>= 1R, else 2R); a 1R trailing stop from
   +1R; the FAR target = the near edge of the nearest opposite H4 or D1 engulf or failed-engulf zone standing at the signal,
   taken only when it is 3R or more away (else no trade for this exit); and the M5 EF trail = no target, the stop moved to the
   far side of each opposite M5 engulf zone that fails (a close through it) after the fill. Time limits as grid 1 by the key
   timeframe (D1 10 days, H4 5 days, H1 and M30 2 days, M15 1 day).

About 1.2 million rules a market. **Markets: xau, eurusd, gbpusd** (the owner's three), each alone and pooled; data-quality
exclusions from `research/edge/data-quality/quality.json` as grid 2. No placebo this time (the grids 1 and 2 placebos matched
the chance rate); reported against the chance rate instead.

## Bar

Unchanged: discovery 2020-23 (n >= 100, mean R after costs > 0, month t >= 2); confirmation 2024-now (n >= 50, mean > 0,
month t >= 2 after Holm over every discovery winner); positive at twice the cost. These years have been read by two grids
already: a confirmation here is a hypothesis for data none of them read.
