# Grid 6: the dominant zone with a confirmation and a market entry (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any code of this study runs. Research only: nothing live changes,
nothing is placed, no council file is read.

## Why

`dom-zone-holdout`, `dom-placebo` and `dom-trade-through` showed that the dominant-zone (DOM) limit's tilt before costs came
mostly from touch fills on mid candles: with a fill half the round trip through the limit it fell to about +0.01R a trade and
vanished in 2015-2019. The question here: does the DOM zone work once there is NO resting limit at all (a market entry at the
next 5-minute open after a confirmation candle closes) and a confirmation on a lower timeframe is required?

## Data (fixed)

- OANDA mid 5-minute candles from the edgekit cache, xau, eurusd, gbpusd, usdjpy, audusd; candles from 2009 for warm-up;
  trades whose FILL is in 2010-01-01 .. 2019-12-31. Discovery = fills in 2010-2014, confirmation = fills in 2015-2019.
  Higher frames from combo-grid-3 `frames(M5)` (D1 = 17:00 New York trading days). Exclusions: combo-grid-2 `exclusions`
  (a trade whose fill falls in an excluded interval is dropped). Costs: combo-grid-2 `COSTS` (round trip, price units).

## The zone

combo-grid-3 `buildZones('dom', L)` unchanged: two consecutive candles of one colour on the zone timeframe, the second closing
beyond the first's extreme; zone = the first candle's body; side = their colour; known at the second candle's close; it ends
at the first zone-timeframe close through its far side or after 120 zone candles.

## Grid cells (6 x 2 x 5 x 3 x 4 x 2 x 4 = 5,760)

1. Chain (zone timeframe > confirmation timeframe): D1 > H4, D1 > H1, H4 > H1, H4 > M15, H1 > M15, H1 > M5.
2. Visit: the first or the second touch of the zone, found by combo-grid-3 `signalsFor` (trigger NONE rows): a touch = a
   confirmation-timeframe candle trading into the zone after the zone is known; a visit ends at a closed candle wholly outside.
3. Confirmation, looked for on the confirmation timeframe from the touch candle through the next 11 candles (12 in all), and
   only until a candle CLOSES beyond the zone's far side (that ends the visit with no trade); the first one counts:
   - `none` (control): the touch candle itself (no trade when it closes beyond the far side).
   - `eg`: an engulf of the zone's side completed by the candle (council/eg-methods.mjs `engulfAt`, span 3).
   - `bo`: a structure break with the side (edgekit `structure(T, 2)`, a BO or a ChoCh) at that candle.
   - `box`: a box close-out with the side (edgekit `boxesHL(T, 2)`: a close beyond the box between a swing low and a swing
     high) at that candle.
   - `rej`: a rejection candle: it trades into the zone, its wick on the zone's side is over 60 % of its range, and it closes
     back out of the zone on the side of the trade (above the zone's top for a buy, below its bottom for a sell).
4. Daily MSNR call (council/eg-methods.mjs `direction()` on the D1 candles with weekly key levels, as combo-grid-3
   `msnrCalls`; the call of the last D1 candle closed at the decision time): `with` (call = side), `against` (call = -side),
   `any`.
5. Session of the decision time (the confirmation candle's close, UTC): `london` 07:00-11:59, `ny` 12:00-20:59, `other` the
   rest, `any`.
6. Stop: `zone` = the far side -/+ (COSTS/2 + 0.25 x ATR(14) of the last closed zone-timeframe candle); `swing` = past the
   extreme of the confirmation-timeframe candles from the touch through the confirmation candle, -/+ COSTS/2.
7. Exit: fixed 1R, 2R, 3R target, or `trail` (stop moved to 1R behind the best price once 1R up), all with a time cap of
   10 days (D1 zone), 5 days (H4), 2 days (H1), closed at the cap candle's close. Management = combo-grid-3 `multi` with a
   market order (the fill candle counts in full; a candle holding stop and target is a stop; gaps exit at the open).

Entry: a MARKET order at the open of the first 5-minute candle starting at or after the confirmation candle's close. No
resting limit anywhere, so no touch-fill question. A trade is skipped when that open is already at or past the stop, or the
risk at the fill is under 2 x the round trip. Every trade has its stop on the losing side; the run throws if one does not.

## The bar (judged BEFORE costs; after costs reported beside)

For each cell: R a trade before costs, month-sum t over every calendar month of the half (empty months count as 0).
- Discovery pass: n >= 100, mean R > 0 and month t >= 2 on 2010-2014.
- Confirmation: each discovery pass is tested on 2015-2019 (n >= 100, mean > 0, month t >= 2); its one-sided p from the
  month t; Holm over all confirmation tests; a cell PASSES when its Holm p < 0.05 and the three conditions hold.
- Reported beside: the expected number of discovery passes by chance (cells with n >= 100 x 0.025) and of confirmation
  passes (discovery passes x 0.025); the same grid with every trade's side flipped (placebo: same time, side reversed, the
  stop at the same distance from the decision candle's close on the other side), its discovery and full pass counts.
- Verdict: PASS = at least one cell passes and the placebo passes fewer cells; INCONCLUSIVE = cells pass but the placebo
  passes as many or more; FAIL = no cell passes.

## No look-ahead

The zone, the touch, every confirmation, the ATR, the Daily call and the session read candles closed at the decision time
only; the entry is the next 5-minute open. `tests/grid6-dom-confirm.test.mjs` cuts the candles at a decision time and checks
the decision does not change.

A grid of 5,760 cells reads the same data many times: a pass is a hypothesis for its own test on other data, never an edge on
its own. Never call any result an edge without its n and t.
