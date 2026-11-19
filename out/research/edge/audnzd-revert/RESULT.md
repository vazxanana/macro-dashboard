# Result: AUD/NZD daily z-score mean reversion (13 Nov 2026)

**Verdict: FAIL, 0 of 3 variants: the AUD/NZD z-score fade is not an edge after costs.** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone first). The best decisive month-sum t is 0.43 (V2, n 48, +0.061R a trade net). Nothing live changed.

Data: OANDA mid daily AUD_NZD, council-data research/daily/audnzd.json, 2004-05-04 to 2026-11-06, 5866 trading days (weekend stubs folded). Entry at the next daily open after z reaches the threshold either side, stop 1.5 x ATR(14), exit at the SMA cross, the stop or after 10 days, one position at a time. Costs stated (AUD/NZD is not in the demo broker's symbol file): 2.0 pips a round trip (1.0 spread + 1.0 slippage), commission 0.000045 x price, financing 2.0 % a year on either side.

| Variant | Window | n | Net R a trade | Gross | Cost | Win % | PF | Month-sum t | p (one-sided) | Holm p | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|---|---|
| V1 SMA20 / SD20, z beyond ±2 | 2016-now (decisive) | 160 | -0.143 | -0.056 | +0.087 | 42.50 | 0.74 | -1.72 | 0.9575 | 1 | -30.27R |
| V1 SMA20 / SD20, z beyond ±2 | 2008-15 | 112 | -0.232 | -0.172 | +0.059 | 38.39 | 0.59 | -2.63 | - | - | -28.09R |
| V2 SMA20 / SD20, z beyond ±2.5 | 2016-now (decisive) | 48 | +0.061 | +0.150 | +0.089 | 47.92 | 1.13 | 0.43 | 0.3348 | 1 | -5.91R |
| V2 SMA20 / SD20, z beyond ±2.5 | 2008-15 | 29 | -0.321 | -0.263 | +0.058 | 34.48 | 0.53 | -1.58 | - | - | -12.98R |
| V3 SMA50 / SD50, z beyond ±2 | 2016-now (decisive) | 122 | -0.104 | -0.005 | +0.099 | 45.08 | 0.80 | -1.03 | 0.8478 | 1 | -12.73R |
| V3 SMA50 / SD50, z beyond ±2 | 2008-15 | 79 | -0.233 | -0.170 | +0.063 | 39.24 | 0.60 | -1.93 | - | - | -20.16R |

## Against the bar

- **V1**: fail (decisive n 160 vs 60, net -0.143R, month-sum t -1.72 vs 2, Holm p 1, 2008-15 net -0.232R).
- **V2**: fail (decisive n 48 vs 60, net +0.061R, month-sum t 0.43 vs 2, Holm p 1, 2008-15 net -0.321R).
- **V3**: fail (decisive n 122 vs 60, net -0.104R, month-sum t -1.03 vs 2, Holm p 1, 2008-15 net -0.233R).

## Exits (decisive window)

- V1: mean 52, stop 69, time 36, stop-gap 3
- V2: mean 17, stop 19, time 12
- V3: stop 51, time 56, mean 13, stop-gap 2

## Financing sensitivity (decisive net R a trade; not judged)

- V1: 0 % -0.086, 2 % -0.143, 4 % -0.199
- V2: 0 % +0.120, 2 % +0.061, 4 % +0.001
- V3: 0 % -0.036, 2 % -0.104, 4 % -0.172

## Placebo: random entries with the same exits (decisive window, 40 seeded draws each)

| Variant | Real net R a trade | Draws median | 5th pct | 95th pct | Draws >= real |
|---|---|---|---|---|---|
| V1 | -0.143 | -0.066 | -0.142 | +0.019 | 38 of 40 |
| V2 | +0.061 | -0.077 | -0.222 | +0.047 | 2 of 40 |
| V3 | -0.104 | -0.057 | -0.147 | -0.005 | 30 of 40 |

## AUD/CAD and EUR/GBP (descriptive only, not judged)

| Market | Variant | 2016-now n | Net R a trade | Month-sum t | 2008-15 n | Net R a trade | Month-sum t |
|---|---|---|---|---|---|---|---|
| audcad | V1 | 150 | +0.150 | 1.82 | 122 | -0.044 | -0.45 |
| audcad | V2 | 49 | +0.057 | 0.36 | 42 | +0.014 | 0.08 |
| audcad | V3 | 114 | +0.070 | 0.68 | 90 | -0.064 | -0.51 |
| eurgbp | V1 | 161 | +0.085 | 1.07 | 114 | +0.051 | 0.48 |
| eurgbp | V2 | 55 | -0.030 | -0.21 | 33 | +0.117 | 0.59 |
| eurgbp | V3 | 104 | +0.131 | 1.16 | 95 | +0.134 | 0.96 |

## What it means

No variant clears the pre-registered bar: fading a daily z-score stretch on AUD/NZD is not a tradeable edge after costs on this data. It is not a council rule, no proposal is written and nothing live changed. Never call it an edge; any other threshold, length, stop or exit would need its own pre-registration on other data.

To repeat: `node research/edge/audnzd-revert/run.mjs fetch <dir>` (git show from origin/council-data, no network; kept out of git), then `node research/edge/audnzd-revert/run.mjs full <dir>`. Tests: `tests/audnzd-revert.test.mjs`.
