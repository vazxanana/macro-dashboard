# The H1 dominant-zone limit on years no grid read

**Verdict: PASS before costs on all three untouched tests (n 151,045 / 273,279 / 27,965, about +0.05R a trade, month t 14.2 / 14.9 / 2.7); after costs it loses on every set.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed.

## The three tests (judged before costs, as the owner asked)

| Test | n | Before costs, R a trade (month t) | After costs (month t) | Holm p |
|---|---:|---|---|---:|
| T1 Set A 2010-14, trailing stop | 75,351 | +0.060 (12.15) | -0.040 (-7.07) | 2.4e-13 |
| T1 Set A 2015-19, trailing stop | 75,694 | +0.050 (8.45) | -0.064 (-10.37) | (with 2010-14) |
| T2 Set B 2005-19, trailing stop | 273,279 | +0.055 (14.92) | -0.051 (-15.16) | 5.2e-27 |
| T3 Gold 2010-19, 4R | 27,965 | +0.039 (2.66) | -0.144 (-9.29) | 0.0045 |

All three pass. The grids found a tilt of +0.04-0.06R a trade before costs on 2020-26. The same size shows on fifteen years
and five markets no grid read. So it is not an accident of the grids' search.

## By market (trailing stop)

| Market | Years | n | Before costs (t) | After costs (t) |
|---|---|---:|---|---|
| Gold | 2010-19 | 27,965 | +0.030 (3.06) | -0.153 (-14.41) |
| Gold | 2005-09 | 10,625 | +0.083 (6.70) | -0.108 (-7.54) |
| EUR/USD | 2010-19 | 30,514 | +0.061 (7.48) | -0.018 (-2.04) |
| EUR/USD | 2005-09 | 14,859 | +0.091 (7.18) | +0.027 (2.17) |
| GBP/USD | 2010-19 | 30,197 | +0.057 (6.36) | -0.026 (-2.90) |
| GBP/USD | 2005-09 | 15,124 | +0.077 (7.29) | +0.018 (1.64) |
| USD/JPY | 2010-19 | 30,335 | +0.066 (8.31) | -0.048 (-5.65) |
| USD/JPY | 2005-09 | 14,853 | +0.066 (5.07) | -0.015 (-1.16) |
| AUD/USD | 2010-19 | 32,034 | +0.058 (6.08) | -0.024 (-2.52) |
| AUD/USD | 2005-09 | 15,123 | +0.080 (6.50) | +0.013 (1.04) |
| NZD/USD | 2005-19 | 45,758 | +0.054 (7.58) | -0.036 (-4.85) |
| USD/CAD | 2005-19 | 46,152 | +0.041 (6.26) | -0.047 (-6.73) |
| USD/CHF | 2005-19 | 44,610 | +0.056 (7.90) | -0.039 (-5.00) |
| EUR/JPY | 2005-19 | 45,557 | +0.049 (6.78) | -0.040 (-5.35) |
| Silver | 2005-19 | 20,618 | +0.013 (1.21) | -0.300 (-21.06) |

All the exits (1R, 2R, 3R, 4R, trailing) give +0.045 to +0.056R before costs on both sets. After costs each loses about
0.05-0.06R a trade.

## What this means

- **Before costs there is a real tilt.** It is about +0.05R a trade, on every forex pair and on gold, in every five-year
  stretch since 2005.
- **After costs the rule loses money**, on every market in 2010-19. The tilt is about half the cost of a round trip.
  The one exception is 2005-09 EUR/USD (+0.027R, t 2.17), and it does not repeat afterwards.
- **What the tilt might come from:** placing a limit order at a recent candle's body pays a small amount on mid candles
  whichever zone it is. The pending `dom-placebo` study compares the rule with random candle bodies of the same size to test this.
- **What it means for the demo job (`council/dom-demo.mjs`):** it records a rule that holds before costs and, on this
  evidence, loses after them. Its forward record will show what the broker really charges.
- **Caveats:**
  - Each signal is its own trade, so trades overlap, which inflates the trade counts. The t is taken on monthly sums.
  - Today's costs (combo-grid-2 `COSTS`) are charged on every past year.

To repeat: `node research/edge/dom-zone-holdout/run.mjs market <m> <dir>` for the ten markets (about 20-40 minutes each,
`--max-old-space-size=3500`), then `node research/edge/dom-zone-holdout/run.mjs report <dir>`.
