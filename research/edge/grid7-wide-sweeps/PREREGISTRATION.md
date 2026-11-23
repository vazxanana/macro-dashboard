# Wide sweep grid: liquidity sweeps of known ranges against the plain fade, ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid6-session-range`'s best cell (a New York sweep of the previous New York afternoon) failed its holdout
(`research/edge/nearmiss-holdout`). Grids of thousands of cells on five markets land at chance; the wide design
(`research/edge/grid7-wide-core`: few cells fixed in advance, ten markets, 2005-14 / 2015-26) has the power to see a small real
tilt. `research/edge/grid7-wide-fade` found that fading the first structure break makes a small tilt before costs. A sweep that
closes back inside a range is a failed break: this study asks whether sweeps of KNOWN ranges (Asia, the previous day, the
previous week) carry more than the plain fade, with every cell fixed below (48 cells).

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (`grid7-wide-core` `MARKETS`, imported).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h (UTC buckets), 1d (17:00 New York
  trading days), 1w (weeks of those days).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The ranges (known before the session; closed candles only)

For every UTC weekday:
- **asia**: the high and low of the 5-minute candles 00:00-06:59 UTC of that day (at least 60 candles, else none).
- **day**: the high and low of the last 17:00 New York trading day CLOSED by the session's start (07:00 for London, 12:00 for New
  York), only when it ended within the last 4 days.
- **week**: the high and low of the last week (of those trading days) CLOSED by the session's start.

## The event (the sweep)

Sessions by the UTC hour of the M15 candle that first trades beyond the edge: **London** 07:00-11:59, **New York** 12:00-16:59.
For each range, each edge (high / low) and each session of a day, M15 candles only, closed only:
1. Candle j (starting inside the session) trades beyond the edge (its high above the range high; a low mirrors) while the close
   of candle j-1 was not beyond it (price came from inside).
2. Within candles j, j+1, j+2 (three candles), the first candle m that CLOSES back inside (strictly inside the edge).
3. The extreme X = the highest high (lowest low) of candles j..m is at least **0.1 x ATR(14) of the Daily** (the last trading
   day closed by the start of candle j) beyond the edge.
The first j of a session that meets 1-3 is the signal for that range edge and session; later ones that session are not used.
The sweep is known at the close of candle m.

## The trade (against the sweep)

Side s: a sweep of a HIGH is sold, of a LOW is bought. Market entry at the open of the first 5-minute candle starting at or after
the close of candle m. **Stop** past the sweep's extreme: X + 0.1 x ATR(14) of M15 at candle m (a sell; a buy mirrors). Every
trade has its stop on the losing side; a fill at or beyond the stop is no trade; a trade whose risk is under the market's
round-trip cost is no trade (the `grid7-wide-core` rule).
- **Exit (three)**: **1R**, **2R**, **range** = the range's other side (a sell after a sweep of the high targets the range low),
  only when it is 1R or more from the fill, else no trade in that cell. Stop first when one 5-minute candle holds stop and
  target; a gap through either fills at the open. **Time limit 1 day** from the fill, out at the close of the 5-minute candle
  that reaches it. Trades overlap freely.
- **MSNR call (two)**: **all**, or **agree** = the Daily MSNR call (`council/eg-methods.mjs` `direction()`, through
  `grid7-wide-core` `dailyCalls`, imported, 1w key levels) of the last trading day closed by the close of candle m equals s.

## The control (fixed here)

`grid7-wide-fade`'s rule on M15, imported: the first structure break (a close beyond the last confirmed swing, 3 candles a side)
FADED, market entry at the next 5-minute open, stop past the break candle's extreme + 0.1 x M15 ATR(14), no context. Session by
the fill's UTC hour (London 07-11, New York 12-16). Exits 1R, 2R and **swing** (the opposite swing standing at the break, only on
the winning side); the swing exit is the control of the sweeps' range exit. Time limit 1 day. Same MSNR "agree" split.

## The cells (48, fixed here)

A. Sweeps: 3 ranges (asia, day, week) x 2 sessions (london, ny) x 3 exits (1R, 2R, range) x 2 calls (all, agree) = **36**,
named `<range> <session> <exit> <call>`, e.g. `asia london 1R all`, `week ny range agree`.

B. Controls: 2 sessions x 3 exits (1R, 2R, swing) x 2 calls = **12**, named `fade <session> <exit> <call>`.

## The bar (judged BEFORE costs, on calendar-month sums of R)

A sweep cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over all 48 confirmation tests (p from the month-sum t, df = months - 1);
5. it beats its control (same session, the matching exit: 1R-1R, 2R-2R, range-swing, same call): Welch t of the per-trade means
   >= 2 in discovery AND in confirmation.

Control cells are reported but cannot pass (they are the reference). Verdict: **PASS** if one sweep cell or more passes; **FAIL**
otherwise. INCONCLUSIVE only if the data cannot be read (fewer than 8 of the 10 markets load).

## Also reported (not part of the bar)

- **Side-flipped check**: every sweep cell traded WITH the sweep (same fill, the stop at the same distance on the other side,
  targets at the same distances in R). Shown so a pass that is only the mirror of a losing direction is visible.
- **After costs** beside every figure: R less (round-trip cost / risk) per trade, `combo-grid-2` `COSTS` (the demo figures for
  gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets, the signals known by a date computed on candles cut there equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades that a plain fade does not have, nothing more: if the cost in R is larger than the
tilt it is not tradable and is said so. Not adopted, never called an edge, no live change; a forward record would need the
owner. One run, no variants.
