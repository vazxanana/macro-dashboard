# Session / previous-day sweep on M15, entered by a limit at an M5 engulf back inside (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

A false break (a sweep) of a known level that closes back inside is one of the desk's oldest reversal ideas. It has been tested
here with a MARKET entry at the close back inside (`research/edge/grid7-wide-sweeps`: 0 of 36, about zero after costs), with a
5-minute structure pattern as the entry (`research/edge/session-sweep`: too few trades) and inside large grids
(`research/edge/grid6-session-range`, where a 15-minute engulf was one confirmation among many: 0 confirmed). What was NOT
tested: waiting for a 5-minute ENGULF back inside the level and resting a LIMIT at that engulf's zone, with the stop past the
sweep's extreme. A limit nearer the extreme makes the risk smaller and the reward larger in R; whether that survives the
fills it misses and the costs is the question. Eight cells, all fixed below.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), read only, no network.
- Markets (5): xau, eurusd, gbpusd, usdjpy, audusd. Results are POOLED over the five (per-market rows are reported).
- 15-minute candles are UTC buckets of the 5-minute candles (`resample`); trading days are 17:00 New York days (`dailyNY`).
- No data-quality exclusion list is applied (said here so a reviewer knows).
- Windows by FILL time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0. (Gold's candles start in March 2006.)
- Costs: `edgekit` `COSTS` (round trip in price units: xau 0.30, eurusd 0.00006, gbpusd 0.00008, usdjpy 0.008, audusd 0.00006),
  the same for every year, charged as cost / risk in R on every filled trade.

## The levels (known before the session; closed candles only)

For every UTC weekday (Monday to Friday):
- **asia**: the high and the low of the 5-minute candles that start 00:00-06:59 UTC that day (at least 60 candles, else none).
- **day**: the high and the low of the last trading day CLOSED by the session's start, only when it ended within the last 4 days.

## The sweep (15-minute candles, closed only)

Sessions by the UTC hour in which the 15-minute candle j STARTS: **london** 07:00-11:59, **ny** (the New York morning)
12:00-16:59. For each level, each edge (high / low) and each session of a day:
1. Candle j trades beyond the edge (its high above a high; its low below a low) while the close of candle j-1 was not beyond it.
2. Among candles j, j+1, j+2 the first candle m that CLOSES back inside the edge (strictly). No such candle: j is not a sweep.
The FIRST j of the session that meets 1-2 is the one sweep of that level edge and session; later ones are not used. The sweep
is known at the close of m. A sweep of a HIGH is sold (s = -1), of a LOW is bought (s = +1).

## The entry (5-minute candles, closed only)

3. Among the 12 five-minute candles that start at or after the close of m (one hour), the FIRST candle k that completes an
   engulf on the trade's side: k closes in the trade's direction and beyond the high (buy) / low (sell) of the base = the last
   candle of the other colour among the three candles before k (`council/eg-methods.mjs` `engulfAt(C, k, 3)`, imported), no
   candle between the base and k has already closed beyond that side of the base, and k closes back inside the edge (below a
   swept high, above a swept low). None within the hour: no trade.
4. The engulf zone is the BASE candle, wick to wick. The order is a **limit at the zone's near edge**: a sell at the base's
   LOW, a buy at the base's HIGH (the side price reaches first when it comes back). It rests from the close of k for 12
   five-minute candles (one hour), then it is cancelled.
5. **Stop** past the sweep's extreme: X = the highest high (sell; lowest low for a buy) of the 5-minute candles from the start of
   j to the close of k; stop = X + 0.1 x ATR(14) of the 15-minute candles at candle m (a buy mirrors). Every order has its stop
   on the losing side of its entry (otherwise no order). A trade whose risk (entry to stop) is under the market's round-trip
   cost is no trade.
6. Fill and exits by `edgekit` `simulate` on the 5-minute candles: the limit fills on a candle that trades to it (at the open
   when it opens past it); on the fill candle only the stop counts; after it the stop comes first when one candle holds both,
   a gap through either fills at the open; **time limit 1 day** from the fill (out at that candle's close). Trades overlap freely.

## Targets (two)

- **2R**: twice the risk from the limit price.
- **far**: the level's other side (asia: the other side of the Asia range; day: the other side of that trading day), only when
  it is 1R or more from the limit price on the winning side; otherwise that order is not in the `far` cell.

## The cells (8, fixed here)

2 levels (asia, day) x 2 sessions (london, ny) x 2 targets (2R, far), named `<level> <session> <target>`, e.g. `asia london 2R`.

## The bar (all must hold for a cell to pass)

1. n >= 300 filled trades in discovery AND in confirmation.
2. Mean R AFTER costs > 0 and calendar-month-sum t >= 2 (after costs) in discovery AND in confirmation.
3. Holm-adjusted one-sided p (from the confirmation month-sum t after costs) < 0.05 over the 8 cells.

Verdict: **PASS** if one cell or more passes; **INCONCLUSIVE** if no cell reaches n >= 300 in both windows; otherwise **FAIL**.
One run, no variants; nothing is tuned after the result.

## Reported

For every cell and both windows: n, win rate, mean R before costs and after costs, the month-sum t of both, the Holm p; the
funnel (sweeps, engulfs found, orders, fills); per-market rows of the best cell; the median planned reward of the `far`
cells. The "best cell" of the headline = the largest confirmation month t after costs among cells with n >= 300 in both
windows (among all cells if none has). A PASS would be a hypothesis for a holdout, never an edge by itself.
