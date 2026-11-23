# Grid 6: session ranges inside the Daily structure (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run. Research only: nothing live reads it, nothing is placed.

## Question

When London (07-12 UTC) or New York (12-17 UTC) breaks and holds, or sweeps and reclaims, the Asia range, the previous
trading day's range or the previous New York afternoon's range, read with a Daily key level, the MSNR direction call and the
H1 box, does any combination give trades that are positive before costs in 2010-2014 AND again in 2015-2019? Every
combination of the factors below is one cell; every cell is run per market and pooled.

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
2009-01-01 to 2019-12-31 (2009 is warm-up only: no trade fills before 2010-01-01). Timeframes built from the 5-minute
candles: M15, H1, H4 (UTC-aligned `resample`) and the Daily trading day (`dailyNY`, 17:00 New York). The data-quality
exclusions (`combo-grid-2` `exclusions`) drop any trade that fills inside a listed interval. Costs: `combo-grid-2` `COSTS`
(round trip in price units).

## Ranges (3), per UTC weekday D

- `asia`: high and low of the 5-minute candles starting in [D 00:00, D 07:00) UTC; at least 60 of the 84 candles.
- `prev`: high and low of the last Daily trading day (`dailyNY`) that closed at or before D 07:00 UTC.
- `nypm`: high and low of the 5-minute candles in [P 17:00, P 21:00) UTC, P = the previous UTC weekday that has candles;
  at least 30 of the 48 candles.
A range with a high not above its low is skipped. Every range is complete before 07:00 UTC of D.

## Events (2) in a window (2), on M15 candles (UTC-aligned) that START in the window

Windows: `london` 07:00-12:00 UTC, `ny` 12:00-17:00 UTC. For each range, window and side, only the FIRST event of each kind:
- `hold` (break and hold): two consecutive M15 closes beyond the edge (above the high: side buy; below the low: side sell),
  both candles in the window, the close before them NOT beyond that edge (a fresh break). Event candle = the second close.
- `sweep` (sweep and reclaim): an M15 candle in the window whose wick goes beyond the edge while the close before it was not
  beyond, then a close back inside past that edge on that candle or within the next 2 candles. Side = against the sweep (a
  wick above the high then a close back below it: sell). Event candle = the reclaim close.

## Context factors (read on candles closed at the signal time ts)

1. **Daily key level touched today** (3: `yes` / `no` / `any`): Daily zones of kinds `av`, `eg`, `dom` (`combo-grid-3`
   `buildZones` on the Daily trading days, imported, not edited) that serve the trade's side; `yes` = some 5-minute candle
   from D 00:00 UTC up to ts traded into such a zone while it stood (known: zone `at` <= the candle's start; not yet ended).
2. **MSNR call** (3: `with` / `against` / `any`): `council/eg-methods.mjs` `direction()` (imported, not edited) on H4 with the
   Daily trading day as the timeframe above (as in grid 5), read on the last H4 candle closed at ts. `any` includes a call of 0.
3. **H1 box state** (4: `inside` / `outWith` / `outAgainst` / `any`): `edgekit` `boxesHL(H1, 2)`; the latest box that had
   formed by the last H1 candle closed at ts: not yet closed out = `inside`; closed out in the trade's side = `outWith`;
   the other way = `outAgainst`.

## Confirmation (3), on M15 from the event candle e

`none` (ts = the event candle's close), `eg` (the first engulf of the trade's side completed within 3 candles,
`engulfAt(C, j, 3)`, on candles e .. e+4), `sb` (the first structure break of the trade's side, `edgekit` `structure(M15, 2)`,
on candles e .. e+4). ts = the close of the confirmation candle.

## Entry (2), stop (2), exit (5)

- Entries: `mkt` (the open of the first 5-minute candle starting at or after ts), `lim` (a limit at the range edge: the
  broken edge for `hold`, the swept edge for `sweep`; lives 8 M15 candles after ts).
- Stops: `range` (past the range's side behind the trade: a buy's low, a sell's high, plus half the round trip); `ext`
  (past the event's extreme: the lowest low (a buy) / highest high (a sell) of the M15 candles from the first event candle
  (the first close beyond for `hold`, the sweep candle for `sweep`) to the confirmation candle, plus 0.1 x the Daily ATR(14)
  of the last closed trading day).
- Exits: `1R`, `2R`, `range` (a target at the range's other side for `sweep`; for `hold` the broken edge plus the range's
  height in the trade's direction, a measured move; a target under 0.5R from the fill: no trade in that exit), `close21`
  (held to 21:00 UTC with the stop only), `trail` (the stop trails 1R behind the best price once +1R is reached). EVERY exit
  is also out at the close of the 5-minute candle ending at 21:00 UTC of the fill day.
- A planned risk under 2 x the round trip, or a filled risk under the round trip, is not taken. Every trade has its stop on the
  losing side of its entry (else the run stops with an error).

Cells: 3 ranges x 2 events x 2 windows x 3 key x 3 call x 4 box x 3 confirmations x 2 entries x 2 stops x 5 exits = 25,920 per
scope; scopes = pooled + the 5 markets (155,520 in all).

## Fills and management

- Market: the open of the first 5-minute candle starting at or after ts; that candle counts fully.
- Limit (NO touch fills): fills only when a 5-minute candle trades THROUGH the limit by half the round trip
  (`dom-trade-through` `findFill(..., 'through', cost / 2)`), at the limit (or a better open); a close past the stop before the
  fill cancels it; on the fill candle only the stop counts. Management: `dom-trade-through` `manage` (stop first when one
  candle holds both; a gap past the stop exits at the open), with the deadline at 21:00 UTC.
- Signals read closed candles only. A cut test on real data (each market cut at five moments) must give the same signals
  before each cut as the full run; it is recorded in result.json.

## Measures and the bar (judged BEFORE costs; after costs beside)

- Month sums of R per cell (calendar months, empty months count as 0); month-sum t.
- **Discovery 2010-2014** (by fill time): n >= 100, mean R > 0, month t >= 2.
- **Confirmation 2015-2019**: n >= 100, mean R > 0, month t >= 2, and Holm over EVERY discovery winner (all scopes) of the
  one-sided p of the confirmation month t, < 0.05.
- Against chance: the discovery count against 2.3 % (one-sided t >= 2) of the cells tested, and the raw confirmation count
  against 2.3 % of the discovery winners.
- **Side-flipped placebo**: every trade is also taken the other way: side flipped, entry, stop and the `range` target mirrored
  around the confirmation candle's close (market: the same stop distance), the same exits, fills and costs. The placebo cells
  go through the same bar and their counts are reported beside.

## Verdict

- **PASS**: at least one cell is confirmed after Holm AND the real cells confirm more cells than the placebo.
- **INCONCLUSIVE**: cells are confirmed, but the placebo confirms as many or more.
- **FAIL**: no cell is confirmed after Holm.

A pass is a before-cost tilt on 2010-2019, never an edge: nothing changes on any desk from it, and its after-cost line is
reported beside. No factor, level or threshold changes after the first run.
