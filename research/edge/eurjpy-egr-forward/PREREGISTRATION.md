# Pre-registration: eurjpy-egr-forward (28 Nov 2026)

Paper research only. **A forward record of one fixed rule on candles no study has read.** Not a live rule, not a paper or demo
stream: nothing is traded, alerted, mirrored or copied, and no council member reads its file. Written and pushed alone, before
any forward trade has been computed.

## Why
`eurjpy-egr-exec` priced the auto-researcher's EUR/JPY engulf-retest sell (auto-3 `eurjpy|egr48|short|none|0.75|1.5`) at the
demo broker's own bid / ask, 2023-12-01 → 2026-11-20: **PASS**, +0.409R a trade after commission and swap (n 106, month t 4.69;
mid candles +0.364R). But the rule was picked among about 1.1 million looks on those same years, on one market, sells only.
Every year of its history has been read; the one source of new evidence is time.

## The rule and its cost (frozen)
- **Orders**: `research/edge/eurjpy-egr-exec/orders.mjs` `orders(D, G)` on OANDA mid EUR/JPY H1 (closed candles only, read
  from 2025-06-01 for the warm-up of the ATR, its 500-reading percentile and the zones): the first return to a standing H1
  engulf zone up to 48 candles old that closes back out, sold at the next open at 10-15 UTC with the ATR in the top 70 % of its
  last 500 readings; stop 0.75 x ATR(14), target 1.5R, out after 24 H1 candles, one position at a time.
- **Cost**: `midR` (which already takes the engine's round trip `D.cost`, the edgekit EUR/JPY figure) less the demo's commission
  0.000045 x entry and its swap on a short (`finR`, 1.007 pips a night, Wednesday three), as the exec study charged them; never
  refreshed. The record also reports the total at twice that cost; a "confirmed" reading needs both above zero.
- **Counted**: orders filled at or after **2026-11-30 00:00 UTC**, once every one of their 24 hold candles is on file (a stop
  or target hit earlier is still counted only then: the record never books a half-known trade).

## The expected range (fixed now)
Built from the exec study's own 106 window orders (2023-12-01 → 2026-11-20) under that cost on mid candles, recomputed by this
study's `baseline` step and gated against the exec study's result.json (n 106 and mid mean R +0.364 must match): **A, as
measured** and **B, no edge** (the same trades less their mean). For N closed forward trades each world's total is drawn 20,000
times by resampling whole calendar months with replacement, cut at N (`gold-vol-breakout-forward` `bands`, imported).

## Readings and checkpoints (as gold-vol-breakout-forward)
- Too few while N < 20; below the measured range when the total is under A's 5th percentile; ahead of a no-edge rule when above
  B's 95th; undecided otherwise.
- **N ≥ 120**: **fails** if under A's 5th percentile, else **holds so far**.
- **N ≥ 240**: **confirmed** only if above B's 95th percentile, month-sum t ≥ 2 AND the total at twice the cost above zero;
  **fails** if under A's 5th; else **not shown either way**. The first crossing of a checkpoint stands.

About three trades a month: 20 trades take about half a year, 120 about three years. Said now so nobody judges it early.

## What this cannot measure
Execution (mid candles plus the measured allowance, not fills; the exec study found ticks a little better than mid). A record
picked from 1.1 million looks will most likely come in under its history: A's range is optimistic. One market, sells only, one
regime. Nothing here makes it a live rule.

## Running
`node research/edge/eurjpy-egr-forward/run.mjs fetch <dir>` then `… run <dir> [out.json]`; `vb-forward.yml` saves it to
council-data `research/forward/eurjpy-egr.json`.
