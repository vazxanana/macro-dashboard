# The H1 dominant-zone limit on the side of the day's volatility breakout (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The H1 dominant-zone limit (DOM) tilts positive before costs on every market and every five years since 2005
(`dom-zone-holdout`, about +0.05R a trade) and loses after costs on every market (about -0.05R); none of 13 filters picks better
trades (`dom-filters`). The T1 volatility breakout (a buy / sell stop at the UTC open +/- 0.5 x the previous folded day's range,
stop back at the open, out at 21:00 UTC) passed at the broker's own quotes on gold and USD/JPY. Question: once the day's breakout
has filled and the day's side is known, are the DOM limits on that side better, enough to pay their costs? No study in
`research/edge/` asks it (checked: `dom-filters`, `dom-zone-holdout`, `vb-structure-filter`, `vb-retest-limit`, the
`vb-pullback-fade` branch, which splits the M15 Break fade, not DOM, by the breakout).

## Data and code (imported, never edited)

- OANDA mid 5-minute candles, `research/edge/_lib/edgekit.mjs` `load`.
- Markets: **xau, eurusd, gbpusd, usdjpy, audusd, usdcad, usdchf** (gold and the six forex majors `fx-vol-breakout` ran; all have
  DOM costs in `combo-grid-3` `COSTS`).
- DOM trades: exactly `dom-zone-holdout` `trades(market, from, to)` (combo-grid-3 `signalsFor(F,'1h','5m','dom')`, no trigger,
  limit at the near edge armed at the touch candle, stop past the far side by half the cost + 0.25 x ATR(14) of H1, grid `multi()`
  exits). Primary exit: the trailing stop ('trail', the holdout's primary). Costs = `combo-grid-3` `COSTS` charged as cost / risk:
  xau, eurusd, gbpusd, usdjpy, audusd are the desk's demo figures; **usdcad and usdchf are ASSUMED** (edgekit says so).
- Breakout days: gold with `gold-vol-breakout-hourcost/original.mjs`, k = its `costs.mjs` `T1.k` (0.5); forex with
  `index-vol-breakout/original.mjs`, k = `fx-vol-breakout` `K` (0.5): `buildDays`, `daySkip`, `vbTrade(…, { sides: 'both', cost: 0 })`.
  A **breakout day** has a fill: side D (+1 buy / -1 sell), fill candle start fillT. Other days are not breakout days.

## Which DOM trades belong to a breakout (no look-ahead)

A DOM trade belongs to the UTC day d0 of its touch time ts (the 5-minute candle at which the limit is armed). It is counted only
when d0 is a breakout day, ts >= fillT + 300 (the breakout's fill candle has closed, so the side is known before the order) and
ts < d0 + 21:00 UTC. Then **WITH** = the DOM side equals D, **AGAINST** = the other side. DOM trades of breakout days before the
fill, after 21:00, or of other days are in neither set. **ALL** = every DOM trade of the window (the unsplit rule).

## Windows (by the DOM fill time)

- **Discovery 2005-01-01 to 2014-12-31**, **confirmation 2015-01-01 to 2026-10-31** (the common task windows; gold's 5-minute
  candles start March 2006). Month sums over every calendar month of the window, an empty month as 0.

## The tests (3, fixed here; markets pooled, all after costs)

- **T1** WITH alone: n >= 200 in each window, mean R after costs > 0 in both windows, month-sum t >= 2 in confirmation,
  Holm p < 0.05 (one-sided, from the confirmation month-sum t).
- **T2** WITH against ALL: per-trade R after costs, WITH mean minus ALL mean > 0 in both windows, Welch t (WITH against the DOM
  trades not in WITH) >= 2 in confirmation, Holm p < 0.05 (one-sided normal).
- **T3** WITH against AGAINST: the same bar on WITH minus AGAINST.

Holm over the three confirmation p values.

## Control (placebo, part of the bar)

Random days matched in count: in each of 200 seeded draws, every breakout day of a market and window is replaced by a random
day drawn (without replacement) from that market's DOM-trade days of the same window, which takes the breakout's side D and
fill time of day; WITH is then rebuilt by the same rule. The real WITH mean R after costs in confirmation must beat at least
190 of 200 draws.

## Verdict

**PASS** only if T1 passes AND (T2 or T3) passes AND the control is beaten. **FAIL** otherwise. INCONCLUSIVE only if a market
cannot be read. A before-cost tilt is not an edge.

## Also reported (not part of the bar)

Before-cost figures; per market; the 4R exit; the cut test (day labels and set of every DOM trade known at five cut dates,
recomputed on candles cut there, equal to the full run).
