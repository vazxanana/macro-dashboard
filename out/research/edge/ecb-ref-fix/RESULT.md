# The ECB euro reference rate: fading the half hour into the 14:10 CET concertation (result)

Pre-registered in `PREREGISTRATION.md` (pushed alone on 14 Nov 2026 before any trade was computed); `run.mjs`, `fetch.mjs`,
`ecb-days.json`, `result.json`. Method copied from the `wmr-fix-reversal` study (branch, not imported). Paper research only:
nothing live changed.

**Verdict: FAIL.** No test is positive after costs in either window. EUR/USD loses −0.136R a trade (exit 15:00 CET) and
−0.124R (exit 14:45 CET) in 2016-26, month-sum t −2.93 and −2.88; the three crosses pooled lose −0.296R (t −11.21). Before
costs the EUR/USD fade is positive in both windows (+0.12 to +0.15R a trade, gross month-sum t 2.46-3.08), so a small reversal
after the concertation is visible on OANDA mid prices, as at the London 16:00 fix, but the raw-spread round trip is about
0.26R a trade at this stop (the 30-minute move's median is small), twice the reversal.

## What was run

EUR/USD, EUR/GBP, EUR/JPY, EUR/CHF, OANDA mid **M5** candles through the site's proxy, 1 Nov 2009 to 13 Nov 2026 (`fetch.mjs`;
files outside git; EUR/USD seeded from the `wmr-fix-reversal` copy and extended). CET / CEST clock (`euSummer`). Move M =
close of the 14:10 candle − open of the 13:45 candle; ref = median |M| of the 20 earlier weekdays with a move; event |M| >
0.5 × ref (about 71 % of days); a market order against M at the open of the 14:15 CET candle, stop 1 × ref, out at the close
of the 14:55 candle (T1, T3) or the 14:40 candle (T2). Costs: 0.3 pip spread + 0.3 pip slippage + 45 USD a million a round
trip, in R; no financing. Days with no move: 27-28 a market (EUR/CHF 62).

## Results

R a trade; t = t of calendar-month sums. Decisive = entries 2016-01-01 to 2026-11-13; replication = 2010-2015.

| Test | Window | n | Gross R a trade | Gross R total | Cost R a trade | Net R a trade | Net R total | Month t (net) | Month t (gross) | Net at 2x cost |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 EUR/USD, 15:00 | 2016-26 | 2,018 | +0.119 | +240.8 | 0.255 | −0.136 | −274.7 | −2.93 | 2.59 | −0.392 |
| T1 EUR/USD, 15:00 | 2010-15 | 1,107 | +0.148 | +164.1 | 0.182 | −0.034 | −37.5 | −0.66 | 2.80 | −0.216 |
| T2 EUR/USD, 14:45 | 2016-26 | 2,018 | +0.131 | +265.1 | 0.255 | −0.124 | −250.3 | −2.88 | 3.08 | −0.379 |
| T2 EUR/USD, 14:45 | 2010-15 | 1,107 | +0.136 | +150.5 | 0.182 | −0.046 | −51.1 | −0.86 | 2.46 | −0.228 |
| T3 crosses pooled, 15:00 | 2016-26 | 6,127 | +0.015 | +91.4 | 0.311 | −0.296 | −1,812.6 | −11.21 | 0.58 | −0.607 |
| T3 crosses pooled, 15:00 | 2010-15 | 3,341 | +0.062 | +208.6 | 0.324 | −0.261 | −872.3 | −5.46 | 1.69 | −0.585 |

Holm over T1-T3 (one-sided p of the decisive net t): p = 0.998, 0.998, 1; Holm-adjusted 1, 1, 1. No test meets condition 1
(net > 0 in both windows) or condition 2 (Holm p < 0.05); all meet n ≥ 100. No near miss.

**Each cross under T3, net R a trade (n, t)**: EUR/GBP 2016-26 −0.343 (2,045, −8.18), 2010-15 −0.136 (1,132, −2.53); EUR/JPY
−0.144 (2,041, −2.97), −0.158 (1,133, −2.57); EUR/CHF −0.401 (2,041, −10.3), −0.501 (1,076, −4.83). Before costs only EUR/JPY
(+0.083R in 2016-26) shows a reversal; EUR/GBP and EUR/CHF are flat.

**Years (T1)**: net positive in 4 of 17 years (2010, 2015, 2021, 2026); gross positive in 14 of 17.

**Summer against winter (T1, 2016-26 net)**: summer −0.125 (n 1,198, t −2.57), winter −0.152 (n 820, t −1.68).

**Known overlaps (reported, not judged)**, T1 2016-26: without ECB decision days −0.145 (n 1,947, t −3.05); the 71 decision
days alone +0.106 (gross +0.365, t 0.30; dates from `ecb-days.json`, partly from memory); without the US / Europe daylight
mismatch weeks −0.123 (n 1,865, t −2.50). The loss is not caused by either overlap.

## Placebo (40 seeds, the same rule at random other CET hours 2-12 and 18-21)

| Test | Rule, 2016-26 net | Placebo 5th / 50th / 95th percentile | Seeds beaten |
|---|---|---|---|
| T1 | −0.136 | −0.412 / −0.355 / −0.318 | 40 of 40 |
| T2 | −0.124 | −0.406 / −0.357 / −0.328 | 40 of 40 |
| T3 | −0.296 | −0.493 / −0.451 / −0.432 | 40 of 40 |

The concertation window loses less than any random hour. As at the London fix this mixes a real (small) reversal with costs
being a smaller share of R at a busy hour (the stop is the window's own median move); it cannot rescue a test that fails the
bar, and none is "robust" (reserved for a passing test).

## What this means

- A reversal after 14:15 CET is visible on EUR/USD before costs in both windows (+0.12 to +0.15R, gross month t 2.5-3.1), the
  same shape and size as at the London 16:00 fix, but at the raw-spread costs of the council's demo broker the fade loses on
  every market and both exits. Not a council rule, not a forward-test candidate.
- Not tested, and not to be inferred: trading inside the five minutes of the concertation (M5 cannot resolve it); a wider stop
  or a larger event threshold (chosen after this result: they would need their own pre-registration on other data).

To repeat: `node --use-env-proxy research/edge/ecb-ref-fix/fetch.mjs <dir> [seedDir]`, then
`node research/edge/ecb-ref-fix/run.mjs run <dir>`. Tests: `tests/ecb-ref-fix.test.mjs`.
