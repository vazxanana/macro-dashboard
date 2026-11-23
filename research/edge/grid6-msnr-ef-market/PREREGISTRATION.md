# Grid 6: failed engulfs (EF) as the signal, market entries (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run. Research only: nothing live reads it, nothing is placed.

## Question

When an engulf zone is closed through on its far side (it failed: an EF, which then serves the other side), does a market entry
with the EF, taken either on the EF candle itself or when price comes back into the EF zone and a lower-timeframe confirmation
forms, give trades that are positive before costs in 2010-2014 AND again in 2015-2019? Every combination of the factors below
is one cell; every cell is run per market and pooled.

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
2009-01-01 to 2019-12-31 (2009 is warm-up only: no trade fills before 2010-01-01). Timeframes from the 5-minute candles: M15,
H1, H4 (`combo-grid-3` `frames`, UTC-aligned) and the Daily trading day (`dailyNY`, 17:00 New York). The data-quality
exclusions (`combo-grid-3` `exclusions`) drop any trade that fills inside a listed interval. Costs: `combo-grid-2` `COSTS`
(round trip in price units).

## The EF

On the zone timeframe, `council/eg-methods.mjs` `zones(C, tf, 3)` (imported, not edited): an engulf completed within 3
candles, the zone = the base candle wick to wick. A zone that a later candle CLOSES through on its far side has failed (`fail`,
`fi`); from that close it is an EF serving the OTHER side (`d = -dir`). It stops serving once a candle of the zone timeframe
closes back through it (`turnBack`, imported) or 20 days after the fail, whichever comes first. Candles are handed to
`zones` / `turnBack` with `time = close - timeframe length`, so every `at`, `fail` and `back` is the real close of a candle.

## Factors and levels

1. **Zone timeframe** (3): `D1`, `H4`, `H1`.
2. **What happens next / trigger** (4):
   - `ef`: the EF candle itself: the signal time ts = the close of the candle that failed the zone. (No confirmation
     timeframe and no visit: these cells are counted once, under conf `-` and visit `-`.)
   - `eg`, `sb`, `box`: price comes back into the EF zone after the fail (the first candle of the confirmation timeframe that
     STARTS at or after the fail close and trades into [bot, top]), then on the confirmation timeframe, from that return
     candle, within 24 candles of it, the first: `eg` engulf of the EF's side (`engulfAt(C, j, 3)`); `sb` structure break of
     the EF's side (`edgekit` `structure(T, 2)`); `box` close out of a box with the EF's side (`edgekit` `boxesHL(T, 2)`, the
     breakout candle). The search stops at a confirmation candle that closes through the EF zone's far side, and the trigger
     candle must start before the EF stops serving. ts = the close of the trigger candle.
3. **Confirmation timeframe** (2): one or two steps lower on the ladder D1, H4, H1, M15, M5: D1 -> H4 / H1, H4 -> H1 / M15,
   H1 -> M15 / M5.
4. **Daily MSNR call** (3): `council/eg-methods.mjs` `direction()` run on H4 with the Daily trading day as the timeframe above
   (the same reading as `grid5-msnr-box` `h4Calls`, imported), read on the last H4 candle CLOSED at ts: `with`, `against`, `any`.
5. **Visit** (3): `first` (the first return after the fail), `later` (the second or third return; a visit ends at a closed
   confirmation candle wholly outside the zone; at most 3 visits an EF), `any`.
6. **Session** (3): UTC hour of ts: `london` 07-12, `ny` 12-17, `other`.
7. **Stop** (2): `zone` = past the EF zone's far side by half the round trip + 0.1 x ATR(14) of the zone timeframe known at
   ts; `swing` = past the confirmation swing: the lowest low (a buy) / highest high (a sell) of the confirmation candles from
   the return candle to the trigger candle (`ef` trigger: the EF candle's own extreme), by half the round trip.
8. **Exit** (5): `1R`, `2R`, `3R`, `trail` (the stop trails 1R behind the best price once +1R is reached), `opp` (a target at
   the near edge of the NEAREST engulf zone of the zone timeframe of the other side standing at ts beyond the entry, only when
   it is 1R or more away; otherwise this exit takes no trade). Every exit is also out at the close of the 5-minute candle
   `cap` after the fill: D1 5 days, H4 3 days, H1 2 days.

Cells per scope: 3 x (3 x 2 x 3 x 3 + 1) x 3 x 2 x 5 = 5,130 (trigger x conf x call x visit for eg / sb / box, plus the `ef`
row); scopes = pooled + the 5 markets.

## Fills and trades

- Market entries only: the open of the first 5-minute candle starting at or after ts; that candle counts fully. Management:
  `dom-trade-through` `manage` (stop first when one candle holds both; a gap past the stop exits at the open).
- Every trade has its stop on the losing side of its entry (else the run stops with an error); a planned risk (from the
  trigger close) under 2 x the round trip, or a filled risk under the round trip, is not taken.
- Signals read closed candles only. A cut test on real data (each market cut at five moments) must give the same signals
  before each cut as the full run; it is recorded in result.json.

## Measures and the bar (judged BEFORE costs; after costs beside)

- Month sums of R per cell (calendar months, empty months count as 0); month-sum t.
- **Discovery 2010-2014** (by fill time): n >= 100, mean R > 0, month t >= 2.
- **Confirmation 2015-2019**: n >= 100, mean R > 0, month t >= 2, and Holm over EVERY discovery winner (all scopes) of the
  one-sided p of the confirmation month t, < 0.05.
- Against chance: the discovery count against 2.3 % (one-sided t >= 2) of the cells tested, and the raw confirmation count
  against 2.3 % of the discovery winners.
- **Side-flipped placebo**: every trade is also taken the other way: side flipped, the stop mirrored around the trigger
  candle's close (the same stop distance), the same exits (the `opp` target from the flipped side's opposite zones), fills
  and costs. The placebo cells go through the same bar and their counts are reported beside.

## Verdict

- **PASS**: at least one cell is confirmed after Holm AND the real cells confirm more cells than the placebo.
- **INCONCLUSIVE**: cells are confirmed, but the placebo confirms as many or more.
- **FAIL**: no cell is confirmed after Holm.

A pass is a before-cost tilt in a cell on 2010-2019, never an edge: nothing changes on any desk from it, and its after-cost
line is reported beside. No factor, level or threshold changes after the first run.
