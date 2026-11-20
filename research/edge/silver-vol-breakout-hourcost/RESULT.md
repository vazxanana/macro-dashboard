# Result: the failed silver breakout at the demo's measured spreads (20 Nov 2026)

**Verdict: ACCOUNTING (the FAILED silver rule, not re-judged): at the demo's measured XAGUSD spreads, C1 (median + 0.05 × M) 0.016R a trade on 2021 → 2026-11-12 (t 0.52) and 0.032R on 2016 → (t 1.23); C2 0.002R (t 0.08) and 0.017R (t 0.66); cost about 0.054R a trade against the study's 0.17R; holds in 0 of 4.** The failed verdict of `silver-vol-breakout` stands: even at the broker's own spreads silver T1 is not apart from zero. Unlike gold, silver's spread is a real cost on this account.

Pre-registered in `PREREGISTRATION.md` (pushed alone, before any XAGUSD quote was read). The rule is `silver-vol-breakout/run.mjs`, imported unchanged; the gate (its $0.03 figures, IS / OOS / ALL) held exactly. Data: council-data `research/probe/ticks-XAGUSD.json` (commit 19c2477d, 44 weekdays of the demo's own quotes at the top of every UTC hour). Commission: XAGUSD is not in `ctrader/symbols.json` (the mirror does not trade it), so gold's 0.000024 of price is used, as pre-registered. Nothing live changed.

## The measurement

Quoted XAGUSD spread, median per UTC hour 00-20: $0.020-0.0275, i.e. 3.5-4.9 × 10⁻⁴ of price (90th percentile up to 6.0 × 10⁻⁴). Gold on the same account: 1.7-2.6 × 10⁻⁵. Silver costs about twenty times more per unit of price.

## Net R a trade (month t)

| Spread | Slippage | 2016-20 | 2021 → 12 Nov 2026 | 2016 → 12 Nov 2026 |
|---|---|---|---|---|
| median | 0 × M | +0.056 (1.31) | +0.023 (0.75) | +0.038 (1.49) |
| median | 0.05 × M | +0.050 (1.17) | +0.016 (0.52) | +0.032 (1.23) |
| median | 0.1 × M | +0.044 (1.02) | +0.009 (0.28) | +0.025 (0.97) |
| 90th pct | 0 × M | +0.047 (1.09) | +0.017 (0.54) | +0.031 (1.18) |
| 90th pct | 0.05 × M | +0.041 (0.95) | +0.010 (0.31) | +0.024 (0.92) |
| 90th pct | 0.1 × M | +0.034 (0.8) | +0.002 (0.08) | +0.017 (0.66) |
| study's $0.03 | 0 | −0.135 (−2.99) | −0.041 (−1.23) | −0.084 (−3.04) |

The measured cost (about 0.054R a trade with 0.05 × M) is a third of the study's 0.17R, so the sign turns, but 0 of the 4 pre-registered checks (C1, C2 × 2021 → and 2016 →) holds: the best is +0.032R, t 1.23.

## What it means

- The gold breakout's measured-cost result does not carry to silver: silver's own spread takes most of its small gross (+0.086R).
- This was a re-costing chosen after the silver study failed on costs; even a positive answer would only have been a lead. It is not one.

To repeat: `node research/edge/silver-vol-breakout-hourcost/run.mjs <dir> <ticks-XAGUSD.json> <symbols.json> [probeCommit]` with `<dir>/xag-5m.json.gz` (OANDA mid M5 XAG/USD from November 2015, kept out of git).
