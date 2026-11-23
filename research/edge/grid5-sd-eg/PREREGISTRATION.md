# Grid 5: fresh supply / demand zones with a lower-timeframe trigger (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any code of this study runs. Research only: nothing live changes,
nothing is placed, no council file is read, no study or council file is edited.

## Why

The supply / demand order-block zone at the origin of a break leg (the Charts page's "fresh entry zones after BO / iBO", and
the gold terminal's locked S/D zones) has never been tested as a key level with a lower-timeframe confirmation. Combination
grids 1-4 tested other zone kinds (engulf, dominant, A / V, barrier, QM, box) and counted a limit as filled on a touch, which
`research/edge/dom-trade-through` showed flatters a limit by about +0.05R a trade. This grid uses only fills a broker would
give: a market entry at the trigger candle's close, or a limit that price trades THROUGH by half the round trip.

## Data (fixed)

- OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), 2009-01-01 to 2019-12-31 (2009 is
  warm-up only), markets xau, eurusd, gbpusd, usdjpy, audusd. Higher frames from `combo-grid-3` `frames(M5)` (UTC buckets for
  15m / 1h / 4h; D1 = `dailyNY`, 17:00 New York trading days). Trades are counted by fill time: discovery 2010-01-01 ..
  2014-12-31 (60 months), confirmation 2015-01-01 .. 2019-12-31 (60 months). Nothing of 2020 on is read.
- Costs: `research/edge/combo-grid-2/run.mjs` `COSTS` (round trip, price units); data-quality exclusions: its `exclusions()`.

## Key zone: a fresh supply / demand zone (fixed)

On the key timeframe L (D1, H4, H1): every structure break of edgekit `structure(L, 3)` (BO or ChoCh: a close beyond the last
confirmed 3-a-side swing). For a break up: the leg's origin = the candle with the lowest low from the broken swing's candle to
the candle before the break (the first one on ties); the order block = the last bearish candle (close < open) from the origin
back to the broken swing's candle, else the origin candle itself. Demand zone = [min(OB low, origin low), OB high]. A break
down mirrors it (supply zone = [OB low, max(OB high, origin high)], OB = last bullish candle). One zone per OB candle (the first
break that names it). The zone is known at the break candle's close. It is DEAD at the first later L candle that closes through
its far side (below the low of demand, above the high of supply), or after 120 L candles. It is FRESH until the first later
candle that trades into it.

## Grid factors (every level fixed here)

1. Key timeframe -> trigger timeframe (3): D1 -> H1, H4 -> M15, H1 -> M5.
2. Visit (2): `first` = only the first touch of the zone (the fresh touch); `any` = every touch while the zone is alive (at
   most 10 visits). A visit starts at the first trigger-timeframe candle that trades into the zone (starting at or after the
   zone is known) and ends at the first later trigger candle wholly outside it.
3. Trigger on the trigger timeframe T, the first of each kind within 12 T candles from the visit's first touch, while no T
   candle has closed through the zone's far side (4):
   - `eg1`: an engulf with the zone's side completed within 1 candle (`council/eg-methods.mjs` `engulfAt(C, j, 1)`); trigger
     zone = the base candle, wick to wick.
   - `eg3`: the same within 3 candles (`engulfAt(C, j, 3)`).
   - `ef`: an engulf zone of the OTHER side (`combo-grid-3` `egZones(T, 3)`) failing (a close through its far side) at candle j;
     trigger zone = that failed zone.
   - `bo`: a structure break with the zone's side, edgekit `structure(T, 2)` (close beyond the last 2-a-side swing); trigger
     zone = from the extreme since the first touch to the broken level.
4. Cycle stage of the key timeframe at the trigger candle's close (3), read with `research/edge/_lib/phase.mjs`'s stage rule
   (its `stageOf`, applied to the full-history `structure(L, 3)` and `structure(B, 3)` of the timeframe below B: D1 -> H4,
   H4 -> H1, H1 -> M15; candles closed by then only):
   - `pull`: L's side equals the zone's side AND the stage is `pullback` (B broke against that side after L's last break and
     has not broken back with it);
   - `cont`: L's side equals the zone's side AND the stage is `continuation` (B has broken back with it);
   - `any`: no condition.
5. Entry (2): `mkt` = a market entry at the trigger candle's close (fill = that close; managed from the next 5-minute candle);
   `lim` = a limit at the trigger zone's near edge (buy: its high; sell: its low), alive 12 T candles from the trigger close,
   filled only by a 5-minute candle that trades THROUGH it by half the round trip (buy: low <= entry - cost/2), fill price =
   the limit or the candle's open when it opens beyond it; a 5-minute close past the stop before a fill cancels it; on the fill
   candle only the stop counts (`dom-trade-through` `findFill(..., 'through', cost/2)` and `manage`, imported).
6. Stop (2): `zone` = past the key zone's far side by 0.1 x ATR(14) of L (last closed L candle); `trig` = past the trigger
   zone's far side by 0.1 x ATR(14) of T (the trigger candle). Every trade has its stop on the losing side of its entry; a
   variant without one is not built. The planned risk must be at least 2 round trips and the filled risk at least one.
7. Exit (5): `1R`, `2R`, `3R` (fixed targets), `trail` (stop to 1R behind the best price from +1R), `opp` (target = the near
   edge of the nearest ALIVE opposite-side zone of the same key timeframe, known at the decision time, at least 1R beyond the
   entry; a trade with no such zone has no `opp` result). Time limit: D1 10 days, H4 5 days, H1 2 days (close of the 5-minute
   candle that reaches it). A candle holding both stop and target is a stop; a candle opening past a level exits at its open.

3 x 2 x 4 x 3 x 2 x 2 x 5 = 1,440 rules, on each of the five markets and pooled: **8,640 cells**.

## Tests (judged BEFORE costs; after costs reported beside every figure)

- Month-sum t: the cell's R summed per calendar month of the fill (empty months count as 0) over the 60 months of a window.
- Discovery (2010-2014): n >= 100, mean R a trade > 0, month t >= 2.
- Confirmation (2015-2019), for each discovery winner with n >= 50 in 2015-2019: mean > 0, month t >= 2, and its one-sided
  month-sum p, Holm-adjusted over all such discovery winners, < 0.05.
- Verdict: **PASS** = at least one cell confirms; **FAIL** = none confirms; **INCONCLUSIVE** = none confirms but the count of
  winners with raw month t >= 2 in 2015-2019 is more than twice the chance count (2.3 % one-sided of the winners checked)
  AND more than the placebo's count.
- Chance: the count of discovery winners and raw confirmations is reported against 2.3 % (one-sided t >= 2) of the cells
  tested. The cells are strongly correlated; that count is a reference, not a test.
- Placebo (side-flipped): the same zones and visits with the side reversed (a demand zone traded as a sell, triggers of the
  other side, stops beyond the zone's other side, opposite targets mirrored), run through the same grid and the same two
  stages; its counts are reported beside.

## No look-ahead

Zones, visits, triggers, the stage and the fills use only candles closed by the moment they are used. A cut test in
`tests/grid5-sd-eg.test.mjs`: cutting the candles at a time leaves every trade that finished before the cut unchanged.

Never call any cell an edge without its n and t; a confirmed cell is a candidate for its own pre-registered test on other data,
not a live rule.
