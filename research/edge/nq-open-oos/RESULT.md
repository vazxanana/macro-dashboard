# NQ New York open run: 22 years out of sample

> **Clock correction, 10 Nov 2026.** Only the HistData cross-check was affected: 721 trades at +0.126R (t 2.26) became 724 at +0.115R (t 2.06), and it now agrees with OANDA on more days. Every OANDA number and the verdict are unchanged. Details: the last section of this page.

Paper research only. No live rule, config or tracker was changed.

**Question.** The council's NQ New York open run made +0.33R a trade over 299 replay trades (2023-26). The robustness audit (#486, `research/robustness.md`) rates it *fragile*. Its t is 3.67 against a multiple-testing bar of 3.68, and a 2018-22 rebuild made about +0.03R. Does the rule have a real edge?

## Verdict: regime-dependent, not robust, not dead

- **Net of 1 point, the live rule is flat for 19 years before it was built.** From 2004 to 2022 it made **−0.018R a trade over 1,560 trades (t −0.53)**. Since 2023 it has made **+0.318R over 309 (t 3.45)**. The Welch t for the difference is 3.42.
- **Only 2023-26 is clearly positive.**
  - 2023-26 is the only run of good years: four in a row, +0.24 to +0.38R a trade.
  - Before that, 6 of 19 years were positive (2005, 2010, 2013, 2017, 2018, 2022). Only 2005 and 2013 came near today's level.
- **The pattern itself (gross, before costs) shows up in two of three eras.**

  | Era | Gross R/trade |
  |---|---|
  | 2004-13 | +0.18 (t 3.9) |
  | 2014-22 | **+0.02 (t 0.4)** |
  | 2023-26 | +0.34 (t 3.7) |

  In 2004-13 NQ traded at 1,500-3,500, so the stops were only 5-8 points. A 1-point cost then took 0.13-0.22R a trade and erased the gross edge. In 2014-22 there was nothing to erase. For nine years and 754 trades, a period that includes the bull markets of 2017, 2019 and 2021, the run did not work at all.
- **The pre-registered regime switch fails.** The switch was "trade only when the 09:30 open is above (or below) its 200-day average", with the side chosen on 2004-22 and checked on 2023-26.
  - Early data: above −0.012R (n 1,153), below −0.033R (n 407). There is no difference to choose from.
  - Late data: the chosen "above" side made +0.292R. The "off" side made +0.546R (n 32).
  - It fails all three of its pass conditions.
  - VIX history (Cboe, FRED, Yahoo) is blocked from this sandbox. A realised-volatility split was already tested on 5 Nov (council-data `research/log.md`) and found nothing.
- **So:** the run works in the current regime, and that regime has lasted four years. Nothing measurable says when it started, and nothing would tell us when it ends. Treat it as a regime bet with a kill switch, not as a structural edge.
  - It is not dead. 2026 is its best year (+0.38R), and most of 2026 came after the rules were set.
  - It is not robust. The long history says it can go nine years without paying, and it has no observable on/off signal.
  - Size it as a regime bet and keep the CUSUM review that is already in place. The owner decides; nothing was changed.

## Data

- **OANDA NAS100_USD 1-minute mid candles, 2003 to 3 Nov 2026.**
  - Source: the site's own keyless proxy `https://meridianx.dev/md/bars?sym=nas100&tf=1m&from=&to=` (free, no monthly cost). `fetch.mjs` keeps only what the rule reads: the 09:30-11:05 ET candles and the price at 00:00 ET.
  - 2003 is dropped as not clean: there is a midnight price on only 63% of days. Every year from 2004 to 2026 passes the cleanliness check: the 09:30 candle on ≥ 93% of weekdays, ≥ 93% of the minutes present, and a midnight price on ≥ 90% of days.
  - Before 2014 the quotes are thin (median 10-35 ticks a minute) and often skip the 00:00 minute. On those days the price standing at midnight is used: the close of the last candle before 00:00. Using only days that have a 00:00 candle gives the same answer: early −0.034R (n 1,020), late +0.312R (n 305).
- **Calibration against the council's own replay** (`research/replay-2w.json`, NQ futures file + feeds):
  - Of the council's 299 trades, 287 fire on the same day here and 286 on the same side.
  - On those 286 the council booked +93.2R and this replay gives **+93.18R**. The OANDA feed reproduces the council's record almost exactly.
- **Cross-check on HistData NSXUSD 2018-26** (council-data, same code):
  - 640 of 648 shared signal days take the same side, and the mean R difference is 0.002.
  - 2018-22: +0.020R (n 435). 2023-26: +0.286R (n 286).
  - The one disagreement is HistData's 2023 (+0.03R against +0.35R on OANDA and +29.5R in the council's futures file). That looks like a HistData problem for that year.
- **Costs.** 1 point round trip, taken off every trade as 1 / stop (pts) in R.

## The rule (council/trader.mjs, copied in `lib.mjs`)

`nqOpenSweep(bars, day, 570, 0, 0.0008, 0.00011)` + the nyflip block:

1. O is the 09:30 ET open.
2. Between 09:31 and 10:59, price runs at least 0.08% of O through O. Within 15 minutes of the first cross, a 1-minute candle closes back across O in the reclaim colour.
3. Trade **with** the run, entering at that close.
4. The stop is at the same distance on the other side: |entry − (extreme ∓ 2 points)|.
5. Only when the 00:00 ET open lies ahead of the trade.
6. 10R cap. The `nqRun` trail moves the stop 1R behind the best price from +2R.
7. Out at the open of the 11:00 ET candle.
8. The trade loop is copied too:
   - Stop before target within a candle.
   - A gap fills at the open.
   - Like the live loop, the first minute after the fill is not checked. Checking it ("strict") changes nothing: +0.039R vs +0.038R.

Note for the owner, not changed:
- `nqOpenSweep` computes `buf` (0.011% of the open) but never uses it. The live stop buffer is a fixed 2 points.
- The council's replay used the 0.011% buffer.
- On 2023-26 the two are almost equal: +0.312R vs +0.318R.
- Over 2004-22 the 0.011% buffer is worse: −0.060R vs −0.018R.

## Year by year (live rule, OANDA, net of 1 point)

| Year | n | R/trade | t | Total R | Max DD (R) | Gross R/trade | Median stop (pts) |
|---|---|---|---|---|---|---|---|
| 2004 | 69 | −0.135 | −1.07 | −9.3 | 16.7 | +0.055 | 5.5 |
| 2005 | 77 | +0.276 | 1.72 | +21.2 | 8.4 | +0.484 | 4.5 |
| 2006 | 83 | −0.065 | −0.51 | −5.4 | 16.8 | +0.132 | 5 |
| 2007 | 85 | −0.021 | −0.15 | −1.8 | 8.9 | +0.153 | 5.5 |
| 2008 | 95 | −0.047 | −0.34 | −4.4 | 17.6 | +0.092 | 7.8 |
| 2009 | 90 | −0.075 | −0.53 | −6.7 | 17.8 | +0.091 | 6.5 |
| 2010 | 88 | +0.071 | 0.54 | +6.3 | 10.1 | +0.236 | 6 |
| 2011 | 79 | −0.046 | −0.28 | −3.6 | 11.8 | +0.107 | 6.8 |
| 2012 | 75 | −0.037 | −0.25 | −2.8 | 10.6 | +0.108 | 7 |
| 2013 | 65 | +0.229 | 1.35 | +14.9 | 7.2 | +0.367 | 7.5 |
| 2014 | 77 | −0.106 | −0.70 | −8.2 | 20.8 | +0.006 | 9.1 |
| 2015 | 88 | −0.167 | −1.30 | −14.7 | 24.2 | −0.072 | 11.2 |
| 2016 | 74 | −0.157 | −0.95 | −11.6 | 24.2 | −0.056 | 9.6 |
| 2017 | 71 | +0.040 | 0.27 | +2.8 | 11.5 | +0.135 | 10.1 |
| 2018 | 90 | +0.154 | 1.04 | +13.8 | 10.6 | +0.213 | 17.8 |
| 2019 | 70 | −0.166 | −1.03 | −11.6 | 17.4 | −0.103 | 15.6 |
| 2020 | 90 | −0.076 | −0.50 | −6.8 | 11.3 | −0.040 | 30.6 |
| 2021 | 93 | −0.046 | −0.32 | −4.3 | 19.2 | −0.015 | 37.2 |
| 2022 | 101 | +0.047 | 0.33 | +4.8 | 10.2 | +0.071 | 45.6 |
| **2023** | 86 | **+0.345** | 1.85 | +29.6 | 5.7 | +0.377 | 31.8 |
| **2024** | 80 | **+0.302** | 1.67 | +24.1 | 9.2 | +0.330 | 36 |
| **2025** | 69 | **+0.236** | 1.32 | +16.3 | 5.2 | +0.259 | 47.2 |
| **2026** (to 3 Nov) | 74 | **+0.380** | 1.98 | +28.1 | 8.5 | +0.396 | 67.6 |
| **All 2004-26** | 1,869 | +0.038 | 1.18 | +70.6 | 60.7 | +0.141 | |

### Splits

| Split | n | R/trade | t | Max DD |
|---|---|---|---|---|
| First half by trades (Jan 2004 – Aug 2015) | 934 | −0.001 | −0.02 | 31.5 |
| Second half (Aug 2015 – Nov 2026) | 935 | +0.076 | 1.60 | 44.1 |
| Untouched: before the rule was built (2004-22) | 1,560 | −0.018 | −0.53 | 60.7 |
| Built on (2023-26) | 309 | +0.318 | 3.45 | 9.7 |

### Eras, by cost

| Era | Gross | Net, 0.5 pt (futures: 1 tick + fees) | Net, 1 pt (primary) |
|---|---|---|---|
| 2004-13 (n 806) | +0.178 (t 3.87) | +0.094 (t 2.05) | +0.010 (t 0.22) |
| 2014-22 (n 754) | +0.018 (t 0.37) | −0.015 (t −0.30) | −0.048 (t −0.96) |
| 2023-26 (n 309) | +0.343 (t 3.72) | +0.330 (t 3.59) | +0.318 (t 3.45) |

At 2 points of cost, 2004-22 is −0.136R (t −4.0). The early-era result depends entirely on cost, and only 2023-26 is insensitive to it.

### Walk-forward

1. **Parameters re-chosen each year.**
   - The method: each year, pick the best of 20 cells by total R over the previous three years, then trade that cell the next year. The cells cross the run size (0.04-0.14%), the midnight filter (on/off) and the exit (runner/2R).
   - Result for 2007-26: +0.026R (n 1,727, t 0.80).
   - Before 2023 it gives −0.039R (n 1,300). From 2023 on it gives +0.225R (t 3.02).
   - The live cell is the 2023-26 winner, and the selection process finds no edge before that.
2. **"Keep it while it works".** This trades the fixed rule in a year only when the previous two years summed above zero. It gives −0.090R in the years it was on before 2023 (n 568).

### Weekday, entry time and side (net R/trade)

| Cut | 2004-22 (untouched) | 2023-26 |
|---|---|---|
| Mon | −0.127 (n 280) | −0.085 (55) |
| Tue | +0.004 (333) | +0.615 (64) |
| Wed | −0.065 (291) | +0.192 (51) |
| Thu | +0.092 (349) | +0.586 (64) |
| Fri | −0.021 (307) | +0.217 (75) |
| Entry 09:31-09:44 | −0.009 (1,377) | +0.310 (280) |
| Entry 09:45-09:59 | −0.026 (117) | +0.936 (17) |
| Entry 10:00-10:29 | −0.298 (48) | −0.367 (12) |
| Entry 10:30-10:59 | +0.127 (18) | – |
| Buys | −0.016 (700) | +0.388 (135) |
| Sells | −0.019 (860) | +0.263 (174) |

- Mondays are the weakest day in both periods. Thursday is the best day early and second-best late.
- Entries from 10:00 to 10:29 lose in both periods (n 48 and 12).
- These are 11 cells looked at after the fact. None comes near a multiple-testing bar, so none is a filter. They are listed for the forward record only.
- Both sides lose before 2023 and win after it. The 2023-26 edge is not long-only beta.

### Other checks (2004-22 | 2023-26, net R/trade)

| Check | 2004-22 | 2023-26 |
|---|---|---|
| Midnight filter off | −0.092 | +0.202 |
| Midnight open behind (the skipped `nyflip-x` trades) | −0.183 | +0.076 |
| Fixed 2R exit instead of the runner | −0.025 | +0.253 |
| Stop buffer 0.011% of the open | −0.060 | +0.312 |

The midnight filter and the runner help in both periods. They do not create an edge where the core run has none.

## Pre-registration

The regime switch was written into `run.mjs` (header comment) before any regime split was computed:
- **Switch.** Today's 09:30 open vs the average of the previous 200 trading days' 09:30 opens: above or below. There is no look-ahead.
- **Side.** Chosen on the clean years before 2023.
- **Pass rule.** On 2023-26 the chosen side must meet all three conditions:
  - positive with t ≥ 2,
  - better than the other side,
  - not below the unfiltered late R a trade.
- **Result.** It chose "above" (−0.012 vs −0.033, Welch t 0.26: no real difference). On 2023-26, "above" made +0.292R (t 3.01) and "below" made +0.546R (n 32). It is lower than the unfiltered +0.318R. **Fail.**

No other switch was tried, so this one test is not a selection from many.

## Files

- `fetch.mjs`: OANDA download through the site proxy, per year into a cache directory.
- `lib.mjs`: the live rule and trade loop copied from `council/trader.mjs` / `council/fills.mjs`, plus stats.
- `load.mjs`: OANDA and HistData day maps.
- `run.mjs`: everything above. It writes `result.json`, which includes all trades.

Re-run:

```
node research/edge/nq-open-oos/fetch.mjs <cacheDir> 2003
node research/edge/nq-open-oos/run.mjs <cacheDir> <council-data research/candles/nsxusd-histdata> <council-data research/replay-2w.json>
```

The candle cache (about 26 MB) is not committed.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. The main run of this study is OANDA and never touched those files. Only the HistData cross-check did: `load.mjs` read the labels as New York time, so from 2019, in the weeks the US is on daylight time and Europe is not, the bar it took as the 09:30 open was really the 10:30 one.

**Re-run on the corrected clock on 10 Nov 2026. No rule, parameter or cost was changed.** Every OANDA number in `result.json` is identical to the old file (checked field by field). The HistData cross-check moved:

| HistData NSXUSD, same code, 1 point | Before | After |
|---|---|---|
| All years: n, R a trade, total R, t | 721, +0.126, +90.7, 2.26 | 724, +0.115, +83.0, 2.06 |
| 2018 (the files were on New York time that year) | 95, +10.1R | 95, +10.1R |
| Days both feeds signal / same side | 648 / 640 | 675 / 671 |
| Days only one feed signals (OANDA / HistData) | 103 / 73 | 76 / 49 |

The two feeds agree on more days now, which is what a corrected clock should do. **The verdict (regime-dependent: flat 2004-22, positive since 2023) rests on the OANDA run and is unchanged.** NSXUSD 2018, 2020, 2023 and 2024 are not certified years in the clock audit; every week of them that could be read agrees with the converter.
