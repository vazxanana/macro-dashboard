# Fading the opening gap on NAS100 and SPX500

Paper research only. No live rule, size, filter, stop, config or council member changed; ICT not involved. The rule, costs,
windows, placebo and pass bar were committed first (`PREREGISTRATION.md`). This page is written by `run.mjs` from `result.json`.

## Verdict: FAIL: 0 of 4 tests pass in 2021 → now; NAS100 fade of every gap −0.059R a trade net (n 852, monthly t −1.84, gross −0.012R), SPX500 fade of every gap −0.121R a trade net (n 913, monthly t −4.37, gross −0.030R)

- **NAS100, every gap 0.15-1.0 %**, 2021 → 2026-11-12 (decides): −0.059R a trade net of 2 points (n 852, t −1.84 on 71 monthly sums; before costs −0.012R); 2016-20 −0.154R (n 745); placebo 95th percentile −0.037R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; n ≥ 150: yes; 2016-20 positive: no; beats the placebo: no → **fail**.
- **NAS100, gaps against the prior day**, 2021 → 2026-11-12 (decides): −0.041R a trade net of 2 points (n 431, t −0.94 on 71 monthly sums; before costs +0.002R); 2016-20 −0.255R (n 356); placebo 95th percentile −0.008R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; n ≥ 150: yes; 2016-20 positive: no; beats the placebo: no → **fail**.
- **SPX500, every gap 0.15-1.0 %**, 2021 → 2026-11-12 (decides): −0.121R a trade net of 1 point (n 913, t −4.37 on 71 monthly sums; before costs −0.030R); 2016-20 −0.116R (n 761); placebo 95th percentile −0.062R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; n ≥ 150: yes; 2016-20 positive: no; beats the placebo: no → **fail**.
- **SPX500, gaps against the prior day**, 2021 → 2026-11-12 (decides): −0.155R a trade net of 1 point (n 472, t −3.70 on 71 monthly sums; before costs −0.068R); 2016-20 −0.149R (n 376); placebo 95th percentile −0.039R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; n ≥ 150: yes; 2016-20 positive: no; beats the placebo: no → **fail**.

Reading (written after the results): the gap does fill often (small gaps most days, 0.5-1.0 % gaps a third to a half of the time), but the 1R stop the same distance away is reached about as often, so the fade is a coin flip before costs (gross R a trade between −0.07R and +0.03R in every test and window) and loses its costs. Every test is negative after costs in both windows and below its own random-side placebo; the variant on gaps against the prior day is no better. Not an edge; no proposal is written and nothing live changes.

## How often the gap fills (descriptive, no test)

Share of trading days on which price traded back to the previous 16:00 close between 09:30 and 16:00 New York, by gap size.

| Market | Window | 0.00-0.15 % | 0.15-0.30 % | 0.30-0.50 % | 0.50-1.00 % | over 1.00 % |
|---|---|---|---|---|---|---|
| NAS100 | 2016-2020 | 86.7 % (315) | 75.5 % (229) | 56.1 % (262) | 41.9 % (277) | 25.7 % (152) |
| NAS100 | 2021 → now | 93.2 % (295) | 75.8 % (264) | 62.2 % (251) | 47.6 % (382) | 24.9 % (261) |
| SPX500 | 2016-2020 | 87.2 % (360) | 59.9 % (304) | 49.4 % (243) | 31.5 % (219) | 18.3 % (109) |
| SPX500 | 2021 → now | 91.6 % (381) | 70.6 % (330) | 53.5 % (299) | 35.1 % (305) | 25.4 % (138) |

## Windows

| Market | Rule | Window | n | Win | Net R/trade | Gross R/trade | Cost R/trade | Total R | t (months) | Stops / targets / time | Max DD R | Median risk (pts) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NAS100 | every gap 0.15-1.0 % | 2016-2020 (replication) | 745 | 49.7 % | −0.154 | +0.010 | 0.165 | −114.92 | −3.53 | 304 / 311 / 130 | −125.76 | 27.2 |
| NAS100 | every gap 0.15-1.0 % | 2021 → now (decides) | 852 | 48.8 % | −0.059 | −0.012 | 0.047 | −50.02 | −1.84 | 371 / 366 / 115 | −53.86 | 79.8 |
| NAS100 | gaps against the prior day | 2016-2020 (replication) | 356 | 46.3 % | −0.255 | −0.051 | 0.204 | −90.77 | −3.12 | 158 / 141 / 57 | −101.00 | 25.6 |
| NAS100 | gaps against the prior day | 2021 → now (decides) | 431 | 49.7 % | −0.041 | +0.002 | 0.044 | −17.72 | −0.94 | 186 / 187 / 58 | −23.59 | 78 |
| SPX500 | every gap 0.15-1.0 % | 2016-2020 (replication) | 761 | 49.0 % | −0.116 | +0.033 | 0.150 | −88.58 | −3.14 | 266 / 301 / 194 | −98.93 | 9.6 |
| SPX500 | every gap 0.15-1.0 % | 2021 → now (decides) | 913 | 47.8 % | −0.121 | −0.030 | 0.091 | −110.50 | −4.37 | 377 / 367 / 169 | −114.32 | 19.8 |
| SPX500 | gaps against the prior day | 2016-2020 (replication) | 376 | 47.3 % | −0.149 | 0.000 | 0.150 | −56.17 | −3.30 | 142 / 145 / 89 | −62.99 | 9.4 |
| SPX500 | gaps against the prior day | 2021 → now (decides) | 472 | 45.8 % | −0.155 | −0.068 | 0.087 | −73.15 | −3.70 | 203 / 184 / 85 | −75.25 | 19.4 |

## Placebo (window B, a random side each traded day, same distance, 40 seeds)

| Market | Rule | Real net R/trade | Placebo median | Placebo 95th percentile |
|---|---|---|---|---|
| NAS100 | every gap 0.15-1.0 % | −0.059 | −0.082 | −0.037 |
| NAS100 | gaps against the prior day | −0.041 | −0.073 | −0.008 |
| SPX500 | every gap 0.15-1.0 % | −0.121 | −0.112 | −0.062 |
| SPX500 | gaps against the prior day | −0.155 | −0.102 | −0.039 |

## By year (net R a trade, n; every gap 0.15-1.0 %)

| Year | NAS100 | SPX500 |
|---|---|---|
| 2016 | −0.195 (139) | −0.108 (157) |
| 2017 | −0.079 (148) | −0.231 (129) |
| 2018 | −0.173 (164) | −0.139 (167) |
| 2019 | −0.094 (159) | −0.033 (158) |
| 2020 | −0.243 (135) | −0.089 (150) |
| 2021 | −0.025 (154) | −0.091 (163) |
| 2022 | −0.209 (119) | −0.264 (142) |
| 2023 | −0.059 (155) | −0.054 (172) |
| 2024 | +0.017 (160) | −0.070 (151) |
| 2025 | −0.045 (133) | −0.086 (136) |
| 2026 | −0.068 (131) | −0.179 (149) |

## Data and days

- NAS100: 770832 OANDA mid M5 candles 2015-12-01 → 2026-11-12; 1597 trades (787 against the prior day); days skipped: 21 early closes, 21 after an early close, 2 with a needed candle missing, 1023 with the gap outside 0.15-1.0 %, 68 with the gap already filled at 09:35.
- SPX500: 753827 OANDA mid M5 candles 2015-12-01 → 2026-11-12; 1674 trades (848 against the prior day); days skipped: 21 early closes, 21 after an early close, 2 with a needed candle missing, 988 with the gap outside 0.15-1.0 %, 26 with the gap already filled at 09:35.

## Notes

- The calendar and statistics helpers are the ones of `research/edge/orb-nas100/run.mjs`, written out in `run.mjs` because that study was not on main when this one was written; the test compares them with that file when it is present.
- OANDA CFDs trade through the night, so the 09:30 open is the CFD price at that minute, not a cash-index auction print; the gap is the overnight CFD move from the previous 15:55 candle close.

To repeat: `node --use-env-proxy research/edge/gap-fill/fetch.mjs <dir>`, then `node research/edge/gap-fill/run.mjs <dir>`.
