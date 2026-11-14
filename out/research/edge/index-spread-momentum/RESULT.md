# Result: non-US equity index pairs, log-spread z-score momentum (14 Nov 2026)

**Verdict: FAIL, 0 of 5 pre-registered checks: following a 2-sd stretch of these non-US index spreads is not an edge after costs.** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Pooled over the four pairs: -0.107R a trade net on 2016-now (n 244, month-sum t -1.56), -0.072R on 2009-15 (n 153); 1 of 4 pairs positive on 2016-now; placebo 95th percentile +0.004. Nothing live changed.

The hypothesis (following a 2-sd stretch of an index spread pays) was formed from the result of `index-pair` (draft PR #881), where fading such stretches on US2000 / NAS100 and SPX500 / US30 lost before costs. Those US pairs are excluded here on purpose: testing the idea on them would fit it on the data that suggested it.

Data: OANDA mid daily DE30_EUR, UK100_GBP, EU50_EUR, JP225_USD, AU200_AUD, FR40_EUR, council-data research/daily/*.json; weekend stubs folded with `foldWeekend`, legs joined on common days (DE40 / UK100 5921 days, 2003-03-25 to 2026-11-06; EU50 / UK100 5800 days, 2003-09-22 to 2026-11-06; JP225 / AU200 5764 days, 2004-03-18 to 2026-11-06; DE40 / FR40 5879 days, 2003-03-31 to 2026-11-06). Rule: beta = OLS slope of ln(A) on ln(B) over the last 250 closes, z of the spread over 60 closes with that beta; z > 2 buys the spread (long A, short beta of B), z < -2 sells it, at the next open; stop when the trade's z returns to 0 (checked at the open and the close; 1R = entry to the signal close's 60-day mean), target at z ±4 the trade's way (at the close), out after 20 days; one position at a time per pair. Costs: both legs' spreads (DE40 2, UK100 2, EU50 2, FR40 2, JP225 10, AU200 2 points a round trip; none of them is in ctrader/symbols.json) and financing on both legs (long leg local policy rate + 2.5 %, short leg max(0, 2.5 % - rate), a year, per rollover night; rates.json).

| Pair | Window | n | Net R a trade | Gross | Spread cost | Financing | Win % | PF | Month-sum t | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|---|
| **Pooled** | 2016-now (decisive) | 244 | -0.107 | +0.022 | +0.020 | +0.109 | 42.62 | 0.76 | -1.56 | -44.51R |
| **Pooled** | 2009-15 | 153 | -0.072 | +0.073 | +0.033 | +0.111 | 39.87 | 0.83 | -0.80 | -13.72R |
| P1 DE40 / UK100 | 2016-now (decisive) | 59 | -0.117 | +0.002 | +0.013 | +0.107 | 44.07 | 0.73 | -1.08 | -14.14R |
| P1 DE40 / UK100 | 2009-15 | 37 | -0.084 | +0.040 | +0.021 | +0.103 | 37.84 | 0.80 | -0.52 | -6.27R |
| P2 EU50 / UK100 | 2016-now (decisive) | 61 | -0.121 | +0.015 | +0.027 | +0.109 | 37.70 | 0.75 | -0.98 | -15.93R |
| P2 EU50 / UK100 | 2009-15 | 38 | -0.062 | +0.136 | +0.052 | +0.145 | 31.58 | 0.88 | -0.29 | -6.53R |
| P3 JP225 / AU200 | 2016-now (decisive) | 60 | +0.031 | +0.109 | +0.015 | +0.064 | 48.33 | 1.09 | 0.28 | -5.87R |
| P3 JP225 / AU200 | 2009-15 | 41 | -0.042 | +0.048 | +0.024 | +0.065 | 51.22 | 0.88 | -0.31 | -5.83R |
| P4 DE40 / FR40 | 2016-now (decisive) | 64 | -0.212 | -0.033 | +0.026 | +0.153 | 40.63 | 0.61 | -1.35 | -14.91R |
| P4 DE40 / FR40 | 2009-15 | 37 | -0.104 | +0.069 | +0.037 | +0.136 | 37.84 | 0.78 | -0.56 | -9.20R |

## Against the bar

- Pooled 2016-now net R a trade > 0: no (-0.107).
- Pooled 2016-now month-sum t >= 2: no (-1.56, 131 months).
- Pooled 2009-15 net R a trade > 0 (same sign): no (-0.072).
- At least 3 of 4 pairs positive on 2016-now: no (1: P1 -0.117, P2 -0.121, P3 +0.031, P4 -0.212).
- Pooled net R a trade above the placebo's 95th percentile: no (-0.107 against +0.004).

## Placebo: random entry days, each pair's real count and side mix, the same exits and costs (2016-now, 40 seeded draws)

| Stream | Real net R a trade | Draws median | 5th pct | 95th pct | Draws >= real |
|---|---|---|---|---|---|
| **Pooled** | -0.107 | -0.561 | -1.664 | +0.004 | 5 of 40 |
| P1 DE40 / UK100 | -0.117 | -0.276 | -2.570 | +0.884 | 18 of 40 |
| P2 EU50 / UK100 | -0.121 | -0.870 | -2.237 | +0.151 | 4 of 40 |
| P3 JP225 / AU200 | +0.031 | -0.325 | -2.143 | +0.290 | 4 of 40 |
| P4 DE40 / FR40 | -0.212 | -0.740 | -1.986 | +0.376 | 10 of 40 |

A random entry day usually has its spread near the 60-day mean, so its 1R (the distance to the z = 0 stop) is small and the same costs weigh many R: that is why the draws' median is far below zero and their spread is wide. The bar compares with the 95th percentile, as pre-registered.

## Also reported, not judged

- **Pooled**: exits on 2016-now time 153, target 10, stop 70, stop-gap 11; sides 128 long spread / 116 short spread; with financing off, net R a trade +0.002 on 2016-now and +0.039 on 2009-15.
- **P1 DE40 / UK100**: exits on 2016-now time 36, target 3, stop 18, stop-gap 2; sides 29 long spread / 30 short spread; worst single trade -1.443R; signals skipped (entry open already past the stop or the target) 4 on 2016-now, 0 on 2009-15; |z| at the signal median 2.24; 1R median 3.84 % of leg A's notional; beta at the decisive trades median 1.24 (0.18 to 2.75); with financing off, net R a trade -0.011 on 2016-now and +0.019 on 2009-15.
- **P2 EU50 / UK100**: exits on 2016-now time 32, stop 21, target 4, stop-gap 4; sides 30 long spread / 31 short spread; worst single trade -1.601R; signals skipped (entry open already past the stop or the target) 6 on 2016-now, 0 on 2009-15; |z| at the signal median 2.17; 1R median 3.27 % of leg A's notional; beta at the decisive trades median 1.04 (0.12 to 2.01); with financing off, net R a trade -0.012 on 2016-now and +0.084 on 2009-15.
- **P3 JP225 / AU200**: exits on 2016-now time 44, stop 14, target 2; sides 36 long spread / 24 short spread; worst single trade -1.194R; signals skipped (entry open already past the stop or the target) 4 on 2016-now, 3 on 2009-15; |z| at the signal median 2.24; 1R median 5.85 % of leg A's notional; beta at the decisive trades median 0.90 (0.00 to 3.18); with financing off, net R a trade +0.095 on 2016-now and +0.023 on 2009-15.
- **P4 DE40 / FR40**: exits on 2016-now stop 17, time 41, stop-gap 5, target 1; sides 33 long spread / 31 short spread; worst single trade -3.719R; signals skipped (entry open already past the stop or the target) 9 on 2016-now, 0 on 2009-15; |z| at the signal median 2.17; 1R median 2.32 % of leg A's notional; beta at the decisive trades median 1.02 (0.39 to 1.75); with financing off, net R a trade -0.059 on 2016-now and +0.032 on 2009-15.

## What it means

Before any cost the pooled stream is near zero (gross +0.022R a trade on 2016-now, +0.073R on 2009-15); financing on the two legs takes +0.109R and the spreads +0.020R a trade. The rule does not clear the pre-registered bar: following a 2-sd stretch of these non-US index spreads, with a stop at the 60-day mean, a target at 4 sd and 20 days at most, is not an edge after both legs' spreads and financing on this data. It is not a council rule, no proposal is written and nothing live changed. Never call it an edge; another threshold, window, hedge ratio, stop or exit would need its own pre-registration on other data. The US pairs of `index-pair` stay untested for this direction on purpose.

Stated limits: the stop is checked at the open and the close only (two prices of the spread a day), so a stop exit fills beyond the z = 0 level and can lose more than 1R, and the target is checked at the close only; the stop level moves with the trade's rolling 60-day mean while 1R is fixed at the signal; spreads are stated, not measured, and no slippage or commission is added; policy rates are approximate yearly means (the euro, sterling and yen figures copied from `turnaround-replicate`, the Australian ones added here), JP225 is financed at the yen rate although OANDA quotes the CFD in US dollars; currency moves on each leg's open profit are ignored; financing uses the repository's `nights` count (Wednesday three).

To repeat: `node research/edge/index-spread-momentum/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/index-spread-momentum/run.mjs full <dir>`. Tests: `tests/index-spread-momentum.test.mjs`.
