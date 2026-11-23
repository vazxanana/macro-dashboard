# Wide trend-pullback grid: a higher-timeframe move, a pullback, a break back with the move (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The market cycle the desk reads is: a move on a higher timeframe, a pullback against it one timeframe lower (often to about half
of the move, or into a zone), then a break back with the move on a lower timeframe still. On five markets inside large grids it
landed at chance (`research/edge/grid6-phase-trigger`, `research/edge/h4-pullback-end`). This study asks the same question the
wide way (`research/edge/grid7-wide-core`): 54 cells fixed below, ten markets, discovery 2005-2014 and confirmation 2015 to the
end of October 2026, each cell against a control taken at the same moments. A real tilt of a few hundredths of an R would show.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York
  trading days, `dailyNY`).
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## Chains (two)

| Chain | Move timeframe M | Pullback timeframe P | Trigger timeframe T | Time limit |
|---|---|---|---|---|
| **D1** | 1d | 4h | 1h | 5 days |
| **H4** | 4h | 1h | 15m | 2 days |

Structure on every timeframe = `edgekit.structure(bars, 3)` (a close beyond the last confirmed swing, 3 candles a side; BO or
ChoCh, each swing broken once). Closed candles only.

## The setup (closed candles only; walked one trigger candle at a time)

Order inside one trigger candle j: first every M and P structure event KNOWN (its candle closed) at or before the START of
candle j is applied, then candle j itself is read.

1. **Move.** The last structure event on M sets the move: side d (+1 up, -1 down), the leg's origin O = the lowest low (for an
   up move; highest high for a down move) of M from the broken swing's candle to the break candle, and the leg's start = the
   start of the broken swing's M candle. A new M event (either side) replaces the move and ends any pullback.
2. **Extreme.** X = the highest high (lowest low for a down move) of the T candles from the leg's start, updated candle by candle.
3. **Pullback start.** A structure event on P AGAINST d, known after the move's event, starts a pullback when none is running.
   Its reference is the T candle that holds X at that moment (index xi).
4. **Pullback extreme.** E = the lowest low (highest high for a down move) of the T candles from xi to the current candle.
5. **Move broken.** A T candle that trades at or beyond O ends the move (no trade from it until the next M event).
6. **Trigger.** The FIRST T structure event WITH d after the pullback started (and while the move holds). The pullback then
   ends; a later P event against d starts a new pullback of the same move (X keeps its running value).

**Depth at the trigger** = |X - E| / |X - O|, in three buckets: **shallow** < 0.382, **mid** 0.382 to 0.618, **deep** > 0.618
(always under 1, since a touch of O ends the move).

**Zone touched during the pullback**: on the pullback timeframe P, `combo-grid-3` `buildZones('eg', P)` (engulf zones) and
`buildZones('dom', P)` (dominant zones), imported, of side d. A zone counts when a T candle from xi to the trigger candle trades
into `[bottom, top]`, the zone was known at or before that candle's start, and the candle starts before the zone's end.
Flags: eg touched, dom touched; **zone** = either.

## The trade

- Side s = d. Entry: market, at the open of the first 5-minute candle starting at or after the trigger candle's close.
- Stop: past E by 0.1 x ATR(14) of T at the trigger candle (`dom-trade-through` `atr14`). Every trade has its stop on the losing
  side of the fill; a fill at or past the stop is no trade. A trade whose risk is under the market's round-trip cost is no trade
  (the `grid7-wide-core` rule, the same in every cell).
- Exits (three): **1R**, **2R**, or **ext** = a target at X (the move's extreme), taken only when X is 1R or more beyond the fill
  (else no trade in that exit's cells). The stop, the target, or the close of the 5-minute candle that reaches the time limit
  (table above). A candle that opens past the stop or the target exits at its open; one that holds both is a stop.
- One trade per (market, chain, trigger candle).
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (the demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## The cells (54, fixed here)

2 chains x 3 exits x 9 contexts:

1. **all**: every trigger;
2. - 7. **depth x zone**: shallow / mid / deep, each with a zone touched (**+zone**) and with none (**-zone**);
8. **eg**: an engulf zone touched (any depth);
9. **dom**: a dominant zone touched (any depth).

Each cell pools the ten markets.

## The control (one per cell)

The same pullbacks, the same moments, the move's direction ignored: for each pullback, the FIRST T structure event of EITHER side
after the pullback started (while the move holds) is a control trade in that event's own direction c. Stop: past the extreme on
c's losing side since xi (E when c = d; for c = -d the highest high / lowest low of the T candles from xi to the trigger) by
0.1 x ATR(14) of T; exits 1R, 2R, and ext = X when c = d or O when c = -d (only when 1R or more away). The control's depth and
zone flags are read at its own trigger candle in the same way, so each cell's control holds the control trades with the same
context. When the first break is with the move, the control trade is the real trade (the two sets overlap; the Welch test is the
pre-registered test anyway). A control trade ends nothing: the real trigger is still waited for.

## The bar (judged BEFORE costs; after-cost figures shown beside)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R a trade > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over all 54 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats its own control: Welch t (trade R of the cell against trade R of the control) >= 2 in discovery AND in
   confirmation.

**Verdict**: PASS if at least one cell passes; FAIL if none does. Nothing is adopted from a pass: a passing cell would be a
candidate for its own forward record and an owner decision, never called an edge before that.

## Also reported

- Every cell: n, mean R, month t in both windows, before and after costs; its control's figures and the Welch t.
- The **side-flipped check** of every cell: the same trigger candle and fill, the other side, the stop the same distance on the
  other side of the fill, targets at the same R multiples (1R, 2R, the ext multiple); judged by bars 1-3 (expected: nothing).
- Beside, for the same trigger timeframe: `grid7-wide-fade`'s plain fade cells (M15 and H1, no context, ext stop, all sessions)
  from its result.json (a different trade: fading every break; shown for scale, not tested here).
- Per-market rows for any passing cell.
- A cut test: the signals of several markets computed on candles cut at a date equal the full run's signals known by that date
  (chain, trigger candle, side, stop, depth, zone flags, kind).
- One run, no variants. Do not re-test variants of these cells on these years.
