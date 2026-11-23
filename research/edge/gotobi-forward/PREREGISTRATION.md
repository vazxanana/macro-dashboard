# Pre-registration: gotobi-forward (23 Nov 2026)

Paper research only. **A forward record of one fixed rule on gotobi days no study has read.** Not a live rule, not a paper or
demo stream: nothing is traded, alerted, mirrored or copied, and no council member reads its file. The cTrader demo job
(`council/gotobi.mjs`, owner item 61) is a separate record of real demo fills and is not touched or read here. Written and
committed alone, before any forward trade has been computed.

## Why
`gotobi` T2 (the fade: sell USD/JPY at 00:55 UTC on a gotobi day, buy back at 06:00 UTC) PASSED on 2016-01-01 → 2026-11-11
(+0.148R a trade net, n 771, month t 2.74), replicated on 2010-15 (`gotobi`, `gotobi-replicate`), held on a second feed
(`gotobi-feed`, `gotobi-minute-histdata`), and `gotobi-exec` measured its cost on the demo broker's own quotes (0.81 pip a round
trip, median, commission included; its return on three years of executable quotes, +0.163R, month t 1.80, missed its own bar).
The one source of new evidence left is time: the gotobi days after the last data any gotobi study read.

## The last data read, and the start
- The candle studies ended on 2026-11-11 (`gotobi`, `gotobi-replicate`, `gotobi-jp225`, `gotobi-timing`, `gotobi-limit-entry`,
  `gotobi-cost`) and 2026-11-12 (`gotobi-feed`, `gotobi-early-years`).
- `gotobi-exec`'s tick probe ran at **2026-11-20 01:32 UTC** (council-data commit d8505176): its last scored day was 2026-11-13,
  but the probe held quotes up to 01:32 UTC of 20 Nov, i.e. the 00:55 entry of the 20 Nov fade.
- So the forward record counts **gotobi days from 2026-11-21 on**; the first is **2026-11-25** (15 Nov rolled back to the 13th,
  20 Nov was partly seen, 23 Nov is a Tokyo holiday). The author has not looked at USD/JPY at the gotobi minutes after 20 Nov.

## The rule and its cost (frozen; nothing is chosen later)
- **Imported unchanged** from `research/edge/gotobi/run.mjs` (sha256 `645f2731…5e32`, pinned in `run.mjs` here and checked at
  every run; a mismatch stops it): `gotobiSet`, `isTokyoBusinessDay`, `windowMove`, `stopDist` (D = 1.5 × the median absolute
  fade-window move of the 20 Tokyo business days before, 15 needed), `trade(ix, 'fade', day, D)` (sell the open of the 00:55 UTC
  M5 candle, stop entry + D checked on M5 highs, a gap fills at the open, out at the 06:00 UTC price, exit grace 15 minutes).
- **Cost: the measured round trip of `gotobi-exec`, frozen**: 0.8132 pip = **0.008132 yen a unit a round trip**, whatever the
  price, never refreshed. Net R = the rule's gross R − 0.008132 / D. (The study's own cost model, about 2 pips, is used only for
  the baseline gate below.)
- **Data**: OANDA mid USD/JPY M5 from 2026-10-01 (warm-up for D) through the keyless candle service, as the other forward
  records. A gotobi day counts only once the candles on file reach its 06:00 UTC exit (a candle starting at or after it); a day
  whose trade cannot be built (no 00:55 candle, no exit price, or no D) is listed as skipped with its reason, never guessed.

## The expected range (fixed now)
Built from the study's own decisive-window T2 trades (2016-01-01 → 2026-11-11), rebuilt by this study's `baseline` step with the
study's functions on OANDA mid M5 and **gated against `gotobi/result.json`** (n 771 and net R 0.1481 under the study's cost must
match exactly, else nothing is written). Each baseline trade is then charged the frozen measured cost instead (gross R −
0.008132 / D), so the range and the forward record are priced alike. **A, as measured** = those trades; **B, no edge** = the same
trades less their mean. One trade a gotobi day, so the block is the **single trade**: for a forward record of N trades, each
world's total is drawn 20,000 times by resampling single trades with replacement (seeded mulberry32, seed 20261123). Reported at
every update: A's 5th / 50th / 95th and B's 95th percentile at N.

## Readings and checkpoints
- **Too few** while N < 20; then **below the measured range** (total under A's 5th), **ahead of a no-edge rule** (above B's
  95th) or **undecided**.
- **N ≥ 120** (about a year and a half): **fails** if under A's 5th percentile, else **holds so far**.
- **N ≥ 240** (about three and a half years): **confirmed** only if above B's 95th percentile and the month-sum t (the study's
  own statistic) ≥ 2; **fails** if under A's 5th; else **not shown either way**.
- **The first crossing of each checkpoint stands** (the previous file is read back; a later run never rewrites it).

## What this cannot measure
Fills: OANDA mid plus a fixed measured cost, not the broker's prices or slippage (the demo job's record is the test of that).
About 70 trades a year, so nothing can be said for years. One forward stretch is one regime of the yen. Nothing here makes it a
live rule: that is the owner's decision after a confirmed record.

## Running
`node research/edge/gotobi-forward/run.mjs baseline <dir>` (once, OANDA mid M5 from 2015-11-01 in `<dir>/usdjpy-5m.json.gz`),
then `node research/edge/gotobi-forward/run.mjs fetch <dir>` and `… run <dir> [out.json]`; `vb-forward.yml` saves it to
council-data `research/forward/gotobi.json`. Test: `tests/gotobi-forward.test.mjs`.
