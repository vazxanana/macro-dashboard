# Does market regime decide when MERIDIAN's setups work?

> **Clock correction, 10 Nov 2026.** NOT RE-RUN: the published numbers were computed on the old candle clock. Details: the last section of this page.

**Short answer: no.** The live Scalp loses in every regime we can measure. No gate fixes it out of sample. Intraday is close to break-even everywhere. Swing has one weak lead (a mid-range D1 ADX band). It passes the formal screen, but the evidence is thin, so it should be tracked on paper, not adopted.

## What was tested

- **Signals.** The council engine itself, unchanged: `council/engine.mjs` (`msAnalyze`, `buildSetup`) for Scalp (M15→M1), Intraday (H1→M5) and Swing (H4→H1).
  - The replay loop follows `council/backtest.mjs`: a 5-minute step, the last 720 candles of each timeframe plus the forming candle, a resting order or a market fill, the pending-order expiry, the 12-candle freshness check, target 1, no break-even, and the `clean.mjs` bad-print cleaner.
  - Coach settings are today's: buf 0.15, minRisk 1.1, minRR 1.2.
- **Data.** HistData M1 from Jan 2018 to Oct 2026 (EST converted to UTC) for gold, EUR/USD, GBP/USD, AUD/USD, USD/CAD and USD/CHF. That is about 640k replay steps per market and 83,749 closed signals.
- **Systems.** Each was judged at signal level, the same way as `backtest.json`:
  - **Scalp, live rule:** against D1, not in Asia or the overlap session, no AUD/USD, reward:risk ≥ 1.2.
  - **Intraday:** today's config filters (against D1, not Asia, reward:risk 1.2–10).
  - **Swing:** the owner rule (against D1).
- **Costs.** One spread per round trip, as in `backtest.mjs`: 1 pip for forex, 0.3 for gold. That averages about 0.13R per Scalp. Everything is reported net unless marked gross; probe.txt also has a 1.5× cost stress.
- **Regimes.** All are measured at signal time from closed candles only:
  - **Volatility:** D1 ATR(14) percentile against the last 250 days (`atrPctD`); H4 ATR percentile against about 250 days (`atrPctH4`); the percentile of 5-day realised volatility (`rvPct`).
  - **Trend:** D1 ADX(14) (`adx`); distance from the D1 MA20 and MA50 in ATR, signed toward the trade (`dist20`, `dist50`) and unsigned (`adist20`).
  - **Range:** last week's range against the 8 weeks before it (`wkExp`); this week's range so far against the average week (`wkSoFar`); today's range so far against the D1 ATR (`dayRange`).
  - **Calendar:** day of week, week of month.
  - **News:** NFP day (first-Friday rule), FOMC day (the Fed's published dates, hard-coded), a CPI window (Tue–Thu between the 10th and the 15th; an approximation, since there is no release data), and the trading day before or after NFP and FOMC.
  - **H4 trend:** with or against the trade.
- **Walk-forward.**
  - Quintile cut points are taken from 2018–2023 (in-sample).
  - For each feature, the gate with the best IS expectancy is chosen. A gate is any range between two quintile cuts, or "only / not" one category, and it must keep at least 30% of IS trades.
  - Each chosen gate is then judged untouched on 2024 – Oct 2026 (out-of-sample).
  - **Variants tried:** 722 in total, counting 178 gates per system, the context run, and 12 neighbour checks.

## Baselines (net R per trade)

| system | IS 2018-23 | OOS 2024-26 | gross IS / OOS | years positive |
|---|---|---|---|---|
| Scalp, live rule | n 9,551, **−0.187**, −1,788R, DD −1,802R, t −10.9 | n 4,532, **−0.229**, −1,038R, DD −1,059R, worst streak 31, t −9.0 | −0.055 / −0.095 | 0 of 9 |
| Intraday, config | n 3,782, −0.078, t −3.0 | n 1,666, −0.015, t −0.4 | −0.017 / +0.053 | 1 of 9 |
| Swing, owner rule | n 529, −0.086, t −1.4 | n 202, +0.049, t 0.4 (+31R of it in 2026) | −0.066 / +0.071 | 2 of 9 |

- **Scalp by year:**

  | year | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
  |---|---|---|---|---|---|---|---|---|---|
  | net R/trade | −0.12 | −0.27 | −0.18 | −0.18 | −0.17 | −0.20 | −0.26 | −0.22 | −0.21 |

- **Scalp by market (OOS):** every market is negative, gold −0.14 and EUR/USD −0.31.
- **Scalp by month in 2026:** 2 of 10 months are positive.
- **Scalp with D1:** −0.21 over 16,430 trades. Neither D1 side works on this data.

**Caveat.** The 30-day replay that put the live rule in place showed +0.33R per trade on Kraken candles with OANDA D1 labels. Three things differ here, any of which could explain the gap:
- the feed: HistData spot against Kraken;
- the D1 label: computed from HistData daily candles, not OANDA's;
- the portfolio rules: this is a signal-level replay without the exposure caps or the re-entry blocker.

Even so, the live rule is negative in all 9 years and in 8 of the 10 months of 2026, so the fair reading is that 30 days was a favourable window.

## Does regime decide? Quintile tables

Full tables are in [tables.md](tables.md). The mean rank correlation of quintile expectancy between IS and OOS, across the 10 continuous features, measures whether a regime ranking that held before 2024 still held after it:

| system | mean rank corr IS→OOS | reading |
|---|---|---|
| Scalp, live | 0.08 | no persistence |
| Intraday | −0.13 | no persistence (slightly reversed) |
| Swing | 0.27 | weak |

- **Scalp:** all 50 quintile cells (10 features × 5 quintiles) are negative in IS **and** in OOS. The best cell is about −0.10R. The calendar and news buckets are all negative in OOS too, from −0.06 to −0.32. No regime makes the live Scalp profitable.

## The gates (chosen IS, judged OOS)

Only gates that pass the formal OOS screen are listed. The screen is: OOS n ≥ 100 (≥ 50 for Swing), OOS expectancy > 0 net, better than the baseline, and positive in ≥ 2 of 3 OOS years. Everything else is in tables.md.

| system | gate | IS n / exp | OOS n / exp / R / DD / t | OOS years 24 / 25 / 26 | after the robustness probe |
|---|---|---|---|---|---|
| Scalp | none of 14 passes. The best IS pick, `atrPctH4 ≥ 0.54`, does −0.217 OOS (n 1,934) | – | – | – | **FAIL** |
| Scalp | owner's example, `D1 ATR pct 30–80` (not IS-picked) | 3,379 / −0.190 | 1,909 / −0.239 / −456R | −0.27 / −0.18 / −0.27 | **FAIL** |
| Intraday | `dayRange 0.41–0.69` | 1,513 / −0.027 | 665 / +0.024 / +15.9R / −41.8 / 0.37 | +0.13 / +0.06 / −0.14 | FAIL: IS negative; −0.018 at 1.5× cost |
| Intraday | `adist20 < 1.27` | 2,265 / −0.055 | 985 / +0.014 / +13.8R / −48.8 / 0.26 | +0.00 / +0.01 / +0.04 | FAIL: IS negative; −0.019 at 1.5× cost |
| Intraday | `wkExp ≥ 1.04` | 1,514 / −0.058 | 604 / +0.009 / +5.7R / −40.8 / 0.13 | +0.02 / +0.12 / −0.09 | FAIL: same |
| Intraday | `wkSoFar < 0.53` | 1,512 / −0.066 | 641 / +0.020 / +12.6R / −40.7 / 0.31 | +0.07 / +0.14 / −0.15 | FAIL: same |
| Swing | **`D1 ADX(14) 19.4–29.2`** | 211 / **+0.113** (t 1.05) | 67 / **+0.290** / +19.4R / −9.3 / **1.46** | +0.08 / +0.20 / +0.64 | **weak PASS → INCONCLUSIVE** |
| Swing | `dist20 0.02–1.26` | 211 / +0.009 | 90 / +0.293 / +26.3R / 1.70 | +0.10 / −0.08 / +1.03 | FAIL: OOS profit is 2026 only (+0.04 without it) |
| Swing | `wkExp < 0.875` | 211 / −0.010 | 99 / +0.335 / +33.2R / 1.91 | +0.19 / −0.49 / +1.55 | FAIL: 2026 only (−0.004 without it) |
| Swing | `dayRange ≥ 0.72` | 212 / +0.059 | 111 / +0.171 / 1.10 | +0.09 / −0.29 / +0.94 | FAIL: 2026 only (−0.05 without it) |
| Swing | `atrPctD 0.08–0.45` | 195 / +0.018 | 79 / +0.157 / 0.83 | +0.06 / −0.09 / +0.50 | FAIL: 2026 only |
| Swing | `news != none` | 169 / −0.061 | 88 / +0.145 / 0.89 | −0.25 / +0.01 / +1.34 | FAIL: 2026 only |

### The one lead: Swing only when D1 ADX(14) is between about 19 and 29 (trending, but not stretched)

- **Neighbouring bands agree OOS:**

  | ADX band | OOS R/trade | OOS n | t |
  |---|---|---|---|
  | 18–28 | +0.42 | 78 | 1.95 |
  | 20–25 | +0.52 | 37 | – |
  | 15–30 | +0.32 | 115 | 1.91 |
  | ≥ 20 (one-sided) | +0.02 | – | – |
  | < 25 (one-sided) | +0.22, 2026-driven | – | – |

  The one-sided versions do not hold, so the effect needs both edges of the band.
- **Positive without 2026:** +0.118 over 45 trades.
- **Robust to costs:** +0.277 at 1.5× cost.
- **Weaknesses:**
  - IS years are positive in only 4 of 6 (2018 −0.25, 2023 −0.22).
  - In OOS, EUR/USD and GBP/USD are negative, and most of the profit is USD/CHF and USD/CAD.
  - OOS t is 1.46 on 67 trades.
  - It was the 2nd-best IS pick of 14 for Swing. The 1st, `rvPct ≥ 0.56`, failed OOS (−0.09).
  - With 722 variants tried, a t of 1.5 is well within what chance produces.
- **Status:** Swing is a shadow setup today, not live. See [proposal.md](proposal.md) for tracking it on paper.

## Verdict

| system | verdict |
|---|---|
| **Scalp (live rule)** | **FAIL.** No regime gate. The setup loses in every regime, every year and every market on 8.8 years of M1 data, before and after costs. The regime question is moot until the setup itself has an edge. Separately, the live Scalp rule deserves a closer look: on this data it is −0.23R a trade from 2024 to 2026, which contradicts the 30-day replay that justified it (see the caveat above). |
| **Intraday** | **FAIL.** Four gates pass the formal screen at +0.01 to +0.02R, but each had negative IS expectancy and turns negative at 1.5× cost. That is noise around zero. |
| **Swing** | **INCONCLUSIVE.** D1 ADX 19–29 is a weak, plausible lead (formal pass, OOS t 1.46, n 67). Track it; don't trade it. |

Owner's example "trade Scalp only when D1 ATR pct is between 30 and 80": −0.190 IS and −0.239 OOS. Rejected.

## Reproduce

```
git archive origin/council-data research/candles/{EURUSD,GBPUSD,AUDUSD,USDCAD,USDCHF,xau-histdata} | tar -x -C $RAW
node research/edge/regime/replay.mjs $RAW/research/candles <market> $OUT/<market>.json   # ~25-35 min per market on a busy 4-core box
node research/edge/regime/analyze.mjs $OUT $RES      # tables.md, analysis.json
node research/edge/regime/probe.mjs $OUT              # probe.txt (neighbours, per year, per market, 1.5x cost)
```

The trade-level files (about 15 MB) are not committed; the replay rebuilds them deterministically.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Not re-run: computed on the old clock.** Reason: this is a long engine replay over 8 years of M1 candles for several markets, and the machine time was spent on the studies that feed a live system or the Academy. The loader is fixed, so the next run is on the corrected clock; the commands are on this page. Until then every number here is an old-clock number. What the old clock touched here: the session and day-of-week splits and the daily candle boundary were an hour late in Europe's summer. The robustness ledger entry "Scalp live rule, 2018-26 HistData" quotes this study.
