# Fade on a resting limit instead of at market (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

Two Equinox fade rules pass before costs and lose after costs, because the round trip is a large share of a small stop:
`grid7-wide-fade` **m15 none atr 2R all** (+0.042R a trade before costs in 2015-26, -0.118R after; cost about 0.16R a trade) and
`big-candle-fade` **m15 k1.5 nobreak half** (+0.193R before, -0.246R after; cost about 0.44R). This study asks one question:
does entering on a LIMIT further in the break's direction (a better price, a passive fill) turn either after costs? Two forces
pull against each other and both are measured: the better price cuts the cost in R and adds distance to the target, but only
the signals where price kept going in the break's direction reach the limit (adverse selection).

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, its default `DATA_DIR`), loaded from
  2004-01-01 for warm-up; timeframes built by `combo-grid-3` `frames` (imported), M15 = UTC 15-minute buckets.
- Markets (10, the same as both studies): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Exclusions: `combo-grid-2` `exclusions(market)` (imported); a signal whose order time falls in a bad interval is dropped.
- Windows by order time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month, an empty month as 0 (`grid7-wide-core` `mstat`, imported).
- Costs: `edgekit` `COSTS`, the FULL round trip in price units, charged on every filled trade as cost / risk (the demo figures
  for gold and the four majors; ASSUMED, not measured, for xag, nzdusd, usdcad, usdchf, eurjpy). Conservative: a passive
  entry would save part of the spread. **Sensitivity, never the verdict**: the same with 0.5 x COSTS (as if the whole round
  trip were spread and the limit saved half of it: an upper bound of the saving), labelled as such.

## The signals (each study's OWN code, imported, never edited)

- **R1** = `grid7-wide-fade` `signals(F)` restricted to tf M15 and context "none" (every first structure break on M15), with
  that study's market trade: fill at the next 5-minute open, stop = fill + d x 1 ATR (d = the break's direction), target 2R,
  time limit 1 day (`CAP['15m']`), exits by its own `exits`.
- **R2** = `big-candle-fade` `signals(F).big` restricted to tf M15, k 1.5 (every candle with kmax >= 0) and not a break the same
  way, with that study's own `trade()`: stop past the candle's extreme + 0.1 ATR, the "half" target (back to the candle's 50 %),
  only when the target is 1R or more from the fill, time limit 1 day.
- A signal enters this study only when its MARKET trade is a trade of the cell in the original study (not past the stop, risk
  not under the round-trip cost, the "half" target 1R or more away for R2, resolved before the data end). The market trade is the
  baseline (row "market"); its figures must reproduce the original cells (gate: R1 confirmation n 201,769, +0.042R before costs;
  R2 confirmation n 54,443, +0.193R; a mismatch over 0.5 % in n or 0.002R in the mean stops the run as a harness failure).

## The limit order (the variant)

- Side s = -d (the fade). Reference = the CLOSE of the signal candle c. **Limit L = c + d x X x A**, A = the ATR the study uses
  for that signal (R1: ATR(14) of M15 at the break candle; R2: ATR(14) of the 14 candles before the big candle). So a fade of an
  up-break is a SELL limit ABOVE the close. **X in {0.1, 0.25, 0.5}.**
- Placed at the close of the signal candle; valid for **N = 4 M15 candles** (one hour): the 5-minute candles starting at or after
  the close and before close + 3,600 s. No other cancel.
- **Fill rule (on 5-minute mid candles)**: a sell limit fills only on a candle whose HIGH is at or above L + one tick; a buy
  limit only on a candle whose LOW is at or below L - one tick (trades THROUGH the price). Tick: xau 0.01, xag 0.001, usdjpy and
  eurjpy 0.001, the other pairs 0.00001. Fill price = L, or the candle's open when it opens past L in the order's favour
  (a gap fills at the better open).
- **On the fill candle only the stop can be hit** (its adverse extreme reaching the stop exits at the stop); from the next
  candle: an open past the stop exits at the open, an open past the target exits at the open, a candle that holds both is a
  stop, then the target, then the time limit at the close of the first candle closing at or after fill time + 1 day. A fill at or
  beyond the stop exits at once at the fill (R 0 before costs). Unresolved at the data end: dropped and counted.
- **Variant A, "same distances"**: the market trade's stop distance (risk0 = s x (market fill - market stop)) and target in R
  (k0: 2 for R1; for R2 the half target's R from the market fill) are kept from L: stop = L - s x risk0, target = L + s x k0 x risk0.
- **Variant B, "same prices"**: the market trade's stop and target PRICES are kept; only the entry moves to L. No order when L is
  at or beyond that stop, or when the risk s x (L - stop) is under the round-trip cost.
- Cells: 2 rules x 3 X x 2 variants = **12 tests**.

## What is measured (per cell, per window)

- Signals, orders, fills, fill rate; per FILLED trade: mean R before costs, after the full cost, after the sensitivity cost,
  mean cost in R; month-sum t of the after-cost R of the filled trades.
- Per SIGNAL (an unfilled order counts 0R): mean after-cost R of the limit, minus the market trade's after-cost R on the same
  signal, and the month t of that paired difference.
- **Adverse selection**: the MARKET trade's before-cost R on the signals the limit filled against those it did not fill.
- **Control** = the same order (same variant, same X, the same stop and target distances in ATR units, the same N and fill
  rule) placed at the close of a RANDOM M15 candle of the same market and the same calendar month, with a random side; one
  control order per signal (matched frequency), ATR at the random candle as the rule takes it, seeded random generator (seed
  fixed in the code). Reported per cell: per-trade after-cost R and month t, and Welch t of the variant against its control.

## The bar (fixed now)

A cell PASSES when all hold: after the FULL cost, mean R per filled trade > 0 in discovery AND in confirmation; month-sum t of the
after-cost R in confirmation >= 2 with a Holm-adjusted one-sided p < 0.05 over the 12 tests; at least 200 fills in each window.
**Verdict**: PASS if one or more cells pass, else FAIL; INCONCLUSIVE only if the baseline gate fails or a market cannot be read.
A passing cell whose random control also clears the same bar (positive after costs in both windows, confirmation month t >= 2)
is reported as "passes, but so does a random limit: not the signal". The sensitivity cost never decides the verdict.

## Cautions written now

- These years were read by both studies (2005-26, the same ten markets): this tests an execution change, not new evidence of a
  signal. Mid candles: a real sell limit fills when the ask reaches it; the one-tick rule on mid is a stand-in, not a broker fill.
- Trades overlap freely (no one-at-a-time), as in both studies; the per-trade Welch t overstates independence.
- One run, no variants of X, N or the fill rule after the result.
