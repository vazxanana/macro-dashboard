# Pre-registration: energy-vol-breakout-hourcost (20 Nov 2026)

Paper research only. `energy-vol-breakout` (20 Nov 2026) tested gold's T1 on WTI, Brent and natural gas with an ASSUMED cost of
0.1 % of the entry a round trip and FAILED (pooled −0.014R a trade net, n 5,221; +0.059R before costs). This study asks: **does
that study's own pre-registered bar pass when each trade is charged the demo broker's measured spread at its fill hour and exit
hour?** The method is `index-vol-breakout-hourcost`'s, unchanged. No rule changes; nothing live changes; not part of ICT.

## What the author has seen
`energy-vol-breakout`'s result (every figure above, per market). **No energy spread of the demo broker has been read**; the
council's `ctrader/symbols.json` lists no energy symbol. This plan is pushed alone, before the probe runs.

## Trades (unchanged)
`energy-vol-breakout/run.mjs` `trades` / `placeboTrades` / `judge` on the same OANDA mid M5 candles (fetched again from the candle
proxy over the same span, 2015-12-01 → 20 Nov 2026). **Harness gate:** with the original 0.1 % cost the study reproduces
`energy-vol-breakout/result.json` per market (n, net R, month t); if not, it stops and says so.

## The measurement
The tick probe (`council/tick-probe.mjs`, `tick-probe.yml`, part `hours`) on the broker's energy symbols. The broker's names are
not known: the run asks for `XTIUSD XBRUSD XNGUSD USOIL UKOIL NGAS WTI BRENT`; for each market the first name listed by the broker
in that order (WTI: XTIUSD, USOIL, WTI; Brent: XBRUSD, UKOIL, BRENT; gas: XNGUSD, NGAS) is used. `hourProfile[h].frac` = the median
quoted spread as a share of the mid at UTC hour h over the last 60 weekdays; commission from the symbol's `commissionRT` when the
council's file lists it, else 0 (said so). **Not measurable** for a market (left out, said so): no listed name, or any hour 00-20
with fewer than 10 windows.

## Cost (route C1 of index-vol-breakout-hourcost)
cost = (0.5 × frac[h_fill] + 0.5 × frac[20] + commissionRT) × entry + 0.05 × the median high − low of the 12 M5 candles ending
with the fill candle (slippage), per trade; 2x = twice it.

## Bar (energy-vol-breakout's, unchanged)
Pool of the measurable markets 2016 → now: net R > 0 in 2016-20 AND 2021 → now; month t ≥ 2; net > 0 at 2x cost; beats ≥ 38 of
40 placebo seed means (same cost route). Per market reported with Holm. A PASS makes the breakout a candidate on energies for a
forward record only; a FAIL stands as energy-vol-breakout's verdict at the measured cost.
