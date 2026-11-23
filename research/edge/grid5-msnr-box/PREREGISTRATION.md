# Grid 5: the MSNR direction call, a Daily key level and the working-timeframe box (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run. Research only: nothing live reads it, nothing is placed.

## Question

At a Daily key level, does a working-timeframe box event (a close out of the box with the trade, or a false break against it
that closes back in), confirmed by a trigger and read with or against the MSNR direction call, give trades that are positive
before costs in 2010-2014 AND again in 2015-2019? Every combination of the factors below is one cell; every cell is run per
market and pooled.

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
2009-01-01 to 2019-12-31 (2009 is warm-up only: no trade fills before 2010-01-01). Timeframes built from the 5-minute candles:
M15, H1, H4 (UTC-aligned `resample`) and the Daily trading day (`dailyNY`, 17:00 New York). The data-quality exclusions of
`research/edge/data-quality/quality.json` (`combo-grid-3` `exclusions`) drop any trade that fills inside a listed interval.
Costs: `combo-grid-2` `COSTS` (round trip in price units).

## Factors and levels

1. **Direction** (3): the MSNR call of `council/eg-methods.mjs` `direction()` (imported, not edited) run on H4 candles with
   the Daily trading day as the timeframe above (Daily key levels: V / A turns of the closes, engulf zones, EF, DOM,
   open-close levels; a switch = a tapped Daily level then an external H4 break). Read on the last H4 candle CLOSED at the
   signal time. Levels: `with` (call = the trade's side), `against` (call = the other side), `any` (no condition; includes a
   call of 0).
2. **Key level touched** (5), all Daily, built by `combo-grid-3` `buildZones` on the Daily candles (imported, not edited):
   `av` (a V / A turn of the closes, 2 a side: zone from the close to the wick), `eg` (an engulf completed within 3 candles,
   the base candle wick to wick), `ef` (an engulf zone that failed, serving the other side), `dom` (dominant: two candles of
   one colour, the second closing beyond the first's extreme; zone = the first candle's body), `sd` (a fresh supply / demand
   zone: the origin candle of a Daily structure break, `buildZones('bar')`, FIRST visit only). A zone serves its side from
   the close that makes it known until a Daily close through its far side (or 120 Daily candles). Touch = the first
   working-timeframe candle that trades into the zone; a visit ends at a closed candle wholly outside it; at most 2 visits a
   zone (`sd`: 1).
3. **Working-timeframe box** (2 x 2 = 4): timeframe `H1` or `M15`; box = `edgekit` `boxesHL(T, 2)` (from a swing low to a
   swing high, 2 candles a side, ended by a close outside). Mode `out`: the first box, inside 24 working candles from the
   touch candle, that ends with a close out of it WITH the trade's side (the breakout candle is the event). Mode `false`: the
   first box in that window that ends with a close out AGAINST the trade's side, followed within 6 candles by a close back
   inside past the broken edge (that close is the event).
4. **Trigger** (4), on the working timeframe, from the event candle e: `box` (the event candle itself), `eg1` (the first
   engulf of the trade's side completed by one candle on candles e .. e+6: `engulfAt(C, j, 1)`), `eg3` (the same within 3
   candles: `engulfAt(C, j, 3)`), `sb` (the first structure break of the trade's side, `edgekit` `structure(T, 2)`, on
   candles e .. e+6). The signal time ts = the close of the trigger candle; the trigger candle must start before the zone dies.
5. **Time of day** (3): UTC hour of ts: `london` 07-12, `ny` 12-17, `other`.
6. **Entry / stop** (up to 6): entries `mkt` (the open of the first 5-minute candle at ts), `limBox` (a limit at the box edge:
   the broken edge for `out`, the edge broken against for `false`), `limEg` (a limit at the near edge of the engulf's base
   candle; `eg1` / `eg3` only); stops `box` (`out`: the box's other side; `false`: the extreme of the false break), or `key`
   (past the Daily zone's far side), each plus half the round trip, and `key` also 0.1 x the Daily ATR(14) known at ts.
   A limit lives 24 working candles (expire = ts + 24 x the working timeframe).
7. **Exit** (5): `1R`, `2R`, `3R`, `trail` (the stop trails 1R behind the best price once +1R is reached), `opp` (a target at
   the nearest Daily key-level zone of the other side standing at ts beyond the entry, any of the five kinds, when it is 1R or
   more away, else 2R). Every exit is also out at the close of the 5-minute candle 2 days after the fill.

Cells: 3 x 5 x 4 x 4 x 3 x 6 x 5 = 21,600 per scope (eg-only entries leave some empty), scopes = pooled + the 5 markets.

## Fills and trades

- Market: the open of the first 5-minute candle starting at or after ts; that candle counts fully.
- Limit (NO touch fills): fills only when a 5-minute candle trades THROUGH the limit by half the round trip
  (`dom-trade-through` `findFill(..., 'through', cost / 2)`, buy: low <= entry - cost/2), at the limit (or a better open); a
  close past the stop before the fill cancels it; on the fill candle only the stop counts. Management:
  `dom-trade-through` `manage` (stop first when one candle holds both; a gap past the stop exits at the open).
- Every trade has its stop on the losing side of its entry (else the run stops with an error); a planned risk under 2 x the
  round trip, or a filled risk under the round trip, is not taken.
- Signals read closed candles only. A cut test on real data (the market cut at several moments) must give the same signals
  before each cut as the full run; it is recorded in result.json.

## Measures and the bar (judged BEFORE costs; after costs beside)

- Month sums of R per cell (calendar months, empty months count as 0); month-sum t.
- **Discovery 2010-2014** (by fill time): n >= 100, mean R > 0, month t >= 2.
- **Confirmation 2015-2019**: n >= 50, mean R > 0, month t >= 2, and Holm over EVERY discovery winner (all scopes) of the
  one-sided p of the confirmation month t, < 0.05.
- Against chance: the discovery count against 2.3 % (one-sided t >= 2) of the cells tested, and the raw confirmation count
  against 2.3 % of the discovery winners.
- **Side-flipped placebo**: every trade is also taken the other way: side flipped, entry and stop mirrored around the trigger
  candle's close (market: the same stop distance), the same exits, fills and costs. The placebo cells go through the same
  bar and their counts are reported beside.

## Verdict

- **PASS**: at least one cell is confirmed after Holm AND the real cells confirm more cells than the placebo.
- **INCONCLUSIVE**: cells are confirmed, but the placebo confirms as many or more.
- **FAIL**: no cell is confirmed after Holm.

A pass is a before-cost tilt on 2010-2019, never an edge: nothing changes on any desk from it, and its after-cost line is
reported beside. No factor, level or threshold changes after the first run.
