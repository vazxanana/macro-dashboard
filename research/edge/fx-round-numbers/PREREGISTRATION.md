# Round numbers on forex majors (stall and break): pre-registration

Written and committed on 14 Nov 2026, before any candle of the test was read for this study and before any trade was
computed. Paper research only: no live rule, size, filter, cost model or mirror setting is changed by this study, whatever it
finds. A pass would only be a proposal to the owner for a paper shadow (`research/proposals/`), never a live change.

## Why

Osler (2000, Federal Reserve Bank of New York Economic Policy Review, "Support for resistance: technical analysis and intraday
exchange rates") and Osler (2003, Journal of Finance, "Currency orders and exchange-rate dynamics: an explanation for the
predictive success of technical analysis") report, from a bank's order book, that take-profit orders cluster at round numbers
(prices ending in 00), so moves tend to stall or reverse there, and that stop-loss orders cluster just beyond round numbers, so
a move that crosses one tends to accelerate. Neither claim has been tested as a trade in this repository. Both are tested here
as two fixed rules, once, with the pass bar below written before any result exists.

## Data

- OANDA mid M15 candles through the council's keyless proxy (`/md/bars?sym=<key>&tf=15m&from=&to=`, 4,999-candle windows,
  paced), from 2005-12-01 (or the first M15 candle the proxy serves, if later) to the start of the UTC day the run is made.
  Only complete candles. Files kept outside git.
- Markets (OANDA keys of `api/_oanda.js`): `eurusd`, `gbpusd`, `audusd`, `usdjpy`. Pip 0.0001; USD/JPY 0.01.
- **Decisive window: trades entered 2016-01-01 to the end of the file. Replication window: trades entered 2006-01-01 (or from
  where the M15 file starts) to 2015-12-31.** Nothing is tuned on either: every number below is fixed now.
- All times UTC. A candle belongs to a time by its open time.

## The levels

- Grid step `G` = 100 pips (0.0100 on EUR/USD, GBP/USD, AUD/USD; 1.00 on USD/JPY).
- **Real levels ("00")**: every multiple of `G` (1.1000, 1.1100, ...; 150.00, 151.00, ...).
- **Control ("50")**: the same grid shifted by half a step (1.1050, 1.1150, ...; 150.50, ...). Reported, not judged.
- **Placebo**: the same grid shifted by `u x G`, `u` uniform in [0, 1), one shift per seed, seeds 1-40 (mulberry32 seeded
  with the seed number alone, first draw), the same shift for every pair. The full rules, costs and statistics are run on each
  shifted grid.
- A candle **touches** level L when `low <= L <= high` (prices compared within 1e-9).

## Rule T1: stall (fade the first touch)

- **Fresh**: level L was not touched by any candle opening in the 24 clock hours before the candle (weekend hours count as
  hours; a level is never fresh in the first 24 hours of the file).
- **Side**: the previous candle's close below L = price comes from below: **sell**; above L = from above: **buy**; equal: no
  trade.
- **Entry**: a resting limit order at L, filled on the touch candle at L; when that candle opens beyond L (a gap), at its open.
  No trade when the candle opens at or beyond the stop.
- **Stop** = L + 15 pips (sell) / L - 15 pips (buy). **Target** = L - 15 pips (sell) / L + 15 pips (buy).
  `r0 = |fill - stop|` (1R; 15 pips unless a gap filled at the open).
- **In the fill candle only the stop is checked** (it counts if the candle reaches it; the target does not count in that
  candle, since the order of the candle's prices is unknown).
- From the next candle: a candle opening at or beyond the stop exits at its open; opening at or beyond the target exits at its
  open; else the stop is checked first, then the target (stop and target in one candle: the stop counts).
- **Time exit**: at the close of the last candle opening before fill time + 8 hours, if still open.
- One T1 trade per level per pair per UTC day (the 24-hour freshness already implies it). Trades on different levels may
  overlap; each is its own trade.

## Rule T2: break (follow the close beyond)

- **Break up of L** at candle c: `c.close >= L + 5 pips`, the previous candle's close `< L + 5 pips`, and L was touched by c
  or by the previous candle (`min(c.low, prev.low) <= L`). L = the highest real level with `c.close >= L + 5 pips`.
  **Break down** mirrored: `c.close <= L - 5 pips`, previous close `> L - 5 pips`, `max(c.high, prev.high) >= L`, L = the
  lowest level with `c.close <= L - 5 pips`.
- **Entry**: at market at the next M15 candle's open, in the break direction (buy after a break up, sell after a break down).
- **Stop** = L - 15 pips (buy) / L + 15 pips (sell), i.e. back on the other side of the level by the same 15 pips as T1.
  `r0 = |entry - stop|`. No trade when the entry open is at or beyond the stop.
- **Target** = entry +/- 1.5 x r0 (1.5 times the stop distance).
- The entry candle is checked for both (stop first); then each candle: open at or beyond the stop or target exits at the open;
  else stop first, then target.
- **Time exit**: at the close of the last candle opening before entry time + 8 hours, if still open.
- One T2 trade per level per pair per UTC day (a second break of the same level that day is ignored).

## Costs (net R)

The raw-spread demo's measured model (CLAUDE.md "Forex spreads", 12 Nov 2026), charged per trade in price, then divided by
`r0`:
- spread 0.3 pip a round trip;
- commission 22.5 USD per million USD of notional a side; for every one of these pairs the USD notional converted to the
  quote currency equals the pair's price, so the round trip is `2 x 22.5e-6 x entry price`;
- slippage of half the default 1-pip spread (0.5 pip) on every market order: the T2 entry, a stop exit (gap or touch) and a
  time exit. None on a limit: the T1 entry and every target exit.
Gross R is reported beside net R; a sensitivity at twice the costs is reported, not judged.

## Statistics and the pass bar

For each rule, the four pairs pooled, real ("00") levels:
1. n >= 300 trades in the decisive window;
2. mean net R a trade in the decisive window > 0;
3. mean net R a trade in the replication window > 0;
4. t >= 2 on calendar-month sums in the decisive window (net R of the rule's trades summed per calendar month of entry, every
   month of the window counted, a month with no trade is 0; t = mean / (sd / sqrt(months)));
5. Holm over the two rules (T1, T2) on the one-sided p of the decisive month-sum t (normal approximation): adjusted p < 0.05;
6. the decisive mean net R a trade is above the 95th percentile (linear interpolation) of the 40 shifted-grid placebo means
   (decisive window, same rule and costs).

A rule **PASSES** only when all six hold. The study's verdict is PASS if at least one rule passes, else FAIL. Per pair, per
year, gross, twice-cost and the "50" control figures are reported and never judged.

## What it would and would not mean

A pass says that this mechanical reading of the order-clustering claim made money net of the measured costs on OANDA mid
candles in both windows and beat random grids. It would not say that a resting order sits at any given level today, nor that
it holds on other markets or with other stop sizes. A fail says these two fixed rules did not, and is not a test of the
papers' order-flow evidence itself.
