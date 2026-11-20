# Pre-registration: index-vol-breakout-hourcost (20 Nov 2026)

Paper research only. `index-vol-breakout` (14 Nov 2026) tested gold-vol-breakout's T1 rule, unchanged, on NAS100 and SPX500
(2016 → 11 Nov 2026) and **FAILED on both**, with assumed round-trip costs of 3 points (NAS100) and 1 point (SPX500). Before
costs it was positive (NAS100 gross +0.055R, month t +2.58; SPX500 +0.032R, t +1.49). The gold version of the same rule turned
out to cost far less on the demo broker than assumed (`gold-vol-breakout-hourcost`, `gold-vol-breakout-exec`). This study asks
the same question for the indices: **does `index-vol-breakout`'s own pre-registered bar pass when each trade is charged the
demo broker's measured spread at its fill hour and exit hour?** No rule changes. Not a gate, exit, entry or size of any live
book; not part of ICT. Nothing live changes and no proposal is written by this study.

## What the author has seen before writing this

- `index-vol-breakout`'s result (every figure above, its placebo means, its failed checks: NAS100 failed isPos, t2, holm,
  cost2x and the placebo with 34 of 40 beaten; SPX500 failed those and oosPos with 25 of 40).
- The council's own `ctrader/symbols.json` spread reads (all hours together, 17-20 Nov 2026, 282 reads): NAS100 median 0.8
  points, US500 (the demo's SPX500) median 0.3 points, commission 0 on both. **No hourly index spread has been read**: the tick
  probe has not been run on NAS100 or US500. This plan is pushed alone, before that probe run.

## Trades (unchanged)

`index-vol-breakout`'s `run.mjs` and `original.mjs` imported unchanged (`buildDays`, `daySkip`, `vbTrade`, `placeboTrade`,
`tradeDays`, `runMarket`, `placebo`, `decide`, `summary`, `T1`, `WINDOWS`, `SEEDS`, `PLACEBO`). OANDA mid M5 NAS100 and SPX500,
2015-12-01 → 2026-11-12 23:55 UTC (the same span as the original), fetched through the candle proxy, kept out of git.

**Harness gate (before anything else is reported):** with the original constant costs (3 / 1 points), the study reproduces
`index-vol-breakout/result.json` exactly: per market and window n, net R, gross R, month t, and the 40 placebo means. If not,
it stops and says so.

## The measurement

The tick probe (`council/tick-probe.mjs`, workflow `tick-probe.yml`, `NAS100:hours US500:hours`): for each UTC hour h over the
last 60 weekdays, `hourProfile[h].frac` = the median of the per-window median spread as a share of the mid, `frac90` = the 90th
percentile. Commission: `commissionRT` of each symbol in council-data `ctrader/symbols.json` (0 today).
**Not measurable** (the study stops and says so): the probe file is missing for a market, or any hour 00-20 has fewer than 10
windows.

## Cost routes (round trip, index points, as a share of the entry price, so 2016's lower levels are charged in proportion)

- **H**: cost = (0.5 × frac[h_fill] + 0.5 × frac[20] + commissionRT) × entry. h_fill = the UTC hour of the fill candle
  (`fillMin` / 60; for a placebo trade, the hour of its random start), 20 = the hour of the 20:55 exit candle.
- **H90**: the same with `frac90`.
- Plus stop-entry slippage s × M, M = the median high − low of the 12 M5 candles ending with the fill candle (the gold costs
  study's `medRange` convention); s = 0.05 with H (**condition C1**), s = 0.10 with H90 (**condition C2**). Placebo trades are
  charged by the same route. "2x costs" in the bar = twice the C1 cost.

## Reading, fixed now

**Per market, PASS = every check of `index-vol-breakout`'s own `decide()` under C1** (2016-20 > 0, 2021 → now > 0, month t ≥ 2,
Holm < 0.05 over the two markets, net > 0 at 2x costs, at least 38 of 40 placebos beaten, n ≥ 30 in each window). C2 is
reported beside it as the stress case. Two markets, Holm as in the original. A pass is a cost result on a rule already found on
gold; it is not by itself a reason to trade (owner). Today's relative spreads are applied to every year (as the gold studies
did); 60 weekdays of one demo account; the spread at the first 2 minutes of an hour stands for that hour; stop slippage assumed.

## Deliverables

`research/edge/index-vol-breakout-hourcost/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`, a test, the probe run's
commit named in result.json.
