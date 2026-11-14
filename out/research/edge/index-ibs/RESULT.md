# Result: the IBS daily reversal on US indices (14 Nov 2026)

**Verdict: FAIL**. Pre-registered in PREREGISTRATION.md (pushed alone first, commit 4274ca30b). Four chances in all: T1-T3 (Holm over three) and the pooled test P.

Rule: IBS = (close - low) / (high - low) of the New York session built from OANDA mid H1 (candles 09:00 to the 16:00 close, New York time); IBS < 0.2 → buy the 16:00 close, sell the next trading day's 16:00 close; stop 1 x ATR(20) of the 20 New York days before, checked on H1 (a gap fills at the open). Costs: SPX500 0.04 %, NAS100 0.05 %, US30 0.05 % of price a round trip; financing (DGS2 + 2.5 %) / 365 a rollover night, Friday three. Data 2004-01-02 to 2026-11-13. Decisive window 2016 to now, replication 2005-2015 (by entry date). t = month-sum t (every calendar month, empty months 0).

## Tests (long, IBS < 0.2)

| Test | Window | n | Gross R | Net R | Cost R | Financing R | Win % | Stops (gaps) | Month-sum t | Total R |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 S&P 500 (SPX500) | 2016-now | 472 | +0.062 | +0.013 | +0.033 | +0.016 | 51.27 | 80 (2) | 0.37 | 6.36 |
| T1 S&P 500 (SPX500) | 2005-2015 | 521 | +0.115 | +0.071 | +0.030 | +0.014 | 56.81 | 76 (0) | 2.66 | 37.16 |
| T2 Nasdaq 100 (NAS100) | 2016-now | 473 | +0.096 | +0.056 | +0.029 | +0.012 | 53.70 | 74 (2) | 1.65 | 26.37 |
| T2 Nasdaq 100 (NAS100) | 2005-2015 | 513 | +0.051 | +0.010 | +0.031 | +0.011 | 51.66 | 84 (0) | 0.34 | 4.97 |
| T3 Dow 30 (US30) | 2016-now | 469 | +0.049 | -0.011 | +0.043 | +0.017 | 50.32 | 75 (1) | -0.31 | -5.00 |
| T3 Dow 30 (US30) | 2005-2015 | 514 | +0.094 | +0.041 | +0.040 | +0.014 | 54.28 | 82 (0) | 1.46 | 20.89 |
| P pooled | 2016-now | 1414 | +0.069 | +0.020 | +0.035 | +0.015 | 51.77 | 229 (5) | 0.64 | 27.73 |
| P pooled | 2005-2015 | 1548 | +0.087 | +0.041 | +0.033 | +0.013 | 54.26 | 242 (0) | 1.63 | 63.03 |

## Checks

| Test | (a) n >= 100 | (b) net R > 0 | (c) month t >= 2, Holm p < 0.05 | (d) 2005-15 net R > 0 | (e) placebo beaten >= 38 / 40 | Holm p | Pass |
|---|---|---|---|---|---|---|---|
| T1 | yes | yes | no | yes | no | 0.7095 | fail |
| T2 | yes | yes | no | yes | yes | 0.1491 | fail |
| T3 | yes | no | no | yes | no | 0.7095 | fail |
| P | – | yes | no | yes | yes | – | fail |

The pooled test P has no n check and no Holm adjustment (one test of its own, as pre-registered).

## Placebo: random trading days, the rule's count per year, traded the same way (2016-now, 40 seeds)

| Test | Rule net R | Seeds beaten | Seed mean 5th pct | Median | 95th pct |
|---|---|---|---|---|---|
| T1 S&P 500 (SPX500) | +0.013 | 33 / 40 | -0.073 | -0.013 | +0.030 |
| T2 Nasdaq 100 (NAS100) | +0.056 | 40 / 40 | -0.069 | -0.019 | +0.043 |
| T3 Dow 30 (US30) | -0.011 | 32 / 40 | -0.081 | -0.040 | +0.013 |
| P pooled | +0.020 | 40 / 40 | -0.055 | -0.029 | +0.011 |

## Before costs: the rule's days against every day (close to close, % a day)

| Market | Rule days 2016-now | Every day 2016-now | Rule days 2005-15 | Every day 2005-15 | Signal share of days | Days without IBS | Skipped signals |
|---|---|---|---|---|---|---|---|
| T1 S&P 500 (SPX500) | +0.160 | +0.055 | +0.253 | +0.027 | 18.40 % | 2 of 5498 | 19 |
| T2 Nasdaq 100 (NAS100) | +0.288 | +0.077 | +0.182 | +0.046 | 18.40 % | 1 of 5498 | 25 |
| T3 Dow 30 (US30) | +0.103 | +0.047 | +0.217 | +0.023 | 18.30 % | 6 of 5496 | 24 |

## Mirror control, reported only (IBS > 0.8 → sell the close, stop 1 x ATR above)

| Market | Window | n | Gross R | Net R | Financing R | Month-sum t |
|---|---|---|---|---|---|---|
| S&P 500 (SPX500) | 2016-now | 846 | -0.021 | -0.059 | +0.003 | -2.21 |
| S&P 500 (SPX500) | 2005-2015 | 788 | +0.019 | -0.017 | +0.004 | -0.73 |
| Nasdaq 100 (NAS100) | 2016-now | 878 | -0.027 | -0.061 | +0.002 | -2.50 |
| Nasdaq 100 (NAS100) | 2005-2015 | 755 | +0.003 | -0.033 | +0.004 | -1.37 |
| Dow 30 (US30) | 2016-now | 740 | -0.028 | -0.074 | +0.003 | -2.55 |
| Dow 30 (US30) | 2005-2015 | 734 | +0.033 | -0.014 | +0.005 | -0.57 |
| pooled | 2016-now | 2464 | -0.025 | -0.065 | +0.003 | -2.63 |
| pooled | 2005-2015 | 2277 | +0.018 | -0.021 | +0.004 | -0.99 |

## By year (long rule, net R a trade, n)

| Year | T1 S&P 500 (SPX500) | T2 Nasdaq 100 (NAS100) | T3 Dow 30 (US30) |
|---|---|---|---|
| 2005 | -0.015 (70) | -0.085 (65) | -0.072 (67) |
| 2006 | +0.120 (47) | -0.109 (52) | +0.015 (37) |
| 2007 | +0.196 (45) | +0.127 (46) | +0.069 (43) |
| 2008 | +0.078 (69) | +0.117 (63) | +0.054 (69) |
| 2009 | +0.140 (51) | +0.149 (46) | +0.203 (51) |
| 2010 | +0.098 (39) | +0.068 (35) | +0.029 (38) |
| 2011 | +0.062 (49) | -0.010 (58) | +0.035 (47) |
| 2012 | -0.112 (38) | -0.117 (39) | -0.077 (47) |
| 2013 | +0.103 (32) | +0.119 (31) | +0.019 (35) |
| 2014 | +0.115 (35) | -0.028 (35) | +0.126 (37) |
| 2015 | +0.028 (46) | -0.090 (43) | +0.086 (43) |
| 2016 | -0.036 (38) | -0.069 (38) | -0.050 (31) |
| 2017 | +0.170 (31) | +0.605 (24) | +0.039 (33) |
| 2018 | -0.193 (48) | +0.022 (50) | -0.186 (45) |
| 2019 | -0.201 (29) | -0.064 (35) | -0.119 (33) |
| 2020 | +0.241 (55) | +0.259 (45) | +0.132 (61) |
| 2021 | +0.010 (50) | -0.026 (48) | +0.026 (49) |
| 2022 | -0.016 (58) | -0.083 (67) | -0.064 (49) |
| 2023 | +0.027 (52) | +0.137 (54) | -0.087 (48) |
| 2024 | +0.113 (45) | -0.006 (48) | +0.019 (43) |
| 2025 | -0.078 (32) | +0.014 (35) | +0.009 (35) |
| 2026 | +0.020 (34) | +0.110 (29) | +0.104 (42) |

## What this does and does not say

- **No test passed (0 of 4).** The best single market, NAS100, made +0.056R a trade net on 2016-now (n 473, month-sum t 1.65, Holm p 0.149) and beat all 40 placebo seeds, but it did not replicate on 2005-2015 (+0.010R, t 0.34). SPX500 is the other way round: +0.071R and t 2.66 on 2005-2015, then +0.013R, t 0.37 on 2016-now. US30 lost on 2016-now. The pooled test: +0.020R a trade, t 0.64.
- **The effect is there before costs and too small after them.** On every market and both windows the day after a low-IBS close rose more than the average day (for example NAS100 2016-now +0.29 % against +0.08 %), as the literature says. In R that is about +0.05 to +0.12R a trade gross, and costs (0.03-0.04R) plus one night of financing (0.01-0.02R) take most of it. One trade a day held one session pays the full round trip each time.
- **It has weakened since publication on the S&P 500 and the Dow**, the markets the published work mostly used (gross +0.115R → +0.062R on SPX500, +0.094R → +0.049R on US30, 2005-15 → 2016-now).
- **The mirror short loses even before costs on 2016-now** (gross −0.02 to −0.03R a trade, net t −2.2 to −2.6): a high close inside the day is not followed by a fall; shorting US indices for a day fights their upward drift.
- Limits, fixed before the results: the session high and low include the 09:00-09:30 pre-open half hour (the H1 grid); one fixed threshold (0.2), one holding period (one session), one stop (1 x ATR(20)). Other thresholds, holding until a high close, or the ETFs instead of CFDs were not tested and would need their own pre-registration on other data. Not an edge here; nothing live changed and no proposal follows.
