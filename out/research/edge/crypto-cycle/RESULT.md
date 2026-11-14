# The owner's market cycle as an entry on crypto: result

**Verdict: FAIL.** Neither exit passed every pre-registered line. Exit A (target the H4 move's extreme): −0.079R a trade net on 2022-2026 (n 830, monthly t −1.80). Exit B (fixed 2R): −0.055R (n 1717, monthly t −1.79).

Pre-registration: `PREREGISTRATION.md` (copied from `research/edge/index-cycle/PREREGISTRATION.md`, branch `index-cycle`; markets, data,
windows, skip window and costs changed for crypto). Paper research only: nothing live changed. Never call this rule an edge on crypto.
Data: Binance spot 5-minute candles of BTC, ETH and SOL from council-data (1 Jan 2022 to 31 Oct 2026), built into H1 / H4 in UTC buckets.
**No 2018-2021 replication**: no intraday crypto before 2022 can be reached from the build sandbox, so the pre-registered halves line
(2022-23 and 2024-now both positive) stands in for it.

## Pass bar

| Line | Exit A | Exit B |
|---|---|---|
| Decisive mean net R > 0 | no | no |
| Monthly t >= 2 | no | no |
| Holm p < 0.05 (2 exits) | no | no |
| Both halves mean net R > 0 | no | no |
| Above the placebo 95th percentile | no | no |
| **Exit passes** | **no** | **no** |

## Pooled results (three coins, net of costs and financing)

| Exit | Window | n | Net R | Mean net R | Mean gross R | t (trades) | Months | t (monthly) | p | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 2022-now (decisive) | 830 | −65.420 | −0.079 | −0.035 | −1.74 | 58 | −1.80 | 0.0722 | 0.1444 |
| A | 2022-2023 (half 1) | 356 | −54.320 | −0.153 | −0.109 | −2.37 | 24 | −2.17 | 0.0298 | |
| A | 2024-now (half 2) | 474 | −11.100 | −0.023 | +0.021 | −0.37 | 34 | −0.43 | 0.6677 | |
| B | 2022-now (decisive) | 1717 | −94.280 | −0.055 | −0.017 | −1.77 | 58 | −1.79 | 0.0733 | 0.1444 |
| B | 2022-2023 (half 1) | 699 | −57.650 | −0.083 | −0.045 | −1.74 | 24 | −1.94 | 0.0529 | |
| B | 2024-now (half 2) | 1018 | −36.630 | −0.036 | +0.003 | −0.88 | 34 | −0.84 | 0.4013 | |

Win rate before costs (decisive): Exit A 37.1 %, Exit B 36.0 %.

## Placebo: random entries with the H4 bias, same market, direction, stop distance and target in R (40 seeds)

| Exit | Rule, decisive mean net R | Placebo 5th pct | Placebo median | Placebo 95th pct | Placebo best | Seeds better than the rule |
|---|---|---|---|---|---|---|
| A | −0.079 | −0.124 | −0.060 | +0.000 | +0.032 | 28 of 40 |
| B | −0.055 | −0.086 | −0.041 | +0.001 | +0.022 | 23 of 40 |

Read: the entry after "the pullback finished" did worse than the median random entry with the same H4 bias for Exit A and worse for Exit B.

## Per coin (reported, never decisive; Holm over the 6 coin x exit tests)

| Exit | Coin | Signals 2022-now | n | Mean net R | Mean gross R | t (monthly) | Holm p (6) | Half 1 n / net R | Half 2 n / net R | Mean stop (% of price) |
|---|---|---|---|---|---|---|---|---|---|---|
| A | BTC | 600 | 273 | +0.028 | +0.086 | 0.32 | 1 | 121 / −0.147 | 152 / +0.167 | 1.3762 |
| A | ETH | 600 | 292 | −0.078 | −0.034 | −1.12 | 0.7821 | 125 / −0.170 | 167 / −0.009 | 1.8352 |
| A | SOL | 636 | 265 | −0.189 | −0.160 | −2.53 | 0.0678 | 110 / −0.138 | 155 / −0.226 | 2.6171 |
| B | BTC | 600 | 567 | +0.002 | +0.053 | 0.04 | 1 | 232 / −0.064 | 335 / +0.048 | 1.7607 |
| B | ETH | 600 | 562 | −0.063 | −0.024 | −1.58 | 0.4536 | 229 / −0.099 | 333 / −0.038 | 2.2822 |
| B | SOL | 636 | 588 | −0.103 | −0.076 | −2.18 | 0.146 | 238 / −0.085 | 350 / −0.115 | 3.251 |

## By exit reason and side, decisive window

| Exit | Group | n | Mean gross R | Mean net R |
|---|---|---|---|---|
| A | target | 247 | +1.707 | +1.662 |
| A | stop | 495 | −1.000 | −1.041 |
| A | gap | 0 | n/a | n/a |
| A | time | 88 | +0.508 | +0.449 |
| A | buys | 391 | −0.061 | −0.110 |
| A | sells | 439 | −0.011 | −0.051 |
| B | target | 437 | +2.000 | +1.958 |
| B | stop | 974 | −1.000 | −1.036 |
| B | gap | 0 | n/a | n/a |
| B | time | 306 | +0.234 | +0.193 |
| B | buys | 863 | +0.000 | −0.042 |
| B | sells | 854 | −0.034 | −0.068 |

## Costs

Mean cost a trade in the decisive window: Exit A +0.044R, Exit B +0.038R (0.04 % of price a round trip,
`CFD_CRYPTO`; financing long 15 %, short 7.5 % BTC / 10 % ETH and SOL a year, every calendar 22:00 UTC held). Twice the costs, decisive
mean net R: Exit A −0.123R, Exit B −0.093R.

## By year of exit, decisive window (Exit A | Exit B, mean net R, n)

| Year | Exit A | Exit B |
|---|---|---|
| 2022 | −0.096 (159) | −0.055 (337) |
| 2023 | −0.199 (197) | −0.108 (362) |
| 2024 | +0.049 (152) | +0.001 (355) |
| 2025 | −0.108 (185) | −0.073 (364) |
| 2026 | +0.011 (137) | −0.035 (299) |

## Data

Binance spot 5-minute candles from council-data `research/candles/crypto5m/` (copied out with `node research/edge/crypto-cycle/fetch.mjs <dir>`,
kept out of git), then `node research/edge/crypto-cycle/run.mjs <dir>`. H1 candles built:

- BTC: 42359 H1 candles, 2022-01-01T00:00 to 2026-10-31T23:00 UTC
- ETH: 42359 H1 candles, 2022-01-01T00:00 to 2026-10-31T23:00 UTC
- SOL: 42359 H1 candles, 2022-01-01T00:00 to 2026-10-31T23:00 UTC

## What follows

A FAIL ends this reading on crypto: no parameter will be varied after seeing the result (pre-registered). Not a council rule, not a filter; nothing live changed.
