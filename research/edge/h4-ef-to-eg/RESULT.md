# H4 engulf failed (EF) to the next H4 engulf (EG): result (23 Nov 2026)

Verdict: **FAIL** (pre-registered in `PREREGISTRATION.md`, committed alone before any trade of this rule was computed).

**In plain words:** buying the retest of a failed H4 sell engulf (selling the retest of a failed buy engulf) after an M15 break
with it, aiming at the next opposite H4 engulf zone 2R or more away, loses money after costs in every window. On the five
markets pooled it made **−0.047R a trade out of sample** (2024 → 22 Nov 2026, n 290, month t −0.38), −0.043R in sample
(2020-2023, n 441, t −0.56) and −0.142R on the 2010-2019 replication (n 1087, t −2.26). Before costs it is about zero
(+0.010R, +0.006R, −0.090R): the target sits a median 3.2R away and is reached on about one trade in five, which is roughly what
a coin needs to break even before costs. A random entry in the same month with the same stop and target did as well: the real
out-of-sample mean beat 22 of 40 placebo runs (38 needed). No market passes; none is called better. Nothing live changed.

## The pooled test (P, the study's verdict)
| Window | n | won | R a trade before costs | after costs | month t | at 2 x costs |
|---|---|---|---|---|---|---|
| Replication 2010-2019 | 1087 | 20 % | −0.090 | −0.142 | −2.26 | −0.194 |
| In sample 2020-2023 | 441 | 23 % | +0.006 | −0.043 | −0.56 | −0.093 |
| Out of sample 2024 → 22 Nov 2026 | 290 | 23 % | +0.010 | −0.047 | −0.38 | −0.104 |

Pass lines: out-of-sample mean > 0 **no**; month t >= 2 **no**; Holm p < 0.05 **no** (1.00); in-sample mean > 0 **no**; > 0 at
2 x costs **no**; 30 or more out-of-sample trades yes (290); replication mean > 0 **no**; placebo (38 of 40) **no** (22 of 40;
placebo median −0.060R, 95th percentile +0.192R). Worst drawdown out of sample −29.8R (in sample −49.9R, 2010-2019 −187.7R).
Out of sample buys −0.134R (n 147), sells +0.044R (n 143); in sample buys −0.035R, sells −0.052R; 2010-2019 buys −0.158R, sells
−0.126R. Exits: 1,427 at the stop, 390 at the target, 1 at the time limit (all windows). Target at the order: median 3.15R
(10th-90th percentile 2.16R-6.63R).

## Each market (out of sample; after costs unless said; Holm over the six tests)
| Market | n | won | before costs | after costs | month t | 2 x costs | in sample | 2010-2019 | placebo | Holm p | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gold | 54 | 20 % | +0.026 | −0.032 | −0.12 | −0.090 | −0.100 (n 85) | −0.082 (n 217) | 13 of 40 | 1.00 | FAIL |
| EUR/USD | 67 | 22 % | −0.120 | −0.168 | −0.89 | −0.216 | −0.048 (n 100) | −0.061 (n 211) | 15 of 40 | 1.00 | FAIL |
| GBP/USD | 65 | 29 % | +0.383 | +0.296 | 0.81 | +0.210 | +0.061 (n 98) | −0.170 (n 233) | 38 of 40 | 1.00 | FAIL |
| USD/JPY | 54 | 17 % | −0.355 | −0.384 | −1.94 | −0.412 | −0.035 (n 73) | −0.253 (n 215) | 3 of 40 | 0.37 | FAIL |
| AUD/USD | 50 | 26 % | +0.077 | +0.018 | 0.07 | −0.041 | −0.110 (n 85) | −0.141 (n 211) | 26 of 40 | 1.00 | FAIL |

GBP/USD is positive in sample and out of sample (t 0.81, far from 2) and lost on 2010-2019 (−0.170R, n 233): by the
pre-registration it fails, and one market of five picked after the result is not a finding. Gold, the market the rule was
shaped on, lost in every window after costs.

## The funnel (all five markets, 2010 → 22 Nov 2026)
About 34,100 H4 engulf zones; 27,600 failed within their life (barriers); 25,900 saw price come back; of those 8,950 closed
through the far side on M15 before any break, 1,130 had no M15 break within 48 candles, 15,850 broke; 2,600 had no alive
opposite zone beyond the entry, 9,880 had one under 2R away and 18 had a stop under 4 x the round trip; 3,343 orders, 637
blocked by one already resting or open, 883 not filled within 24 H4 candles, 1,818 filled and closed, 2 still open at the end
(not booked), 3 placed from 16 Nov 2026 left out. Per-market counts are in `result.json` (`counts`).

## Checks
- Harness: on the gold H4 candles of November 2026 the code found both H4 sell engulf zones of the owner's example to the cent
  before the run (the example's trade is not written in the repository). The failure of that zone came after the last candle on
  file (22 Nov 23:50 UTC), so the example itself is not in the test.
- No look-ahead: on gold, the orders known at three moments (2015, 2019, 2023) are identical when the series is cut there
  (`cutCheck`); the offline test also changes every later price and cuts synthetic series, checks the barrier is a failed zone
  of the other side known before the order, the stop side, the 2R target at the nearest alive opposite zone, and that turning
  prices upside down gives the same orders on the other side.
- Costs: `edgekit.COSTS` round trip per trade, gold buys also pay overnight financing (`council/fills.mjs`); forex financing is
  not charged (no measured rate), which flatters the forex rows if anything.

## What it means
A failed H4 engulf as a barrier, an M15 break with it and a far opposite-engulf target do not pick better trades than a
random entry with the same stop and target in the same month; before costs the rule sits at zero in each window and costs
make it lose. This joins the other engulf and barrier readings that sit at zero before costs (`desk-slices`, `desk-rigor`,
`h4-zone-trail`, `barrier-qm-janda`). As pre-registered, no other buffer, order life, window, target rule, minimum R or market
is tried on these years. It says nothing about the owner's own choice of which failed zone to trade; that would need his calls
stamped before the outcome (the decision journal).

Files: `run.mjs` (`node research/edge/h4-ef-to-eg/run.mjs`, about 11 s on the toolkit cache), `result.json`, `trades.json`
(every booked trade), test `tests/h4-ef-to-eg.test.mjs`.
