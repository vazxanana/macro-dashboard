# Result: the gold volatility breakout filled at the demo broker's own ticks (20 Nov 2026)

**Verdict: PASS on the pre-registered bar.** `gold-vol-breakout` T1, unchanged, filled at the first broker tick across its
trigger, stopped at the first broker tick across its stop and closed at the last broker quote before 21:00 UTC: **+0.184R a
trade after commission, 572 filled trades (24 Nov 2023 → 12 Nov 2026), month t 3.54**. The same trades on OANDA mid made
+0.192R before any cost, so real fills and commission cost about 0.01R a trade. The stop-order slippage, the one cost the
hour-cost study still assumed, is small: **$0.07 median at entry ($0.28 mean, $0.67 at the 90th percentile), 0.011R a trade**;
at the stop $0.065 median ($0.30 mean, $0.46 p90).

**What this is not.** These three years sit inside the period the rule was found and tuned on (`gold-vol-breakout`, 2007-26), so
this is the rule priced at real fills, not new evidence that it works. A pass is not by itself a reason to trade: that stays
the owner's decision (`research/proposals/2026-11-14-gold-vol-breakout.md`). Nothing live changed.

Pre-registered in `PREREGISTRATION.md` (pushed alone, before any broker tick of these trades was read). Trades: T1 through
`gold-vol-breakout-hourcost/original.mjs` (byte for byte) on OANDA mid M5, 582 trades (`trades.json`).

## The measurement

Two reads of the tick probe (`council/tick-probe.mjs`, the demo broker's past bid / ask ticks, read only):
- council-data `research/probe/ticks-XAUUSD.json`, commit a00d5984d (20 Nov 03:28-04:23 UTC): 2,275 fill queries (entry and
  stop windows) and the 582 exit marks.
- council-data `research/probe/ticks-XAUUSD-x.json`, commit 5d2ae2dcd: 387 exit marks read again with a one-hour look-back.

**An implementation gap, closed before the result was read in full.** The probe looked for each exit mark's quote within
±60 s of 21:00:00 UTC. On US summer-time days 21:00 UTC is 17:00 New York, the start of gold's daily break: the broker's last
quote comes about 60 s earlier (median age 60 s, 90th percentile 62 s), so 387 of 582 marks came back empty and the first
report kept only 296 trades, mostly stopped ones (−0.23R, TOO FEW). The pre-registration's rule is "the bid / ask last quoted
at or before 21:00:00 UTC" with no age limit, so the probe gained a look-back (`PROBE_MARKS_BACK`, #1296) and the report reads
the time-exit quote up to an hour old (`X_AGE`). 7 trades still have no quote (early-close holidays) and are left out; 3
triggers were never crossed on the broker (R 0, counted).

## Numbers

| | n | net R a trade | month t |
|---|---|---|---|
| Broker fills, all (incl. 3 not filled) | 575 | **+0.184** | **3.54** |
| Broker fills, filled only | 572 | +0.185 | |
| Same trades on OANDA mid, before costs | 575 | +0.192 | |

Stops: 172 on the broker against 180 on OANDA (the broker's ticks decide). Commission 2 × 0.000024 of price.

**Descriptive, not part of the bar** (computed after the verdict; `result.json` `split`):

| Year | n | net R |
|---|---|---|
| 2023 (from 24 Nov) | 18 | +0.459 |
| 2024 | 198 | +0.070 |
| 2025 | 189 | +0.202 |
| 2026 (to 12 Nov) | 167 | +0.271 |

Buys +0.208R (n 310), sells +0.158R (n 262). **The ten best trades carry 55 % of the total**; without them the rest average
+0.085R. 2024 was close to flat. A forward record would show quickly whether the rule still pays when gold is not trending.

## What it means

The breakout's open cost question is answered for today's demo account: spreads at every hour (`gold-vol-breakout-hourcost`)
and the stop order's own slippage (here) together take about 0.03R a trade, far under the $0.60 a round trip the original
studies charged. What is left before any live use is the forward record itself, which only a paper / demo stream can give.

To repeat: `node research/edge/gold-vol-breakout-exec/run.mjs report <ticks-XAUUSD.json> "<commits>" <ticks-XAUUSD-x.json>`.
Test: `tests/gold-vol-breakout-exec.test.mjs`.
