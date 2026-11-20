# Pre-registration: usdjpy-vol-breakout-forward (20 Nov 2026)

Paper research only. **A forward record of one fixed rule on candles no study has read.** Not a live rule, not a paper or demo
stream: nothing is traded, alerted, mirrored or copied, and no council member reads its file. Written and pushed alone, before
any forward trade has been computed.

## Why
`fx-vol-breakout` found gold's T1 breakout positive on USD/JPY 2016-26 (+0.063R a trade net, n 2,079, month t 2.50) while the
six-pair pool failed, and `usdjpy-vol-breakout-early` confirmed it on 2005-2015, years that study never read (+0.079R, n 2,089,
month t 2.95). Both are OANDA mid candles with a pre-set cost. The one source of new evidence left is time: the trades the
frozen rule takes after the last candle either study read (19 Nov 2026).

## The rule and its cost (frozen)
- **Trades**: `research/edge/usdjpy-vol-breakout-early/run.mjs` `trades('usdjpy', days)` (T1 through the pinned
  `index-vol-breakout/original.mjs`, sha256 afa36e03…276f, checked at every run; a mismatch stops it).
- **Cost**: `fx-vol-breakout` `charge` = 0.000045 × entry + 0.005 a round trip (the demo's commission and a half-pip
  allowance), never refreshed.
- **Days**: complete UTC weekdays from **2026-11-20** on, built by `original.mjs` `buildDays` from OANDA mid USD/JPY M5 read
  from 1 Nov 2026 (warm-up for the previous day's range only); the last calendar day on file is left out (it may be forming).

## The expected range (fixed now)
Built from the 2016-26 USD/JPY trades of `fx-vol-breakout` under that cost (n 2,079, the discovery set), recomputed by this
study's `baseline` step and gated against that study's result.json (n and net R must match): **A, as measured** (+0.063R a
trade) and **B, no edge** (the same trades less their mean). For a forward record of N closed trades, each world's total is
drawn 20,000 times by resampling whole calendar months with replacement (seed 20261120), joined in draw order and cut at N
(`gold-vol-breakout-forward` `bands`, imported). Reported: A's 5th / 50th / 95th and B's 95th percentile at N.

## Readings and checkpoints (as gold-vol-breakout-forward)
- Too few while N < 20; below the measured range when the total is under A's 5th percentile; ahead of a no-edge rule when above
  B's 95th; undecided otherwise.
- **N ≥ 120** (about seven months): **fails** if under A's 5th percentile, else **holds so far**.
- **N ≥ 240** (about fifteen months): **confirmed** only if above B's 95th percentile and month-sum t ≥ 2; **fails** if under
  A's 5th; else **not shown either way**. The first crossing of a checkpoint stands.

## What this cannot measure
Execution (mid candles plus an allowance, not fills); the demo broker's own ticks are the test of that. One forward year of
one market is one regime. Nothing here makes it a live rule: that is the owner's decision after a confirmed record.

## Running
`node research/edge/usdjpy-vol-breakout-forward/run.mjs fetch <dir>` then `… run <dir> [out.json]`; `vb-forward.yml` saves it to
council-data `research/forward/usdjpy-vol-breakout.json`.
