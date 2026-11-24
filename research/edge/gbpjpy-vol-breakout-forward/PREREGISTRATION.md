# Pre-registration: gbpjpy-vol-breakout-forward (24 Nov 2026)

Paper research only. **A forward record of one fixed rule on candles no study has read.** Not a live rule, not a paper or demo
stream: nothing is traded, alerted, mirrored or copied, and no council member reads its file. Written and pushed alone, before
any forward trade has been computed.

## Why
`yen-crosses-vol-breakout` put gold's T1 breakout on five yen crosses, 2005 → 20 Nov 2026. The pool failed. GBP/JPY alone
cleared every check (+0.050R a trade net, n 4,198, month t 2.63, Holm p 0.020, positive in 2005-15 and 2016 on, 40 of 40
placebos). **It was the best of five**, so its history flatters it; every year of that history has been read, and no second
feed of GBP/JPY is on file. The one source of new evidence is time.

## The rule and its cost (frozen)
- **Trades**: `research/edge/usdjpy-vol-breakout-early/run.mjs` `trades('gbpjpy', days)` (T1 through the pinned
  `index-vol-breakout/original.mjs`, sha256 checked at every run; a mismatch stops it): the UTC open ± 0.5 x the previous
  day's range, the stop back at the open, out at 21:00 UTC.
- **Cost**: that study's `charge` = 0.000045 × entry + 0.005 a round trip, never refreshed. The cross's real spread is wider
  than this allowance; the record also reports the total at twice the cost, and a "confirmed" reading needs both.
- **Days**: complete UTC weekdays from **2026-11-25** on, built by `original.mjs` `buildDays` from OANDA mid GBP/JPY M5 read
  from 1 Nov 2026 (warm-up for the previous day's range only); the last calendar day on file is left out (it may be forming).

## The expected range (fixed now)
Built from the 2016-01-01 → 2026-11-20 GBP/JPY trades of `yen-crosses-vol-breakout` under that cost, recomputed by this
study's `baseline` step and gated against that study's result.json (n and net R of its 2016 → window must match): **A, as
measured** and **B, no edge** (the same trades less their mean). For N closed forward trades each world's total is drawn 20,000
times by resampling whole calendar months with replacement, cut at N (`gold-vol-breakout-forward` `bands`, imported).

## Readings and checkpoints (as gold-vol-breakout-forward)
- Too few while N < 20; below the measured range when the total is under A's 5th percentile; ahead of a no-edge rule when above
  B's 95th; undecided otherwise.
- **N ≥ 120**: **fails** if under A's 5th percentile, else **holds so far**.
- **N ≥ 240**: **confirmed** only if above B's 95th percentile, month-sum t ≥ 2 AND the total at twice the cost above zero;
  **fails** if under A's 5th; else **not shown either way**. The first crossing of a checkpoint stands.

## What this cannot measure
Execution (mid candles plus an allowance, not fills). One forward year of one market is one regime. Because the market was
picked as the best of five, A's range is optimistic: a record inside it is weaker evidence than the same record on USD/JPY.
Nothing here makes it a live rule.

## Running
`node research/edge/gbpjpy-vol-breakout-forward/run.mjs fetch <dir>` then `… run <dir> [out.json]`; `vb-forward.yml` saves it to
council-data `research/forward/gbpjpy-vol-breakout.json`.
