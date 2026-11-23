# The volatility breakout with an H1-break veto, on the untouched holdout (holdout-h1-veto, 23 Nov 2026)

**Verdict: FAIL: pooled holdout kept days −0.011R a trade after costs (n 19454, month t −1.14, one-sided p 0.873); Set A +0.049R (n 4273), Set B −0.028R (n 15181); 2x costs −0.063R; vetoed days −0.037R (n 1352); lines missed: setB, t2, holm, cost2x**

Paper research only. Rule, sets, costs and the pass bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed. This page is written by `run.mjs` from `result.json`.

Said plainly: the pooled breakout (the base rule, every fill hour) was already read on most holdout markets by earlier studies; only the split by the H1 structure at the fill is untouched. NZD/USD has never been in a breakout study.

## The bar

| Line | Needed | Here | Met |
|---|---|---|---|
| 1 | Set A mean R after costs > 0 | +0.049 (n 4273) | yes |
| 2 | Set B mean R after costs > 0 | −0.028 (n 15181) | no |
| 3 | pooled month t ≥ 2 and Holm p < 0.05 | t −1.14 (263 months), one-sided p 0.873, Holm ≤ 1 | no |
| 4 | ≥ 100 pooled trades | 19454 | yes |
| 5 | pooled mean R > 0 at 2x costs | −0.063 | no |
| gate | harness reproduces published results | 9 of 9 windows | yes |

Family: not every sibling result is in yet: the bound 5 x p (Holm's largest multiplier) is used; the adjusted p can only be this or smaller.

## Kept days (the rule) against vetoed days, after costs

| Series | Kept n | Kept net R | Kept gross R | Kept 2x cost | Kept month t | Vetoed n | Vetoed net R | Kept − vetoed (Welch t) |
|---|---|---|---|---|---|---|---|---|
| **Pooled holdout** | 19454 | −0.011 | +0.040 | −0.063 | −1.14 | 1352 | −0.037 | +0.025 (+0.71) |
| Set A | 4273 | +0.049 | +0.086 | +0.012 | +2.57 | 331 | +0.204 | −0.155 (−1.86) |
| Set B | 15181 | −0.028 | +0.027 | −0.084 | −2.50 | 1021 | −0.114 | +0.086 (+2.29) |
| xau (A) | 650 | +0.090 | +0.205 | −0.024 | +1.68 | 55 | +0.145 | −0.055 (−0.30) |
| eurusd (A) | 889 | +0.016 | +0.042 | −0.009 | +0.47 | 64 | +0.247 | −0.230 (−1.19) |
| gbpusd (A) | 916 | +0.042 | +0.063 | +0.021 | +1.18 | 68 | +0.414 | −0.372 (−1.74) |
| usdjpy (A) | 901 | +0.093 | +0.117 | +0.069 | +2.60 | 69 | +0.181 | −0.088 (−0.49) |
| audusd (A) | 917 | +0.015 | +0.039 | −0.010 | +0.44 | 75 | +0.042 | −0.027 (−0.17) |
| nzdusd (B) | 3059 | −0.037 | −0.007 | −0.067 | −2.02 | 204 | −0.084 | +0.047 (+0.58) |
| usdcad (B) | 3042 | −0.062 | −0.028 | −0.096 | −3.24 | 217 | −0.135 | +0.073 (+0.92) |
| usdchf (B) | 3106 | −0.017 | +0.017 | −0.051 | −0.74 | 199 | −0.043 | +0.026 (+0.30) |
| eurjpy (B) | 3043 | +0.045 | +0.071 | +0.019 | +1.99 | 208 | −0.162 | +0.207 (+2.94) |
| xag (B) | 2931 | −0.072 | +0.087 | −0.232 | −2.95 | 193 | −0.146 | +0.074 (+0.71) |

## In plain words

The rule does not pass the pre-registered bar (FAIL; missed: setB, t2, holm, cost2x). With the veto, pooled: −0.011R a trade after costs (n 19454, gross +0.040R, month t −1.14 over 263 months). Without it (the base rule, same days): −0.013R (n 20806, month t −1.33). The vetoed days (6.5 % of base days): −0.037R (n 1352); kept minus vetoed +0.025R (Welch t +0.71). Set A kept +0.049R vs vetoed +0.204R (t −1.86); Set B kept −0.028R vs vetoed −0.114R (t +2.29). The veto was chosen from in-sample trades of 2010-2026 on the five main markets; whatever it shows here is read as the pre-registration says, never as an edge without its n and t.

## Sides and exits (pooled kept days)

Buys n 9710 +0.007R, sells n 9744 −0.030R; stopped 6681, out at 21:00 12773; worst drawdown −557.86R. Base rule without the veto on the same days: n 20806, −0.013R a trade (month t −1.33). Share of base days vetoed: 6.5 %.

## By year (kept days, net R a trade, n)

| Year | Set A | Set B |
|---|---|---|
| 2005 | +0.076 (728) | — |
| 2006 | +0.014 (815) | — |
| 2007 | +0.074 (889) | — |
| 2008 | +0.070 (923) | — |
| 2009 | +0.014 (918) | — |
| 2010 | — | +0.004 (898) |
| 2011 | — | +0.056 (880) |
| 2012 | — | −0.022 (921) |
| 2013 | — | +0.001 (858) |
| 2014 | — | −0.040 (882) |
| 2015 | — | −0.077 (902) |
| 2016 | — | −0.058 (906) |
| 2017 | — | −0.109 (914) |
| 2018 | — | −0.056 (927) |
| 2019 | — | −0.046 (891) |
| 2020 | — | −0.005 (914) |
| 2021 | — | +0.024 (921) |
| 2022 | — | −0.013 (890) |
| 2023 | — | −0.111 (907) |
| 2024 | — | −0.028 (867) |
| 2025 | — | −0.027 (909) |
| 2026 | — | +0.036 (794) |

## Harness gate (unfiltered base rule at each study's own cost)

| Market | Source | Window | Published n / net | Here n / net | Within 2 % and 0.01R |
|---|---|---|---|---|---|
| xau | gold-vol-breakout-replicate | 2007-01-01 → 2009-12-31 | 561 / +0.139 | 561 / +0.139 | yes |
| eurusd | fx-majors-vb-early | 2005-01-04 → 2009-12-31 | 953 / +0.032 | 953 / +0.032 | yes |
| gbpusd | fx-majors-vb-early | 2005-01-04 → 2009-12-31 | 984 / +0.068 | 984 / +0.068 | yes |
| usdjpy | usdjpy-vol-breakout-early | 2005-01-04 → 2009-12-31 | 970 / +0.099 | 970 / +0.099 | yes |
| audusd | fx-majors-vb-early | 2005-01-04 → 2009-12-31 | 992 / +0.017 | 992 / +0.017 | yes |
| usdcad | fx-majors-vb-early | 2010-01-01 → 2015-12-31 | 1171 / −0.054 | 1171 / −0.054 | yes |
| usdchf | fx-majors-vb-early | 2010-01-01 → 2015-12-31 | 1157 / +0.039 | 1157 / +0.039 | yes |
| eurjpy | yen-crosses-vol-breakout (complete years) | 2010-01-01 → 2025-12-31 | 3079 / +0.031 | 3079 / +0.031 | yes |
| xag | silver-vol-breakout (complete years) | 2016-01-01 → 2025-12-31 | 1854 / −0.100 | 1854 / −0.100 | yes |

NZD/USD has no published breakout result, so no gate applies to it.

## What this does NOT show

- One veto, fixed before the run (3-a-side H1 swings, 6 H1 candles); no other swing size, freshness window or timeframe is tried, and choosing one now on these trades would be a search.
- "6 or fewer closed H1 candles" is read as: the break's candle is one of the last 6 H1 candles closed at the fill candle's start (age 1 = the last closed one). Written in code before the run; the pre-registration does not say whether the break candle itself counts.
- Set B costs are ASSUMED, not measured on the demo account; past years are charged today's costs; OANDA mid candles, not broker ticks.
- The phase tags in `trades.json` (D1 / H4 side and stage known at 00:00 UTC) are a description, never part of the verdict.
- Whatever the verdict, nothing here is an edge on its own and nothing live changes.

## Data and method

- xau (Set A): 271849 M5 candles 2006-03-19 → 2009-12-31, 989 weekdays, 705 base trades, 55 vetoed; eurusd (Set A): 381404 M5 candles 2005-01-02 → 2009-12-31, 1304 weekdays, 953 base trades, 64 vetoed; gbpusd (Set A): 379947 M5 candles 2005-01-02 → 2009-12-31, 1304 weekdays, 984 base trades, 68 vetoed; usdjpy (Set A): 381168 M5 candles 2005-01-02 → 2009-12-31, 1304 weekdays, 970 base trades, 69 vetoed; audusd (Set A): 379975 M5 candles 2005-01-02 → 2009-12-31, 1304 weekdays, 992 base trades, 75 vetoed; nzdusd (Set B): 1273553 M5 candles 2009-11-01 → 2026-11-23, 4399 weekdays, 3263 base trades, 204 vetoed; usdcad (Set B): 1272857 M5 candles 2009-11-01 → 2026-11-23, 4399 weekdays, 3259 base trades, 217 vetoed; usdchf (Set B): 1264888 M5 candles 2009-11-01 → 2026-11-23, 4399 weekdays, 3305 base trades, 199 vetoed; eurjpy (Set B): 1278151 M5 candles 2009-11-01 → 2026-11-23, 4399 weekdays, 3251 base trades, 208 vetoed; xag (Set B): 1191774 M5 candles 2009-11-01 → 2026-11-23, 4386 weekdays, 3124 base trades, 193 vetoed. Source: the shared toolkit's OANDA mid M5 cache; 2010-2026 on the five main markets not read.
- Base rule imported unchanged (gold-vol-breakout buildDays / daySkip / vbTrade, k 0.5, both sides, stop at the UTC open, out at the 20:55 candle close), all fill hours; per-day trade and costs = holdout-vb-early dayTrade / costOf (max(toolkit COSTS, the market's own study cost: gold $0.60, silver $0.03, forex 0.000045 x entry + 0.5 pip)); 2x reported. Veto: H1 = toolkit resample(m5, 3600) over the continuous loaded history (warm-up included), structure(H1, 3) events (BO and ChoCh); at the first fill, the last event whose candle closed at or before the fill candle's start; vetoed when its direction is against the fill side and its age (above) <= 6; the day then has no trade (the other order is cancelled). Month sums by exit month over each set's span (empty months 0), Set A and Set B months pooled; p one-sided from the toolkit's t. Gate: the unfiltered rule at each study's own cost against its published by-year results on the overlapping holdout years.
- To repeat: `node research/edge/holdout-h1-veto/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git).

