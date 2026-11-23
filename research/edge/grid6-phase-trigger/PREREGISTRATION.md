# Grid 6: the market cycle as context for a triggered entry on M15 (pre-registration)

Written 23 Nov 2026, before any run of this rule set. Research only: nothing live changes, nothing is placed.

## Why

The phase reader (`research/edge/_lib/phase.mjs`) gives, at any moment, each timeframe's side and stage (move, pullback,
continuation, range) and where price sits in its range. Grid 5 (`grid5-cycle-box`) asked whether a swing-box event does better
in one stage of the timeframe directly above. This grid asks a wider question: does a simple M15 trigger do better before costs
when the D1, H4 and H1 cycle around it is in a given state, when it trades with the H4 side, or from the cheap half of the H4
range, or in a given session? Entries are at market only (no limit fills, so no touch-fill effect can appear).

## Candles

OANDA mid 5-minute candles of the `edgekit` cache (xau, eurusd, gbpusd, usdjpy, audusd); higher timeframes by
`research/edge/combo-grid-3/run.mjs` `frames` (15m, 1h, 4h UTC buckets; 1d = 17:00 New York trading days). Warm-up from
2009-01-01; trades counted by fill time 2010-01-01 to 2019-12-31. A candle is read only once it has CLOSED.

## The context (read at the last closed H1 candle)

For a trigger whose M15 candle closes at moment `tc`, the context is `readPhase` (handed the 1d, 4h, 1h and 15m candles closed
by the moment, no 5m) at `T = floor(tc / 3600) * 3600`, the close of the last H1 candle at or before `tc`. From it:

- `D1`, `H4`, `H1` stage = `tf[k].stage` (move / pullback / continuation / range); H4 side = `tf['4h'].side`.
- H4 position: the last close at `T` against `tf['4h'].half` (the 50% of the H4 range in use by the reader's own 50% rule);
  the far side of that range = its high (for a buy) / low (for a sell).

## Factors (fixed)

**Stage context** (up to 45 levels): `any`; each single timeframe's stage (D1, H4, H1 x 4 stages = 12); each H4 x H1 stage pair
(16); each D1 x H4 stage pair (16). Collapse rule, decided from the context alone, never from outcomes: a pair level is kept
only when it holds at least 3% of the H1 closes of 2010-2014 pooled over the five markets; the dropped pairs are named in the
result. The full D1 x H4 x H1 triple is not a level (64 cells, too thin).

**Side** (3): `none`; `with` = the trade's direction equals the H4 side; `against` = the H4 side is the opposite (an H4 side of
0 is neither).

**Position** (3): `none`; `cheap` = a buy with the last close below the H4 half, or a sell above it; `dear` = the other way.

**Trigger on M15** (4), on the closed M15 candle `j`, direction `d`:

- `bo`: a structure break of `edgekit` `structure(M15, 3)` at `j` (a BO or a ChoCh); `d` = its direction.
- `box`: a swing box of `edgekit` `boxesHL(M15, 3)` closed out at `j`; `d` = the break's direction.
- `eg`: a two-candle engulf: candle `j - 1` of the other colour and candle `j` closing beyond its extreme (a bullish `j`
  closing above the bearish `j - 1`'s high = a buy; mirrored for a sell).
- `sweep`: the last confirmed M15 swing low (3 a side, confirmed before `j`, not swept before) is traded below by candle `j`,
  which closes back above it = a buy (a swing high mirrored = a sell); one sweep per swing.

**Session** (4) by the trigger candle's start hour (UTC): `any`; `london` 07:00-11:59; `newyork` 12:00-16:59; `other`.

**Entry**: market at the open of the first 5-minute candle starting at or after `tc`.

**Stop**: past the trigger's swing: for a buy, the lowest low of M15 candles `j - 5` to `j`, minus 0.1 x ATR(14) of H1 (the
last closed H1 candle at `T`); a sell mirrors it. Every trade has its stop on the losing side; a stop under 2 round-trip costs
from the trigger close is not traded; a fill with under 1 cost of risk is dropped.

**Exit** (5): `1R`, `2R`, `3R`; `far` = target the far side of the H4 range (not traded when it is under 0.5R from the fill in
the trade's favour); `trail` = from +1R the stop trails 1R behind the best price. Stop first when one candle holds both; a candle
opening past a level exits at its open; out at the close of the 5-minute candle that closes 2 days after the fill. Management =
`research/edge/dom-trade-through/run.mjs` `manage` (imported; market entry, so the fill candle counts in full).

Cells: 45 stage levels (or fewer after the collapse) x 3 sides x 3 positions x 4 triggers x 4 sessions x 5 exits = up to
32,400 rules, on each of the five markets and pooled.

Costs: `research/edge/combo-grid-2/run.mjs` `COSTS` (round trip in price units); R after costs = R - cost / risk. Data-quality
exclusions: `exclusions()`; a trade whose fill falls in one is dropped.

## The bar (judged BEFORE costs; after costs beside with the same bar)

Calendar-month sums of R, every month of the window counted (an empty month = 0); month t = mean / (sd / sqrt(60)).

1. Discovery 2010-2014 (60 months): n >= 100, mean R a trade > 0, month t >= 2.
2. Confirmation 2015-2019 (60 months), discovery winners only: n >= 100, mean > 0, month t >= 2, and the one-sided p of the
   confirmation month t (df 59) below 0.05 after Holm over every discovery winner with n >= 100 in confirmation (all scopes
   together).

**Side-flipped placebo**: every trigger is traded again with the direction reversed at the same moment, at market, the stop the
same distance from the trigger close on the other side, the same exits (`far` = the other side of the H4 range), and filed in
the same cell (the filters are judged on the original direction). A rule whose flipped twin also passes the confirmation bar
(raw) is a timing or volatility effect, not a direction.

Reported: cells tested; discovery winners; raw confirmations against the number expected by chance (discovery winners x 0.0228,
a rough guide: the cells are strongly correlated); Holm confirmations; the same counts for the placebo; counts by factor; the
best pooled cell of each window; every confirmed cell with its placebo twin, before and after costs.

## Verdict, fixed in advance

PASS = one or more Holm-confirmed cells before costs whose side-flipped twin does not pass the confirmation bar (raw).
FAIL = none. INCONCLUSIVE = fewer than 100 cells reach n >= 100 in discovery. A pass is a before-cost tilt on years read by
other studies, never an edge; the after-cost figures say whether it pays its costs.

## Checks

A cut test on seeded synthetic candles: trades built on candles cut at a moment equal the full run's trades that exit before
that moment (no look-ahead from the trigger, the phase reading or the exit). Every trade has its stop on the losing side. The
phase reading on tails of closed candles equals `readPhase` on the whole series. Offline test `tests/grid6-phase-trigger.test.mjs`
pins RESULT.md to result.json.
