# Gold "interim bottom" in a bear regime: result (20 Nov 2026)

Pre-registration: `PREREGISTRATION.md` (pushed alone before any month-end was classified). Paper research only; nothing live
changed and no proposal is written. The claim is the "interim bottom" framework the veteran batch's gold brief quotes
(`research/macro-veteran/references/gold-market-brief-2026-11-07.md`): inside a gold bear regime, month-ends where gold is
unusually far below its 200-day average, the dollar has risen sharply over 52 weeks and speculators hold little were followed by
positive three-month returns (9 of 10, median +4.2 %). Rebuilt here as a **public proxy with two of the three conditions** (no COT
history before 2019 is on file), thresholds from earlier bear month-ends only, OANDA spot gold, net of costs and financing.

**Verdict: FAIL, too few to judge: S2 (bear regime + gold in the lowest 30 % of its 200-day stretch + dollar in the top 30 % of its
52-week change) fired at 2 month-ends 2007-26 (Sep and Oct 2022), one trade (the second fell inside it): +1.56R net, n 1, no t
possible; T1 and T2 cannot pass.**

## What the data held (2007-01 to the last complete three-month hold, council-data f6b1160)

| | Count |
|---|---|
| Month-ends | 238 |
| Bear month-ends (SMA50 < SMA200 for 20 days) | 65, in 11 separate episodes |
| Judged (12+ earlier bear month-ends for the thresholds) | 53 |
| C1: stretch in the lowest 30 % | 11 |
| C2: 52-week dollar in the top 30 % | 14 |
| Both (S2) | 2 (30 Sep 2022, 31 Oct 2022) |

## The tests

| Test | n | Net R a trade | t | Holm p | Pass |
|---|---|---|---|---|---|
| T1: S2 long, 3 x ATR20 stop, 63 days | 1 | +1.562 | n/a | 1 | no |
| T2: S2 minus every bear month-end (n 62) | 1 vs 62 | +1.351 | n/a | 1 | no |

The one trade: long from 3 Oct 2022 (gold about $1,660), held 63 days to the close, +8.6 % over three months.

## Reported, not tested (one position at a time; baseline rows overlap)

| Stream | n | Net R | t | Up after 3 months | Exact 95 % interval | Median 3-month return |
|---|---|---|---|---|---|---|
| S1: C1 or C2 | 14 | +0.420 | 1.16 | 10 of 14 (71 %) | 42-92 % | +4.8 % |
| C1 alone | 7 | +0.674 | 1.64 | 6 of 7 (86 %) | 42-100 % | +7.5 % |
| C2 alone | 8 | +0.341 | 0.61 | 5 of 8 (63 %) | 24-91 % | +2.9 % |
| Every bear month-end (B) | 62 | +0.211 | 1.21 | 40 of 62 (65 %) | 51-76 % | +2.0 % |
| Every month-end | 235 | +0.326 | 2.80 | 142 of 235 (60 %) | 54-67 % | +2.0 % |

The direction is the brief's: the stretched-gold condition (C1) did better than the bear baseline (86 % up, +7.5 % median, against
65 % / +2.0 %), as did "either condition" (71 %). But on 7 and 14 trades the intervals overlap the baseline's almost entirely, and
the overlapping all-month rows (t 2.80) are gold's own 2007-26 rise counted many times over, not evidence for this rule.

## Limits

- Two of three conditions (COT left out); DXY from five pairs; OANDA spot; point-in-time thresholds (the WGC's were set on its whole
  sample). So the 2 signals here are not the WGC's 10 or 5 episodes, and this is not a faithful replication.
- The claim's author used data since 2005: no window here is untouched. With the brief's own episode count the t-bar could not be
  reached; the honest reading is "not testable to the bar on 20 years of one market", as the pre-registration said in advance.

## To repeat

`node research/edge/gold-interim-bottom/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-interim-bottom/run.mjs full <dir>`. Test: `tests/gold-interim-bottom.test.mjs`.
