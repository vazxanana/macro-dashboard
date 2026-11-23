# Grid 6: a Weekly key level, the H4 box and the Daily MSNR call (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run. Research only: nothing live reads it, nothing is placed.
The same shape as `grid5-msnr-box`, one step up the timeframe ladder (Weekly level, H4 box, H4 / H1 trigger, Daily call).

## Question

At a Weekly key level, does an H4 box event (a close out of the box with the level's side, or a false break against it that
closes back in), confirmed by a trigger and read with or against the Daily MSNR direction call, give trades that are positive
before costs in 2010-2014 AND again in 2015-2019? Every combination of the factors below is one cell; every cell is run per
market and pooled.

## Data

- OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
  2009-01-01 to 2019-12-31 (2009 is warm-up: no trade fills before 2010-01-01). H1 and H4 built from them (UTC-aligned
  `resample`), the Daily trading day (`dailyNY`, 17:00 New York).
- OANDA mid UTC daily candles from the same cache, 2007-01-01 to 2019-12-31, used ONLY to build the Weekly candles (so the
  Weekly levels have history from 2007). **Weeks start Monday 00:00 UTC**; a candle dated Saturday or Sunday belongs to the
  week that follows. A Weekly candle runs from the Saturday 00:00 UTC before its Monday to the next Saturday 00:00 UTC (`t`,
  `e`), and is known only at `e` (a fixed time, never the time of its last candle, so a week still forming is never read as
  closed).
- The data-quality exclusions of `research/edge/data-quality/quality.json` (`combo-grid-3` `exclusions`) drop any trade that
  fills inside a listed interval. Costs: `combo-grid-2` `COSTS` (round trip in price units).

## Factors and levels

1. **Direction** (3): the MSNR call of `council/eg-methods.mjs` `direction()` (imported, not edited) run on the Daily trading
   day candles with the Weekly candles as the timeframe above (`keyOf` = the Weekly candle holding the day; `htfSec` = 7 days,
   so a Weekly level counts from its first Daily candle's start + 7 days: at or after the week's real close). Read on the last
   Daily candle CLOSED at the signal time. Levels: `with` (call = the trade's side), `against`, `any` (no condition; includes
   a call of 0).
2. **Weekly key level touched** (5), built by `combo-grid-3` `buildZones` on the Weekly candles (imported, not edited):
   `av` (a V / A turn of the closes, 2 a side), `eg` (an engulf completed within 3 candles, base candle wick to wick), `ef` (an
   engulf zone that failed, serving the other side; the imported rule gives it 20 days unless closed through), `dom`
   (dominant: two candles of one colour, the second closing beyond the first's extreme; zone = the first candle's body), `sd`
   (fresh supply / demand: the origin candle of a Weekly structure break, `buildZones('bar')`, FIRST visit only). A zone
   serves its side from the close that makes it known until a Weekly close through its far side (or 120 Weekly candles, the
   imported life). Touch = the first H4 candle starting at or after the zone is known that trades into it; a visit ends at a
   closed H4 candle wholly outside it; at most 2 visits a zone (`sd`: 1).
3. **H4 box** (2): box = `edgekit` `boxesHL(H4, 2)` (swing low to swing high, 2 candles a side, ended by a close outside).
   Mode `out`: the first box, inside 24 H4 candles from the touch candle, that ends with a close out of it WITH the level's
   side (the breakout candle is the event). Mode `false`: the first box in that window that ends with a close out AGAINST the
   side, followed within 6 H4 candles by a close back inside past the broken edge (that close is the event).
4. **Trigger** (4), from the event H4 candle e: `box` (the event candle itself); `egH4` (the first engulf of the side
   completed within 3 candles, `engulfAt(C, j, 3)`, on H4 candles e .. e+3); `egH1` (the same on H1, on the first 6 H1 candles
   closing at or after the event candle's close); `sbH1` (the first H1 structure break of the side, `edgekit`
   `structure(H1, 2)`, on those 6 H1 candles). The signal time ts = the close of the trigger candle; the trigger candle must
   start before the zone dies.
5. **Entry / stop** (4): entries `mkt` (the open of the first 5-minute candle starting at or after ts) and `limBox` (a limit at
   the box edge: the broken edge for `out`, the edge broken against for `false`); stops `box` (`out`: the box's other side;
   `false`: the extreme of the false break, from the box's breaking H4 candle up to the trigger candle) or `key` (past the
   Weekly zone's far side plus 0.1 x the Weekly ATR(14) of the last Weekly candle closed at ts), each plus half the round
   trip. A limit lives 24 H4 candles (expire = ts + 4 days).
6. **Exit** (5): `1R`, `2R`, `3R`, `trail` (the stop trails 1R behind the best price once +1R is reached), `opp` (a target at
   the nearest Weekly key-level zone of the other side standing at ts beyond the entry, any of the five kinds, when it is 1R
   or more away, else 2R). Every exit is also out at the close of the 5-minute candle 5 days after the fill (the cap
   `combo-grid-3` uses for H4).

No session factor (higher timeframe). Cells: 3 x 5 x 2 x 4 x 4 x 5 = 2,400 per scope; scopes = pooled + the 5 markets.

## Fills and trades

- Market: the open of the first 5-minute candle starting at or after ts; that candle counts fully.
- Limit (NO touch fills): fills only when a 5-minute candle trades THROUGH the limit by half the round trip
  (`dom-trade-through` `findFill(..., 'through', cost / 2)`), at the limit (or a better open); a close past the stop before the
  fill cancels it; on the fill candle only the stop counts. Management: `dom-trade-through` `manage` (stop first when one
  candle holds both; a gap past the stop exits at the open).
- Every trade has its stop on the losing side of its entry (else the run stops with an error); a planned risk under 2 x the
  round trip, or a filled risk under the round trip, is not taken.
- Signals read closed candles only. A cut test on real data (each market cut at five moments) must give the same signals
  before each cut as the full run; it is recorded in result.json. The unit test also changes every candle after a cut.

## Measures and the bar (judged BEFORE costs; after costs beside)

- Month sums of R per cell (calendar months, empty months count as 0); month-sum t.
- **Discovery 2010-2014** (by fill time): n >= 100, mean R > 0, month t >= 2.
- **Confirmation 2015-2019**: n >= 100, mean R > 0, month t >= 2, and Holm over EVERY discovery winner (all scopes) of the
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
