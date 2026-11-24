# USD/CNH: gold's T1 volatility breakout, unchanged (24 Nov 2026)

**Verdict: FAIL: USD/CNH T1 confirmation 2018 → +0.066R a trade net (n 1699, month t +2.09; gross +0.133R), discovery +0.023R (n 680, t +0.56); 40 of 40 placebos beaten; fails: cost2x**

Paper research only. Rule, cost, windows and bar fixed in `PREREGISTRATION.md` (pushed alone before any USD/CNH candle was fetched). The rule's functions are imported from `index-vol-breakout/original.mjs` (sha256 checked). Nothing live changed; not an edge.

| Window | n | Win | Net R/trade | Gross R/trade | Net 2x cost | Cost R/trade | Month t (net) | Month t (gross) | Max DD R | Median stop |
|---|---|---|---|---|---|---|---|---|---|---|
| Discovery 2011-03-01 → 2017 | 680 | 44.1 % | +0.023 | +0.124 | −0.078 | +0.101 | +0.56 | +3.22 | −30.50 | 0.01 |
| Confirmation 2018 → 2026-11-24 | 1699 | 44.3 % | +0.066 | +0.133 | −0.002 | +0.068 | +2.09 | +4.35 | −29.98 | 0.01 |
| Whole span | 2379 | 44.2 % | +0.053 | +0.131 | −0.024 | +0.077 | +2.11 | +5.34 | −30.50 | 0.01 |

Placebo (40 seeds, confirmation window): the rule beats 40 of 40 (38 needed). Checks: bothWindows yes, t2 yes, cost2x no, n200 yes, placebo yes.

By year (net R a trade): 2013 +0.253 (n 2) · 2014 +0.235 (n 112) · 2015 −0.073 (n 193) · 2016 −0.005 (n 189) · 2017 +0.020 (n 184) · 2018 +0.153 (n 190) · 2019 +0.106 (n 180) · 2020 +0.052 (n 194) · 2021 +0.133 (n 184) · 2022 +0.198 (n 193) · 2023 +0.011 (n 198) · 2024 −0.001 (n 196) · 2025 −0.022 (n 192) · 2026 −0.043 (n 172).

Buys / sells (whole span): 1196 at +0.036R, 1183 at +0.071R.

**Correlation with USD/JPY T1 (descriptive)**: monthly net R, whole common span r +0.04 over 157 months; 2018 → r +0.08 over 107 months. USD/JPY T1 over the same days: 2989 trades, +0.070R net, month t +3.11 (its own cost: 0.000045 of the entry + 0.5 pip).

**Reading.** Every check passed but the 2x-cost one (confirmation −0.002R a trade at 2x, month t −0.07). The single cost (about 6.1 pips a round trip at 7.0) is ASSUMED, below the about 9.2 pips `cnh-fix` assumed for the same pair, and the result lives or dies on it: the cost takes about half the gross R. The net R also fades: 2018-22 positive every year, 2023 → about zero or negative (by year above). By the pre-registration this is a FAIL; at most a before-cost tilt whose after-cost value is unknown until the pair's spread is measured. Discovery is in practice 2013-07-03 → 2017 (USD/CNH 5-minute candles are too thin before that for the original's 200-candle day rule). USD/CNH does not join gold and USD/JPY; the breakout stays where it was found. Nothing live changed.

Cost (ASSUMED, not measured; the demo broker has no USDCNH): 0.000045 of the entry + 0.0003 a round trip. Data: OANDA mid M5 usdcnh 2011-02-05 → 2026-11-24, 1017916 candles; 4066 trading days from 2011-03-01, 821 skipped by the original's day rules.
