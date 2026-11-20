# Pre-registration: usdjpy-vol-breakout-exec (20 Nov 2026)

Paper research only. T1 on USD/JPY (UTC open ± 0.5 × the previous folded day's range, stop at the open, out at 21:00 UTC),
**unchanged**, filled at the demo broker's own ticks, exactly as `gold-vol-breakout-exec` did for gold: the stop-order entry at the
first broker tick that crosses the trigger, a stop exit at the first tick that crosses the stop, the time exit at the 21:00 quote.
This prices the one thing `fx-vol-breakout`, `usdjpy-vol-breakout-early` and the forward record assume (a half-pip allowance on
OANDA mid): real fills. Nothing live changes.

Written and pushed alone, **before any broker tick of these trades is read** (the probe has read USD/JPY only at 00:55 and 06:00
UTC on gotobi days, `gotobi-exec`).

## Trades
T1 through `usdjpy-vol-breakout-early/run.mjs` `trades` (the pinned `index-vol-breakout/original.mjs`, sha256 afa36e03…276f), on
OANDA mid M5 USD/JPY, days **2023-11-24 to 2026-11-19** (inside the broker's tick history, as gotobi-exec found it). For each
trade: the fill candle, side, O (the stop), trigger, how the OANDA path ended.

## The measurement (tick probe `fills` and `marks`, unchanged code)
For each trade, from the broker's ticks of both sides (`gold-vol-breakout-exec`'s `queriesOf` / `brokerTrade` logic, with the
OANDA-to-broker stop margin NEAR = 0.05 yen in place of gold's $0.50):
1. **Entry**: the first tick from the start of the OANDA fill candle to its end + 5 minutes where ask ≥ trigger (buy) or bid ≤
   trigger (sell); fill = that tick's ask / bid.
2. **Stop exit**: the first tick at or after the entry, up to 21:00 UTC, where bid ≤ O (buy) or ask ≥ O (sell); checked on every
   M5 candle whose OANDA extreme came within NEAR of O.
3. **Time exit**: the bid (buy) / ask (sell) last quoted at or before 21:00:00 UTC, at most an hour old.
A trade the broker's ticks never trigger is "not filled" (R 0). The broker's ticks decide stopped or not.

## R and the bar
r = |trigger − O|. R = side × (exit − fill) / r − (2 × 0.0000225 × fill) / r (the demo's commission, 22.5 a million a side).
**PASS**: n ≥ 300 filled trades and broker net R a trade > 0 with month-sum t ≥ 2. Else FAIL (TOO FEW under 300). Reported:
entry and stop slippage (median, mean, 90th percentile, in yen and in R), the same trades on OANDA mid, by year and side, and the
share of the ten best trades. These years are in sample for `fx-vol-breakout` (2016-26): this prices the rule at real fills, it
is not new evidence that it works; a pass is no reason to trade by itself (owner).
