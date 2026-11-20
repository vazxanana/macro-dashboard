# Result: the gold volatility breakout at the demo's measured hourly spreads (20 Nov 2026)

**Verdict: ACCOUNTING (no rule tested): at the demo broker's measured hourly spreads, `gold-vol-breakout` T1 stays positive with
month t ≥ 2 under both pre-registered conditions, pooled 2007-26 and on 2021-26: C1 (median spread + 0.05 × M slippage)
+0.139R a trade (n 3,713, t 6.47) and +0.105R (n 1,121, t 2.79); C2 (90th-percentile spread + 0.10 × M) +0.132R (t 6.11) and
+0.098R (t 2.59). Holm p ≤ 0.005 for all four.** The cost question of `research/proposals/2026-11-14-gold-vol-breakout.md`
("what does a round trip cost at 00:00-07:00 UTC") is answered for today's demo account: **the same as any other hour**, about
0.02R a trade.

Pre-registered in `PREREGISTRATION.md` (pushed alone, before the measurement existed). The rule is `gold-vol-breakout`'s T1 from
`original.mjs` (byte for byte) through `costs.mjs` (`gold-vol-breakout-costs/run.mjs` byte for byte). The harness gate held: route
S ($0.60) reproduces the costs study in every window, exactly. Nothing live changed and no proposal is written here.

## The measurement (council-data `research/probe/ticks-XAUUSD.json`, commit 0459ec37, read 20 Nov 2026 00:58 UTC)

The demo broker's own bid and ask ticks at the first 2 minutes of every UTC hour of the last 44 weekdays (its history reaches at
least 1,095 days back). Quoted spread, median of the per-window medians (90th percentile), US dollars:

| UTC hour | 00 | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| median $ | 0.10 | 0.105 | 0.085 | 0.07 | 0.08 | 0.09 | 0.075 | 0.10 | 0.10 | 0.075 | 0.08 | 0.07 | 0.08 | 0.10 | 0.09 | 0.08 | 0.08 | 0.07 | 0.07 | 0.09 | 0.10 |
| p90 $ | 0.10 | 0.11 | 0.10 | 0.10 | 0.10 | 0.10 | 0.10 | 0.10 | 0.11 | 0.10 | 0.10 | 0.10 | 0.10 | 0.11 | 0.11 | 0.11 | 0.10 | 0.09 | 0.10 | 0.10 | 0.10 |

As a share of the mid, 1.7-2.6 × 10⁻⁵ in every hour (about $0.07-0.10 at $3,600-4,100 gold). Commission `commissionRT`
0.000024 of price (council-data `ctrader/symbols.json`). Asian hours are **not** wider on this account. Single-tick maxima reach
$1-9 (around 22:00-23:00 UTC, the rollover, and news minutes): the medians, not the maxima, are what a fill usually pays.

## Net R a trade (month t), every window

| Route | Slippage | 2007-11 | 2012-15 | 2016-20 | 2021-26 | Pooled 2007-26 |
|---|---|---|---|---|---|---|
| H (median) | 0 | +0.209 (5.13) | +0.177 (3.04) | +0.101 (2.59) | +0.112 (2.98) | +0.146 (6.81) |
| H | 0.05 × M | +0.202 (4.93) | +0.170 (2.93) | +0.094 (2.41) | +0.105 (2.79) | **+0.139 (6.47)** |
| H | 0.10 × M | +0.194 (4.73) | +0.164 (2.81) | +0.087 (2.23) | +0.098 (2.60) | +0.132 (6.14) |
| H90 | 0.10 × M | +0.194 (4.72) | +0.163 (2.80) | +0.086 (2.21) | +0.098 (2.59) | **+0.132 (6.11)** |
| studies' $0.60 (reference) | 0 | +0.120 (2.83) | +0.100 (1.70) | +0.009 (0.22) | +0.072 (1.86) | +0.073 (3.35) |

By fill session, pooled, C1: Asia n 985, gross +0.383R, cost 0.019R, net +0.364R; London n 1,066, +0.113 → +0.098R; New York
n 1,662, +0.047 → +0.032R.

## What this does and does not say

- **It answers the cost question for today's account.** At $0.07-0.10 of spread and $0.09-0.10 of commission a round trip, T1
  pays about 0.015-0.02R a trade, a tenth of its gross. The studies' $0.60 was eight times too high for this account.
- **Past years are charged today's relative spread**, as route D of the costs study did: in 2007 a retail gold spread was surely
  wider than 2 × 10⁻⁵ of $650. The pooled and 2007-15 figures are therefore what the rule WOULD earn at today's cost, not what it
  earned then. The 2021-26 window (+0.105R, t 2.79) is the one closest to today's costs.
- **Slippage of a stop order on a breakout is assumed** (0.05-0.10 × the recent M5 range), not measured. A forward demo record is
  the only way to measure it, and with it the real cost.
- **The rule's other weaknesses stand**: 2016-20 was flat at $0.60 (here t 2.41 at measured cost); the 17:00 New York day cut
  nets far less than the 00:00 UTC cut (`gold-vol-breakout-k`, not re-run here); the longest stretch under water was 4.4 years at
  $0.60. 60 weekdays of one demo account's quotes are a snapshot.
- Nothing here is an edge on its own: the rule's evidence is `gold-vol-breakout` (FAIL, near miss), its replication on 2007-15
  (PASS), the feed check (PASS) and now a measured cost that no longer threatens it. What it supports is the owner's decision in
  the proposal: a forward paper or demo record, whose first job is to measure the fill slippage.

To repeat: `node research/edge/gold-vol-breakout-hourcost/run.mjs <dir> <ticks-XAUUSD.json> <symbols.json> [probeCommit]` with
`<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11-01 → 2026-11-13, `gold-gap-open/fetch.mjs` with `GGO_FROM` / `GGO_TO`).
