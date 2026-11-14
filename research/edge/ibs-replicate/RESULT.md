**Verdict: DOES NOT REPLICATE** (fails the pre-registered reading). Pooled over seven indices #895 never used, 2016-now: R1 -0.041R a trade net (n 3543, month-sum t -1.97, Holm p 1.000), R3 by entry day -0.024R (1313 days, t -1.39, Holm p 1.000), R2 2005-15 +0.021R (n 3706); gate passed: yes.

# Result: the IBS daily reversal, frozen and replicated on seven other indices (14 Nov 2026)

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 3e9c808f1). Paper only; nothing live changed. Rule (frozen.mjs = #895's run.mjs byte for byte, sha256 `6e56210c13ef5863…`): IBS = (close - low) / (high - low) of the day < 0.2 → buy the close, sell the next day's close, stop 1 x ATR(20). Day = each market's own OANDA UTC daily candle (weekend folded into Monday; Friday closes 21:00 UTC). Cost 0.05 % a round trip, financing (DGS2 + 2.5 %) / 365 a rollover night, Friday three. Data: council-data `research/daily/<key>.json` (commit 1fc946e73), to 2026-11-06. Decisive window 2016 to now, replication 2005-2015.

## Gate

frozen.mjs `study()` on #895's own OANDA H1 candles (spx500, nas100, us30, 2004-01-02 to 2026-11-13, fetched again with #895's fetch.mjs): **passed**, 13 of 13 blocks deep-equal to #895's published result.json (pooled decisive / replication / placebo, T1-T3 each, verdict). Pooled decisive n 1414, net +0.020R, month-sum t 0.64; replication n 1548, +0.041R.

## Tests (pooled seven markets, long, IBS < 0.2)

| Test | Window | n | Gross R | Net R | Cost R | Financing R | Win % | t | One-sided p | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 pooled | 2016-now | 3543 | +0.008 | -0.041 | +0.037 | +0.013 | 49.59 | -1.97 (month-sum) | 0.9756 | 1.0000 |
| R2 pooled | 2005-2015 | 3706 | +0.064 | +0.021 | +0.033 | +0.010 | 52.75 | 1.06 (month-sum) | – | – |
| R3 by entry day | 2016-now | 1313 days | – | -0.024 | – | – | – | -1.39 (day) | 0.9184 | 1.0000 |

## Cost rows (descriptive, decide nothing; financing unchanged)

| Cost a round trip | R1 net R | R1 month-sum t | R2 net R | R2 month-sum t | R3 net R | R3 t |
|---|---|---|---|---|---|---|
| 0.05 % (pre-registered) | -0.041 | -1.97 | +0.021 | 1.06 | -0.024 | -1.39 |
| 0.025 % (half: a cheaper futures route, descriptive) | -0.023 | -1.10 | +0.037 | 1.92 | -0.006 | -0.35 |
| 0.10 % (2x) | -0.077 | -3.65 | -0.012 | -0.62 | -0.061 | -3.48 |

## Placebo (random same-count days per market and year, traded the same way, 2016-now, 40 seeds)

Rule R1 net -0.041R beats 19 of 40 seed means (5th pct -0.064, median -0.041, 95th -0.027).

## Per market (reported, not judged)

| Market | Window | n | Gross R | Net R | Month-sum t | Rule days % | Every day % | Skipped | Days without IBS |
|---|---|---|---|---|---|---|---|---|---|
| Germany 40 (DE30_EUR) | 2016-now | 459 | +0.001 | -0.048 | -1.53 | +0.034 | +0.040 | 0 | 2 of 5558 |
| Germany 40 (DE30_EUR) | 2005-2015 | 461 | +0.060 | +0.019 | 0.55 | +0.154 | +0.042 |  |  |
| UK 100 (UK100_GBP) | 2016-now | 495 | +0.027 | -0.032 | -0.99 | +0.065 | +0.025 | 0 | 5 of 5526 |
| UK 100 (UK100_GBP) | 2005-2015 | 515 | +0.054 | +0.005 | 0.15 | +0.202 | +0.017 |  |  |
| Euro Stoxx 50 (EU50_EUR) | 2016-now | 504 | +0.018 | -0.031 | -0.90 | +0.084 | +0.031 | 1 | 1 of 5559 |
| Euro Stoxx 50 (EU50_EUR) | 2005-2015 | 554 | +0.076 | +0.030 | 1.00 | +0.166 | +0.015 |  |  |
| France 40 (FR40_EUR) | 2016-now | 498 | -0.007 | -0.057 | -1.61 | +0.051 | +0.028 | 0 | 4 of 5591 |
| France 40 (FR40_EUR) | 2005-2015 | 508 | +0.041 | +0.002 | 0.05 | +0.095 | +0.017 |  |  |
| Japan 225 (JP225_USD) | 2016-now | 508 | +0.014 | -0.027 | -0.92 | +0.074 | +0.050 | 0 | 0 of 5659 |
| Japan 225 (JP225_USD) | 2005-2015 | 510 | +0.132 | +0.093 | 2.97 | +0.242 | +0.029 |  |  |
| Australia 200 (AU200_AUD) | 2016-now | 527 | -0.020 | -0.080 | -2.54 | -0.008 | +0.024 | 1 | 41 of 5576 |
| Australia 200 (AU200_AUD) | 2005-2015 | 590 | +0.070 | +0.022 | 0.76 | +0.147 | +0.019 |  |  |
| Hong Kong 33 (HK33_HKD) | 2016-now | 552 | +0.025 | -0.013 | -0.49 | +0.036 | +0.017 | 0 | 17 of 5391 |
| Hong Kong 33 (HK33_HKD) | 2005-2015 | 568 | +0.019 | -0.021 | -0.63 | -0.023 | +0.023 |  |  |

## By year (net R a trade, n)

| Year | de40 | uk100 | eu50 | fr40 | jp225 | au200 | hk33 |
|---|---|---|---|---|---|---|---|
| 2005 | +0.107 (37) | -0.082 (49) | +0.022 (50) | +0.044 (46) | +0.106 (54) | +0.078 (51) | +0.076 (48) |
| 2006 | +0.085 (32) | +0.095 (60) | -0.004 (51) | +0.073 (43) | +0.307 (41) | +0.129 (48) | +0.053 (34) |
| 2007 | +0.278 (48) | -0.123 (45) | +0.115 (54) | -0.077 (48) | +0.040 (41) | +0.047 (49) | +0.061 (50) |
| 2008 | +0.017 (63) | +0.061 (60) | -0.020 (72) | -0.029 (66) | +0.081 (55) | +0.152 (80) | -0.062 (62) |
| 2009 | +0.005 (41) | +0.112 (46) | +0.122 (48) | +0.016 (51) | +0.200 (43) | -0.014 (54) | +0.027 (52) |
| 2010 | +0.123 (36) | +0.171 (42) | +0.082 (48) | +0.032 (42) | -0.038 (43) | -0.022 (48) | +0.046 (58) |
| 2011 | -0.137 (54) | -0.038 (55) | -0.023 (74) | -0.069 (58) | -0.038 (58) | -0.113 (43) | -0.125 (59) |
| 2012 | +0.024 (40) | -0.006 (45) | +0.157 (51) | +0.159 (48) | +0.070 (50) | +0.168 (45) | +0.103 (53) |
| 2013 | -0.222 (32) | -0.112 (38) | -0.033 (33) | -0.023 (34) | +0.150 (50) | +0.036 (62) | -0.119 (46) |
| 2014 | -0.057 (37) | -0.099 (32) | -0.036 (37) | -0.049 (35) | +0.103 (38) | -0.185 (51) | -0.072 (55) |
| 2015 | -0.028 (41) | +0.000 (43) | -0.069 (36) | -0.055 (37) | +0.086 (37) | -0.090 (59) | -0.180 (51) |
| 2016 | +0.068 (43) | +0.014 (51) | +0.024 (47) | -0.016 (42) | +0.012 (46) | -0.118 (46) | +0.055 (46) |
| 2017 | +0.043 (35) | +0.047 (41) | -0.093 (44) | +0.007 (44) | +0.016 (46) | -0.064 (49) | +0.187 (44) |
| 2018 | -0.009 (38) | -0.272 (48) | -0.212 (43) | -0.115 (44) | -0.030 (44) | -0.260 (47) | -0.068 (49) |
| 2019 | -0.010 (40) | -0.109 (42) | +0.029 (40) | +0.015 (37) | -0.100 (39) | -0.068 (45) | +0.098 (45) |
| 2020 | +0.021 (51) | +0.064 (62) | +0.094 (57) | +0.065 (56) | -0.045 (30) | -0.058 (47) | -0.026 (44) |
| 2021 | -0.018 (32) | -0.009 (34) | +0.005 (32) | -0.030 (31) | -0.095 (49) | +0.064 (47) | -0.058 (50) |
| 2022 | -0.186 (55) | -0.079 (51) | -0.070 (59) | -0.134 (62) | -0.045 (66) | -0.209 (49) | -0.143 (63) |
| 2023 | -0.285 (47) | -0.218 (48) | -0.261 (49) | -0.329 (47) | -0.089 (51) | -0.160 (60) | -0.062 (63) |
| 2024 | -0.042 (44) | +0.103 (43) | +0.030 (43) | -0.127 (47) | +0.062 (51) | -0.023 (55) | -0.011 (55) |
| 2025 | -0.077 (35) | -0.057 (37) | -0.092 (42) | -0.037 (40) | -0.077 (43) | -0.087 (42) | +0.072 (50) |
| 2026 | +0.052 (39) | +0.199 (38) | +0.198 (48) | +0.108 (48) | +0.089 (43) | +0.158 (40) | -0.120 (43) |

## What this does and does not say

- **It does not replicate.** On the seven indices #895 never used, 2016-now, the frozen rule lost: R1 −0.041R a trade net (n 3,543, month-sum t −1.97), R3 by entry day −0.024R (1,313 days, t −1.39). Every one of the seven is negative net on 2016-now (Australia 200 worst, −0.080R, t −2.54; Hong Kong 33 least bad, −0.013R).
- **Before costs there is next to nothing left since 2016**: +0.008R a trade gross pooled (#895 had +0.069R on the US indices). The placebo agrees: the rule's mean beats 19 of 40 random-day seeds, the middle of the pack, so low-IBS days are not better entries than any other day on these markets.
- **2005-2015 had the effect before costs** (+0.064R gross, +0.021R net, month-sum t 1.06; Japan 225 +0.093R net, t 2.97), the same fade #895 saw on the S&P 500 and the Dow. A reversal that was there before publication and is gone after it, in two separate sets of markets.
- **Cheaper execution does not rescue it here**: with the round trip halved (a stand-in for a futures route, descriptive) R1 is still −0.023R (t −1.10) and R3 −0.006R. At twice the cost R1 is −0.077R (t −3.65). So #900's NAS100 futures result, already chosen after seeing the CFD result, gets no support from other indices.
- Limits, fixed before the results: the day here is each market's OANDA UTC daily CFD candle, not its exchange cash session (#895's New York H1 session cannot be built from council-data and is not these markets' day); for Japan 225 the UTC day ends at the Tokyo open. The stop is checked on the next daily candle (open, then low), not on H1. Financing uses the US 2-year rate for every market (above the euro and yen rates for most of the sample, so conservative there; financing is 0.013R a trade in all). One cost (0.05 %) for all seven; the half-cost row shows the reading does not hang on it.
- Nothing live changed and no proposal follows. #895's FAIL stands, and the IBS reversal is not an edge on these CFDs.
