# Order blocks and fair value gaps, standard rules (result)

**Verdict: FAIL. H1 order blocks +0.018R a trade before costs (n 7672, month t 1.07), no better than a placebo (Welch t 0.43); FVG 50% fill -0.021R (n 28522, t -2.24).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, pushed alone first). OANDA mid 5-minute candles of xau, eurusd,
gbpusd, usdjpy and audusd, trades filled 2010-01-01 to 2019-12-31 (2009 warm-up), H1 / H4 resampled from them, 2R target,
5-day cap, exits by `combo-grid-3` `multi()`. Judged before costs; after costs beside. Research only: nothing live changed.

## Tests (before costs, Holm over three one-sided p)

| Test | Whole window | 2010-14 | 2015-19 | Holm p | Pass |
|---|---|---|---|---:|---|
| T1 order block | +0.018R, n 7672, month t 1.07 | +0.038R (t 1.52) | -0.002R (t -0.08) | 0.427 | no |
| T2 order block minus placebo | +0.010R, Welch t 0.43 (month t of the difference 0.61) | +0.011R (t 0.32) | +0.010R (t 0.30) | 0.667 | no |
| T3 FVG 50% fill | -0.021R, n 28522, month t -2.24 | -0.036R (t -2.77) | -0.006R (t -0.42) | 0.987 | no |

The FVG is also no better than its own placebo (-0.007R, Welch t -0.46). Placebo seeds 2-5: +0.034R to -0.002R a trade;
order block minus placebo from -0.015R (t -0.64) to +0.020R (t 0.84): the sign changes with the seed.

## Pooled streams (2R)

| Stream | n | Won | Before costs | After costs |
|---|---:|---:|---:|---:|
| Order block | 7672 | 34.2 % | +0.018R (month t 1.07) | -0.037R (t -2.16) |
| Order block placebo | 6681 | 33.8 % | +0.008R (t 0.46) | -0.048R (t -2.68) |
| FVG 50% fill | 28522 | 31.6 % | -0.021R (t -2.24) | -0.266R (t -27.16) |
| FVG placebo | 19033 | 30.9 % | -0.015R (t -1.37) | -0.260R (t -21.67) |

The FVG's stop is half the gap plus 0.1 ATR, so costs take about 0.24R a trade on average.

## Per market (before costs; after costs in brackets)

| Market | Order block | Placebo | OB minus placebo (t) | FVG 50% | FVG placebo |
|---|---|---|---|---|---|
| xau | +0.029 (n 1498, t 0.80) [-0.072] | -0.005 | +0.034 (0.63) | -0.017 (n 5125) [-0.423] | -0.057 |
| eurusd | +0.070 (n 1452, t 2.03) [+0.031] | +0.065 | +0.006 (0.10) | +0.014 (n 5771) [-0.163] | +0.019 |
| gbpusd | +0.046 (n 1442, t 1.13) [+0.003] | -0.001 | +0.047 (0.85) | -0.011 (n 5717) [-0.204] | -0.024 |
| usdjpy | +0.008 (n 1543, t 0.19) [-0.050] | +0.022 | -0.014 (-0.26) | -0.059 (n 5791) [-0.329] | -0.009 |
| audusd | -0.047 (n 1737, t -1.40) [-0.087] | -0.033 | -0.014 (-0.29) | -0.032 (n 6118) [-0.229] | -0.007 |

EUR/USD's order block (+0.070R, t 2.03) is matched by its placebo (+0.065R): it is the resting-limit effect, not the block.
Not judged per market, and nothing found here is a rule.

## Reading

Read as written here, the textbook order block (the last opposite candle before a displaced H1 break) picks limit entries
no better than a random same-colour candle of the last day, and loses after costs. The H1 FVG 50% fill with the H4
structure loses even before costs. This tests one mechanical reading of each; it does not judge a trader's own choice of
blocks and gaps. To repeat: fill the cache (`research/edge/_lib/fetch-cache.mjs <m> 5m 2009 2019`), then `run.mjs market
<m> <dir>` for the five markets and `run.mjs report <dir>`. Test: `tests/smc-ob-fvg.test.mjs`.
