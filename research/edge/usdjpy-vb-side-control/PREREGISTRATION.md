# Pre-registration: usdjpy-vb-side-control (20 Nov 2026)

Written and pushed alone, before any control trade is computed. Paper research only; nothing live changes. Not part of ICT.

## Why
USD/JPY's T1 passed on 2016-26 (`fx-vol-breakout`), on 2005-15 (`usdjpy-vol-breakout-early`) and at the broker's ticks
(`usdjpy-vol-breakout-exec`), but almost all of its gain is on the buy side (2005-26 on OANDA mid: buys +0.148R a trade, sells
+0.001R; seen after those results). The original placebo draws a random side, so it cannot tell **timing** (the breakout entry)
from **direction** (being long USD/JPY on the days the rule was long). This control keeps each real trade's day and side and
randomises only the entry time.

## Control
- Trades: T1 on USD/JPY OANDA mid M5, days **2005-01-04 → 2026-11-19**, through `usdjpy-vol-breakout-early/run.mjs` `trades`
  (the pinned `index-vol-breakout/original.mjs`), cost `fx-vol-breakout` `costPx('usdjpy')`.
- Control trade for each real trade, per seed (seeds 1-40, the original's generator `rng(seed)`): on the same day and SAME side,
  a market entry at the open of an M5 candle drawn uniformly from 01:00-18:00 UTC (the original placebo's window), stop at the
  real trade's 1R distance (|trigger − O|) from that entry, out at 21:00 UTC or the stop (`placeboTrade`), same cost.
- Per seed: the mean net R of the control trades.

## Tests and bar
1. **Beat**: the real trades' mean net R beats at least 38 of the 40 seed means.
2. **Paired difference**: per calendar month, sum over the month's trades of (real net R − the mean of that trade's 40 control
   net Rs); month-sum t ≥ 2.
3. Both halves (2005-15, 2016 → now): mean paired difference > 0.
**PASS** (the breakout's timing adds value beyond the side) only if all three hold. **FAIL** means the USD/JPY result is not shown
to be more than being long or short on the same days; the lead then rests on direction, which is a different (and untested)
rule. Reported: the same split by side (buys, sells). Nothing live changes either way.
