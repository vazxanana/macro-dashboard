# The T1 volatility breakout on Bitcoin and Ether (24 Nov 2026)

**Verdict: FAIL, 0 of 3: T1 breakout on BTC + ETH pooled, confirmation 2024-01 → 2026-10 +0.045R a trade net (n 1428, month t +1.27; gross +0.089R), discovery 2022-23 −0.011R (n 970); 40 of 40 placebos beaten**

Paper research only. Rule, data, windows, cost and pass bar were fixed in `PREREGISTRATION.md` (committed alone before this run). `vbTrade` / `placeboTrade` imported from `index-vol-breakout/original.mjs` (sha256 checked). Nothing live changed; no proposal.

| Test | Window | n | Win | Net R/trade | Gross R/trade | Net 2x cost | Cost R/trade | Total R | Month t | Max DD R |
|---|---|---|---|---|---|---|---|---|---|---|
| BTC | 2022-23 | 476 | 37.8 % | −0.030 | +0.021 | −0.081 | +0.051 | −14.29 | −0.53 | −31.72 |
| BTC | 2024 → 2026-10 | 713 | 41.8 % | +0.031 | +0.084 | −0.022 | +0.053 | +22.02 | +0.77 | −28.67 |
| ETH | 2022-23 | 494 | 40.9 % | +0.007 | +0.046 | −0.032 | +0.039 | +3.52 | +0.16 | −21.37 |
| ETH | 2024 → 2026-10 | 715 | 39.7 % | +0.059 | +0.095 | +0.023 | +0.036 | +42.22 | +1.31 | −17.88 |
| pool | 2022-23 | 970 | 39.4 % | −0.011 | +0.034 | −0.056 | +0.045 | −10.77 | −0.25 | −44.77 |
| pool | 2024 → 2026-10 | 1428 | 40.8 % | +0.045 | +0.089 | +0.001 | +0.044 | +64.24 | +1.27 | −44.87 |

| Test | Holm p | Placebos beaten (confirmation) | Placebo median | Both windows > 0 | t ≥ 2 + Holm | 2x cost ≥ 0 | ≥ 38 placebos | n ≥ 200 | Pass |
|---|---|---|---|---|---|---|---|---|---|
| BTC | 0.285 | 40 of 40 | −0.030 | no | no | no | yes | yes | no |
| ETH | 0.285 | 40 of 40 | +0.002 | yes | no | yes | yes | yes | no |
| pool | 0.285 | 40 of 40 | −0.008 | no | no | yes | yes | yes | no |

## Reported only

- BTC, confirmation: buys +0.046R (n 359), sells +0.015R (n 354); weekend days −0.124R, weekdays +0.072R; median stop 1084.4; by year 2022 −0.059 (n 244), 2023 +0.000 (n 232), 2024 +0.131 (n 246), 2025 +0.007 (n 250), 2026 −0.055 (n 217).
- ETH, confirmation: buys +0.010R (n 363), sells +0.110R (n 352); weekend days −0.139R, weekdays +0.118R; median stop 53.13; by year 2022 −0.018 (n 243), 2023 +0.031 (n 251), 2024 +0.043 (n 250), 2025 +0.061 (n 257), 2026 +0.075 (n 208).
- pool, confirmation: buys +0.028R (n 722), sells +0.062R (n 706); weekend days −0.132R, weekdays +0.094R; median stop 207.09; by year 2022 −0.038 (n 487), 2023 +0.016 (n 483), 2024 +0.087 (n 496), 2025 +0.034 (n 507), 2026 +0.009 (n 425).

## Reading

FAIL as pre-registered: no test passes. The pool lost in 2022-23 (−0.011R a trade, n 970) and made +0.045R in 2024-26 (n 1428, month t 1.27, Holm p 0.285), short of t 2. The breakout beat all 40 random-entry placebos in confirmation (their median −0.008R), so the entry timing carries a small before-cost tilt (gross +0.089R), but a before-cost tilt is not an edge: after the assumed 0.06 % round trip it is within noise and BTC's 2x-cost figure is negative. ETH is the better coin (+0.059R, t 1.31; +0.007R in 2022-23), not enough on its own. Weekend days lost on both coins (pool −0.132R) while weekdays made +0.094R: a split looked at after the result, a hypothesis at most, never a rule from these years. Only 2022-26 could be read (no 2018-21 candles reachable), so this is less than five years of one market regime per coin. Not an edge; nothing proposed.

Cost: `tradeCost` of `council/fills.mjs` for a crypto market order with a non-target exit = 0.06 % of the entry price a round trip (CFD_CRYPTO 0.04 % + half a 0.02 % spread on entry and exit); ASSUMED, the demo broker's crypto quotes were not measured. No financing (every trade is out by 21:00 UTC). Data: Binance spot M5 from council-data `research/candles/crypto5m`, BTC 2022-01-01 → 2026-10-31 (508304 candles, 1765 days); ETH 2022-01-01 → 2026-10-31 (508304 candles, 1765 days). 2018-21 is not on file and every exchange host was refused by the network proxy, so the discovery window is 2022-23 (pre-registered).
