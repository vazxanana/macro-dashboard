# Pre-registration: gold after its largest 5-day move of the year (capitulation / blow-off), 14 Nov 2026

Written and pushed alone, before any trade of this rule was simulated. Paper research only: nothing live reads it, no
rule, size, filter, stop, config or council member changes whatever the result.

## Question
When gold's 5-day close-to-close return is the most extreme of the past trading year (the largest 5-day fall: a
capitulation; the largest 5-day rise: a blow-off), does gold reverse over the next two weeks, net of costs?

A **stand-alone daily rule**. It is not a gate, exit, entry or size change of the live gold book (Gold trend / Gold daily
engulf) and reads none of that book's 2006-17 positions (owner decision 44). Not covered by an earlier study: the nearest
are `gold-shock-revert` (one extreme DAY measured against ATR, 3-day hold), `gold-13w-low` (a weekly CLOSING LEVEL low, not
the size of a move), `gold-streak` (runs of up / down closes), `gold-200d-stretch` (distance from the 200-day average) and
`gold-weekly-momentum`; none conditions on the 5-day return's rank in its own 252-day history.

## Data (named before any result)
- One market: XAU/USD only. council-data `research/daily/xau.json` at commit `f6288251e` (OANDA mid daily candles, UTC days,
  2006-03-20 to 2026-11-06), weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend`.

## Rule
- `R5(i) = close(i) / close(i-5) - 1`, at the close of day i (closed candles only).
- **Capitulation** at day i: `R5(i)` is strictly lower than every `R5(j)` for j = i-251 .. i-1 (the largest 5-day fall of the
  past 252 trading days, today included). **Blow-off**: strictly higher than every one of them. Needs i >= 256.
- Entry at the open of day i+1. **Stop** = 2 x ATR(20) at day i (true range, the 20 days ending at i) from the entry, every
  trade. Exit at the close of day i+10 (ten trading days held), or at the stop: a day that opens through the stop fills at
  its open, else a touch of the stop (low for a buy, high for a sell) fills at the stop. No target.
- One position at a time per test; a signal while the test's position is open is ignored.

## Tests (three, Holm over the three)
- **T1 (primary, both-sided): reversal.** Buy after a capitulation, sell after a blow-off, one stream.
- **T2: long after a capitulation only** (T1's buy side alone).
- **T3: continuation, both-sided.** Sell after a capitulation, buy after a blow-off (the mirror of T1).
- Comparison, not a test: long every 10th trading day and short every 10th trading day (same hold, stop and costs), the
  unconditional same-side baselines.

## Costs
- $0.60 a round trip (spread $0.30 + $0.15 slippage each side), as `gold-13w-low` / `gold-shock-revert`.
- Buys pay overnight financing: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price; sells pay and earn nothing.
- **Cost share of R**, measured on all days (no signal read): median 2 x ATR(20) is $37.3 in 2007-16 (median gold price
  $1,223) and $47.9 in 2017-26 ($1,822): the $0.60 is 1.6 % / 1.3 % of R; a 14-night buy's financing about 6.8 % / 7.9 % of
  R. Median stop well over $10.
- 2x costs = both the round trip and the financing doubled.

## Statistics and windows
- R a trade, 1R = the stop distance. Trades counted by EXIT month. In sample 2007-01 to 2016-12, out of sample 2017-01 to
  2026-10. t = mean / standard error of net R summed by calendar month, over EVERY calendar month of the window (months
  with no trade count as 0). One-sided p from t (normal), Holm over the three tests.
- **Placebo**: 40 seeds; each real trade's signal day is replaced by a random day of the same window whose trade (same
  side, hold and stop rule) exits in that window; the OOS net month t of each seed; the real t must be above the 95th
  percentile (more than 38 of 40 seeds below).
- **Pass** (each test on its own): OOS net month mean > 0 with t >= 2 and Holm p < 0.05; in-sample net month mean > 0;
  OOS mean still > 0 at 2x costs; above the placebo's 95th percentile. The verdict is PASS only if T1 (the primary) passes; a
  pass of T2 or T3 alone is reported as such, not as a verdict on the rule.
- Expected few trades (signals cluster, ten-day hold); no minimum n is added, the t carries it. Nothing is changed after
  the run; if it fails, no variant is tried here.
