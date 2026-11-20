# Pre-registration: pgm-vol-breakout-hourcost (20 Nov 2026)

Paper research only. `pgm-vol-breakout` (20 Nov 2026) tested gold's T1 on platinum and palladium with ASSUMED costs (0.30 % /
0.20 % of the entry a round trip) and FAILED (pooled −0.181R a trade net, n 4,082; +0.060R before costs). This study asks: **does
that study's own pre-registered bar pass when each trade is charged the demo broker's measured spread at its fill hour and exit
hour?** The method is `energy-vol-breakout-hourcost`'s (route C1), unchanged. No rule changes; nothing live changes.

## What the author has seen
`pgm-vol-breakout`'s result. **No platinum or palladium quote of the demo broker has been read**; the council's
`ctrader/symbols.json` lists neither metal. A probe run asking for `XPTUSD` and `XPDUSD` (part `hours`) was started before this
file was written; its output has not been read. This plan is pushed alone before it is.

## Trades (unchanged)
`pgm-vol-breakout/run.mjs` `trades` / `placeboTrades` / `judge` on the same OANDA mid M5 candles. **Harness gate:** with the
original costs the study reproduces `pgm-vol-breakout/result.json` per market (n, net R, month t); if not, it stops.

## The measurement
Tick probe (`council/tick-probe.mjs`, part `hours`) on `XPTUSD` and `XPDUSD`. `hourProfile[h].frac` = the median quoted spread as
a share of the mid at UTC hour h over the last 60 weekdays; commission from the probe file when it lists one, else 0 (said so).
**Not measurable** for a market (left out, said so): the broker does not list it, or any hour 00-20 has fewer than 10 windows.

## Cost (route C1)
cost = (0.5 × frac[h_fill] + 0.5 × frac[20] + commission) × entry + 0.05 × the median high − low of the 12 M5 candles ending with
the fill candle (slippage), per trade; 2x = twice it.

## Bar (pgm-vol-breakout's, unchanged)
Pool of the measurable markets 2016 → now: net R > 0 in 2016-20 AND 2021 → now; month t ≥ 2; net > 0 at 2x cost; beats ≥ 38 of
40 placebo seed means (same cost route). Per market reported with Holm. A PASS makes the breakout a candidate on these metals for a
forward record only; a FAIL stands as pgm-vol-breakout's verdict at the measured cost.
