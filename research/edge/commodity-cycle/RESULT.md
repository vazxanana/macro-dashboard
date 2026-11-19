# The owner's market cycle as an entry on commodity CFDs (gold excluded): result

**Verdict: FAIL.** Neither exit passed every pre-registered line. Exit A (target the H4 move's extreme): −0.317R a trade net on 2016-2026 (n 2425, monthly t −10.07). Exit B (fixed 2R): −0.260R (n 5695, monthly t −15.06). Six markets pooled: silver, platinum, palladium, copper, WTI and Brent crude (OANDA mid H1).

Pre-registration: `PREREGISTRATION.md` (pushed first). The rule is `frozen.mjs` = `research/edge/crypto-cycle/run.mjs` of branch
`crypto-cycle` byte for byte (sha256 pinned in `tests/commodity-cycle.test.mjs`); this study adds only fx-cycle's skip window, the
commodity costs (assumed spreads, not measured) and the windows. Paper research only: nothing live changed. Never call this rule an edge
on commodities. Gold is not in this study (owner item 44).

## Gate

The frozen file's own `study()` on crypto-cycle's own candles (council-data `research/candles/crypto5m`) reproduces crypto-cycle's published `result.json` **exactly, every field**: Exit A n 830, net R −65.420, monthly t −1.80; Exit B n 1717, net R −94.280, monthly t −1.79.

## Pass bar

| Line | Exit A | Exit B |
|---|---|---|
| Decisive mean net R > 0 | no | no |
| Monthly t >= 2 | no | no |
| Holm p < 0.05 (2 exits) | yes | yes |
| Replication 2007-2015 mean net R > 0 | no | no |
| Above the placebo 95th percentile | no | no |
| **Exit passes** | **no** | **no** |

The p is two-sided, as pre-registered: where the Holm line reads "yes" with a negative mean, the result is significant in the losing direction.

## Pooled results (six markets, net of costs and financing)

| Exit | Window | n | Net R | Mean net R | Mean gross R | Mean net R at 2x cost | t (trades) | Months | t (monthly) | p | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 2016-now (decisive) | 2425 | −768.020 | −0.317 | −0.028 | −0.605 | −10.97 | 131 | −10.07 | < 0.0001 | < 0.0001 |
| A | 2007-2015 (replication) | 1928 | −719.090 | −0.373 | −0.032 | −0.714 | −10.24 | 108 | −10.35 | < 0.0001 | |
| B | 2016-now (decisive) | 5695 | −1477.990 | −0.260 | −0.024 | −0.495 | −14.88 | 131 | −15.06 | < 0.0001 | < 0.0001 |
| B | 2007-2015 (replication) | 4601 | −1185.500 | −0.258 | +0.013 | −0.528 | −12.89 | 108 | −11.00 | < 0.0001 | |

Before any cost (the 0-cost line), the decisive pooled mean is −0.028R (Exit A) and −0.024R (Exit B): the rule loses before costs too, so the verdict does not rest on the assumed spreads.

Win rate before costs (decisive): Exit A 35.4 %, Exit B 36.1 %. Mean cost a trade: Exit A +0.288R, Exit B +0.235R.

## Placebo: random entries with the H4 bias, same market, side, stop distance and target in R (40 seeds)

| Exit | Rule, decisive mean net R | Placebo 5th pct | Placebo median | Placebo 95th pct | Placebo best | Seeds better than the rule |
|---|---|---|---|---|---|---|
| A | −0.317 | −0.395 | −0.353 | −0.306 | −0.298 | 6 of 40 |
| B | −0.260 | −0.302 | −0.281 | −0.245 | −0.238 | 3 of 40 |

Read: the entry after "the pullback finished" did better than the median random entry with the same H4 bias for Exit A and better for Exit B.

## Per market, decisive 2016-now (reported, never decisive; Holm over the 12 market x exit tests at base cost)

| Exit | Market | Signals (all years) | n | Mean R, no cost | Mean net R, base | Mean net R, 2x cost | t (monthly) | Holm p (12) | Replication n / net R | Mean stop (% of price) | Mean cost (R) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | Silver | 1947 | 401 | −0.090 | −0.238 | −0.385 | −3.93 | 0.0005 | 344 / −0.164 | 0.9946 | +0.148 |
| A | Platinum | 2102 | 388 | −0.089 | −0.499 | −0.908 | −6.74 | < 0.0001 | 297 / −0.602 | 0.9844 | +0.410 |
| A | Palladium | 2022 | 428 | +0.193 | −0.389 | −0.971 | −5.39 | < 0.0001 | 268 / −0.932 | 1.2088 | +0.582 |
| A | Copper | 2204 | 401 | −0.028 | −0.360 | −0.691 | −4.77 | < 0.0001 | 342 / −0.369 | 0.7816 | +0.331 |
| A | WTI crude | 2348 | 408 | −0.139 | −0.259 | −0.378 | −3.85 | 0.0005 | 357 / −0.101 | 1.2471 | +0.120 |
| A | Brent crude | 2186 | 399 | −0.031 | −0.157 | −0.284 | −1.92 | 0.0552 | 320 / −0.225 | 1.21 | +0.126 |
| B | Silver | 1947 | 920 | −0.009 | −0.137 | −0.265 | −3.26 | 0.0022 | 768 / −0.150 | 1.1949 | +0.128 |
| B | Platinum | 2102 | 956 | −0.057 | −0.402 | −0.747 | −8.76 | < 0.0001 | 754 / −0.367 | 1.2195 | +0.345 |
| B | Palladium | 2022 | 962 | +0.092 | −0.370 | −0.833 | −9.09 | < 0.0001 | 694 / −0.595 | 1.5539 | +0.462 |
| B | Copper | 2204 | 940 | −0.014 | −0.284 | −0.555 | −6.51 | < 0.0001 | 763 / −0.302 | 0.9463 | +0.270 |
| B | WTI crude | 2348 | 972 | −0.098 | −0.196 | −0.294 | −5.72 | < 0.0001 | 826 / −0.126 | 1.6204 | +0.098 |
| B | Brent crude | 2186 | 945 | −0.058 | −0.162 | −0.267 | −3.89 | 0.0005 | 796 / −0.058 | 1.5066 | +0.104 |

**Natural gas (reported only, not pooled, not in any Holm family):** Exit A n 429, mean R no cost −0.072 / base −0.378 / 2x −0.685, monthly t −4.93; replication n 363 / −0.325. Exit B n 1019, mean R no cost −0.045 / base −0.276 / 2x −0.506, monthly t −6.33; replication n 889 / −0.346.

## By exit reason and side, decisive window

| Exit | Group | n | Mean gross R | Mean net R |
|---|---|---|---|---|
| A | target | 745 | +1.816 | +1.517 |
| A | stop | 1520 | −1.000 | −1.288 |
| A | gap | 5 | −1.778 | −1.937 |
| A | time | 155 | +0.691 | +0.446 |
| A | buys | 1137 | +0.006 | −0.294 |
| A | sells | 1288 | −0.059 | −0.337 |
| B | target | 1465 | +2.000 | +1.728 |
| B | stop | 3386 | −1.000 | −1.239 |
| B | gap | 19 | −1.395 | −1.566 |
| B | time | 825 | +0.418 | +0.262 |
| B | buys | 2987 | −0.004 | −0.242 |
| B | sells | 2708 | −0.046 | −0.279 |

## By year of exit, decisive window (mean net R, n)

| Year | Exit A | Exit B |
|---|---|---|
| 2016 | −0.289 (216) | −0.221 (558) |
| 2017 | −0.348 (247) | −0.265 (538) |
| 2018 | −0.434 (236) | −0.270 (531) |
| 2019 | −0.649 (239) | −0.416 (530) |
| 2020 | −0.254 (208) | −0.128 (468) |
| 2021 | −0.245 (222) | −0.241 (499) |
| 2022 | −0.312 (212) | −0.226 (532) |
| 2023 | −0.269 (213) | −0.376 (540) |
| 2024 | −0.076 (232) | −0.219 (547) |
| 2025 | −0.245 (199) | −0.246 (511) |
| 2026 | −0.324 (201) | −0.225 (441) |

## Costs (assumptions, not measurements)

Round trip = 2 x an assumed typical spread, as a fraction of the entry price: Silver 0.10 %, Platinum 0.30 %, Palladium 0.50 %, Copper 0.20 %, WTI crude 0.10 %, Brent crude 0.10 %, Natural gas 0.30 %. Financing: long 0.00015 of the entry price a rollover (`council/fills.mjs` `nights`: Monday-Friday 22:00 UTC, Wednesday three), short 0. No broker measurement of these markets exists; the 2x line is in the tables.

## Data

OANDA mid H1 candles through the site's candle proxy (`node --use-env-proxy research/edge/commodity-cycle/fetch.mjs <dir>`, kept out of git),
then `node research/edge/commodity-cycle/run.mjs <dir>`. Candles:

- Silver: 125369 H1 candles, 2006-03-19T21:00 to 2026-11-13T20:00 UTC
- Platinum: 126137 H1 candles, 2005-01-03T02:00 to 2026-11-13T20:00 UTC
- Palladium: 123091 H1 candles, 2005-01-03T19:00 to 2026-11-13T20:00 UTC
- Copper: 125385 H1 candles, 2004-01-05T00:00 to 2026-11-13T20:00 UTC
- WTI crude: 136899 H1 candles, 2004-01-05T00:00 to 2026-11-13T20:00 UTC
- Brent crude: 121815 H1 candles, 2004-01-02T10:00 to 2026-11-13T20:00 UTC
- Natural gas: 133788 H1 candles, 2004-01-05T00:00 to 2026-11-13T20:00 UTC

## What follows

A FAIL ends this reading on commodities: no parameter will be varied after seeing the result (pre-registered). With index-cycle, fx-cycle, crypto-cycle and cycle-gate-study, the cycle entry / gate has now failed on every market group tested. Not a council rule, not a filter; nothing live changed.
