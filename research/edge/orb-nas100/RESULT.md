# The 5-minute opening range breakout on NAS100 and SPX500, out of sample

Paper research only. No live rule, size, filter, stop, config or council member changed; ICT not involved. The rule, costs,
windows, placebo and pass bar were committed first (`PREREGISTRATION.md`). This page is written by `run.mjs` from `result.json`.

## Verdict: FAIL: 0 of 2 markets pass in 2021 → now; NAS100 +0.075R a trade net (n 1460, monthly t +1.27, gross +0.135R), SPX500 −0.053R a trade net (n 1456, monthly t −0.79, gross +0.138R)

- **NAS100**, 2021 → 2026-11-12 (decides): +0.075R a trade net of 2 points (n 1460, t +1.27 on 71 monthly sums; before costs +0.135R, t +2.27); placebo 95th percentile −0.215R; Holm p 0.204. Net > 0: yes; t ≥ 2: no; beats the placebo: yes; Holm: no → **fail**.
- **SPX500**, 2021 → 2026-11-12 (decides): −0.053R a trade net of 1 point (n 1456, t −0.79 on 71 monthly sums; before costs +0.138R, t +2.08); placebo 95th percentile −0.468R; Holm p 0.785. Net > 0: no; t ≥ 2: no; beats the placebo: yes; Holm: no → **fail**.

**Reading.** Before costs the opening candle does point the day: in 2021 → now both markets make about +0.14R a trade gross (NAS100 t 2.27, SPX500 t 2.08 on monthly sums). After a CFD trader's round trip it is gone or too small to tell from luck: NAS100 keeps +0.075R a trade (+110R over 1,460 trades, t 1.27, Holm p 0.20), SPX500 loses (−0.053R). The part after the paper's sample (March 2023 → now) is no better (NAS100 +0.085R, t 1.04; SPX500 −0.089R). In 2016-2020, when the opening ranges were a few points wide, costs took 0.24R (NAS100) and 0.47R (SPX500) a trade and both lose (SPX500 −458R). Not an edge; no proposal is written and nothing live changes.

## Windows

| Market | Window | n | Win | Net R/trade | Gross R/trade | Cost R/trade | Total R | t (months) | Stops / targets / time | Max DD R | Median risk (pts) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| NAS100 | 2016-2020 (inside the paper) | 1241 | 22.8 % | −0.027 | +0.210 | 0.236 | −33.06 | −0.36 | 933 / 40 / 268 | −143.05 | 11.6 |
| NAS100 | 2021 → now (decides) | 1460 | 24.9 % | +0.075 | +0.135 | 0.060 | +110.22 | +1.27 | 1084 / 29 / 347 | −49.27 | 41 |
| NAS100 | Mar 2023 → now (after the paper) | 922 | 25.2 % | +0.085 | +0.143 | 0.058 | +78.54 | +1.04 | 682 / 23 / 217 | −49.27 | 42.6 |
| SPX500 | 2016-2020 (inside the paper) | 1199 | 19.4 % | −0.382 | +0.086 | 0.468 | −458.14 | −4.88 | 945 / 43 / 211 | −476.89 | 3 |
| SPX500 | 2021 → now (decides) | 1456 | 20.1 % | −0.053 | +0.138 | 0.191 | −76.78 | −0.79 | 1153 / 54 / 249 | −143.66 | 6.9 |
| SPX500 | Mar 2023 → now (after the paper) | 919 | 19.4 % | −0.089 | +0.094 | 0.183 | −81.40 | −1.04 | 735 / 35 / 149 | −132.48 | 6.9 |

## Placebo (window B, a random side each day, 40 seeds)

| Market | Real net R/trade | Placebo median | Placebo 95th percentile |
|---|---|---|---|
| NAS100 | +0.075 | −0.297 | −0.215 |
| SPX500 | −0.053 | −0.581 | −0.468 |

## By year (net R a trade, n)

| Year | NAS100 | SPX500 |
|---|---|---|
| 2016 | +0.049 (249) | −0.462 (242) |
| 2017 | −0.411 (247) | −0.807 (229) |
| 2018 | +0.160 (247) | −0.222 (239) |
| 2019 | +0.026 (249) | −0.151 (242) |
| 2020 | +0.041 (249) | −0.292 (247) |
| 2021 | +0.093 (251) | +0.039 (249) |
| 2022 | +0.118 (249) | +0.075 (249) |
| 2023 | +0.059 (247) | +0.021 (246) |
| 2024 | +0.025 (249) | −0.347 (247) |
| 2025 | +0.182 (247) | −0.019 (247) |
| 2026 | −0.039 (217) | −0.092 (218) |

## Data and days

- NAS100: 770832 OANDA mid M5 candles 2015-12-01 → 2026-11-12; 2701 trades; days skipped: 103 NYSE holidays, 21 early closes, 3 with the 09:30 or 09:35 candle missing, 7 doji, 0 with the entry already at or past the stop.
- SPX500: 753827 OANDA mid M5 candles 2015-12-01 → 2026-11-12; 2655 trades; days skipped: 103 NYSE holidays, 21 early closes, 2 with the 09:30 or 09:35 candle missing, 49 doji, 5 with the entry already at or past the stop.

## Notes

- Post hoc, about the placebo: it is easy to beat by construction, so beating it says little. A random side that goes AGAINST the opening candle enters at the 09:35 open, which sits near the candle's close, i.e. near the end that becomes its stop: in 2021 → now its median risk is 10 points on NAS100 (41 with the candle) and 2 points on SPX500 (6.9), so the round trip costs it far more in R (net −0.74R and −1.11R a trade on those days; −0.12R and −0.16R before costs). The decisive checks that fail are the t and Holm, not the placebo.
- The paper's sample is recalled as January 2016 to February 2023 (its abstract, not re-read). Window B overlaps it for 26 months; the after-sample line (March 2023 → now) was fixed in the pre-registration and is descriptive.
- The paper trades QQQ shares with commissions of a cent a share and leverage up to 4x; this study trades the OANDA NAS100 / SPX500 CFDs at a fixed 1R a trade with the round trips of pre-fomc-drift (2 and 1 points). A cheaper venue (the ETF or a micro future) would keep more of the gross +0.14R; that is a different study and would need its own pre-registration.
- This is not the council's NQ New York open run (nq-open), which is a different rule and is unchanged.

To repeat: `node --use-env-proxy research/edge/orb-nas100/fetch.mjs <dir>`, then `node research/edge/orb-nas100/run.mjs <dir>`.
