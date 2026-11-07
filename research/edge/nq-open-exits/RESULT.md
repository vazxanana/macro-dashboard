# NQ New York open run: five pre-registered exits, same entries. All fail; the live exit stays.

Paper research only. No live rule, config, tracker or research stream was changed. **Nothing was built.**

**Question.** The live exit (`config.nqRun`: 10R cap, after +2R the stop trails 1R behind the best price, out at 11:00 ET) was
chosen on Nasdaq cash 2018-26. Is there an exit that does better on the 19 years where the entry makes about nothing (2004-22),
and that also does better where it works (2023-26)? Five variants were fixed in `preregistration.md` (commit 13c4ae5b) before
anything was computed; six cells, because the time exit has an earlier and a later setting.

## Verdict: FAIL, all six cells. The live exit is the best of the seven on 2023-26 and no variant beats it on 2004-22.

| cell | exit | 2004-22 R/trade (t) · max DD | 2023-26 R/trade (t) · max DD | 2023-24 | 2025-26 | pass |
|---|---|---|---|---|---|---|
| **B (live)** | trail 1R from +2R, 10R cap, out 11:00 | **−0.016** (−0.47) · 57.9 | **+0.318** (3.45) · 9.7 | **+0.324** | **+0.311** | – |
| fixed2R | target 2R, out 11:00 | −0.025 (−0.78) · 67.0 | +0.253 (3.16) · 8.5 | +0.228 | +0.282 | no |
| trail1 | trail 1R from +1R | −0.037 (−1.25) · 75.3 | +0.269 (3.46) · 7.5 | +0.233 | +0.311 | no |
| trail3 | trail 1R from +3R | −0.019 (−0.54) · 65.3 | +0.315 (3.15) · 11.8 | +0.320 | +0.309 | no |
| t1030 | live exit, out 10:30 | −0.022 (−0.71) · 65.8 | +0.254 (3.01) · 9.4 | +0.280 | +0.224 | no |
| t1200 | live exit, out 12:00 | −0.018 (−0.51) · 66.3 | +0.281 (3.01) · 9.9 | +0.283 | +0.279 | no |
| half | half off at +2R, rest trails from +2R | −0.021 (−0.64) · 62.9 | +0.285 (3.38) · 9.1 | +0.276 | +0.296 | no |

n = 1,561 trades in 2004-22 and 309 in 2023-26 for every cell (the same entries; no trade lost its candles, including at 12:00).
Net of 1 point a trade. Gross and 2-point figures are in `result.json` and move every cell by the same amount, so they do not
change the ranking.

- **Selection (2004-22): no cell beats the baseline's −0.016R a trade**, and none is more than 0.02R away from it. `trail1`
  also fails the drawdown condition (75.3 vs a limit of 69.5). The entry makes nothing in those years and no exit changes that.
- **Confirmation (2023-26): every cell is worse than the live exit**, overall and in 2023-24. In 2025-26 `trail1` ties it
  (+0.311) and nothing beats it. `trail3` is the closest (+0.315 vs +0.318) but its drawdown is 11.8R against a limit of 11.6R.
- **Paired differences against the live exit** (same trades, same days; R a trade, t):

  | cell | 2004-22 | 2023-26 |
  |---|---|---|
  | fixed2R | −0.009 (t −0.83) | −0.065 (t −1.76) |
  | trail1 | −0.021 (t −1.28) | −0.049 (t −1.02) |
  | trail3 | −0.003 (t −0.29) | −0.003 (t −0.07) |
  | t1030 | −0.006 (t −0.47) | **−0.064 (t −2.34)** |
  | t1200 | −0.002 (t −0.19) | −0.037 (t −1.61) |
  | half | −0.005 (t −0.89) | −0.033 (t −1.76) |

  Only the 10:30 exit is clearly worse (t −2.3); the rest are within noise of the live exit on both periods. The honest
  reading is that the exit does not matter much to this rule: six different exits move 2004-22 by at most 0.02R and 2023-26 by
  at most 0.07R, while the regime moves it by 0.33R. The live exit happens to be the best or tied-best cell everywhere.

## What the exits do (2023-26, 309 trades, net)

| cell | stopped out | time exit | trail / target | where the money is |
|---|---|---|---|---|
| B (live) | 158 at −1.03 | 61 at +1.35 | 90 trail at +1.99 | 29% of trades reach +2R; the trail keeps 2R of them on average, the 11:00 exit adds +1.35 on the ones still running |
| fixed2R | 158 | 42 at +0.62 | 109 target at +1.98 | the 2R target cuts the 11:00 runners from +1.35 to +0.62: −0.065R a trade |
| trail1 | 122 | 28 | 159 trail at +1.05 | fewer full losses (122 vs 158) but 159 trails at +1.05: the breakeven stop at +1R gives back the runs |
| trail3 | 171 | 83 at +1.35 | 55 trail at +2.93 | 13 more full losses than B; the trail wins are bigger (+2.93) but there are 35 fewer of them |
| t1030 | 149 | 84 at +0.98 | 76 trail at +1.97 | out before the move finishes: the time exits fall from +1.35 to +0.98 |
| t1200 | 165 | 37 at +1.03 | 107 trail at +2.05 | the extra hour adds 7 stop-outs and the 12:00 exits are worth less than the 11:00 ones were |
| half | 158 | 61 at +1.19 | 90 trail at +1.98 | half at 2R costs +0.16 on every runner for no fewer losses |

The 2004-22 mix is the same picture at a lower level (B: 768 stops at −1.12, 526 time exits at +0.69, 267 trails at +1.78).

## Year by year (net R a trade)

| year | B | fixed2R | trail1 | trail3 | t1030 | t1200 | half |
|---|---|---|---|---|---|---|---|
| 2004 | −0.135 | −0.075 | −0.187 | −0.092 | −0.150 | −0.200 | −0.105 |
| 2005 | +0.276 | +0.204 | +0.121 | +0.345 | +0.254 | +0.183 | +0.240 |
| 2006 | −0.065 | −0.099 | −0.153 | −0.052 | −0.065 | −0.149 | −0.082 |
| 2007 | −0.021 | −0.032 | −0.099 | −0.070 | −0.027 | −0.063 | −0.026 |
| 2008 | −0.047 | −0.016 | −0.169 | −0.097 | +0.049 | −0.011 | −0.031 |
| 2009 | −0.075 | −0.061 | −0.053 | −0.086 | −0.058 | −0.055 | −0.068 |
| 2010 | +0.071 | +0.109 | +0.115 | +0.075 | +0.094 | +0.229 | +0.090 |
| 2011 | −0.046 | −0.106 | −0.097 | −0.032 | −0.060 | −0.049 | −0.076 |
| 2012 | +0.001 | −0.029 | −0.044 | +0.066 | −0.092 | +0.050 | −0.014 |
| 2013 | +0.229 | +0.214 | +0.233 | +0.224 | +0.321 | +0.311 | +0.221 |
| 2014 | −0.106 | −0.131 | −0.112 | −0.068 | −0.150 | −0.053 | −0.118 |
| 2015 | −0.167 | −0.139 | −0.109 | −0.116 | −0.212 | −0.162 | −0.153 |
| 2016 | −0.157 | −0.207 | −0.161 | −0.184 | −0.179 | −0.174 | −0.182 |
| 2017 | +0.040 | +0.026 | +0.095 | −0.005 | −0.018 | +0.028 | +0.033 |
| 2018 | +0.154 | +0.165 | +0.125 | +0.124 | +0.080 | +0.130 | +0.159 |
| 2019 | −0.166 | −0.210 | −0.155 | −0.181 | −0.113 | −0.144 | −0.188 |
| 2020 | −0.076 | −0.095 | +0.033 | −0.058 | −0.029 | −0.135 | −0.091 |
| 2021 | −0.046 | −0.047 | −0.018 | −0.067 | −0.066 | −0.087 | −0.046 |
| 2022 | +0.047 | +0.043 | −0.044 | −0.041 | +0.017 | +0.026 | +0.045 |
| **2023** | +0.345 | +0.254 | +0.260 | +0.404 | +0.320 | +0.340 | +0.299 |
| **2024** | +0.302 | +0.200 | +0.203 | +0.230 | +0.236 | +0.221 | +0.251 |
| **2025** | +0.236 | +0.251 | +0.227 | +0.114 | +0.172 | +0.240 | +0.244 |
| **2026** (to 3 Nov) | +0.380 | +0.310 | +0.389 | +0.491 | +0.273 | +0.315 | +0.345 |

`trail3` has the best single year (2026, +0.49) and the worst of the good years (2025, +0.11): a later trail start trades a
few big runs against more full losses, and which wins depends on the year. That is noise, not an exit to pick.

## So

- **Keep the live exit.** It was chosen on 2018-26 cash data and it holds up on 22 years of a different feed against six
  alternatives, none of which was computed before this test. Nothing is proposed to the owner.
- **The exit is not where this rule's problem is.** #511 showed the entry is regime-bound (flat 2004-22, +0.32R 2023-26). Six
  exits move the 2004-22 result by at most 0.02R. If the regime ends, no exit will save the rule; the CUSUM review in
  `council/decay.mjs` is the right guard, not a different trail.
- **Six cells were looked at.** With that many, a chance pass against a loose bar would not have been a surprise; the bar
  here (better in both periods, both halves, drawdown within 20%) was fixed before the run and none came close. This is a clean
  negative, not a near miss.

## Data and method

- **OANDA NAS100_USD 1-minute mid candles** via the site's keyless proxy: the #511 cache (09:30-11:05 ET plus the midnight
  price, clean years 2004-26, to 6 Nov 2026) plus the **11:05-12:05 ET candles** fetched by `fetch-noon.mjs` for the 12:00 exit
  (6,088 of the 6,101 cached weekdays 2004-26 had them).
- **Entries:** `nqOpenSweep` + the midnight-open filter from `research/edge/nq-open-oos/lib.mjs`, which copies
  `council/trader.mjs`. 1,870 entries, identical for every cell. The baseline B reproduces #511's `dayTrade` on every trade
  (checked in `run.mjs`; the run stops if it does not). B has one more trade than #511 (2012-10-31, the Hurricane Sandy
  reopening): the cache had no 11:00-11:04 candle that day, and the noon candles let the trade close at 11:05.
- **Management:** the live loop with the exit as a parameter (`manage()` in `run.mjs`): within a candle the stop is checked
  first, then the target / 2R half-off, then the trail from the candle's best price, then the time exit at the open; a gap
  fills at the open; the first minute after the fill is not checked (as live).
- **Costs:** 1 point round trip = 1 / stop (points) in R, the same for every cell. 2 points and gross reported in `result.json`.
- **Pass bar** (preregistration.md, unchanged): selection 2004-22 R/trade > B and max DD ≤ 1.2 × B's; confirmation 2023-26
  R/trade > B overall and in both calendar halves (2023-24, 2025-26) and max DD ≤ 1.2 × B's. Each cell on its own.

## Files

- `preregistration.md`: the five variants, windows, costs and bar, committed before the run (13c4ae5b).
- `fetch-noon.mjs`: the 11:05-12:05 ET candles into the #511 cache directory (`nas100-noon-<year>.json`, not committed).
- `run.mjs`: entries, the parametrised live loop, the six cells, the bar, `result.json`.
- `result.json`: every cell's stats by period, half and year, the exit mix, the paired differences, the verdicts, and one row
  per entry with each cell's net R and exit.

Re-run:

```
node research/edge/nq-open-oos/fetch.mjs <cacheDir> 2003
node research/edge/nq-open-exits/fetch-noon.mjs <cacheDir>
node research/edge/nq-open-exits/run.mjs <cacheDir>
```
