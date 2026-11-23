# Liquidity sweep, change of character, fair value gap (result)

**Verdict: FAIL. 0 of 3; the base model made +0.021R a trade before costs (n 3,161, month t 0.86), -0.062R after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, pushed alone first). Pooled xau, eurusd, gbpusd, usdjpy and audusd,
trades 2010-2019 (discovery 2010-2014, confirmation 2015-2019), OANDA mid 5-minute candles from the `edgekit` cache, grid 3's
`multi()` for every outcome, grid 2's `COSTS` and the data-quality exclusions. Judged before costs (the owner's basis); after
costs beside. Research only: nothing live changed, and nothing of the ICT desk was read or used.

The rule, in short: the last H4 break of structure gives the side; an H1 candle trades through a liquidity pool (an H1 swing
low or high, the Asia range, the previous day's low or high) and closes back; on M5 a close beyond the last swing made after
the sweep (the change of character); a limit at the 50 % of the latest unfilled three-candle gap of that leg, stop past the
sweep's extreme, 2 hours to fill, out after 24 hours. Placebo: at the same moment and side, a limit at the 50 % of a random
same-colour M5 body of the 24 candles before, with the same stop distance and target (the resting-limit control).

## Tests (before costs; Holm over three)

| Test | n | R a trade | month t 2010-14 | month t 2015-19 | pooled month t | Holm p | vs placebo (Welch t) | After costs | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| T1 base model, 50 % entry, 2R | 3,161 | +0.021 | 0.74 | 0.47 | 0.86 | 0.67 | +0.064R (1.73) | -0.062 (t -2.47) | no |
| T2 T1 + premium / discount | 1,506 | -0.031 | -1.60 | 0.28 | -0.97 | 0.67 | +0.035R (0.67) | -0.116 (t -3.61) | no |
| T3 opposite-pool target | 2,942 | -0.065 | -1.48 | -1.71 | -2.26 | 0.077 | +0.037R (0.78) | -0.145 (t -5.00) | no |

No half reaches a month t of 2 on any test. The premium / discount filter halves the trades and makes them worse; aiming at
the opposite pool (nearest pool 1R to 10R away) loses before costs. The placebo limits lose too (T1 placebo -0.043R, n 2,400):
the resting-limit tilt seen with the dominant zone (`dom-placebo`) does not appear here, and the real trades beat their
placebo by +0.06R, short of the bar (Welch t 1.73).

## Reported, not tested (before costs, after costs in brackets)

| Stream | n | R a trade | month t |
|---|---:|---:|---:|
| Near-edge entry, 2R | 3,392 | +0.015 [-0.062] | 0.64 |
| No H4 side (both sides of every sweep), 2R | 6,612 | +0.034 [-0.048] | 2.20 (2010-14 2.33, 2015-19 0.76) |

Without the H4 side the stream is slightly better and beats its placebo by +0.081R (Welch t 3.14), but its confirmation half is
flat: read after the fact, not evidence. Taking the H4 side did not pick the better trades (as `ltf-structure` and
`vb-structure-filter` found for other entries).

### T1 by market

| Market | n | R a trade | month t | After costs | Placebo |
|---|---:|---:|---:|---:|---:|
| xau | 577 | +0.102 | 1.80 | -0.039 | +0.014 |
| eurusd | 644 | +0.069 | 1.27 | +0.011 | +0.028 |
| gbpusd | 664 | -0.012 | -0.22 | -0.080 | -0.072 |
| usdjpy | 596 | -0.025 | -0.49 | -0.117 | -0.121 |
| audusd | 680 | -0.020 | -0.36 | -0.085 | -0.059 |

### T1 by session of the change of character, pool and side

| Group | n | R a trade | month t | After costs |
|---|---:|---:|---:|---:|
| London 07-12 UTC | 1,125 | +0.034 | 0.79 | -0.048 |
| New York 12-17 UTC | 697 | +0.030 | 0.59 | -0.035 |
| Other hours | 1,339 | +0.006 | 0.16 | -0.088 |
| Previous day low / high swept | 610 | +0.007 | 0.12 | -0.072 |
| Asia low / high swept | 990 | -0.028 | -0.71 | -0.105 |
| H1 swing swept | 1,561 | +0.058 | 1.65 | -0.031 |
| Buys | 1,549 | -0.004 | -0.11 | -0.086 |
| Sells | 1,612 | +0.045 | 1.36 | -0.039 |

No group reaches a month t of 2; every group loses after costs except EUR/USD (+0.011R, t near 0). Gold's +0.10R is the
largest figure and is one of five markets, picked after looking: a hypothesis at most.

## Reading

Written as fixed rules, the standard sweep, change-of-character and fair-value-gap entry is at zero before costs on five
markets over ten years and loses after them; the H4 side, the premium / discount filter and the opposite-pool target do not
improve it. It does not judge a trader's own choice of which sweeps to take. Do not test variants of it on these years.

Notes on the run: about 2,200-2,500 setups a market of both sides (`signals`), of which the one-at-a-time rule and the H4
side leave 577-680 filled trades a market; H1 swing pools are searched up to 2,000 H1 candles back for the opposite-pool
target (an implementation limit). To repeat: `EDGE_DATA=<cache> node research/edge/smc-sweep-fvg/run.mjs run` (8 seconds).
Test: `tests/smc-sweep-fvg.test.mjs`.
