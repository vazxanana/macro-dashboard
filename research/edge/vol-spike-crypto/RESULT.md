# Result: the frozen vol-spike rebound on crypto (14 Nov 2026)

**Verdict: FAIL.** #860's rule, frozen byte for byte (buy after the 5-day realised volatility exceeds twice its prior 120-day
median while the close is below the 20-day average, hold 10 days, stop 3 x ATR(20)), run on BTC, ETH, SOL and XRP daily
candles lost a little after costs in 2020-26 (-0.031R a trade, n 112, month-sum t -0.42) and before costs was flat (-0.006R).
The 2017-19 replication lost too (-0.102R, n 28), and the rule beat only 11 of 40 placebo seeds. 0 of the 4 checks after the
trade count pass. The after-panic rebound seen on US indices does not show on crypto. Not an edge; no proposal; nothing live
changed. Rules, windows and bar: `PREREGISTRATION.md` (committed alone before this run).

## Gate
The frozen `study()` on #860's own data (council-data `research/daily/{spx500,nas100,us30}.json` + `macro/cache.json` DGS2)
gives #860's committed `holds["10"]` JSON-equal, verdict PASS (window B n 165, +0.151R, t 2.53; A n 122, +0.013R). Passed.

## Coins, days and windows
- Primary (the verdict): BTC, ETH, SOL, XRP (the council's four crypto markets). Reported only: ADA, BNB, DOGE, LINK, LTC, TRX.
- Binance spot UTC daily candles, council-data `research/candles/crypto1d`, all to 2026-10-31, no missing day in any coin.
- One frozen "day" = one UTC calendar day, seven days a week (the wrapper does not use the frozen `candles()`, which drops
  weekends): RV5 = 5 calendar days, MED120 = 120, SMA20 / ATR(20) = 20, the hold 10 calendar days.
- First signal-ready day: BTC and ETH 2017-12-20, XRP 2018-09-06, SOL 2020-12-14 (no replication trades).
- Decisive D: entries 2020-01-01 to 2026-10-31. Replication W: entries 2017-01-01 to 2019-12-31.

## Primary: pooled BTC + ETH + SOL + XRP, 10-day hold

| Window | Cost | n | R a trade | % a trade | won | trade t | month t | stops | worst drawdown |
|---|---|---|---|---|---|---|---|---|---|
| D 2020-26 | none | 112 | -0.006 | +0.353 | 52.68 % | -0.11 | -0.09 | 13 | -6.86R |
| D 2020-26 | base | 112 | -0.031 | -0.185 | 49.11 % | -0.56 | -0.42 | 13 | -7.7R |
| D 2020-26 | 2x | 112 | -0.055 | -0.723 | 45.54 % | -1.02 | -0.75 | 13 | -10.1R |
| W 2017-19 | none | 28 | -0.079 | +0.187 | 50 % | -1.06 | -0.79 | 2 | -4.56R |
| W 2017-19 | base | 28 | -0.102 | -0.375 | 46.43 % | -1.36 | -0.99 | 2 | -4.88R |
| W 2017-19 | 2x | 28 | -0.125 | -0.938 | 42.86 % | -1.66 | -1.19 | 2 | -5.21R |

Bar: n >= 40 (yes), R a trade in D > 0 (no), month t >= 2 (no), W > 0 (no), D > 0 at 2x cost (no). Cost averaged 0.024R a trade
(CFD round trip 0.04 % + 15 % a year financing over 12.12 nights on average). In percent of price the trades made +0.35 % before
costs; the 3 x ATR(20) risk is wide on crypto, so costs are small in R but the rebound itself is absent.

## Per coin, decisive window D (10-day hold, base cost; Holm over the four)

| Coin | n | R a trade | trade t | month t | one-sided p | Holm p | won | before costs | 2x cost | worst DD | W n | W R a trade |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BTC | 30 | -0.078 | -0.68 | -0.79 | 0.753 | 1 | 43.33 % | -0.043 | -0.113 | -3.23R | 11 | -0.151 |
| ETH | 23 | -0.054 | -0.61 | -0.65 | 0.729 | 1 | 47.83 % | -0.03 | -0.077 | -1.9R | 11 | -0.128 |
| SOL | 21 | +0.021 | 0.16 | 0.14 | 0.437 | 1 | 52.38 % | +0.037 | +0.004 | -3.22R | 0 | - |
| XRP | 38 | -0.008 | -0.08 | -0.08 | 0.531 | 1 | 52.63 % | +0.013 | -0.028 | -4.6R | 6 | +0.034 |

## Secondary
- **5-day hold** (#860's own primary): D n 136, -0.012R a trade (month t -0.22), +0.001R before costs, -0.024R at 2x;
  W n 33, -0.087R.
- **The six other coins (not in the verdict)**: D n 197, +0.054R a trade, trade t 0.96, month t 0.85 (+0.079R before costs,
  +0.029R at 2x); W n 26, +0.002R. Per coin in D: ADA -0.108 (n 34), BNB +0.074 (32), DOGE +0.162 (32), LINK +0.020 (26),
  LTC +0.127 (32, t 1.31), TRX +0.053 (41). Positive on the whole, nowhere near t 2, and these are coins no council system
  trades; reading them as the effect would be choosing the set after the fact.
- **By entry year** (primary four, sum of net R): 2017 +0.15 (1), 2018 -2.27 (15), 2019 -0.75 (12), 2020 -1.22 (17),
  2021 +0.30 (12), 2022 -5.93 (23), 2023 +2.92 (9), 2024 +0.67 (18), 2025 -3.42 (21), 2026 +3.25 (12). The 2022 bear market,
  with spike after spike on the way down, is the worst year, as 2008 and 2020 were for the indices.

## Placebo
40 seeds (`rng(7001)` … `rng(7040)`): per coin the same number of trades on days below the 20-day average WITHOUT a spike, fill
in D, the frozen hold, stop and the same costs. Seeds' pooled mean +0.023R, 95th percentile +0.164R. The rule (-0.031R) beats
11 of 40: the spike made the dip entry worse than an ordinary dip below the average, not better.

## Departures and assumptions
- Financing at the broker's crypto long swap of today (15 % a year, BTC/ETH/SOL); XRP and the six reported coins are not listed
  at the broker and are charged the same rate (assumption, as `crypto-reversal`). Past rates are not on file.
- Candles are Binance spot, not the broker's CFD prices or the council's Kraken feed (the longest history on file).
- No slippage beyond `CFD_CRYPTO`; the 2x-cost row covers it.
- No parameter was changed after the first run; no other multiple, median, SMA, stop, hold, coin set or window was tried.

## What it means for #860
One more frozen run that does not support the index result: here the sign is negative in both windows, so it gives no
support to a general after-panic effect. #860's paper-shadow proposal stays the owner's decision with this beside it.

## To repeat
`node research/edge/vol-spike-crypto/run.mjs fetch <dir>` (git show from `origin/council-data` and `origin/vol-spike-rebound`,
no network), then `node research/edge/vol-spike-crypto/run.mjs full <dir>`. Tests: `tests/vol-spike-crypto.test.mjs`.
