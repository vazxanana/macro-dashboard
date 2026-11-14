# Result: silver at a 20-day high in euros but not in dollars (14 Nov 2026)

**Verdict: FAIL, 0 of 2: buying (selling) silver after a 20-day high (low) in euros but not in dollars makes +0.002R a trade net out of sample 2017-26 (n 83, month t +0.03); it beats 31 of 40 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any trade result was computed). A replication
of gold-euro-divergence (branch; on gold: OOS +0.103R, month t +1.38, FAIL) on a market it was not found on, with the same
signal, holds, stops, baseline, placebo and bar. Paper research only, a **stand-alone rule on silver**: not a gate, entry, exit or
size of anything live. No live rule, size, filter, stop, config, cost constant or council member changed. No proposal is written.
This page is written by `run.mjs` from `result.json`.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xag.json` and `eurusd.json` at commit `61aa34da` (silver 2006-03-20 to 2026-11-13), weekends folded into Monday with `council/fills.mjs` `foldWeekend`.
- Signal: silver in euros (XAG/USD close / EUR/USD close of the same UTC day) closes above (below) the highest (lowest) such
  close of the 20 matched days before it while XAG/USD does not: long (short) XAG/USD at the next daily open. Signal days: in sample 93 long + 59 short, out of sample 62 + 52.
- Trade: stop k x ATR(20) of the 20 silver candles before the entry (1R), gaps through the stop fill at the open, one position at
  a time per test. Costs $0.06 a round trip (silver-rates-shrug's figure); no financing (no silver rate exists in `council/fills.mjs`; this flatters buys a little).
- Baseline: the same trade entered after every eligible day of the same calendar year, same side; excess = net R minus that mean.
- t on calendar-month sums of net R (empty months 0), Holm over T1 and T3 on the one-sided OOS p (T2, long only, has under 100 signal days a window: reported, not judged); 40 seeded placebos per test.

## Results

| Test | Window | n | gross R | net R | net at 2x | month t (gross) | month t (net) | excess R | excess t | stops |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 101 | +0.094 | +0.032 | −0.029 | +1.42 | +0.50 | +0.057 | +0.88 | 18 |
| T1 | 2017-26 | 83 | +0.081 | +0.002 | −0.076 | +0.91 | +0.03 | +0.044 | +0.51 | 14 |
| T2 | 2007-16 | 59 | +0.067 | +0.005 | −0.056 | +0.78 | +0.06 | +0.001 | +0.01 | 12 |
| T2 | 2017-26 | 48 | +0.124 | +0.047 | −0.029 | +1.12 | +0.43 | +0.030 | +0.30 | 6 |
| T3 | 2007-16 | 83 | +0.083 | +0.042 | +0.001 | +1.19 | +0.60 | +0.036 | +0.52 | 9 |
| T3 | 2017-26 | 68 | +0.007 | −0.044 | −0.094 | +0.06 | −0.40 | −0.042 | −0.41 | 15 |

| Test | what | OOS p | Holm p | placebo beaten | placebo median t | pass |
|---|---|---|---|---|---|---|
| T1 | both sides, hold 5 candles, stop 2 x ATR(20) (primary) | 0.488 | 0.976 | 31 of 40 | −0.71 | no |
| T2 | long signals only, hold 5 candles, stop 2 x ATR(20) (descriptive: under 100 events a window) | 0.334 | not judged | 25 of 40 | +0.11 | not judged |
| T3 | both sides, hold 10 candles, stop 3 x ATR(20) | 0.655 | 0.976 | 19 of 40 | −0.38 | no |

## By side (reported, not judged)

| Test | Window | side | n | gross R | net R | baseline net R (every day) |
|---|---|---|---|---|---|---|
| T1 | 2007-16 | long | 59 | +0.067 | +0.005 | −0.033 |
| T1 | 2007-16 | short | 42 | +0.132 | +0.071 | −0.078 |
| T1 | 2017-26 | long | 48 | +0.124 | +0.047 | +0.004 |
| T1 | 2017-26 | short | 35 | +0.022 | −0.060 | −0.109 |
| T2 | 2007-16 | long | 59 | +0.067 | +0.005 | −0.033 |
| T2 | 2017-26 | long | 48 | +0.124 | +0.047 | +0.004 |
| T3 | 2007-16 | long | 46 | +0.020 | −0.021 | −0.001 |
| T3 | 2007-16 | short | 37 | +0.162 | +0.121 | −0.055 |
| T3 | 2017-26 | long | 39 | +0.052 | +0.002 | +0.036 |
| T3 | 2017-26 | short | 29 | −0.055 | −0.105 | −0.106 |

Median risk (1R) per T1 trade: $0.98 in sample, $0.9 out of sample; mean cost 0.062R / 0.078R.

## Reading

The divergence of silver in euros and silver in dollars at a 20-day extreme does not lead XAG/USD by enough to trade on the pre-registered bar, so the gold near miss does not replicate on silver. Not an edge; never use it as a filter, gate or size step. No re-run with other look-backs, holds or stops (any such look would be post hoc).

## To repeat

`node research/edge/silver-euro-divergence/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/silver-euro-divergence/run.mjs full <dir>`; delete `<dir>` afterwards. Tests: `tests/silver-euro-divergence.test.mjs`.
