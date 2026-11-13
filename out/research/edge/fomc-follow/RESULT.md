# Follow or fade the first 30 minutes after the FOMC statement: result

**Verdict: FAIL, 0 of 6 tests.** Best in 2020 → now: R (fade) on NAS100, n 54, +0.095R a trade net of costs, t +0.56, Holm p 1; 2010-19 −0.313R; placebo 95th percentile +0.171R.

Pre-registered in `PREREGISTRATION.md` (committed before any trade of the rule was computed). A new stand-alone event rule decided on 2020 → now; not a test of the gold book (owner decision item 44 untouched). Events: scheduled FOMC statements 2010 → October 2026 (Federal Reserve FOMC meeting calendars (federalreserve.gov/monetarypolicy/fomccalendars.htm and the historical materials by year), scheduled meetings only; 2022 on from council/events.mjs); unscheduled 2008-01-22, 2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15 excluded. Rule: direction of the first 30 minutes after the scheduled FOMC statement (close of the candle ending at S + 30 min against the one ending at S); F follows it, R fades it; entry at S + 30 min, stop beyond the window's extreme on the losing side (at least 0.25 x the window range), target 1.5R, out at 15:55 New York; skipped when the window range is under 0.5 x the mean of the same window on the 20 previous weekdays. Costs, round trip: NAS100 2.0 points, SPX500 1.0 point, gold $0.30. Data: OANDA mid M5 candles through the candle proxy (the pre-fomc-drift study's files).

## The six tests (2020 → now decides)

| rule | market | n | net R a trade | t | Holm p | 2010-19 net R (n) | placebo 95th pct | beats seeds | pass |
|---|---|---|---|---|---|---|---|---|---|
| F (follow) | NAS100 | 54 | −0.038 | −0.24 | 1 | +0.016 (79) | +0.172 | 23 / 40 | no |
| R (fade) | NAS100 | 54 | +0.095 | +0.56 | 1 | −0.313 (79) | +0.171 | 35 / 40 | no |
| F (follow) | SPX500 | 54 | −0.137 | −0.85 | 1 | −0.048 (77) | +0.095 | 22 / 40 | no |
| R (fade) | SPX500 | 54 | −0.139 | −0.83 | 1 | −0.289 (77) | +0.077 | 28 / 40 | no |
| F (follow) | XAU/USD | 54 | +0.042 | +0.28 | 1 | +0.122 (80) | +0.288 | 34 / 40 | no |
| R (fade) | XAU/USD | 54 | −0.154 | −0.93 | 1 | −0.217 (80) | +0.061 | 25 / 40 | no |

"pass" = n ≥ 40, mean net R > 0, t ≥ 2, Holm p < 0.05 over the six tests, positive in 2010-19 and above the placebo's 95th percentile (the same rule on non-FOMC Wednesdays at the same clock time, 40 seeds).

## Detail per window

| rule | market | window | events | trades | net R | t | gross R | cost R | win | exits | skipped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F (follow) | NAS100 | 2010-2019 | 80 | 79 | +0.016 | +0.15 | +0.153 | +0.137 | 49 % | time 44, stop 20, target 15 | no direction 1 |
| F (follow) | NAS100 | 2020 → now | 54 | 54 | −0.038 | −0.24 | −0.005 | +0.033 | 43 % | stop 29, time 7, target 18 | none |
| R (fade) | NAS100 | 2010-2019 | 80 | 79 | −0.313 | −2.30 | +0.036 | +0.350 | 43 % | target 31, stop 44, time 4 | no direction 1 |
| R (fade) | NAS100 | 2020 → now | 54 | 54 | +0.095 | +0.56 | +0.157 | +0.062 | 46 % | target 25, stop 29 | none |
| F (follow) | SPX500 | 2010-2019 | 80 | 77 | −0.048 | −0.46 | +0.104 | +0.152 | 49 % | time 42, stop 21, target 14 | no direction 3 |
| F (follow) | SPX500 | 2020 → now | 54 | 54 | −0.137 | −0.85 | −0.065 | +0.072 | 39 % | stop 32, target 17, time 5 | none |
| R (fade) | SPX500 | 2010-2019 | 80 | 77 | −0.289 | −2.11 | +0.074 | +0.363 | 43 % | stop 42, target 31, time 4 | no direction 3 |
| R (fade) | SPX500 | 2020 → now | 54 | 54 | −0.139 | −0.83 | −0.001 | +0.138 | 41 % | target 21, stop 32, time 1 | none |
| F (follow) | XAU/USD | 2010-2019 | 80 | 80 | +0.122 | +1.35 | +0.171 | +0.049 | 56 % | stop 15, time 53, target 12 | none |
| F (follow) | XAU/USD | 2020 → now | 54 | 54 | +0.042 | +0.28 | +0.086 | +0.044 | 50 % | time 14, stop 24, target 16 | none |
| R (fade) | XAU/USD | 2010-2019 | 80 | 80 | −0.217 | −1.85 | −0.107 | +0.110 | 39 % | target 19, time 20, stop 41 | none |
| R (fade) | XAU/USD | 2020 → now | 54 | 54 | −0.154 | −0.93 | −0.074 | +0.079 | 37 % | stop 34, target 20 | none |

F and R take the same signals in opposite directions. Their stops differ (F beyond the far extreme of the window, R beyond the near one, at least 0.25 x the window range), so their results are not mirror images; both pay the cost, and a near stop makes the cost larger in R.

## By year, 2020 → now (net R a trade, n)

- F (follow), NAS100: 2020 −0.80 (7) · 2021 +0.69 (8) · 2022 −0.28 (8) · 2023 −0.23 (8) · 2024 +0.01 (8) · 2025 +0.53 (8) · 2026 −0.32 (7)
- R (fade), NAS100: 2020 +0.65 (7) · 2021 −0.43 (8) · 2022 −0.09 (8) · 2023 +0.20 (8) · 2024 +0.49 (8) · 2025 −0.43 (8) · 2026 +0.38 (7)
- F (follow), SPX500: 2020 −0.79 (7) · 2021 +0.64 (8) · 2022 −0.91 (8) · 2023 −0.24 (8) · 2024 +0.12 (8) · 2025 +0.18 (8) · 2026 −0.03 (7)
- R (fade), SPX500: 2020 +0.15 (7) · 2021 −0.64 (8) · 2022 +0.18 (8) · 2023 −0.49 (8) · 2024 +0.41 (8) · 2025 +0.12 (8) · 2026 −0.76 (7)
- F (follow), XAU/USD: 2020 −0.20 (7) · 2021 +0.30 (8) · 2022 −0.73 (8) · 2023 −0.19 (8) · 2024 +0.02 (8) · 2025 +0.45 (8) · 2026 +0.68 (7)
- R (fade), XAU/USD: 2020 −0.41 (7) · 2021 −0.47 (8) · 2022 +0.79 (8) · 2023 −0.45 (8) · 2024 +0.18 (8) · 2025 −0.13 (8) · 2026 −0.67 (7)

## What this means

No test meets the pre-registered bar, so neither following nor fading the first 30 minutes after the FOMC statement is an edge on the council's feeds after costs. No proposal is written and nothing live changed. This was a new stand-alone event rule, not a test of the gold book (item 44). Any other version (another window length, target, exit time, market or filter) would need its own pre-registration on data not used here.

To repeat: the candle files of `research/edge/pre-fomc-drift/fetch.mjs`, then `node research/edge/fomc-follow/run.mjs <dir>`. Tests: `tests/fomc-follow.test.mjs`.
