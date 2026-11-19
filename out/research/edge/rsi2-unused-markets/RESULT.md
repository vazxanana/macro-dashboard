# Result: the 2-day RSI pullback, frozen, on the OANDA index CFDs no earlier study used (14 Nov 2026)

**Verdict: DOES NOT REPLICATE** (a fail of the pre-registered single test: -0.016R a trade after costs, month t -0.50, 0 of 4 checks).

PREREGISTRATION.md was committed and pushed before any number was computed. The pooled book of US2000, CH20, NL25, HK33, CN50 and SG30 made **-0.016R a trade after costs** in 2016 to
6 Nov 2026 (n 469, calendar-month t **-0.50**); none of the four checks held. Not an edge; nothing live changed and no
proposal is written. With `rsi2-replicate` (+0.027R, month t 0.85 on six other indices) this is the second frozen
replication of the #838 near miss on markets it never read, and the second to fail.

## Gate
The frozen rule file (`frozen.mjs`, sha256 `edade889…d5ab65`, byte for byte `research/edge/rsi2-pullback/run.mjs` of commit
4e1b4e1dd) run on today's council-data SPX500 / NAS100 / US30 and DGS2 reproduced **every** published figure of #838 (n, %
and R a trade, total R, t on trades and months in both windows; window B placebo p95, one-sided p, Holm p; verdict FAIL).

## The unused set
Index keys of the OANDA map not read by #838 or `rsi2-replicate`: us2000, ch20, nl25, es35, hk33, cn50, sg30, in50. By the
pre-registered coverage rule (first signal by 2016-01-04, data to within 14 days of 2026-11-06, no hole over 14 days in window
B), **six qualify**; `es35` fails (first signal 2017-09-14; a 21-day hole in Oct-Nov 2021), `in50` fails (the series ends
2022-07-12).

## Primary test, window B (2016 - 6 Nov 2026), pooled, equal risk per trade

| Pooled book, net | n | R a trade | R a trade before costs | won | t trades | t months | total R | worst drawdown |
|---|---|---|---|---|---|---|---|---|
| B: 2016 - Nov 2026 (decisive) | 469 | **-0.016** | +0.020 | 63.33 % | -0.71 | **-0.50** | -7.28 | -19.87R |
| A: 2008 - 2015 (replication, reported) | 303 | +0.015 | +0.050 | 65.68 % | 0.55 | 0.43 | +4.64 | -8.16R |

| Check (all four needed) | value | bar | holds |
|---|---|---|---|
| 1. pooled net R a trade > 0 | -0.016 | > 0 | no |
| 2. calendar-month t of pooled net R | -0.50 | >= 2 | no |
| 3. markets with net R a trade > 0 | 3 of 6 | >= 4 | no |
| 4. beats the placebo's 95th percentile | -0.016 vs +0.010 | > p95 | no |

**Placebo** (40 seeds of random entry days with close > SMA200, the same holds, stops and costs; the frozen procedure, read in
R): pooled mean -0.016R, 95th percentile +0.010R, highest +0.021R; 17 of 40 random seeds did as well as or better than the
rule. The oversold entry adds nothing over a random day in an uptrend on these markets.

## Per market (reported, never the verdict)

| Window B, net | n | % a trade | R a trade | won | t trades | t months (R) | worst DD | one-sided p | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| US2000 | 86 | +0.409 | +0.051 | 73.26 % | 1.94 | 1.13 | -4.28R | 0.0264 | 0.1584 |
| CH20 | 79 | -0.076 | -0.001 | 60.76 % | -0.40 | -0.01 | -5.60R | 0.6541 | 1 |
| NL25 | 91 | +0.031 | +0.008 | 67.03 % | 0.17 | 0.14 | -6.05R | 0.4328 | 1 |
| HK33 | 67 | +0.090 | +0.001 | 61.19 % | 0.36 | 0.02 | -3.97R | 0.3586 | 1 |
| CN50 | 71 | -0.075 | -0.041 | 57.75 % | -0.33 | -1.23 | -3.57R | 0.6289 | 1 |
| SG30 | 75 | -0.450 | -0.126 | 57.33 % | -1.96 | -2.18 | -9.42R | 0.9747 | 1 |

| Window A (2008-15), net | n | R a trade | t months (R) |
|---|---|---|---|
| US2000 | 60 | +0.059 | 1.42 |
| CH20 | 59 | +0.069 | 1.05 |
| NL25 (from 2008-10) | 65 | +0.033 | 0.54 |
| HK33 | 54 | -0.051 | -0.70 |
| CN50 (from 2012-06) | 19 | +0.081 | 0.89 |
| SG30 | 46 | -0.085 | -1.16 |

No market passes after Holm. The only market with a positive sign of note is US2000, the one US index in the set (it moves
with the three #838 markets): +0.051R a trade, month t 1.13.

## Costs: 0x / 1x / 2x the round-trip points (financing kept in all three)

| Pooled | B: R a trade | B: t months | B: worst DD | B: markets > 0 | A: R a trade | A: t months |
|---|---|---|---|---|---|---|
| 0x points | +0.004 | 0.14 | -17.35R | 4 | +0.040 | 1.14 |
| 1x (base) | -0.016 | -0.50 | -19.87R | 3 | +0.015 | 0.43 |
| 2x | -0.035 | -1.13 | -26.19R | 1 | -0.010 | -0.28 |

Even with no spread at all the window-B book is +0.004R a trade (month t 0.14). **Financing sensitivity** (benchmark 0, i.e.
2.5 % a year only, instead of DGS2 + 2.5 % for the CHF / EUR / HKD / SGD / CN50 markets): -0.008R a trade, month t -0.24, 4 of
6 markets positive: the DGS2 assumption does not decide the verdict.

## Notes
- **Correlation**: 469 window-B trades fell on 348 entry days; 216 trades shared their entry day with another market. The
  month-sum t is the honest measure.
- **Costs are assumptions** except US2000 (2 x the demo broker's measured median spread of 0.3 points): CH20 5.0, NL25 0.4,
  HK33 16.0, CN50 12.0, SG30 0.6 points a round trip, fixed. The 0x row shows the verdict does not hang on them.
- Caveats: OANDA's daily close (00:00 UTC) is not the exchange close, and for HK33 / CN50 / SG30 it falls many hours after
  the local session; financing uses the US 2-year yield for every market (stated in the pre-registration).
- **Departures from the pre-registration**: none. The qualified set computed by `run.mjs` equals the pre-registered one (the
  run refuses to continue otherwise).
- Not tested, and not to be tuned on these windows: other thresholds, exits, filters or market selections (keeping US2000
  alone after seeing this would be curve-fitting). Across #838, `rsi2-replicate` and this study the frozen RSI(2) pullback has
  now been run on 15 index CFDs; outside the US large caps it is indistinguishable from a random entry in an uptrend.

To repeat: `node research/edge/rsi2-unused-markets/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/rsi2-unused-markets/run.mjs full <dir>`. Tests: `tests/rsi2-unused-markets.test.mjs`.
