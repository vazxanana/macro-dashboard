# The volatility breakout entered on a limit at the retest (23 Nov 2026)

**Verdict: FAIL. A limit at the retest lost to the stop entry on 2010-19 before costs: gold −0.032R a signal day (n 1842, t −1.74), USD/JPY −0.019R a signal day (n 1886, t −1.32); the deeper limit too.**

Paper research only. Rule, variants, tests and pass bar fixed in `PREREGISTRATION.md` (pushed alone first). Nothing live changed. 2010-2019 is in sample for the rule itself (gold read 2007-26, USD/JPY 2005-26 by earlier studies); only the variants are new.

## Tests (gross R per signal day, variant minus V0; a no-fill day counts 0R for the variant)

| Test | Market | Signal days | Mean d | Month t | 2010-14 | 2015-19 | p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 V1 | xau | 1842 | −0.032 | −1.74 | −0.026 | −0.037 | 0.959 | 1 | no |
| T1 V1 | usdjpy | 1886 | −0.019 | −1.32 | −0.017 | −0.021 | 0.906 | 1 | no |
| T2 V2 | xau | 1842 | −0.036 | −1.62 | −0.041 | −0.032 | 0.947 | 1 | no |
| T2 V2 | usdjpy | 1886 | −0.019 | −0.91 | −0.004 | −0.033 | 0.818 | 1 | no |

## 2010-2019 (judged)

| Market | Entry | Fills | Fill rate | Gross R/trade | Net R/trade | Net month t | Per day gross | Per day net | Cancelled at stop / gap |
|---|---|---|---|---|---|---|---|---|---|
| xau | V0 | 1842 | 100.0 % | +0.138 | +0.122 | +3.88 | +0.138 | +0.122 | 0 / 0 |
| xau | V1 | 1725 | 93.6 % | +0.114 | +0.096 | +2.81 | +0.107 | +0.089 | 0 / 5 |
| xau | V2 | 1497 | 81.3 % | +0.126 | +0.103 | +2.70 | +0.102 | +0.084 | 0 / 5 |
| usdjpy | V0 | 1886 | 100.0 % | +0.080 | +0.046 | +1.66 | +0.080 | +0.046 | 0 / 0 |
| usdjpy | V1 | 1775 | 94.1 % | +0.064 | +0.028 | +0.96 | +0.061 | +0.026 | 0 / 6 |
| usdjpy | V2 | 1508 | 80.0 % | +0.076 | +0.031 | +0.91 | +0.061 | +0.025 | 0 / 6 |

Paired, per signal day: xau V1 − V0 gross −0.032 (t −1.74), net −0.032 (t −1.79); xau V2 − V0 gross −0.036 (t −1.62), net −0.038 (t −1.71); usdjpy V1 − V0 gross −0.019 (t −1.32), net −0.020 (t −1.37); usdjpy V2 − V0 gross −0.019 (t −0.91), net −0.021 (t −1.00).

## 2020 → now (in sample, judges nothing)

| Market | Entry | Fills | Fill rate | Gross R/trade | Net R/trade | Net month t | Per day gross | Per day net | Cancelled at stop / gap |
|---|---|---|---|---|---|---|---|---|---|
| xau | V0 | 1314 | 100.0 % | +0.140 | +0.125 | +3.56 | +0.140 | +0.125 | 0 / 0 |
| xau | V1 | 1261 | 96.0 % | +0.150 | +0.133 | +3.50 | +0.144 | +0.128 | 0 / 0 |
| xau | V2 | 1075 | 81.8 % | +0.175 | +0.153 | +3.23 | +0.143 | +0.126 | 0 / 0 |
| usdjpy | V0 | 1313 | 100.0 % | +0.121 | +0.089 | +2.61 | +0.121 | +0.089 | 0 / 0 |
| usdjpy | V1 | 1238 | 94.3 % | +0.099 | +0.055 | +1.51 | +0.093 | +0.052 | 0 / 3 |
| usdjpy | V2 | 1019 | 77.6 % | +0.087 | +0.034 | +0.72 | +0.067 | +0.026 | 0 / 3 |

Paired, per signal day: xau V1 − V0 gross +0.004 (t +0.33), net +0.003 (t +0.25); xau V2 − V0 gross +0.002 (t +0.11), net +0.000 (t +0.02); usdjpy V1 − V0 gross −0.028 (t −1.47), net −0.038 (t −1.86); usdjpy V2 − V0 gross −0.053 (t −2.00), net −0.063 (t −2.31).

## Reading

Waiting for the retest misses the days that run without coming back: V1 fills 94 % of gold's and 94 % of USD/JPY's signal days, V2 81 % / 80 %. Filled trades make +0.114R (gold V1) and +0.064R (USD/JPY V1) a trade before costs against V0's +0.138R / +0.080R; per signal day +0.107R / +0.061R against +0.138R / +0.080R. The days that come back to the level are the weaker ones: at the same entry price (V1) the filled trades earn less a trade than V0, so the limit adds no price improvement and loses the days that run (adverse selection). Costs do not change the picture (paired differences after costs within 0.01R of the gross ones). The stop entry stays: no retest limit improved the signal day on the pre-registered bar. Nothing live changed.

Gate: V0 reproduces the published gross figures (xau ok, xau2 ok, usdjpy ok). Data: xau 1275746 M5 candles 2009-01-01 → 2026-11-22; usdjpy 1339637 M5 candles 2009-01-01 → 2026-11-22. Costs: gold C1 of gold-vol-breakout-hourcost (measured hourly spread + commission + 0.05 × M), USD/JPY 0.000045 × entry + 0.5 pip.

To repeat: `EDGE_DATA=<dir> MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/_lib/fetch-cache.mjs <xau|usdjpy> 5m 2009`, then `EDGE_DATA=<dir> node research/edge/vb-retest-limit/run.mjs`.
