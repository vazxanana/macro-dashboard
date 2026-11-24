# Previous-day sweep, then an M5 structure-shift break back: five markets (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run on real candles. Research only: nothing live reads it, nothing is placed, no rule is
proposed, no order code is touched.

## Why

A sweep of the previous day's high or low that fails (a wick beyond it, a close back inside) is a common discretionary reason to
trade back into the range. What the repository already holds, read before writing this:

- `mosha-sweep` and `mosha-select` (FAIL): a swept H1 swing on GOLD only, an M5 range at the extreme and a close out of it; target a
  far H4 zone. Not the previous day's extremes, one market.
- `grid7-wide-sweeps` (FAIL, 0 of 36): sweeps of the Asia range, the previous day and the previous week on ten markets, entered
  AT ONCE at the M15 close back inside; 1R / 2R / the range's other side. No lower-timeframe confirmation.
- `smc-sweep-fvg` (FAIL): an H1 sweep, a structure shift and then a limit in a price gap. A different entry.
- `mmxm-pdhl-raid-gold` (FAIL, 12 trades), `gold-pdhl-break` (FAIL, the continuation), `session-sweep` (INCONCLUSIVE, Asia range).

Not tested: the previous day's extremes on several markets with the entry held back until the 5-minute chart itself turns (a
close beyond the last 5-minute swing made before the sweep's extreme), and the day's opening price as the target. That is this
study. `grid7-wide-sweeps`' entry (at once, no confirmation) is run beside it as a control so the confirmation's own effect shows.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), from 2004-06-01 for warm-up to
  2026-11-01. No network.
- Markets (5): xau (history starts March 2006), eurusd, gbpusd, usdjpy, audusd.
- M15 = `edgekit` `resample(M5, 900)`. Trading days = `edgekit` `dailyNY(M5)` (17:00 New York to 17:00 New York, weekend candles
  folded into Monday).
- Exclusions: `combo-grid-2` `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Costs: `edgekit` `COSTS` (round trip in price units, the demo figures for these five markets), charged as cost / risk per trade.
- Windows by FILL time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31** (142
  months). Month sums count every calendar month of the window, an empty month as 0, pooled over the five markets.

## The levels (known before the day starts)

For trading day D: **PDH / PDL** = the high and low of the trading day before it in the list, used only when that day holds at
least 200 five-minute candles (no holiday stubs) and ended at most 4 days before D began. **Day open** = the open of D's first
5-minute candle.

## The sweep (M15 candles that lie wholly inside day D, closed candles only)

For the HIGH (the low mirrors everything below):
1. Candle j has its high above PDH while candle j-1 did not close above PDH (or j is the day's first M15 candle).
2. Among candles j, j+1, j+2, j+3 (one hour) the first candle m that CLOSES below PDH and above PDL (back inside).
3. X = the highest high of candles j..m (the sweep extreme). The sweep is known at the close of candle m.
The first j of the day that meets 1-3 is the day's one signal for that edge; a j with no such m is skipped and the scan goes on.
At most two signals a market a day (one per edge).

## The M5 confirmation (the structure-shift break back)

Let x = the 5-minute candle that made X (the first one if several) inside candles j..m. For each 5-minute candle k after x, in
order, until 24 candles (2 hours) after the close of m:
- If k starts at or after the close of m and trades above X: the setup is cancelled (the extreme was taken out).
- L(k) = the low of the most recent 5-minute swing low (`edgekit` `swings(M5, 3)`: 3 candles a side) whose candle is before x and
  at most 48 candles before x, that is CONFIRMED before k (its third later candle closed before k) and that no 5-minute candle
  from the swing to k-1 has closed below. No such swing: k cannot confirm.
- k confirms when it CLOSES below L(k).
The entry moment is the close of k, or the close of m when k closed earlier than that (both the M15 close back inside and the M5
break are needed). No confirming k in the window: no trade.

## The trade (against the sweep: a swept high is sold, a swept low is bought)

- **Entry**: market, at the open of the first 5-minute candle starting at or after the entry moment.
- **Stop**: past the sweep extreme: X + 0.1 x ATR(14) of M15 at candle m (simple mean of the true range of the 14 M15 candles up
  to and including m); a buy mirrors. Every trade has its stop on the losing side; a fill at or beyond the stop is no trade; a
  trade whose risk is under the market's round-trip cost is no trade.
- **Exit (two)**: **2R**; **open** = the day's opening price, only when it lies on the winning side of the fill at 1R or more,
  else no trade in that cell. Stop first when one 5-minute candle holds stop and target; a candle that opens through the stop or
  the target exits at its open. **Time limit 24 hours** from the fill: out at the close of the 5-minute candle that reaches it.
- **Session (three)** by the fill's UTC hour: **all**; **london** 07:00-11:59; **ny** 12:00-16:59.
- Trades may overlap. A trade still open at the end of the data is dropped.

## The cells (6, fixed here)

`open all`, `open london`, `open ny`, `2R all`, `2R london`, `2R ny`.

## The bar (judged AFTER costs, on calendar-month sums of R)

A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R after costs > 0 and month-sum t >= 2 in discovery;
3. mean R after costs > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 6 confirmation tests (p from the after-cost month-sum t, df = months - 1).

Verdict: **PASS** if one cell or more passes; **INCONCLUSIVE** if no cell reaches n >= 300 in both windows; **FAIL** otherwise.

## Also reported (not part of the bar)

- Before-cost and after-cost mean R, n, win share and month t of every cell in both windows; mean cost / risk.
- **Control**: the same sweeps entered at the close of candle m with NO M5 confirmation, same stop, exits, sessions and windows
  (six rows).
- Per-market rows of the `2R all` and `open all` cells.
- Counts: sweeps found, confirmed, cancelled, unconfirmed, dropped.

## What a result means

One run, no variants afterwards. A pass would be a tilt on mid candles at assumed-constant demo costs, never called an edge and
never a live change without the owner and a forward record. A fail closes this combination on these five markets and years.
