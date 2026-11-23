# Chart rules 2020: result (23 Nov 2026)

**Verdict: FAIL. 0 of 3 tests pass: the barrier retest on H1 boxes made -0.020R a trade after costs in 2024-2026 (n 3,354, month t -0.29), on H4 boxes -0.035R (n 283, month t -0.20), the sweep reversal -0.252R (n 94, month t -1.49).**

Pre-registered in PREREGISTRATION.md (committed alone before any run). OANDA mid 5-minute candles of 18 markets, H1 / H4
resampled, D1 = 17:00 New York days; trades filled 2020-01-01 to 2026-11-23; discovery 2020-2023, confirmation 2024 on; costs of
`combo-grid-2`, data-quality exclusions applied. Target = the nearest standing H4 / D1 engulf or failed-engulf zone, 3R or more.

| Test | Window | Trades | Won | R a trade after costs | Month-sum t | Before costs | At 2x costs |
|---|---|---|---|---|---|---|---|
| T1 barrier retest, H1 boxes | 2020-2023 | 4,728 | 21 % | -0.088 | -1.55 | -0.039 | -0.137 |
| | 2024-now | 3,354 | 21 % | -0.020 | -0.29 | +0.032 | -0.072 |
| T2 barrier retest, H4 boxes | 2020-2023 | 497 | 20 % | -0.175 | -0.96 | -0.148 | -0.202 |
| | 2024-now | 283 | 25 % | -0.035 | -0.20 | -0.010 | -0.059 |
| T3 sweep reversal, H1 | 2020-2023 | 157 | 27 % | +0.048 | 0.32 | +0.092 | +0.003 |
| | 2024-now | 94 | 19 % | -0.252 | -1.49 | -0.207 | -0.297 |

Holm-adjusted confirmation p: T1 1.00, T2 1.00, T3 0.44. Every test fails its discovery bar, its confirmation bar and the
double-cost check (T3's discovery n of 157 clears 100 but its t is 0.32; its confirmation n of 94 clears 50).

**The far target is not what matters.** Median target 4.45R (T1), 4.13R (T2), 4.23R (T3). The same signals exited at a fixed 2R
(descriptive): T1 -0.065R (n 8,082, month t -2.67), T2 -0.050R (n 780), T3 -0.037R (n 251). Every signal without the 3R zone
filter at 2R: T1 -0.033R (n 148,609, t -5.30; +0.005R before costs), T2 -0.025R (n 39,981; -0.006R before costs), T3 -0.008R
(n 12,088; +0.021R before costs). Before costs every version sits within 0.03R of zero (the zone-filtered T3 discovery +0.09R
excepted, which reverses to -0.21R in 2024 on): the entries carry no direction, so costs decide them.

By market (all years, after costs, 20+ trades): no market's month t reaches 2 on T1 or T2 (best T1 EUR/JPY +0.309R, n 340, t 1.55;
T2 EUR/JPY +0.74R on 24 trades); T3 has 20-24 trades a market, too few to read (USD/CHF +1.25R, t 2.08, and USD/CAD -0.76R,
t -2.93, among 18 markets). Picking one after this is not a test.

No look-ahead: on real EUR/USD and gold candles, signals and their targets with an order time before 6 random cuts each were
the same from the cut candles (18,617 signals, 0 differences); the offline test does the same on seeded candles. Every trade has
its stop past the box's far side (or the swept extreme) by 0.25 x ATR(14) plus half the cost.

What this does and does not say: these two rules, written as above, have no edge on 2020-2026 after costs. It does not judge the
owner's own choice of which box or sweep to trade on a chart. Nothing live changed. To repeat (candle cache in `EDGE_DATA`, built
with `research/edge/_lib/fetch-cache.mjs`): `node run.mjs market <m> <dir>` for the 18 markets, then `node run.mjs report <dir>`;
`node run.mjs cut <m>` for the look-ahead check. Test: `tests/chart-rules-2020.test.mjs`.
