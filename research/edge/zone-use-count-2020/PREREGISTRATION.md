# Zone use count: does an engulf zone react less with each touch? (pre-registration, 23 Nov 2026)

Written before any figure of this study was computed. Research only: nothing live changes, whatever the result.

## Question

Teachings of engulf-zone trading disagree on how many times a zone may be used: once; twice for an engulf zone (EG) and once
for a failed one (EF); about three times; three to five times; or until a candle closes through it. The question here is
whether the reaction of a zone gets weaker with each touch. The difference between touch numbers is the question; the usual
bar for a rule is reported beside it.

## Zones (unchanged from `research/edge/combo-grid/run.mjs`, imported, not edited)

- `buildZones('eg', L)`: the engulf completed within three candles; the zone is the first (base) candle, wick to wick; it
  ends at the first close through its far side or after 120 candles of its timeframe.
- `buildZones('ef', L)`: an EG zone that failed (closed through), turned to serve the other side from the failing close; it
  ends at a close back through it or 20 days later.
- Zone timeframes: H4 and H1 (the 5-minute OANDA mid candles resampled; `frames` of combo-grid).

## Touches

- Counted on the timeframe one step below the zone (the first chain of the combo grid for each): H4 zones on H1 candles,
  H1 zones on 15-minute candles, from the first such candle that starts at or after the zone is known, until the zone ends.
- A touch starts with the first candle that overlaps the zone (low at or below its top and high at or above its bottom) and
  ends with the next CLOSED candle wholly outside it. The next overlapping candle is the next touch. Touches are numbered
  1, 2, 3, ... per zone with no cap (touches before 2020 count in the numbering; only trades filled from 2020 are scored).

## The trade, the same on every touch

- A limit at the zone's near edge (top for a buy zone, bottom for a sell zone), resting from the start of the touch's first
  candle (equivalent to an order resting since the previous touch ended: every candle in between is wholly outside); it
  expires at the end of the touch.
- Stop past the far side by half the market's round-trip cost. Every trade has its stop on the losing side.
- Target 2R. Out at the close of the 5-minute candle that reaches 5 days after the fill (H4 zones) or 2 days (H1 zones).
- Fills and exits on 5-minute candles (combo-grid's `multi`: on the fill candle only the stop counts; a stop or target gapped
  through fills at the open; a 5-minute close past the stop before the fill cancels the order).
- A zone whose planned risk (zone height + half the cost) is under twice the round-trip cost gives no trade (cost over 0.5R).
- Every touch is traded on its own (no one-position rule): each touch is one observation.
- R after costs = R before costs - round-trip cost / risk. Costs: `COSTS` of `research/edge/combo-grid-2/run.mjs`.
- Trades whose fill falls in a bad interval of `research/edge/data-quality/quality.json` (combo-grid-2 `exclusions`) are dropped.

## Markets and window

xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy cadjpy euraud nas100 spx500 de40, all
pooled (the last eight have candles from 2019 only). Candles loaded from 2019-03-01 for the zones' history; trades scored
with fills from 2020-01-01 to the last candle. Discovery 2020-2023, confirmation 2024 to now.

## Tests (pre-registered)

Groups by touch number: 1, 2-3, 4+ (H4 and H1 zones pooled, all markets pooled), for EG and EF separately.

- T1-EG: mean R after costs of touch 1 minus touches 2-3, EG zones. Welch t on per-trade R, whole window 2020-now.
- T2-EG: touches 2-3 minus touches 4+, EG zones.
- T1-EF and T2-EF: the same for EF zones.
- Two-sided p from the Welch t, Holm over the four. A difference HOLDS when its Holm p < 0.05 and the difference has the same
  sign in discovery (2020-2023) and confirmation (2024-now). A positive difference = the reaction weakens with use.
- Reported for each test: the difference and Welch t in each half, and the same difference before costs.

The bar for a rule (reported for the six groups EG/EF x touch 1 / 2-3 / 4+): PASS only if discovery n >= 100, mean R after
costs > 0, month-sum t >= 2; confirmation n >= 50, mean R > 0, month-sum t >= 2 with a one-sided p that survives Holm over
the six groups; mean R still > 0 at twice the cost (confirmation). Month-sum t = t of calendar-month sums of R, months with no
trade counted as 0 (48 discovery months, 2024-01 to 2026-11 confirmation).

Descriptive only (no verdict): each touch number 1, 2, 3, 4, 5, 6+ with n, win rate, mean R before and after costs and
month-sum t, for EG and EF; the same split by zone timeframe (H4, H1) and by market.

## Cut test

Run once on the real candles of one market: every trade whose exit is before a cut date must be identical when the candles
after the cut are removed (zones, touch numbers, fills, exits). The test file also runs it on synthetic candles.

## Caveats known in advance

- Later touches exist only for zones that survived the earlier ones (a zone closed through on touch 1 has no touch 2): that
  selection is part of what "use count" means, not a defect.
- An EG zone lives at most 120 candles (20 days on H4, 5 days on H1) and an EF zone 20 days, so high touch numbers are rare
  and come from long-lived zones.
- Touches of one zone and trades of correlated markets are not independent; the per-trade Welch t overstates the evidence,
  the month-sum t of each group is reported beside it.
