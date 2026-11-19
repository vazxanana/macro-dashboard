# Pre-registration: silver's volatility against gold's as a gold signal, 14 Nov 2026

Written and pushed alone, before any signal or trade of this rule was computed. Paper research only: nothing live reads it,
no rule, size, filter, stop, config or council member changes whatever the result.

## Question
Silver and gold usually move together, silver with about twice gold's volatility. Two stories are told about the times the
volatility ratio departs from its norm:
- **Silver calm against gold** (the ratio of silver's realised volatility to gold's is low for the year): the metals' move is
  driven by gold-specific demand (haven, central-bank, currency) rather than by speculative metal flows, and gold's own
  trend is said to continue up.
- **Silver wild against gold** (the ratio is high for the year): speculative froth in the metals complex, after which gold
  is said to give back.

Does buying gold when the ratio is low, or selling it when the ratio is high, make money net of costs over five days, and
more than the same-side five-day trade taken on every eligible day (the unconditional same-side baseline, which carries
gold's drift)?

A **stand-alone daily rule**. It is not a gate, exit, entry or size change of the live gold book (Gold trend / Gold daily
engulf) and reads none of that book's 2006-17 positions (owner decision 44); daily candles alone are used.
Not covered by an earlier study: `gold-silver-ratio` trades the gold / silver PRICE ratio back to its mean;
`gold-silver-divergence` a gold 24-hour extreme silver does not confirm; `gold-silver-lead-intraday` silver's intraday lead;
`gold-drd-silver` / `drd-metals-book` a daily-rejection pattern on silver; `gold-volvol-switch`, `gold-vol-target`,
`gold-vol-breakout*`, `gold-realized-skew` read gold's own volatility only. None reads silver's volatility relative to gold's.

## Data (named before any result)
- Two markets, read only: XAU/USD (traded) and XAG/USD (signal input only). council-data `research/daily/xau.json` and
  `research/daily/xag.json` at commit `67bac79eb` (OANDA mid daily candles, UTC days, from March 2006), weekend stubs folded
  into the next weekday with `council/fills.mjs` `foldWeekend` for both. A day is used only when both markets have a candle
  with the same day time; the two series are joined on that time.

## Rule
- `rv(m, i)` = sample standard deviation of the 20 daily log close-to-close returns of market m ending at day i (closes
  i-20 to i). `Q(i) = rv(xag, i) / rv(xau, i)`.
- `pct(i)` = the share of the 252 values `Q(i-251) .. Q(i)` that are <= `Q(i)` (a trailing percentile; reads nothing after
  day i). Needs 272 joined days of history.
- **Low** signal at the close of day i: `pct(i) <= 0.20`. **High** signal: `pct(i) >= 0.80`.
- Entry at the open of day i+1 (gold). Buy on a Low signal, sell on a High signal.
- **Stop** = 1.5 x ATR(20) of gold at day i (true range, the 20 days ending at i) from the entry, on the losing side. A day
  that opens through the stop fills at its open, else a touch (low for a buy, high for a sell) fills at the stop. No target.
  **Exit** at the close of day i+5 (five trading days held, entry day included), or at the stop.
- One trade at a time per test: after a trade, the next signal day must be at or after the exit day.

## Tests (three, Holm over the three)
- **T1 (primary): buy gold when silver is calm against gold** (Low signal, long).
- **T2: sell gold when silver is wild against gold** (High signal, short).
- **T3: both together** (T1 and T2 signals in one stream, one trade at a time, the earlier signal first).
- **Same-side baseline** (comparison and one pass condition, not a fourth test): the same trade (entry at the next open,
  same stop rule, out at the close of day i+5, same costs) on EVERY day i of the window for which `pct(i)` is defined, long
  and short separately (overlapping pool). The baseline net R of a test = the mean, over its trades, of the pool's mean net
  R for the trade's side in the same window. **Excess** = the test's net R a trade minus that baseline, with a Welch-type t
  (trades' sd and the pool mean's error).

## Costs
- $0.60 a round trip (spread $0.30 + $0.15 slippage each side).
- Buys pay overnight financing: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price; sells pay and earn nothing.
- Cost share of R, estimated from the earlier daily gold studies on the same candles (median 1.5 x ATR(20) about $28 in
  2007-16 and $36 in 2017-26): the $0.60 is about 2 % of R; about seven nights of financing on a buy about 4-5 % of R. The
  realised cost share of the test trades is reported.
- 2x costs = the round trip and the financing both doubled.

## Statistics and windows
- R a trade, 1R = the stop distance. Trades counted by EXIT month. In sample 2007-01 to 2016-12, out of sample 2017-01 to
  2026-10. t = mean / standard error of net R summed by calendar month, over EVERY calendar month of the window (months
  with no trade count as 0). One-sided p from t (normal), Holm over the three tests.
- **Placebo**: 40 seeds; each real trade is replaced by a baseline trade of a random eligible day of the same window with the
  same side; the OOS net month t of each seed. The real t must beat more than 38 of the 40.
- **Pass** (each test on its own): OOS net month mean > 0 with t >= 2 and Holm p < 0.05; in-sample net month mean > 0; OOS
  mean still > 0 at 2x costs; more than 38 of 40 placebo seeds below the real OOS t; and the OOS excess over the same-side
  baseline > 0. The verdict is PASS only if T1 (the primary) passes; a pass of T2 or T3 alone is reported as such.
- Also reported (description, not tests): signal days per window, the median ratio Q per window, per-year net R.
- Nothing is changed after the run; if it fails, no variant (percentile cut, lookback, hold, stop) is tried here.
