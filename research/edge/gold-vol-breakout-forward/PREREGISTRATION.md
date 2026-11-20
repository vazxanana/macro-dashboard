# Pre-registration: gold-vol-breakout-forward (20 Nov 2026)

Paper research only. **A forward record of one fixed rule on candles no study has read.** It is not a live rule, not a paper or
demo stream and not an answer to owner decision 62: nothing is traded, alerted, mirrored or copied, and no council member reads
its file. The rule is `gold-vol-breakout`'s T1, a stand-alone intraday rule on spot gold, not a gate, exit, entry or size of the
live gold book (owner decision 44: none of that book's records are read).

Written and pushed alone, before any forward trade has been computed. The author has looked at no candle after 12 Nov 2026
through this rule.

## Why

Every figure for T1 so far comes from candles the rule was built or judged on: `gold-vol-breakout` (FAIL, out-of-sample month t
1.86), the costs studies, `gold-vol-breakout-hourcost` (the demo's quoted spread by hour: +0.105R a trade on 2021-26 under C1,
month t 2.79) and `gold-vol-breakout-exec` (PASS on the broker's own ticks, 24 Nov 2023 → 12 Nov 2026, +0.184R, n 572, month t
3.54). The exec study's years are in sample, and most of the gain is 2025-26 (the years of gold's widest daily ranges). The one
source of new evidence left is time: the trades the frozen rule takes after the last candle any study read. This study writes
them down as they happen, with the expected range fixed now.

## The rule and its cost (frozen; nothing is chosen later)

- **Trades**: `gold-vol-breakout-hourcost/costs.mjs` `tradesIn` (T1: k 0.5, both sides, entry and exit as `original.mjs`
  `vbTrade`), imported unchanged. Both files are checked against the sha256 that `gold-vol-breakout-hourcost/run.mjs` pins
  (`ORIG_SHA`, `COSTS_SHA`); a mismatch stops the run.
- **Days**: complete UTC weekdays from **2026-11-13** (the first weekday after the last day `gold-vol-breakout` read, its
  `dataEnd` 2026-11-12) onwards, built by `costs.mjs` `daysOf` (the forming last day is left out). Data: OANDA mid XAU/USD M5 from
  1 Oct 2026 (warm-up for the previous day's range only), through the candle service, complete candles.
- **Cost**: route C1 of `gold-vol-breakout-hourcost`, exactly as its `charge` computes it: half the demo's median quoted spread of
  the fill hour plus half of hour 20, plus the commission, as a share of the entry, plus 0.05 × the fill candle's median M5 range.
  The profile and commission are the ones in `gold-vol-breakout-hourcost/result.json` as committed (probe of 20 Nov 2026, 44
  weekdays, commission 0.000024): read from that file, never refreshed. Financing: none (T1 is flat at 21:00 UTC).

## The expected range (fixed now)

Two worlds, both built from the same 2021 → 12 Nov 2026 trades under C1 (`hourcost`'s window W4, n 1,121):

- **A, as measured**: those trades as they are (+0.105R a trade).
- **B, no edge**: the same trades less their mean (0R a trade).

For a forward record of N closed trades, each world's total R is drawn 20,000 times by resampling whole calendar months of the
W4 trades with replacement (seeded, 20261120), joining them in draw order and cutting at N trades. Reported at every update: A's
5th, 50th and 95th percentiles and B's 95th percentile of the total at that N.

## Readings (every update)

- **Too few** while N < 20.
- **Below the measured range** when the forward total is under A's 5th percentile.
- **Ahead of a no-edge rule** when the forward total is above B's 95th percentile (and not below A's 5th).
- **Undecided** otherwise.

Also reported, never judged before the checkpoints: n, win rate, net and gross R a trade, total, month-sum t, worst drawdown,
by side and by session (Asia before 07:00 UTC, London 07:00-12:00, New York after).

## Checkpoints and what they mean

- **N ≥ 120 (about six months)**: if the total is below A's 5th percentile, the record **fails** (the rule did not hold up on
  new candles; the study says decision 62 should be answered no). Otherwise it **holds so far**.
- **N ≥ 240 (about a year)**: **confirmed** only if the total is above B's 95th percentile and the month-sum t is 2 or more;
  **fails** if below A's 5th percentile; otherwise **not shown either way**.

The first crossing of a checkpoint is the reading that counts; later updates are reported but never replace it. No rule,
window, cost or line above changes after this file is pushed. A different question (another cost, another k, another market)
needs its own pre-registration.

## What this cannot measure

Execution: OANDA mid candles and the measured quoted spread, not fills. The broker's own ticks (`gold-vol-breakout-exec`'s
method) or a demo stream (decision 62) are the tests of slippage. One forward year of one market is also one regime: a year of
narrow gold ranges would show little whatever the rule's merit.

## Running

`node research/edge/gold-vol-breakout-forward/run.mjs <candleDir>` reads `xau-5m.json.gz` and writes `result.json` and
`RESULT.md` here; `.github/workflows/vb-forward.yml` runs it weekly on fresh candles and saves `result.json` to council-data
`research/forward/gold-vol-breakout.json`. Test: `tests/gold-vol-breakout-forward.test.mjs`.
