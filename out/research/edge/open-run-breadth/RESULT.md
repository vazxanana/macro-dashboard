# Open run breadth: does the NQ open run work on other index opens?

> **Clock correction, 10 Nov 2026.** Only the HistData S&P 500 cross-check was affected. It was re-run on the corrected candle clock; it agrees with OANDA on more days now, and no verdict field changed. Details: the last section of this page.

Paper research only. No live rule, config or tracker was changed.

**Question.** The NQ New York open run made nothing over 2004-22 and +0.32R a trade over 2023-26 (#511). Is that 2023+
effect a broad change in how index opens trade, so that the same rule also pays on ES, YM and the DAX? Or is it NQ only?
The rule, sessions, costs and pass bar were pre-registered and pushed before any of these candles were downloaded
(`preregistration.md`).

## Verdict: NQ-ONLY. The rule does not carry over to any other market, in either period

- **None of the three new markets passes even the 2023-26 half of the bar.** Every one loses money after costs in 2023-26.
  The pre-registered label is **NQ-ONLY**.

  | Market | Cost (pts) | 2004-22 net R/trade (n, t) | 2023-26 net R/trade (n, t) | Gross 2004-22 | Gross 2023-26 | Late (L) | Early (E) |
  |---|---|---|---|---|---|---|---|
  | NQ (reference) | 1.37 | −0.122 (1,561, −3.26) | **+0.303** (309, 3.37) | +0.107 | +0.337 | pass | fail |
  | ES (SPX500) | 1.0 | −0.303 (1,159, −7.45) | −0.097 (222, −1.04) | +0.029 | +0.018 | fail | fail |
  | YM (US30) | 5.5 | −0.124 (1,124, −2.97) | −0.229 (276, −3.28) | +0.079 | −0.157 | fail | fail |
  | DAX (DE30) | 2.0 | −0.074 (1,322, −1.96) | −0.109 (234, −1.25) | +0.065 | −0.050 | fail | fail |
  | ES + YM + DAX pooled | | −0.163 (3,605, −7.07) | −0.151 (732, −3.17) | | | | |

- **This is not a cost problem.** Before costs, the 2023-26 run is +0.02R on ES, −0.16R on YM and −0.05R on DAX. NQ is
  +0.34R. There is no gross edge on any new market for costs to remove.
- **NQ's 2023-26 years have no echo elsewhere.**

  | Year | NQ | ES | YM | DAX |
  |---|---|---|---|---|
  | 2023 | +0.269 | +0.048 | −0.187 | +0.139 |
  | 2024 | +0.289 | −0.050 | −0.312 | −0.081 |
  | 2025 | +0.220 | −0.238 | −0.032 | −0.364 |
  | 2026 (to 6 Nov) | +0.436 | −0.152 | −0.427 | −0.076 |

  NQ is positive in 4 of 4 years. The three new markets are positive in 2 of 12 market-years.
- **Even on NQ's own winning days the other markets do not follow.**
  - In 2023-26, ES fired on 102 of the same days as NQ, on the same side. The two R series are correlated at 0.67.
    On those days NQ made +0.14R a trade and ES made −0.02R.
  - DAX on the same days and side as NQ: DAX −0.26R, NQ +0.38R (n 47).
  - YM on the same days and side as NQ: YM −0.43R, NQ −0.02R (n 59).
- **More markets means less edge, not more.** In 2023-26, the equal-weight daily basket of all four markets makes
  −0.023R a day (t −0.49). NQ alone makes +0.303R.

**So:** the 2023+ open run is not a broad change in index-open structure. ES, YM and DAX trade the same macro news, and
ES and YM open at the same minute. They show nothing in 2023-26, before or after costs. This leaves two explanations for
NQ:
- an NQ-specific quirk of the last four years, or
- the rule being fitted to NQ 2023-26, the window it was built on (#486 already rated its t 3.67 as just under the
  multiple-testing bar).

This study cannot tell those two apart. Neither one gives a reason to expect the run to keep working. Nothing here
argues for adding markets or for more size. This study supports #511's advice: if NQ is kept, it is a regime bet with the
existing CUSUM review as its kill switch. The owner decides; nothing was changed.

## What was tested (exactly as pre-registered)

- The rule is the live `nqOpenSweep` + `nyflip` rule copied from #511 `lib.mjs`, made session-generic:
  1. O is the open of the session-open 1-minute candle.
  2. Price runs at least 0.08% of O through O. Within 15 minutes of the first cross, a 1-minute candle closes back across
     O in the reclaim colour.
  3. Trade with the run, entering at that close.
  4. Stop at the same distance on the other side.
  5. Only when the local-midnight price lies ahead of the trade.
  6. 10R cap; from +2R the stop trails 1R behind the best price.
  7. Out at open + 90 minutes.
- **Stop buffer: 0.011% of O** for every market. This is the fraction the live code declares in its unused `buf`
  parameter. The live NQ code uses a fixed 2 points, which does not carry over between markets priced from 5,000 to
  45,000. On NQ the two are equivalent: at 1 point of cost, +0.312R vs +0.318R in 2023-26.
- **Sessions.**
  - ES and YM: 09:30 New York; scan 09:31-10:59; out 11:00; midnight is 00:00 New York.
  - DAX: 09:00 Berlin (the Xetra open); scan 09:01-10:29; out 10:30; midnight is 00:00 Berlin.
  - FTSE was dropped before any data was read. The site's OANDA proxy (`api/_oanda.js`) does not serve UK100.
- **Data.**
  - OANDA 1-minute mid candles through the site's keyless proxy (`meridianx.dev/md/bars`, free), 2004 to 6 Nov 2026.
  - NQ uses the #511 cache.
  - Clean years use the #511 thresholds. The only year dropped inside the windows is ES 2017: 91.4% of the scan minutes are
    present, against a threshold of 93%.
- **Costs.** All-in round trips from the repo's cost study (`research/edge/costs`): MNQ 1.37, MES 1.0, MYM 5.5 points, and
  DAX 2.0 points. Each cost is a constant number of points, so it weighs more in the early years, when prices were lower.

### Calibration gate (passed before any new-market number was read)

The generic code was run on the #511 NQ cache with the live 2-point buffer and a 1-point cost. It reproduces #511 exactly:
−0.018R (n 1,560) in 2004-22 and +0.318R (n 309) in 2023-26.

## Sensitivity (net R/trade, 2004-22 | 2023-26)

| Variant | NQ | ES | YM | DAX |
|---|---|---|---|---|
| Primary | −0.122 \| **+0.303** | −0.303 \| −0.097 | −0.124 \| −0.229 | −0.074 \| −0.109 |
| Gross | +0.107 \| +0.337 | +0.029 \| +0.018 | +0.079 \| −0.157 | +0.065 \| −0.050 |
| Cost ×2 | −0.351 \| +0.269 | −0.636 \| −0.211 | −0.328 \| −0.302 | −0.212 \| −0.168 |
| Cost scaled to price (2023-26 %) | +0.075 \| +0.305 | −0.064 \| −0.090 | +0.007 \| −0.228 | +0.010 \| −0.109 |
| Midnight filter off | −0.214 \| +0.195 | −0.316 \| −0.124 | −0.127 \| −0.249 | −0.115 \| −0.107 |
| Midnight behind (skipped trades) | −0.323 \| +0.078 | −0.330 \| −0.155 | −0.129 \| −0.272 | −0.165 \| −0.097 |
| Buffer 0 | −0.128 \| +0.287 | −0.338 \| −0.086 | −0.139 \| −0.212 | −0.082 \| −0.083 |
| Fixed 2R exit (no runner) | −0.137 \| +0.253 | −0.294 \| −0.080 | −0.127 \| −0.203 | −0.075 \| −0.119 |

- No variant makes any new market positive in 2023-26, except ES gross (+0.018, t 0.2).
- The halves of 2023-26 tell the same story:

  | Market | First half | Second half |
  |---|---|---|
  | NQ | +0.276 | +0.329 |
  | ES | +0.017 | −0.210 |
  | YM | −0.260 | −0.199 |
  | DAX | +0.021 | −0.239 |

- With costs scaled to price, the 2004-22 numbers are close to zero on every market: +0.075 on NQ, −0.064 on ES, +0.007 on
  YM, +0.010 on DAX. That is #511's finding again: the early period has a small gross pattern that a realistic cost
  removes. Only NQ has anything in 2023-26.

## Checks

- **HistData SPXUSD M1, 2018-26** (council-data), same code, ES at 1 point:
  - 2018-22: −0.125R (n 313). 2023-26: −0.110R (n 200).
  - On the 443 days both feeds fire, they take the same side on 437. The mean difference in R is −0.014.
  - The ES result is not an OANDA artefact.
- **Dependence on NQ's days** (2023-26, trades on the same date as an NQ trade):

  | Market | Shared days | Same side | Correlation of R (same side) | Market R/trade on shared same-side days | NQ R/trade on them |
  |---|---|---|---|---|---|
  | ES | 113 | 102 | 0.67 | −0.02 | +0.14 |
  | YM | 78 | 59 | 0.17 | −0.43 | −0.02 |
  | DAX | 77 | 47 | 0.36 | −0.26 | +0.38 |

  - When ES and NQ fire on the same day and side, NQ makes only +0.14R a trade, and ES makes nothing.
  - On its other 207 days, NQ makes about +0.38R a trade.
  - So most of NQ's 2023-26 R comes from days when the same rule on ES did not fire or took the other side. That points
    to something about NQ, not about the 09:30 open.
- **DAX midnight price.** OANDA's DE30 candles stop overnight (Eurex hours), so the DAX midnight price is usually the
  prior evening's last price. This is the pre-registered fallback. With the filter switched off the result does not change
  (−0.107R in 2023-26), so the definition is not the cause.
- **One fetch fix, made before results were run.** The 1-minute request looked back 3 hours for the last price before
  midnight. On DAX Mondays, and on DAX in 2004-05, that found nothing: a midnight price was available on only 79% of
  days, below the clean-data threshold. This was seen in the data-quality check, before any trade was computed.
  `fetch.mjs` now adds the last 5-minute candle of the previous 4 days, which is the pre-registered "last candle before
  00:00, however far back". For ES and YM it touched at most 4 days a year.

## Files

- `preregistration.md`: rule, sessions, costs and pass bar, pushed before the data.
- `lib.mjs`: the session-generic copy of the #511 rule and trade loop, plus the market table.
- `fetch.mjs`: OANDA download through the site proxy, per market and year, with the midnight lookback fill.
- `run.mjs`: calibration gate, per-market runs, sensitivity, dependence, basket and the HistData check. It writes
  `result.json`, which includes every trade.

Re-run:

```
node research/edge/open-run-breadth/fetch.mjs <cacheDir> spx500   # likewise us30, de40
node research/edge/nq-open-oos/fetch.mjs <nqCacheDir> 2003
node research/edge/open-run-breadth/run.mjs <cacheDir> <nqCacheDir> [<council-data research/candles/spxusd-histdata>]
```

The candle caches (about 75 MB) are not committed.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. The study's own runs are OANDA and never read those files. Only the HistData SPXUSD cross-check did, through `nq-open-oos/load.mjs`, which read the labels as New York time (one hour early in about four weeks a year from 2019).

**Re-run on the corrected clock on 10 Nov 2026. No rule was changed.** A control run of the old loader reproduced the published `result.json` exactly (51,724 numbers). On the corrected clock 57 numbers differ, all inside the `histdataES` block:

| HistData ES 2018-26 | Before | After |
|---|---|---|
| Early part: n, R a trade, t | 313, −0.125, −1.53 | 319, −0.123, −1.53 |
| Late part: n, R a trade, t | 200, −0.110, −1.17 | 195, −0.078, −0.81 |
| Days both feeds signal / same side | 443 / 437 | 463 / 462 |

**The verdict is unchanged.**
