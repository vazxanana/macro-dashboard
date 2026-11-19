# Result: the weekly US crude inventory report on WTI, fade or follow the first half hour (oil-wednesday)

**Verdict: FAIL, 0 of 2 rules pass: neither fading nor following the first half hour after the report is an edge on WTI.** Rule F (fade): decisive 2021 on −0.096R a trade net (n 304, t -0.21, Holm p 1), 2016-20 −0.221R (n 259), beats 39 of 40 placebo seeds: fail (decisive mean net R not above 0; Holm p not under 0.05 with t >= 2; 2016-2020 mean not above 0). Rule C (continue): decisive 2021 on −0.013R a trade net (n 306, t -0.13, Holm p 1), 2016-20 −0.093R (n 260), beats 34 of 40 placebo seeds: fail (decisive mean net R not above 0; Holm p not under 0.05 with t >= 2; 2016-2020 mean not above 0; beats 34 of 40 placebo seeds (needs 38)).

Pre-registered in PREREGISTRATION.md (pushed first). Data: OANDA mid M30 WTICO_USD via the site proxy, 2015-11-01 to 2026-11-13, 130392 candles. Calendar: 567 weeks, 84 delayed to Thursday 11:00, 0 skipped. Costs $0.03 a round trip; no overnight. Research only: nothing live changed.

| Rule | Window | n | net R a trade | t | win | total R | worst DD | gross R a trade | x2 cost R a trade |
|---|---|---|---|---|---|---|---|---|---|
| F (fade) | 2016-20 | 259 | −0.221 | -1.44 | 0.259 | -57.3 | -74.2 | +0.123 | −0.566 |
| F (fade) | 2021 on | 304 | −0.096 | -0.21 | 0.148 | -29.1 | -104.3 | +0.243 | −0.434 |
| C (continue) | 2016-20 | 260 | −0.093 | -1.31 | 0.427 | -24.1 | -34.7 | −0.017 | −0.169 |
| C (continue) | 2021 on | 306 | −0.013 | -0.13 | 0.359 | -3.8 | -38.3 | +0.056 | −0.081 |

## Decisive window by side, exits, placebo

- Rule F (fade): buys +0.330R (n 143), sells −0.474R (n 161); exits stop 258, gap 0, time 46; median risk $0.177; median net R −1.151; trades risking under $0.05: 38; placebo means −0.801 to −0.091R (median −0.388).
- Rule C (continue): buys −0.043R (n 162), sells +0.022R (n 144); exits stop 157, gap 0, time 149; median risk $0.53; median net R −1.023; trades risking under $0.05: 0; placebo means −0.211 to +0.051R (median −0.100).

## By year (net R a trade, n)

| Year | F | C |
|---|---|---|
| 2016 | −0.115 (51) | −0.141 (52) |
| 2017 | −0.249 (51) | +0.290 (51) |
| 2018 | −0.252 (52) | −0.300 (52) |
| 2019 | −0.524 (52) | −0.020 (52) |
| 2020 | +0.032 (53) | −0.282 (53) |
| 2021 | −0.407 (52) | +0.328 (52) |
| 2022 | −0.893 (52) | −0.015 (52) |
| 2023 | −0.334 (52) | −0.122 (52) |
| 2024 | −0.198 (52) | +0.017 (52) |
| 2025 | +2.334 (51) | −0.367 (53) |
| 2026 | −1.176 (45) | +0.107 (45) |

## Reading

Neither reading of the first half hour after the report is an edge on WTI by the pre-registered bar. Never call it one; no proposal is written and nothing live changed. The fade's stop sits just past the reaction candle's extreme, often a few cents from the entry, so its R per trade has very long tails (decisive gross +0.243R a trade, t 0.53, median net −1.151R; one year, 2025, carries the sign) and the $0.03 spread is a large share of a small risk. Not tested: consensus surprises (no consensus data), other exits, the report on Brent.
