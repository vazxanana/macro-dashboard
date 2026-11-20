# Pre-registration: gold-vol-breakout-exec (20 Nov 2026)

Paper research only. `gold-vol-breakout`'s T1 (UTC open ± 0.5 × the previous folded day's range, stop at the open, out at
21:00 UTC), **unchanged**, filled at the demo broker's own ticks: the stop-order entry at the first broker tick that crosses the
trigger, a stop exit at the first tick that crosses the stop, the time exit at the 21:00 quote. This measures the one cost the
hour-cost study (`gold-vol-breakout-hourcost`) still assumed: the slippage of a stop order on a breakout. Nothing live changes.

Written and pushed alone, **before any broker tick of these trades is read** (the probe has read gold's quotes only at the top
of each hour and around US releases).

## Trades

T1 of `gold-vol-breakout/run.mjs` (via `gold-vol-breakout-hourcost/original.mjs`, byte for byte, sha256
afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f) on OANDA mid M5, days from 24 Nov 2023 (inside the broker's
tick history) to 12 Nov 2026. For each trade the OANDA path gives the fill candle, the side, O (the stop), the trigger level and
how it ended (stop or time).

## The measurement (tick probe, new `fills` part)

For each trade, from the broker's ticks of both sides:
1. **Entry**: the first tick at or after the start of the OANDA fill candle (and no later than its end + 5 minutes) where
   ask ≥ trigger (a buy) or bid ≤ trigger (a sell). Fill = that tick's ask (buy) / bid (sell).
2. **Stop exit** (trades that the OANDA path stopped): the first tick at or after the entry tick, up to 21:00 UTC, where
   bid ≤ O (a buy) or ask ≥ O (a sell). Exit = that tick's bid (buy) / ask (sell).
3. **Time exit**: the bid (buy) / ask (sell) last quoted at or before 21:00:00 UTC.
A trade whose entry the broker's ticks never cross in the window is "not filled on the broker" (counted, R 0). A trade the OANDA
path did NOT stop but the broker's ticks do stop is taken as stopped (the broker's ticks decide), and the reverse: the stop query
runs for every filled trade.

## R

r = |trigger − O| (the planned risk, as T1). R = side × (exit − fill) / r − commission (2 × 0.000024 × fill) / r.
Reported beside: the same trades on OANDA mid (T1's own R) and the hour-cost study's C1 charge.

## Reading, fixed now

- **The slippage**: entry fill minus trigger in $ and in R (median, mean, 90th percentile), stop-exit slippage likewise.
- **PASS**: n ≥ 300 filled trades, broker net R > 0 with month t ≥ 2. Else FAIL. This is the rule priced at real fills over
  three recent years; it is not new evidence about the years before, and a pass is not by itself a reason to trade (owner).

## Deliverables

`research/edge/gold-vol-breakout-exec/{PREREGISTRATION.md, run.mjs, queries.json, RESULT.md, result.json}`, the probe's `fills`
part, tests.
