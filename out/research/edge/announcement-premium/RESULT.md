# Announcement-day premium: a long over the CPI / payrolls release day, against other days: result

**Verdict: FAIL: SPX500 release days −0.080 % a day net vs other days 2017-26 (n 224, Welch t −0.93); 0 of 5 tests pass.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before `dates.mjs` and this run). Paper research only; nothing live changed; ICT and the gold book untouched. Prior: Savor and Wilson (JFQA 2013), equity and Treasury returns are higher on scheduled macro announcement days.

Unit: the OANDA UTC daily candle of the release's New York date (08:30 New York = 12:30 / 13:30 UTC, inside it): bought at 00:00 UTC, sold at 24:00 UTC. Release-day NET return (round trip + one night of financing at DGS2 + 2.5 %) against the other non-FOMC NYSE weekdays' GROSS return. In sample 2008-01-01 to 2016-12-31, out of sample 2017-01-01 to 2026-11-06. Data: council-data research/daily (OANDA mid, UTC days).

## The five tests (out of sample decides; T1 is primary)

| test | market | OOS n | release net % | other gross % | diff net % | Welch t net | Holm p | diff gross % (t) | IS n | IS diff net % (t) | 2x costs diff % | placebo t p5 / p50 / p95 (beaten) | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | SPX500 (US500) | 224 | −0.015 | +0.066 | −0.080 | −0.93 | 1 | −0.026 (−0.30) | 145 | −0.049 (−0.52) | −0.134 | −1.94 / −0.92 / +0.67 (20 of 40) | no |
| T2 | NAS100 | 224 | +0.004 | +0.079 | −0.075 | −0.67 | 1 | −0.011 (−0.10) | 145 | −0.115 (−1.08) | −0.139 | −1.92 / −0.90 / +0.77 (26 of 40) | no |
| T3 | US30 | 224 | −0.037 | +0.059 | −0.097 | −1.22 | 1 | −0.033 (−0.41) | 145 | −0.057 (−0.65) | −0.161 | −2.48 / −1.02 / +0.24 (15 of 40) | no |
| T4 | USB10Y (10-year Treasury CFD) | 224 | −0.143 | −0.004 | −0.139 | −4.47 | 1 | −0.025 (−0.80) | 145 | −0.154 (−3.77) | −0.253 | −7.60 / −4.91 / −2.61 (31 of 40) | no |
| T5 | USB30Y (30-year Treasury CFD) | 224 | −0.162 | −0.007 | −0.155 | −2.85 | 1 | −0.041 (−0.75) | 145 | −0.198 (−2.95) | −0.269 | −4.63 / −2.56 / −0.84 (17 of 40) | no |

Checks per test (all needed): OOS Welch t >= 2 with Holm p < 0.05; OOS n >= 100; in-sample difference > 0; OOS difference > 0 at 2x costs; OOS t above the placebo in at least 38 of 40 seeds.

- T1 SPX500 (US500): t2Holm no, nOk yes, sameSignIS no, cost2 no, placebo no. Round trip 0.04 %, mean cost with financing 0.0541 % a hold. Release day alone, OOS: −0.015 % net (one-sample t −0.18), +0.040 % gross.
- T2 NAS100: t2Holm no, nOk yes, sameSignIS no, cost2 no, placebo no. Round trip 0.05 %, mean cost with financing 0.0641 % a hold. Release day alone, OOS: +0.004 % net (one-sample t +0.04), +0.068 % gross.
- T3 US30: t2Holm no, nOk yes, sameSignIS no, cost2 no, placebo no. Round trip 0.05 %, mean cost with financing 0.0641 % a hold. Release day alone, OOS: −0.037 % net (one-sample t −0.49), +0.027 % gross.
- T4 USB10Y (10-year Treasury CFD): t2Holm no, nOk yes, sameSignIS no, cost2 no, placebo no. Round trip 0.1 %, mean cost with financing 0.1141 % a hold. Release day alone, OOS: −0.143 % net (one-sample t −4.71), −0.029 % gross.
- T5 USB30Y (30-year Treasury CFD): t2Holm no, nOk yes, sameSignIS no, cost2 no, placebo no. Round trip 0.1 %, mean cost with financing 0.1141 % a hold. Release day alone, OOS: −0.162 % net (one-sample t −3.08), −0.048 % gross.

## In sample and out of sample, gross and net

| test | window | n | release gross % | release net % | other gross % | diff gross % | t gross | diff net % | t net |
|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2008-16 | 145 | +0.025 | −0.024 | +0.025 | −0.000 | +0.00 | −0.049 | −0.52 |
| T1 | OOS 2017-2026 | 224 | +0.040 | −0.015 | +0.066 | −0.026 | −0.30 | −0.080 | −0.93 |
| T2 | IS 2008-16 | 145 | −0.010 | −0.069 | +0.046 | −0.057 | −0.53 | −0.115 | −1.08 |
| T2 | OOS 2017-2026 | 224 | +0.068 | +0.004 | +0.079 | −0.011 | −0.10 | −0.075 | −0.67 |
| T3 | IS 2008-16 | 145 | +0.029 | −0.030 | +0.027 | +0.002 | +0.02 | −0.057 | −0.65 |
| T3 | OOS 2017-2026 | 224 | +0.027 | −0.037 | +0.059 | −0.033 | −0.41 | −0.097 | −1.22 |
| T4 | IS 2008-16 | 145 | −0.035 | −0.143 | +0.010 | −0.045 | −1.10 | −0.154 | −3.77 |
| T4 | OOS 2017-2026 | 224 | −0.029 | −0.143 | −0.004 | −0.025 | −0.80 | −0.139 | −4.47 |
| T5 | IS 2008-16 | 145 | −0.066 | −0.175 | +0.023 | −0.089 | −1.33 | −0.198 | −2.95 |
| T5 | OOS 2017-2026 | 224 | −0.048 | −0.162 | −0.007 | −0.041 | −0.75 | −0.155 | −2.85 |

## CPI days and payrolls days apart (gross, against the other days; reported only)

| test | window | CPI n | CPI diff gross % (t) | payrolls n | payrolls diff gross % (t) |
|---|---|---|---|---|---|
| T1 | IS | 40 | −0.003 (−0.03) | 105 | +0.001 (+0.01) |
| T1 | OOS | 109 | −0.021 (−0.17) | 115 | −0.030 (−0.26) |
| T2 | IS | 40 | +0.013 (+0.11) | 105 | −0.083 (−0.60) |
| T2 | OOS | 109 | +0.078 (+0.49) | 115 | −0.095 (−0.63) |
| T3 | IS | 40 | −0.061 (−0.55) | 105 | +0.026 (+0.23) |
| T3 | OOS | 109 | −0.089 (−0.78) | 115 | +0.021 (+0.20) |
| T4 | IS | 40 | −0.112 (−2.25) | 105 | −0.019 (−0.37) |
| T4 | OOS | 109 | +0.012 (+0.27) | 115 | −0.060 (−1.38) |
| T5 | IS | 40 | −0.114 (−1.11) | 105 | −0.080 (−0.96) |
| T5 | OOS | 109 | +0.020 (+0.27) | 115 | −0.099 (−1.30) |

## Dates

- 369 release days used (145 in sample, 224 out of sample): 149 CPI, 220 payrolls, 0 both. Sources per date in `dates.mjs` and in result.json `releaseDates`.
- CPI from 2012 only: 2008-2011 CPI dates cannot be written out reliably here, so those years are payrolls only (and their CPI days sit, unknown, among the comparison days). 2012-17 CPI dates are the cpi-follow study's memory list as kept by its spike check: 18 dates it dropped are not used (2012-01-19, 2012-04-13, 2012-07-17, 2012-10-16, 2012-11-15, 2013-02-21, 2013-07-16, 2013-09-17, 2013-10-30, 2013-12-17, 2014-02-20, 2014-03-18, 2014-11-20, 2015-06-18, 2015-09-16, 2016-06-16, 2016-12-15, 2017-03-15). 2018-21 BLS schedule, 2022 on council/events.mjs.
- Payrolls 2008-2021: the BLS rule (168 dates), 2022 on council/events.mjs.
- Dropped: 2010-04-02 (NFP, not a NYSE trading day (holiday)); 2012-04-06 (NFP, not a NYSE trading day (holiday)); 2014-09-17 (CPI, FOMC day); 2014-12-17 (CPI, FOMC day); 2015-04-03 (NFP, not a NYSE trading day (holiday)); 2016-03-16 (CPI, FOMC day); 2017-04-14 (CPI, not a NYSE trading day (holiday)); 2017-06-14 (CPI, FOMC day); 2017-12-13 (CPI, FOMC day); 2019-12-11 (CPI, FOMC day); 2020-04-10 (CPI, not a NYSE trading day (holiday)); 2020-06-10 (CPI, FOMC day); 2021-04-02 (NFP, not a NYSE trading day (holiday)); 2023-04-07 (NFP, not a NYSE trading day (holiday)); 2024-06-12 (CPI, FOMC day); 2026-04-03 (NFP, not a NYSE trading day (holiday)).
- Release-minute check of the 2008-09 payrolls rule dates (reported, drops nothing): USB10Y M5 range of the 08:30 New York candle against the median of the 8 nearest other Fridays; 24 of 24 at 1.5x or more. Median ratio 3.72x.

## By year (release net % vs other gross %, a day)

| year | T1 n / diff | T2 n / diff | T3 n / diff | T4 n / diff | T5 n / diff |
|---|---|---|---|---|---|
| 2008 | 12 / +0.169 | 12 / +0.034 | 12 / +0.195 | 12 / −0.192 | 12 / −0.220 |
| 2009 | 12 / +0.110 | 12 / −0.019 | 12 / +0.140 | 12 / −0.373 | 12 / −0.544 |
| 2010 | 11 / −0.292 | 11 / −0.170 | 11 / −0.333 | 11 / −0.067 | 11 / −0.271 |
| 2011 | 12 / −0.534 | 12 / −0.620 | 12 / −0.425 | 12 / +0.000 | 12 / +0.011 |
| 2012 | 18 / −0.124 | 18 / −0.428 | 18 / −0.120 | 18 / −0.207 | 18 / −0.317 |
| 2013 | 19 / +0.179 | 19 / +0.089 | 19 / +0.155 | 19 / −0.188 | 19 / −0.337 |
| 2014 | 19 / +0.028 | 19 / −0.097 | 19 / −0.013 | 19 / −0.017 | 19 / +0.035 |
| 2015 | 21 / −0.010 | 21 / +0.096 | 21 / −0.061 | 21 / −0.199 | 21 / −0.093 |
| 2016 | 21 / −0.156 | 21 / −0.119 | 21 / −0.162 | 21 / −0.118 | 21 / −0.122 |
| 2017 | 20 / +0.096 | 20 / +0.230 | 20 / +0.058 | 20 / −0.120 | 20 / −0.136 |
| 2018 | 24 / +0.025 | 24 / +0.176 | 24 / −0.020 | 24 / −0.152 | 24 / −0.165 |
| 2019 | 23 / +0.474 | 23 / +0.523 | 23 / +0.465 | 23 / −0.222 | 23 / −0.223 |
| 2020 | 22 / −0.488 | 22 / −0.763 | 22 / −0.381 | 22 / −0.093 | 22 / −0.049 |
| 2021 | 23 / +0.074 | 23 / +0.101 | 23 / +0.077 | 23 / −0.059 | 23 / −0.025 |
| 2022 | 24 / −0.391 | 24 / −0.656 | 24 / −0.365 | 24 / −0.127 | 24 / −0.058 |
| 2023 | 23 / +0.396 | 23 / +0.493 | 23 / +0.298 | 23 / −0.033 | 23 / −0.071 |
| 2024 | 23 / −0.093 | 23 / −0.013 | 23 / −0.147 | 23 / −0.212 | 23 / −0.327 |
| 2025 | 22 / −0.532 | 22 / −0.445 | 22 / −0.545 | 22 / −0.199 | 22 / −0.289 |
| 2026 | 20 / −0.392 | 20 / −0.402 | 20 / −0.444 | 20 / −0.171 | 20 / −0.206 |

## Reading

The pre-registered primary test (T1, SPX500) does not pass, so this is not an edge on the desk's CFDs and nothing here calls any of these streams one. Even before costs, release days do not differ measurably from other days on these UTC-day CFD returns: the gross differences run from −0.089 to +0.002 % a day across the five markets and both windows, the largest |t| 1.33. The premium the paper reports is not seen here on 2008-2026 OANDA CFD days (with CPI only from 2012), and after a round trip and a night of financing every stream is negative. Not tested: FOMC days (excluded on purpose, see pre-fomc-drift), other releases, the cash close instead of the UTC day.

To repeat: `node research/edge/announcement-premium/run.mjs fetch <dir>` (git show from origin/council-data, no network), `node --use-env-proxy research/edge/announcement-premium/run.mjs check` (optional, rewrites datecheck.json), then `node research/edge/announcement-premium/run.mjs full <dir>`.
