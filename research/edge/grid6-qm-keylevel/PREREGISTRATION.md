# Grid 6: the QM reversal at a higher-timeframe key level (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run. Research only: nothing live reads it, nothing is placed.

## Question

When a QM reversal (a quasimodo: for a sell, a higher high is made, then a candle closes below the swing low before it) forms
on H1, M15 or M5 right after price touched a Daily or H4 key level of the reversal's side, does trading it give trades that are
positive before costs in 2010-2014 AND again in 2015-2019? Every combination of the factors below is one cell; every cell is
run per market and pooled.

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
2009-01-01 to 2019-12-31 (2009 is warm-up only: no trade fills before 2010-01-01). Timeframes built from the 5-minute candles
by `combo-grid-3` `frames` (imported, not edited): M15, H1, H4 (UTC-aligned), the Daily trading day (`dailyNY`, 17:00 New
York) and the week of those days. The data-quality exclusions (`combo-grid-3` `exclusions`) drop any trade that fills inside a
listed interval. Costs: `combo-grid-2` `COSTS` (round trip in price units).

## The QM

`edgekit` `qms(T, 3)` on the QM timeframe T (imported, not edited). A sell: swing low L0, swing high H1 (the left shoulder),
a higher swing low L1, then price trades above H1 (the highest high after it is the head), then a candle CLOSES below L1: that
close is the break (signal time ts = the break candle's close). A buy mirrors it. Swings are 3 candles a side and are used
only once confirmed.

## Factors and levels

1. **Key level** (10): built on CLOSED candles; a zone serves one side from the close that makes it known until a close of
   its timeframe through its far side (or 120 of its candles).
   - Daily and H4 (8 = 2 timeframes x 4 kinds), by `combo-grid-3` `buildZones` (imported, not edited): `av` (a V / A turn
     of the closes, 2 a side; zone from the close to the wick), `eg` (an engulf completed within 3 candles; the base candle
     wick to wick), `ef` (an engulf zone that failed, serving the other side for 20 days), `dom` (two candles of one colour,
     the second closing beyond the first's extreme; zone = the first candle's body).
   - `pd`: the previous trading day's high (serves sells) and low (serves buys), live for the whole next trading day.
   - `pw`: the previous week's high and low (weeks of Daily trading days), live for the whole next week.
   - **Touched**: one of the last 12 candles of the QM timeframe up to and including the break candle starts at or after the
     zone is known, before it ends, and trades into it (low <= top and high >= bottom; a `pd` / `pw` level counts when the
     candle's range reaches it). The zone must serve the QM's side (a sell QM needs a resistance zone). One QM counts once
     in each key-level cell it touched, whatever the number of zones of that kind.
2. **QM timeframe** (3): H1, M15, M5.
3. **Trend context** (3): the structure side (`edgekit` `structure(L, 3)`) of the key level's timeframe L (Daily for `pd`,
   the week for `pw`) on the last L candle CLOSED at ts. `against` = the side is the other way from the QM; `with` = the
   same way; `any` = no condition (a side of 0 counts only here).
4. **Sweep** (3): `yes` = the head traded beyond a swing of the QM timeframe (3 a side; a swing high for a sell) that was
   confirmed before the head's candle, made within the 48 candles before it, and is beyond the left shoulder; `no` = not;
   `any`.
5. **Session** (4): UTC hour of ts: `london` 07-12, `ny` 12-17, `other`, `any`.
6. **Entry** (2): `mkt` = market at the open of the first 5-minute candle starting at or after ts (that candle counts fully);
   `lim` = a limit at the left shoulder level, filled only when a 5-minute candle trades THROUGH it by half the round trip
   (`dom-trade-through` `findFill(..., 'through', cost / 2)`, never a touch fill), at the limit or a better open; it lives
   24 candles of the QM timeframe and is cancelled by a 5-minute close past the stop before it fills; on the fill candle only
   the stop counts.
7. **Exit** (5): `1R`, `2R`, `3R`, `mm` (measured move: the break candle's low for a sell, high for a buy, projected 1:1 by
   the distance from the head to it; as R from the planned entry, taken as 1R when it is under 1R), `trail` (the stop trails
   1R behind the best price once +1R is reached). Every exit is also out at the close of the 5-minute candle 2 days after
   the fill. Management: `dom-trade-through` `manage` (stop first when one candle holds both; a gap past the stop exits at the
   open).

**Stop**: past the QM's extreme (the head) by half the round trip. Every trade has its stop on the losing side of its entry
(else the run stops with an error). A planned risk under 2 x the round trip, or a filled risk under the round trip, is not
taken. Each QM gives one trade per entry (the cells only split them).

Reported cells: 10 x 3 x 3 x 3 x 4 x 2 x 5 = 10,800 per scope; scopes = pooled + the 5 markets.

## Measures and the bar (judged BEFORE costs; after costs beside)

- Month sums of R per cell (calendar months by fill time, empty months count as 0); month-sum t.
- **Discovery 2010-2014**: n >= 100, mean R > 0, month t >= 2.
- **Confirmation 2015-2019**: n >= 100, mean R > 0, month t >= 2, and Holm over EVERY discovery winner (all scopes) of the
  one-sided p of the confirmation month t, < 0.05.
- Against chance: the discovery count against 2.3 % of the cells tested, and the raw confirmation count against 2.3 % of the
  discovery winners.
- **Side-flipped placebo**: every trade is also taken the other way: side flipped, entry and stop mirrored around the break
  candle's close (market: the same stop distance), the measured-move target mirrored, the same exits, fills and costs. The
  placebo cells go through the same bar and their counts are reported beside.
- No look-ahead: a cut test on real data (each market cut at five moments) must give the same signals before each cut as the
  full run; recorded in result.json, and an offline test on a seeded market also changes every price after a cut.

## Verdict

- **PASS**: at least one cell is confirmed after Holm AND the real cells confirm more cells than the placebo.
- **INCONCLUSIVE**: cells are confirmed, but the placebo confirms as many or more.
- **FAIL**: no cell is confirmed after Holm.

A pass is a before-cost tilt on 2010-2019, never an edge: nothing changes on any desk from it, and its after-cost line is
reported beside. No factor, level or threshold changes after the first run.
