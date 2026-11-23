# Grid 6: boxes inside boxes down the timeframe ladder (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run. Research only: nothing live reads it, nothing is placed.

## Question

When a box on a lower timeframe closes out (or makes a false break and closes back in) in the side the box of a higher
timeframe last closed out to, read with the middle timeframe's box, do the trades show a before-cost tilt in 2010-2014 AND again
in 2015-2019? Every combination of the factors below is one cell; every cell is run per market and pooled.

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
2009-01-01 to 2019-12-31 (2009 is warm-up only: no trade fills before 2010-01-01). Timeframes built from the 5-minute candles
by `combo-grid-3` `frames` (imported, not edited): M15, H1, H4 (UTC-aligned) and the Daily trading day (17:00 New York). The
data-quality exclusions (`combo-grid-2` `exclusions`) drop any trade that fills inside a listed interval. Costs: `combo-grid-2`
`COSTS` (round trip in price units).

## The box

On every timeframe a box = `edgekit` `boxesHL(T, 2)`: from the last confirmed swing low to the last confirmed swing high (2
candles a side), starting at the candle that confirms the later of the two; it closes out when a CLOSED candle closes above its
high (side +1) or below its low (side -1). That close is known at the end of its candle. The next box takes swings made after the
box before.

## Chains (3)

`D1 -> H4 -> H1`, `H4 -> H1 -> M15`, `H1 -> M15 -> M5` (top -> middle -> bottom).

## The signal

A bottom-box event at bottom candle j (closed); the signal time ts = the close of the event candle:
- `out`: a bottom box closes out at j with side d;
- `false`: a bottom box closes out AGAINST d at j0, and a candle j within 6 candles after j0 closes back inside past the broken
  edge (buy: a close above the broken low); the extreme of the break (j0 .. j) is kept.
The trade side d is ALWAYS the side of the last top box that closed out by ts (no top close-out yet: no signal). No other
direction filter (no trend filter).

## Factors and levels

1. **Chain** (3), above.
2. **Top position** (2 + any): the close of the event candle c0 is `inside` the last closed-out top box (its low <= c0 <= its
   high) or `outside` it.
3. **Middle** (2 + any): the last middle box that closed out by ts closed out with d (`yes`) or not / none yet (`no`).
4. **Trigger** (2): `out` or `false` (above).
5. **Size** (2 + any): the bottom box's range (high - low) against the range of the middle box used in 3 (none: `over`):
   `small` under a third, `big` otherwise.
6. **Session** (3 + any): UTC hour of ts: `london` 07-12, `ny` 12-17, `other`.
7. **Entry** (2): `mkt` (the open of the first 5-minute candle starting at or after ts) or `lim` (a limit at the bottom box's
   broken edge: `out` the edge broken with d, `false` the edge broken against d; lives 24 bottom candles).
8. **Stop** (2), each plus half the round trip: `bot` past the bottom box's other side (`out`: the opposite edge; `false`: the
   extreme of the false break, since the box's other side lies beyond the entry), or `mid` past the middle box's other side (the
   middle box of 3: its low for a buy, its high for a sell; none, or not on the losing side of the entry: no trade).
9. **Exit** (5): `1R`, `2R`, `3R`, `trail` (the stop trails 1R behind the best price once +1R is reached), `top` (a target at
   the far edge of the top box of 2, buy: its high; when it is under 1R from the entry, or behind it, the target is 2R). Every exit
   is also out at the close of the 5-minute candle CAP after the fill: 5 days for D1 -> H4 -> H1, 2 days for H4 -> H1 -> M15,
   1 day for H1 -> M15 -> M5.

Stored cells: 3 x 2 x 2 x 2 x 2 x 3 x 2 x 2 x 5 = 2,880; with the `any` levels 3 x 3 x 3 x 2 x 3 x 4 x 2 x 2 x 5 = 12,960 cells
a scope, scopes = pooled + the 5 markets.

## Fills and trades

- Market: the open of the first 5-minute candle starting at or after ts; that candle counts fully.
- Limit (NO touch fills): fills only when a 5-minute candle trades THROUGH the limit by half the round trip
  (`dom-trade-through` `findFill(..., 'through', cost / 2)`), at the limit (or a better open); a close past the stop before the
  fill cancels it; on the fill candle only the stop counts. Management: `dom-trade-through` `manage` (stop first when one candle
  holds both; a gap past the stop exits at the open).
- Every trade has its stop on the losing side of its entry (else the run stops with an error); a planned risk under 2 x the
  round trip, or a filled risk under the round trip, is not taken.
- Signals read closed candles only. A cut test on real data (each market cut at five moments) must give the same signals before
  each cut as the full run; recorded in result.json. The test file also checks a cut and a changed future on a seeded market.

## Measures and the bar (judged BEFORE costs; after costs beside)

- Month sums of R per cell (calendar months, empty months count as 0); month-sum t.
- **Discovery 2010-2014** (by fill time): n >= 100, mean R > 0, month t >= 2.
- **Confirmation 2015-2019**: n >= 100, mean R > 0, month t >= 2, and Holm over EVERY discovery winner (all scopes) of the
  one-sided p of the confirmation month t, < 0.05.
- Against chance: the discovery count against 2.3 % (one-sided t >= 2) of the cells tested, and the raw confirmation count
  against 2.3 % of the discovery winners.
- **Side-flipped placebo**: every trade is also taken the other way: side flipped, entry and stop mirrored around c0 (market:
  the same stop distance), the `top` exit at the same R multiple as the real trade, the same fills, exits and costs. The placebo
  cells go through the same bar and their counts are reported beside.

## Verdict

- **PASS**: at least one cell is confirmed after Holm AND the real cells confirm more cells than the placebo.
- **INCONCLUSIVE**: cells are confirmed, but the placebo confirms as many or more.
- **FAIL**: no cell is confirmed after Holm.

A pass is a before-cost tilt on 2010-2019, never an edge: nothing changes on any desk from it, and its after-cost line is
reported beside. No factor, level or threshold changes after the first run.
