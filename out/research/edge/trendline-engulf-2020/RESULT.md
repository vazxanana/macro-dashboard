# Trendline third touch and break-and-retest with an engulf trigger, 18 markets: result (23 Nov 2026)

**Verdict: FAIL. 0 of 4 tests pass: confirmation 2024-26 after costs T1 n 1,174, -0.021R a trade, month t -0.49; T2 n 4,024, -0.050R, t -2.46; T3 n 1,019, +0.050R, t 1.18 (discovery -0.064R); T4 n 3,624, -0.084R, t -3.46.**

Pre-registration: `PREREGISTRATION.md` (committed before this code). Code: `run.mjs` (the shared toolkit, `engulfAt` of
`council/eg-methods.mjs`, the costs and data-quality exclusions of `combo-grid-2`). Data: OANDA mid 5-minute candles of 18
markets, 2019-06 (warm-up) to 23 Nov 2026, grouped to UTC H4 and H1. Discovery 2020-2023, confirmation 2024 to now.

| Test | Rule, timeframe | Discovery: n / mean R (month t) | Confirmation: n / mean R (month t) | Conf. at 2x cost | Conf. before costs | Holm p |
|---|---|---|---|---|---|---|
| T1 | third touch, H4 | 1544 / +0.006 (t 0.16) | 1174 / -0.021 (t -0.49) | -0.046 | +0.003 | 1.000 |
| T2 | third touch, H1 | 5500 / -0.058 (t -2.99) | 4024 / -0.050 (t -2.46) | -0.102 | +0.002 | 1.000 |
| T3 | break and retest, H4 | 1418 / -0.064 (t -1.71) | 1019 / +0.050 (t 1.18) | +0.020 | +0.081 | 0.490 |
| T4 | break and retest, H1 | 5099 / -0.081 (t -3.93) | 3624 / -0.084 (t -3.46) | -0.143 | -0.024 | 1.000 |

Mean R is a trade after costs with the pre-registered 2R target; month t is on calendar-month sums (empty months zero), by
fill month; Holm over the four one-sided confirmation p values.

## Descriptive only (no test, no verdict)
| Test | Gold discovery | Gold confirmation | All, 1R target, confirmation | All, 3R target, confirmation |
|---|---|---|---|---|
| T1 | 103 / +0.015 (t 0.12) | 56 / -0.094 (t -0.52) | 1245 / -0.053 (t -1.67) | 1129 / +0.023 (t 0.43) |
| T2 | 324 / -0.047 (t -0.74) | 249 / +0.043 (t 0.58) | 4218 / -0.063 (t -4.28) | 3913 / -0.059 (t -2.53) |
| T3 | 79 / -0.055 (t -0.44) | 55 / +0.018 (t 0.10) | 1076 / -0.019 (t -0.56) | 995 / +0.035 (t 0.66) |
| T4 | 280 / -0.119 (t -1.71) | 204 / -0.110 (t -1.16) | 3778 / -0.059 (t -3.75) | 3551 / -0.057 (t -2.06) |

## What happened, in plain words
- Before costs every stream is at zero (confirmation -0.024R to +0.081R a trade): the line, its third touch or its retest
  and the engulf do not pick moves that run 2R more often than chance; the costs (larger on H1, where stops are smaller)
  turn that into a loss. H1 loses in both windows with month t near -2.5 to -3.9.
- T3 (break and retest on H4) is the only stream positive in 2024-26 (+0.050R, t 1.18, Holm p 0.49) and it lost in
  2020-2023 (-0.064R): 2021 alone was -0.163R a trade, 2026 +0.094R. Its buys made +0.124R in confirmation (n 508), its
  sells -0.022R (n 511): a split read after the result, not a finding.
- Gold alone (descriptive) is no better than the pool on any test; 55-249 confirmation trades a test.
- The rules are common, not rare: 2,400-9,500 trades a test over 18 markets.

## Checks
- No look-ahead: with every candle after 15 Jun 2023 removed, the signals of gold and EUR/USD triggered before that date
  are identical on both timeframes and both rules (89-367 signals compared per case; `result.json` `cutCheck`). The test
  file repeats it on seeded synthetic candles with every later price changed.
- Every trade has its stop on the losing side (a market fill already past the stop is skipped: 23 in all).
- Data quality: trades filled in a listed bad interval are dropped (54 in all). `quality.json` lists intervals for the first
  ten markets only; the eight added markets (gbpjpy eurgbp audjpy cadjpy euraud nas100 spx500 de40) had none to apply.
- Before the full run the code was run once on gold alone to check it worked; nothing was changed after that run.

Nothing live changed. No variant (swing size, tolerance, slope limits, windows, targets, timeframes) will be run.
