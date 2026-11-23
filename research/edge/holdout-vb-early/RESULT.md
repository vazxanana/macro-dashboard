# The volatility breakout, early fills only, on the untouched holdout (holdout-vb-early, 23 Nov 2026)

**Verdict: FAIL: pooled holdout early fills +0.063R a trade after costs (n 4521, month t +2.22, one-sided p 0.014); Set A +0.239R (n 1011), Set B +0.012R (n 3510); 2x costs −0.002R; lines missed: holm, cost2x**

Paper research only. Rule, sets, costs and the pass bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed. This page is written by `run.mjs` from `result.json`.

Said plainly, as the pre-registration says: the pooled breakout (every fill hour) was already read on most holdout markets by earlier studies; only the split by fill hour is untouched. NZD/USD has never been in a breakout study.

## The bar

| Line | Needed | Here | Met |
|---|---|---|---|
| 1 | Set A mean R after costs > 0 | +0.239 (n 1011) | yes |
| 2 | Set B mean R after costs > 0 | +0.012 (n 3510) | yes |
| 3 | pooled month t ≥ 2 and Holm p < 0.05 | t +2.22 (263 months), one-sided p 0.014, Holm ≤ 0.068 | no |
| 4 | ≥ 100 pooled trades | 4521 | yes |
| 5 | pooled mean R > 0 at 2x costs | −0.002 | no |
| gate | harness reproduces published results | 9 of 9 windows | yes |

Family: Holm over the five primary p values.

## Early fills (the rule) against late fills (06:00-21:00 UTC), after costs

| Series | Early n | Early net R | Early gross R | Early 2x cost | Early month t | Late n | Late net R | Early − late (Welch t) |
|---|---|---|---|---|---|---|---|---|
| **Pooled holdout** | 4521 | +0.063 | +0.127 | −0.002 | +2.22 | 16285 | −0.034 | +0.097 (+3.83) |
| Set A | 1011 | +0.239 | +0.284 | +0.195 | +3.86 | 3593 | +0.010 | +0.230 (+4.12) |
| Set B | 3510 | +0.012 | +0.082 | −0.058 | +0.39 | 12692 | −0.046 | +0.058 (+2.06) |
| xau (A) | 83 | +0.413 | +0.617 | +0.209 | +1.68 | 622 | +0.052 | +0.360 (+1.44) |
| eurusd (A) | 173 | +0.233 | +0.266 | +0.200 | +1.70 | 780 | −0.013 | +0.246 (+1.74) |
| gbpusd (A) | 145 | +0.231 | +0.260 | +0.202 | +1.50 | 839 | +0.040 | +0.191 (+1.21) |
| usdjpy (A) | 281 | +0.313 | +0.343 | +0.284 | +3.15 | 689 | +0.012 | +0.301 (+2.91) |
| audusd (A) | 329 | +0.140 | +0.170 | +0.109 | +1.59 | 663 | −0.044 | +0.184 (+2.13) |
| nzdusd (B) | 1070 | −0.043 | −0.007 | −0.080 | −1.11 | 2193 | −0.038 | −0.005 (−0.12) |
| usdcad (B) | 383 | +0.005 | +0.055 | −0.044 | +0.06 | 2876 | −0.077 | +0.082 (+0.92) |
| usdchf (B) | 389 | −0.013 | +0.032 | −0.059 | −0.15 | 2916 | −0.019 | +0.006 (+0.07) |
| eurjpy (B) | 926 | +0.089 | +0.120 | +0.058 | +1.59 | 2325 | +0.009 | +0.081 (+1.37) |
| xag (B) | 742 | +0.012 | +0.204 | −0.180 | +0.18 | 2382 | −0.105 | +0.117 (+1.68) |

## In plain words

The rule does not pass the pre-registered bar (FAIL; missed: holm, cost2x). Early fills, pooled: +0.063R a trade after costs (n 4521, gross +0.127R, month t +2.22 over 263 months). Late fills of the same rule: −0.034R (n 16285); early minus late +0.097R (Welch t +3.83). NZD/USD, the cleanest slice (never in a breakout study, no verdict): early −0.043R (n 1070, month t −1.11), late −0.038R (n 2193). Gold 2006-09 early +0.413R (n 83); USD/JPY 2005-09 early +0.313R (n 281). Line 5 (2x costs) is missed whatever the four sibling studies report, so the FAIL does not wait on the family's Holm. Set A (2005-09) is strong (+0.239R, month t +3.86) and Set B (fresh markets, 2010 on) is flat (+0.012R, t +0.39): the early-fill lean held in the early years of the markets it was found on, not on markets it was never seen on. Early fills beat late fills on both sets (Welch t +4.12 and +2.06), on Set B early fills are about flat and late fills lose. The split was chosen from in-sample trades of 2010-2026 on the five main markets; whatever it shows here is read as the pre-registration says, never as an edge without its n and t.

## Sides and exits (pooled early fills)

Buys n 2144 +0.102R, sells n 2377 +0.028R; stopped 2278, out at 21:00 2243; worst drawdown −120.10R. Unfiltered base rule on the same days: n 20806, −0.013R a trade.

## By year (early fills, net R a trade, n)

| Year | Set A | Set B |
|---|---|---|
| 2005 | +0.354 (223) | — |
| 2006 | +0.327 (192) | — |
| 2007 | +0.152 (196) | — |
| 2008 | +0.110 (188) | — |
| 2009 | +0.235 (212) | — |
| 2010 | — | +0.138 (176) |
| 2011 | — | +0.036 (189) |
| 2012 | — | −0.024 (170) |
| 2013 | — | +0.022 (203) |
| 2014 | — | +0.196 (200) |
| 2015 | — | −0.002 (163) |
| 2016 | — | −0.109 (222) |
| 2017 | — | −0.101 (194) |
| 2018 | — | +0.035 (193) |
| 2019 | — | −0.109 (227) |
| 2020 | — | +0.207 (228) |
| 2021 | — | +0.085 (177) |
| 2022 | — | −0.100 (206) |
| 2023 | — | −0.250 (194) |
| 2024 | — | +0.066 (240) |
| 2025 | — | −0.061 (274) |
| 2026 | — | +0.162 (254) |

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

- It tests one cut (06:00 UTC) fixed before the run; no other hour is tried, and choosing one now on these trades would be a search.
- Set B costs are ASSUMED, not measured on the demo account; past years are charged today's costs; OANDA mid candles, not broker ticks.
- The phase tags in `trades.json` (D1 / H4 side and stage known at 00:00 UTC) are a description, never part of the verdict.
- Whatever the verdict, nothing here is an edge on its own and nothing live changes.

## Audit correction (23 Nov 2026)

- An adversarial audit re-checked look-ahead (the trade reads only the previous day's range and candles after the open; the phase tags read only candles closed by 00:00 UTC), costs, fills, the holdout windows (no 2010-2026 candle of the five main markets is loaded), the pins and the numbers (recomputed from `trades.json`). No defect changes a number or the verdict.
- Wording fixed: the plain-words paragraph said early fills beat late ones on Set B "only by losing less"; Set B early fills are +0.012R a trade (not a loss) and late fills −0.046R.
- Said plainly: the base rule's `daySkip` drops a day with fewer than 200 M5 candles by 21:00 UTC, which is known only after the day. It is the pinned base rule (a data-quality filter, unchanged on purpose). Holdout days it drops that had an early fill: 7 (+3.13R after costs in all); with them the pooled result moves by under 0.001R a trade and no line changes.

## Data and method

- xau (Set A): 271849 M5 candles 2006-03-19 → 2009-12-31, 989 weekdays in the set, 705 base trades; eurusd (Set A): 381404 M5 candles 2005-01-02 → 2009-12-31, 1304 weekdays in the set, 953 base trades; gbpusd (Set A): 379947 M5 candles 2005-01-02 → 2009-12-31, 1304 weekdays in the set, 984 base trades; usdjpy (Set A): 381168 M5 candles 2005-01-02 → 2009-12-31, 1304 weekdays in the set, 970 base trades; audusd (Set A): 379975 M5 candles 2005-01-02 → 2009-12-31, 1304 weekdays in the set, 992 base trades; nzdusd (Set B): 1273553 M5 candles 2009-11-01 → 2026-11-23, 4399 weekdays in the set, 3263 base trades; usdcad (Set B): 1272857 M5 candles 2009-11-01 → 2026-11-23, 4399 weekdays in the set, 3259 base trades; usdchf (Set B): 1264888 M5 candles 2009-11-01 → 2026-11-23, 4399 weekdays in the set, 3305 base trades; eurjpy (Set B): 1278151 M5 candles 2009-11-01 → 2026-11-23, 4399 weekdays in the set, 3251 base trades; xag (Set B): 1191774 M5 candles 2009-11-01 → 2026-11-23, 4386 weekdays in the set, 3124 base trades. Source: the shared toolkit's OANDA mid M5 cache; 2010-2026 on the five main markets not read.
- Base rule imported unchanged (gold-vol-breakout buildDays / daySkip / vbTrade, k 0.5, both sides, stop at the UTC open, out at the 20:55 candle close). Early = the first fill's candle starts before 06:00 UTC (both orders cancelled at 06:00 otherwise). Cost a round trip: max(toolkit COSTS, the market's own study cost: gold $0.60, silver $0.03, forex 0.000045 x entry + 0.5 pip); 2x reported. Month sums by exit month over each set's span (empty months 0), Set A and Set B months pooled; p one-sided from the toolkit's t. Gate: the unfiltered rule at each study's own cost against its published by-year results on the overlapping holdout years.
- To repeat: `node research/edge/holdout-vb-early/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git).


## Clock correction (23 Nov 2026, review)

The toolkit applied the 2007 US daylight rule to 2005-2006, so in a few weeks of each of those years the New York day ended an hour early. Re-run with the old rule before 2007 (1st Sunday of April to last Sunday of October). No figure of this report changed; the verdict stands.
