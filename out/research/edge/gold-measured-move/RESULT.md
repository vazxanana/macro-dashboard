# Result: the measured move (ABCD) on gold H4 (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests: after a close beyond B, gold reaches D no more often than a random-side trade does (67.1 % vs 66.7 %).**
T1 (target D) made -0.043R a trade net out of sample (n 231, month t -0.97) and +0.020R in sample (n 206, month t 0.47); before
costs it is flat (-0.004R out of sample). Not an edge; nothing live changed and no proposal is written.

Pre-registration: `PREREGISTRATION.md` (committed alone, first). A stand-alone rule, never a gate, exit, entry or size of the live
gold book (item 44 untouched). Data: OANDA mid H1 XAU_USD, 19 Mar 2006 to 13 Nov 2026 (125,704 H1 candles), built into 32,724 H4
candles in UTC buckets 02 / 06 / 10 / 14 / 18 / 22. Costs: $0.60 a round trip plus financing on buys at `FIN.xau.long`
(0.000148 of the price a rollover). In sample 2008-16, out of sample 2017 to October 2026.

## The tests

| Test | Target | IS n | IS net R | IS month t | OOS n | OOS gross R | OOS net R | OOS month t | OOS net at 2x | p (Holm) | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | D | 206 | +0.020 | 0.47 | 231 | -0.004 | -0.043 | -0.97 | -0.081 | 1.00 | 17 of 40 | no |
| T2 | halfway to D | 176 | -0.038 | -1.22 | 189 | -0.018 | -0.053 | -1.44 | -0.089 | 1.00 | 30 of 40 | no |
| T3 | D, with the D1 50-day average | 121 | -0.015 | -0.23 | 138 | -0.034 | -0.070 | -1.27 | -0.107 | 1.00 | 10 of 40 | no |

- **T1**: in sample +0.059R gross (t 1.30 on trades), +0.020R net; out of sample -0.004R gross, -0.043R net, PF 0.86, worst
  drawdown -19.9R. Exits out of sample: 155 target, 62 stop, 14 time. Financing out of sample 2.47R in all. Years out of sample:
  2017 -0.034R, 2018 -0.091R, 2019 -0.122R, 2020 -0.211R, 2021 -0.204R, 2022 -0.107R, 2023 +0.157R, 2024 -0.063R, 2025 +0.066R,
  2026 +0.096R (each 16 to 31 trades). Longs out of sample +0.006R (n 132), shorts -0.109R (n 99).
- **T2** loses in both windows: a nearer target raises the hit rate (79.4 % out of sample) but not the R.
- **T3**: the trend filter keeps 138 of 231 out-of-sample trades and does worse (-0.070R); in sample -0.015R.
- **Placebo** (40 seeds; every real out-of-sample trade replayed at its own entry candle with the same stop and target
  distances, the side drawn at random): T1's real mean -0.043R beats 17 of 40 (placebo median -0.036R, range -0.116R to
  +0.049R); T2 30 of 40 (median -0.073R); T3 10 of 40 (median -0.040R). The bar was 38.
- **The question as asked**: of T1's out-of-sample trades, 67.1 % reached D before the stop or the 30-candle exit; with the side
  drawn at random and the same distances, 66.7 % (median of 40 seeds) reached their target. The direction carries nothing.

## Why the hit rate is high and the R is not
D = C + (B - A) is measured from C, and the entry is a close beyond B, so the trade risks about B - C to make about
(B - A) - (B - C). With BC between 0.382 and 0.786 of AB the planned reward : risk is 0.27 to 1.6 (median 0.42). A high hit rate
is what the geometry gives any trade, of either side, at those distances; the placebo shows exactly that.

## The funnel
1,596 setups (808 long, 788 short) passed the swing, ATR and ratio filters; 775 were cancelled when price traded through C before
the trigger, 230 closed beyond B before C was confirmed (skipped), 18 expired after 30 candles; 573 triggered, 25 of them on the
same entry candle as another setup (kept once). One position at a time per test leaves the n above.

## Not tested, said plainly
Other pivot widths, ratio bands, timeframes, an entry at C instead of at the break, or other markets: each would be a new
pre-registration, and none is proposed (the gross result is flat on both windows). To repeat: `node --use-env-proxy
research/edge/gold-measured-move/run.mjs fetch <dir>` (candles kept out of git), then `node research/edge/gold-measured-move/run.mjs
full <dir>`. Test: `tests/gold-measured-move.test.mjs`.
