# Engulf and failed-engulf zones with a ChoCh or EF turn down the ladder (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The owner reads a higher-timeframe engulf zone (or an engulf zone that failed and so turned) as the place to look, a change of
character or a failed engulf one timeframe lower as the sign that price turned there, and the same sign one timeframe lower
again as the moment to enter. `grid7-wide-eg-chain` (engulf on every step) and `grid7-ltf-ef` (the failed engulf alone) found
nothing; neither tested a turn of structure in the middle of the ladder. This study does, on the wide design of
`grid7-wide-core`: few cells fixed here, ten markets, a long discovery and a long confirmation window, two controls.

## Data

- OANDA mid 5-minute candles through the site's candle proxy, the shared cache (`research/edge/_lib/edgekit.mjs`,
  `fetch-cache.mjs`, `EDGE_DATA`), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver start where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York
  trading days), 1w.
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## Ladders

- **A**: higher zone on D1, turn on H4, trigger on H1 (time limit 10 days).
- **B**: higher zone on H4, turn on H1, trigger on M15 (time limit 3 days).

## The higher zone (closed candles only)

Two kinds, pooled, each with its side d:

- **EG**: an engulf zone of side d, `combo-grid-3` `buildZones('eg', Z)` (the base candle of a close beyond it within 3
  candles, `council/eg-methods.mjs` `engulfAt`); serves from the completing close until a close of Z through its far side or 120
  Z candles.
- **EF**: an engulf zone of the other side that failed (a Z close through its far side), turned to side d, `buildZones('ef', Z)`;
  serves from that close for 20 days or until a Z close back through it.

**First return only**: the first middle-timeframe candle (k) starting at or after the zone is known that trades into
`[bottom, top]`, before the zone's end. Only that visit counts.

## The turn (middle timeframe), within 24 middle candles from k (inclusive), before the zone's end

- **ChoCh**: the first middle close beyond the last swing against the move into the zone: for a buy, a close above the latest
  2-a-side swing high (`edgekit.swings(T, 2)`) confirmed before that candle; a sell mirrors.
- **EF**: an engulf zone of the other side on the middle timeframe (`council/eg-methods.mjs` `zones`, 3 candles), completed no
  earlier than 24 middle candles before k, closed through towards d (its fail candle) at or after k.
- **either**: whichever of the two comes first.

A middle close through the higher zone's far side before the turn ends the setup (no trade).

## The trigger (lowest timeframe), within 24 lowest candles after the turn candle's close

- **ChoCh**: the first lowest-timeframe change of character towards d (`edgekit.structure(T, 2)`, an event of kind ChoCh, side d)
  whose candle starts at or after the turn candle's close.
- **EF**: the first lowest-timeframe engulf zone of the other side (3 candles) closed through towards d, its fail candle
  starting at or after the turn candle's close.
- **either** (used only for the MSNR cells below): whichever of the two comes first.

A lowest close through the higher zone's far side before the trigger ends the setup.

## Trade

- Entry: market at the open of the first 5-minute candle starting at or after the trigger candle's close.
- Stop: past the extreme made in the higher zone (the lowest 5-minute low for a buy, highest high for a sell, from the start of
  the return candle k to the trigger candle's close) by 0.1 x ATR(14) of the middle timeframe at the turn candle.
- Every trade has its stop on the losing side of the fill; a fill at or past the stop is no trade; a trade whose risk is under
  the market's round-trip cost is no trade (the same for every cell and control).
- Exits (four): a target at **1R**, **2R**, **3R**, or **opp** = the near side of the nearest higher-timeframe zone of the
  other side (EG or EF) standing at the trigger and ahead of the fill, only when it is 1R or more away (else that trade is not
  in the opp cell); the stop; the close of the 5-minute candle that reaches the time limit. A 5-minute candle that opens past the
  stop or target exits at its open; one that holds both is a stop. The trade engine is `grid7-wide-eg-chain`'s `trade` (imported).
- One trade per (market, ladder, trigger candle, side) within a cell.
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Cells (56)

- **48**: 2 ladders x turn (ChoCh / EF / either) x trigger (ChoCh / EF) x 4 exits, all trades.
- **8**: 2 ladders x the Daily **MSNR** call (with / against the trade's side) x exits 1R and 2R, turn = either and trigger =
  either. The call: `council/eg-methods.mjs` `direction()` (imported) on the 1d candles with the 1w candles above (as
  `grid7-wide-core`'s `dailyCalls`), the call of the last 1d candle closed at the trigger's close; 0 (no call) is in neither.

Each cell pools the ten markets.

## Controls

- **(i) trigger alone**: for each trade of a cell, the lowest-timeframe trigger of the same kind (ChoCh or EF; for the MSNR
  cells the same kind as the real trigger) and side, NOT belonging to any setup of that ladder, nearest in time to the real
  trigger (within 30 days, each used at most once per cell); the same stop rule with the same look-back length as the real
  trade, ATR at the trigger's middle candle, the same exits (opp measured the same way). For the MSNR cells the control trade
  must carry the same call condition.
- **(ii) zone return at market, no turn**: for every zone of the ladder, market entry at the first 5-minute open after the
  return candle k closes, stop past the extreme from k's start to its close + 0.1 ATR(14) of the middle timeframe, the same
  exits; one control set per ladder and exit (and per MSNR condition for the MSNR cells).

## The bar (judged BEFORE costs; after-cost figures shown beside)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R a trade > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over all 56 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats BOTH controls: Welch t (trade R of the cell against trade R of the control) >= 2 in discovery AND in
   confirmation, for control (i) and for control (ii).

**Verdict**: PASS if at least one cell passes; FAIL if none does; INCONCLUSIVE if no cell reaches n >= 300 in both windows.
Nothing is adopted from a pass: a passing cell would be a candidate for its own forward record and an owner decision.

## Also reported

- Every cell: n, mean R, month t in both windows, before and after costs; both controls' figures and the Welch t.
- The **side-flipped placebo** of every cell: the same fill, the other side, the stop the same distance on the other side of
  the fill, the mirrored targets; judged by bars 1-3 (expected: about nothing passes).
- Per-market rows for any passing cell.
- A cut test: the setups of several markets computed on candles cut at a date equal the full run's setups known by that date.
- One run, no variants. Do not re-test variants of these cells on these years.
