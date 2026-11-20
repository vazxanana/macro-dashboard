# Pre-registration: gold-vol-breakout-hourcost (20 Nov 2026)

Paper research only. **Cost accounting of one fixed rule, with spreads measured hour by hour on the demo broker; no rule is
tested here and no rule's verdict changes.** The rule is `gold-vol-breakout`'s T1, unchanged: a stand-alone intraday rule on
spot gold, **not** a gate, exit, entry or size of the live gold book (owner decision 44: none of that book's records are
read). Nothing live changes and no proposal is written by this study.

Written and pushed alone, **before the spread measurement it uses exists**: the demo tick probe (`council/tick-probe.mjs`,
workflow `tick-probe.yml`, PR #1285) has not run yet, so no hourly gold spread is known to the author.

## Why

`research/proposals/2026-11-14-gold-vol-breakout.md` names the open question: T1's thin margin (pooled 2007 → 12 Nov 2026
+0.073R a trade at $0.60, gross +0.155R) depends on what a round trip really costs, and above all in Asian hours, where two
thirds of the gross is made (fills before 07:00 UTC: gross +0.383R a trade) and spreads are widest. `gold-vol-breakout-costs`
charged one flat demo figure ($0.07 median spread over one day of quotes, all hours together). This study charges each trade
the spread the demo broker quoted **at the hour of its fill and at the hour of its exit**.

## The rule and the trades (unchanged)

`original.mjs` = `gold-vol-breakout`'s `run.mjs` byte for byte (sha256
afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f); `costs.mjs` = `gold-vol-breakout-costs/run.mjs` byte for
byte (sha256 c753937339a0e5531c011bb4ed6473a1e4f9682e28c203cac20152f7891c922a). This study imports `tradesIn`, `stats`,
`medRange`, `WINDOWS`, `SLIPS`'s convention and the original's `monthT`, `quantile`, `normP`, `holm` and changes none of them.
Trades: T1 on OANDA mid XAU/USD M5 2006-11-01 → 2026-11-12 (`xau-5m.json.gz`, out of git, fetched through the candle proxy
with `gold-gap-open/fetch.mjs`), windows W1 2007-11, W2 2012-15, W3 2016-20, W4 2021 → data end, POOLED 2007 → data end.

## Harness gate (before anything else is reported)

Under the costs study's route S ($0.60) with no slippage, every window must reproduce `gold-vol-breakout-costs/result.json`
exactly (n, net R, gross R, month t). If it fails, the study stops and says so.

## The measurement

`research/probe/ticks-XAUUSD.json` on council-data, the first run of the tick probe (its commit named in result.json):
`hourProfile[h]` = for UTC hour h, over the last 60 weekdays (inside the broker's history), `frac` = the median of the
per-window median spread as a share of the mid, and `frac90` = the 90th percentile of the same. Commission: `commissionRT` of
`XAUUSD` in council-data `ctrader/symbols.json` at the same date (a share of the price, round trip).

**Not measurable** (the study stops, reports that and nothing else): the probe file is missing, its history reaches fewer than
20 weekdays, or any hour from 00 to 20 has fewer than 10 windows.

## Cost routes (round trip, per ounce, a share of the entry price)

- **H**: cost = (0.5 × frac[h_fill] + 0.5 × frac[20] + commissionRT) × entry, h_fill = the UTC hour of the fill candle
  (`fillMin` / 60), 20 = the hour of the 20:55 exit candle. A market order pays half the quoted spread against the mid at
  each end.
- **H90**: the same with `frac90`.
- Plus stop-entry slippage s × M, s ∈ {0, 0.05, 0.10}, M = the costs study's `medRange` (median range of the 12 M5 candles
  ending with the fill candle), in R: net = R − finR − (cost + s × M) / r. The same s × M convention as the costs study.

## What is reported

Per window and per route × slippage: n, net R a trade, month t, total R; by fill session (Asia 00-07, London 07-12, New
York 12-21): n, gross, net under H + 0.05. The hour profile itself (frac, frac90, n per hour).

## Reading, fixed now

Two conditions, judged on POOLED and on W4:
1. **C1 = H + 0.05 × M**, the measured spread with a modest stop slippage;
2. **C2 = H90 + 0.10 × M**, the widest usual hours with more slippage.

The verdict line states whether T1 stays positive with month t ≥ 2 under each, on each window. One-sided p from month t
(`normP`), Holm over 2 conditions × 2 windows. **This is accounting:** it can say the measured cost does not kill the rule;
it cannot make the rule an edge (its 2016-20 and 2017-26 figures stand) and it says nothing about past years' spreads (today's
relative spread is applied to 2007-26, as route D did). Caveats said in the result: 60 weekdays of one demo account; the
spread at the first 2 minutes of each hour stands for the whole hour; stop-order slippage is assumed, not measured.

## Deliverables

`research/edge/gold-vol-breakout-hourcost/{PREREGISTRATION.md, original.mjs, costs.mjs, run.mjs, RESULT.md, result.json}`,
`tests/gold-vol-breakout-hourcost.test.mjs`, `out/` rebuilt.
