# Grid 5: the market cycle of the timeframe above and a swing-box event on the timeframe below (pre-registration)

Written 23 Nov 2026, before any run of this rule set. Research only: nothing live changes, nothing is placed.

## Why

The phase reader (`research/edge/_lib/phase.mjs`) says, per timeframe, whether price is in a move, a pullback or a
continuation, read against the timeframe below. The swing box (`research/edge/_lib/edgekit.mjs` `boxesHL`: a swing low to a
swing high, ended by a close outside) is the working timeframe's own structure. The question: does a box event on the working
timeframe do better before costs in one stage of the timeframe above, and when the timeframes above agree with the trade?
The fill rule is the strict one `research/edge/dom-trade-through` showed is needed on mid candles: a limit fills only when
price trades through it by half the round trip (F2), never on a mere touch.

## The rules (fixed)

Candles: OANDA mid 5-minute candles of the `edgekit` cache; higher timeframes by `research/edge/combo-grid-3/run.mjs`
`frames` (15m, 30m, 1h, 4h UTC buckets, 1d = 17:00 New York trading days, 1w from those days). A candle is read only once it
has CLOSED (its close time at or before the moment).

**Chains** (3): the timeframe above U and the working timeframe W: D1 > H4, H4 > H1, H1 > M15.

**Box events on W** (3), from `boxesHL(W, 3)`; for each box that was broken (`dir` +1 / -1 at candle `bi`):

- `break`: the breaking candle itself. Direction = the break's direction. The broken edge = the box high (up) / low (down).
- `false`: the first candle within 6 W candles after the break that closes back inside the box (at or under the high after
  a break up, at or over the low after a break down). Direction = against the break. The broken edge = the edge that was
  broken.
- `retest`: the first candle within 12 W candles after the break that trades back to the broken edge and closes beyond it
  (on the break's side), when no candle closed back inside before it. Direction = the break's direction.

The trigger candle is the event's candle; everything below is known at its close.

**Stage of U** (4 levels): `any`, `move`, `pullback`, `continuation` = `readPhase(...).tf[U].stage` at the trigger candle's
close (the phase reader's own reading, against the timeframe below U; `any` takes every stage, `range` included).

**Side agreement** (3 levels), against the trade's direction: `none` (no condition); `one` = the side of U
(`readPhase(...).tf[U].side`) equals the trade's direction; `two` = `one` and the side of the timeframe above U equals it too
(above D1: the weekly side by `phase.mjs` `readTf` on the 1w candles; above H4: D1; above H1: H4).

The direction comes from the box event; stage and side are filters on it. So (pullback, one) = a trade with U's side while U
is in a pullback, (move, none) = every event while U is in a move, either direction.

**Entry** (2): `mkt` = at market at the trigger candle's close (filled at the open of the first 5-minute candle starting at or
after it); `lim` = a limit at the broken box edge placed at the trigger candle's close, alive 12 W candles, filled only when a
5-minute candle trades THROUGH it by half the round-trip cost (`dom-trade-through`'s F2: a buy when the low is at or under the
limit minus half the cost; filled at the limit, or at the open when it opens beyond); cancelled by a 5-minute close past the
stop before a fill. A limit that would already be on the wrong side of the trigger close is not placed. On the fill candle of
a limit only the stop counts.

**Stop** (2): `box` = the other side of the box on the trade's losing side: for a buy, the lower of the box low and the
lowest low from the break candle to the trigger candle; for a sell, the higher of the box high and the highest high over the
same candles (for a false break this is the false break's extreme). `atr` = 1 x ATR(14) of W at the trigger candle from the
reference price (the trigger close for `mkt`, the limit for `lim`). Every trade has its stop on the losing side; a stop under 2
round-trip costs from the reference price is not traded, a fill with under 1 cost of risk is dropped.

**Exit** (5): `1R`, `2R`, `3R`, `trail` (from +1R the stop trails 1R behind the best price), `box` (target = the box height
from the fill). Stop first when one candle holds both; a candle opening past a level exits at its open; time limit W = H4 5
days, H1 2 days, M15 1 day (out at that candle's close). Management = `dom-trade-through`'s `manage` (imported).

Cells: 3 chains x 4 stages x 3 side levels x 3 events x 2 entries x 2 stops x 5 exits = 2,160 rules, on each of xau, eurusd,
gbpusd, usdjpy, audusd and pooled: 12,960 cells.

Costs: `research/edge/combo-grid-2/run.mjs` `COSTS` (round trip in price units), R after costs = R - cost / risk. Data-quality
exclusions: `exclusions()` (`research/edge/data-quality/quality.json`); a trade whose fill falls in one is dropped.

## Data

The `edgekit` cache, 5-minute candles from 2009-01-01 (warm-up) to 2019-12-31; trades counted by fill time 2010-01-01 to
2019-12-31. None of the combination grids read these rules; `combo-grid-4` and the holdout studies read the same years with
other rules.

## The bar (judged BEFORE costs; after costs reported beside with the same bar)

Calendar-month sums of R, every month of the window counted (an empty month = 0); month t = mean / (sd / sqrt(60)).

1. Discovery 2010-2014 (60 months): n >= 100, mean R a trade > 0, month t >= 2.
2. Confirmation 2015-2019 (60 months), discovery winners only: n >= 50, mean > 0, month t >= 2, and the one-sided p of the
   confirmation month t (df 59) below 0.05 after Holm over every discovery winner with n >= 50 in confirmation (all scopes
   together).

**Side-flipped placebo**: every cell is run again on the same triggers with the direction reversed, entered at market at the
trigger close, the stop the same distance from the trigger close on the other side, the same exits (the filters are judged on
the original direction, so the placebo trades exactly the same moments). A rule whose flipped twin also passes is a timing or
volatility effect, not a direction.

Reported: cells tested; discovery winners; raw confirmations (step 2 without Holm) against the number expected by chance
(discovery winners x 0.0228, a one-sided 2.3 % rate; the cells are strongly correlated, so this is a rough guide); Holm
confirmations; the same three counts for the placebo grid; counts by chain, stage, side level, event, entry, stop and exit;
the best pooled cell of each window; every confirmed cell with its placebo twin, before and after costs.

## Verdict, fixed in advance

PASS = one or more Holm-confirmed cells before costs whose side-flipped twin does not pass the confirmation bar (raw).
FAIL = none. INCONCLUSIVE = fewer than 100 cells reach n >= 100 in discovery. A pass is a before-cost tilt on years read by
other studies, never an edge; the after-cost figures say whether it pays its costs.

## Checks

A cut test on seeded synthetic candles: trades built on candles cut at a moment equal the full run's trades that exit before
that moment (no look-ahead from the box, the phase reading, the fill or the exit). Every trade has a stop on the losing side.
The phase reading handed a tail of closed candles equals `readPhase` on the whole series. Offline test
`tests/grid5-cycle-box.test.mjs` pins RESULT.md to result.json.
