# Portfolio rules: caps, sizing, correlation and drawdown (edge research, paper only)

> **Clock correction, 10 Nov 2026.** The ICT stream built from HistData was re-run on the corrected candle clock and the portfolio was recomputed. No verdict field changed. Details: the last section of this page.

**Verdict: no rule change passes.** The live caps hold up: a dollar cap of 2 and a 3-hour Scalp re-entry wait each scored best in-sample, and both held out-of-sample. The ICT desk's own `sizeOf` was the best sizing scheme that uses no future data. Two ideas looked promising but are **inconclusive**:
- an ICT cap on index trades in the same direction
- a rolling Kelly tilt on the council

**What to change is the size of one R.** At 1R per trade, the council sleeve takes about 2,500 trades a year. Its expected worst drawdown in a year, at the 95th percentile, is about **205R**. The same figure for ICT is about **26R**.

## Data (all net of costs)

| stream | source | window | IS / OOS split |
|---|---|---|---|
| Council live sleeve | `backtest-150d-m30.json` (engine replay; the file has a `closed` column, which the cap simulation needs). Two setups: Scalp against D1, not in Asia, no AUD/USD; and gold M30→M1 against D1. Pending orders hold a slot. Cost is one spread. | Jun 6 – Nov 3 2026 | split at Sep 14 2026 (first two thirds IS) |
| ICT A-setups, long history | the `ict-filters` driver, copied as `ict-stream.mjs` (unchanged apart from the `ONLY=` per-market switch): `ict/tracker.mjs` signals plus `ict/replay.mjs` simulate on HistData NQ/ES/GC. Cost is 2 ticks. | 2018 – Oct 2026 | 2018–23 / 2024–26 |
| ICT desk replay | `ict/replay.json` (CNBC; NQ ES YM RTY GC), A-setups, cost 1 tick + spread | Aug 2025 – Nov 2026 | used only as a second out-of-sample check |
| Council 30-day | `backtest.json`, which uses OANDA D1 labels but has no close times | Oct 8 – Nov 7 2026 | correlation only |

The ICT baseline matches the `ict-filters` result exactly: IS n 910, +0.091R/trade; OOS n 411, +0.125R/trade.

## Baseline (live caps, fixed 1R)

| | n | WR | exp R | total R | maxDD R | t | daily Sharpe |
|---|---|---|---|---|---|---|---|
| Council IS (net) | 673 | 0.293 | −0.008 | −3.5 | 53.4 | −0.11 | −0.12 |
| Council OOS (net) | 339 | 0.319 | +0.094 | +31.9 | 62.6 | 0.81 | 1.56 |
| Council IS / OOS (gross) | | | +0.067 / +0.168 | +45.2 / +56.8 | | | |
| ICT IS 2018–23 (net) | 910 | 0.378 | +0.091 | +82.8 | 34.2 | 1.76 | 0.67 |
| ICT OOS 2024–26 (net) | 411 | 0.404 | +0.125 | +51.3 | 16.0 | 1.72 | 0.93 |

ICT R by year: 2018 −14.4, 2019 +20.6, 2020 +28.7, 2021 −7.1, 2022 +29.4, 2023 +25.7, 2024 +18.6, 2025 +20.3, 2026 +12.4.

Council by group, IS → OOS, in R per trade:

| group | IS | OOS |
|---|---|---|
| FX Scalp | −0.22 | −0.08 |
| crypto Scalp | −0.02 | −0.03 |
| gold Scalp | +0.40 | +0.62 |
| gold M30→M1 | +0.07 | +0.44 |

In this file the forex D1 labels come from Kraken. The live trader has used OANDA labels since 7 Nov, and the 30-day file with OANDA labels shows the forex sleeve positive.

## 1. Correlation of daily R

The window is 2026-06-06 to 10-30. Daily R is booked on the close day, and flat days count as 0.

- **Between systems, the correlation is about zero.**
  - Council sleeve vs ICT indices: −0.08.
  - Council sleeve vs ICT gold: +0.04.
  - Council gold M30 vs ICT gold: −0.20.
- **Between markets, the average pairwise correlation is about zero.**
  - Council FX + gold: 0.00.
  - Council crypto: 0.12.
  - 30-day OANDA file: −0.03.
  - ICT indices (CNBC): 0.02.
  - ICT NQ–ES over 2018–26: 0.24.
- **The one strong cluster is gold inside the council.** Gold Scalp and gold M30→M1 correlate at **0.67**. They are the same market, often the same direction, open at the same time. The 2-trades-per-market cap is what bounds this.

### Dollar clustering (EUR/USD, GBP/USD, USD/CHF, USD/CAD, gold)

This uses uncapped council trades on different dollar markets that were open at the same time.

| pair type | pairs | corr of R | P(lose \| the other loses) | base loss rate |
|---|---|---|---|---|
| same-dollar direction | 552 | 0.00 | 0.74 | 0.70 |
| opposite direction | 754 | −0.05 | 0.67 | 0.70 |
| ICT: same-direction index trades (NQ+ES) | 166 | **0.60** | **0.86** | |

On these M1 Scalp stops, same-dollar trades barely co-move. The stops are small, so the trades are decided by each pair's own noise, not by the dollar. The dollar cap earns its keep by cutting the number of trades, not by cutting correlation. Index trades on the ICT side are strongly clustered.

## 2. Caps

### Council: 80 combinations

The grid was: per market 1/2/3/∞ × dollar cap 1/2/3/4/∞ × re-entry 0/3/6/12 h. Each combination was replayed in time order through the trader's rules: no opposite side on a market, pending orders count toward the caps, re-entry blocked after a same-way Scalp loss.

One knob at a time around the live setting, as daily Sharpe IS → OOS:

| knob | values | IS Sharpe | OOS Sharpe |
|---|---|---|---|
| dollar cap | 1 / **2** / 3 / 4 / ∞ | −0.33 / **−0.12** / −0.24 / −0.21 / −0.24 | 0.97 / **1.56** / 1.29 / 1.26 / 1.26 |
| re-entry h | 0 / **3** / 6 / 12 | −0.89 / **−0.12** / −0.42 / −1.87 | 1.31 / **1.56** / 1.72 / 1.81 |
| per market | 1 / **2** / 3 / ∞ | −0.93 / **−0.12** / 0.12 / 0.51 | 0.91 / **1.56** / 1.57 / 1.67 |

All caps together against none: uncapped scores IS Sharpe −1.11 and OOS 1.03, with OOS max DD 91.7R against 62.6R with the live caps. **The caps are worth keeping.**

The joint in-sample best was per-market ∞, dollar cap 1, re-entry 6 h. It made OOS +23.9R against +31.9R, with the same Sharpe of 1.56 and DD 32.8 against 62.6. That is a lower-risk, lower-return trade-off, not an improvement: **FAIL**.

### ICT: 6 combinations

The grid was: per market 1/2 × same-direction index cap 1/2/∞.

| | IS exp | IS DD | IS Sharpe | OOS n | OOS exp | OOS R | OOS DD | OOS Sharpe |
|---|---|---|---|---|---|---|---|---|
| live (1 per market) | +0.091 | 34.2 | 0.67 | 411 | +0.125 | +51.3 | 16.0 | 0.93 |
| IS best: 2 per market, **1 same-direction index trade** | +0.098 | 29.8 | 0.74 | 378 | +0.149 | +56.5 | 12.6 | 1.12 |
| desk CNBC replay, live | | | | 239 | +0.265 | +63.3 | 16.2 | 1.73 |
| desk CNBC replay, index cap 1 | | | | 198 | +0.168 | +33.3 | 12.3 | 1.14 |

The index cap passes on HistData: every OOS year is positive (+13.8 / +27.9 / +14.8). It fails on the desk's own 4-index CNBC replay, so it is **INCONCLUSIVE**. A softer version to try later: split one R across same-direction index trades instead of blocking them.

## 3. Sizing

Each scheme is rescaled so that its average in-sample weight is 1, and the schemes are compared on OOS results. "Kelly" here means a per-market tilt of μ/σ² relative to the pooled μ/σ², capped at 0–2×. The rolling version uses only trades already closed.

| scheme | ICT IS Sharpe | ICT OOS Sharpe | ICT OOS R / DD | council IS Sharpe | council OOS Sharpe | council OOS R / DD |
|---|---|---|---|---|---|---|
| fixed 1R | 0.67 | 0.93 | 51.3 / 16.0 | −0.12 | 1.56 | 31.9 / 62.6 |
| vol-scaled (1/σ of last 50, 0.5–2×) | 0.65 | 0.88 | 46.9 / 16.5 | −1.15 | 1.54 | 27.6 / 57.4 |
| Kelly tilt from in-sample | 0.86* | 0.92 | 56.7 / 13.4 | = fixed (pooled IS μ ≤ 0) | | |
| Kelly tilt, rolling | 0.63 | 0.88 | 50.4 / 13.8 | **2.45** | **2.21** | **53.2 / 57.9** |
| Kelly tilt, rolling, 0.25× floor | 0.68 | 0.90 | 49.7 / 13.2 | 2.17 | 2.16 | 50.0 / 55.3 |
| ICT live `sizeOf` | **0.70** | **1.16** | 73.8 / 17.4 | | | |

\* fitted on the in-sample data itself.

- **ICT:** keep `sizeOf`. Volatility scaling and Kelly add nothing out-of-sample.
- **Council:** the rolling Kelly tilt is better in both halves and in 5 of 6 months. However, the OOS is only 51 days of one regime, and the tilt mostly moves size towards gold and away from crypto and FX, which amounts to choosing markets. **INCONCLUSIVE.** Paper-track it next to the live sleeve.

Absolute Kelly, as the fraction of equity per 1R:
- ICT: full Kelly 3.7% (IS) to 5.7% (OOS); quarter Kelly **0.9–1.4%**.
- Council sleeve: full Kelly 0.64%; quarter Kelly **0.16%**.

## 4. Monte Carlo

Each run uses 10,000 paths of 365 calendar days, built from 5-day blocks of real days. The i.i.d. trade bootstrap is shown for contrast.

| book (fixed 1R unless noted) | p50 DD | **p95 DD** | p99 DD | P(DD ≥ 20R) | recovery from max DD, median / p95 (days) | max DD not recovered within the year | P(losing year) |
|---|---|---|---|---|---|---|---|
| ICT, OOS 2024–26 days | 13.0 | **26.3** | 34.2 | 15% | 48 / 153 | 43% | 16% |
| ICT, 2018–26 days | 14.7 | **29.9** | 38.5 | 24% | 51 / 155 | 47% | 22% |
| ICT OOS, `sizeOf` | 13.3 | 26.4 | 33.8 | 16% | 42 / 138 | 37% | 11% |
| ICT OOS, index cap 1 (inconclusive) | 11.4 | 23.0 | 29.7 | 9% | 46 / 146 | 39% | 12% |
| Council sleeve, live caps | 102 | **205** | 259 | 100% | 51 / 160 | 49% | 24% |
| Council sleeve, uncapped | 207 | 408 | 513 | 100% | 69 / 172 | 72% | 56% |
| ICT + council (council R = 0.05 ICT R) | 12.0 | **23.3** | 30.1 | 10% | | | 9% |
| ICT + council (0.10) | 14.2 | 27.6 | 36.0 | 19% | | | 9% |
| ICT + council (0.25) | 25.5 | 49.7 | 63.7 | 75% | | | 12% |

The i.i.d. trade bootstrap gives almost the same ICT DD (25.0R p95), which agrees with the near-zero clustering.

## Recommendation

1. **Caps:** keep the dollar cap at 2, 2 trades per market, and the 3-hour re-entry wait. Each is the in-sample best on its own knob and holds out-of-sample. Removing them doubles the drawdown. Do not raise the dollar cap; 3 and 4 were worse in both halves.
2. **Sizing:**
   - Keep fixed R with ICT `sizeOf`.
   - Size the two systems separately. **ICT about 0.75% of equity per 1R**: the 95th-percentile one-year DD is about 26R, which puts it at about 20% of equity, slightly under quarter Kelly. **Council sleeve about 0.1% per trade**, which makes 205R about 20%.
   - Combined in one book: council R at **0.05× an ICT R** keeps the p95 DD at about 23R and cuts P(losing year) from 12% to 9%.
3. **Expected max DD at 95%:** about **26R a year** for the ICT book, about 205R for the council sleeve at 1R per trade, and about 23R for the combined book at 0.05×.
   - P(a −20R drawdown within a year): about 15% for ICT and about 10% for the combined book. It is certain for the council sleeve at 1R.
   - Recovery from the year's worst drawdown takes a median of about 50 days and 150 days at the 95th percentile. In about 40% of years it is not recovered by year-end.

## Caveats

- **Variants tried: 119.**
  - council caps: 80
  - ICT caps: 6, plus 5 checks on the CNBC replay
  - sizing schemes: 11
  - Monte Carlo books: 17
- The council evidence covers 150 days of one regime. Its forex D1 labels differ from the live trader's.
- The gold-systems research published statistics only, without trade lists, so the gold replica, Mosha and gold-trend books are not included.
- The YM/RTY index cluster appears only in the 15-month CNBC replay.

## Files

- `portfolio.mjs`: the whole study
- `ict-stream.mjs`: the ICT trade-stream builder
- `build-result.mjs`: writes `result.json`
- `detail.json`: every number above

To reproduce:

```
ONLY=nq|es|gc node research/edge/portfolio/ict-stream.mjs <candles dir> ict-<m>.json   # one market per process (memory)
node research/edge/portfolio/portfolio.mjs backtest-150d-m30.json ict-nq.json,ict-es.json,ict-gc.json ict/replay.json backtest.json research/edge/portfolio
node research/edge/portfolio/build-result.mjs
```

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**The HistData ICT stream (`ict-stream.mjs`) was re-run on the corrected clock on 10 Nov 2026 and `portfolio.mjs` recomputed. No rule or cap was changed.** `detail.json` and `result.json` hold the new numbers. The portfolio also reads live council-data files (`ict/replay.json`, `backtest.json`), which have moved on since the first run: a control run of the old loader on today's files differs from the published `result.json` in 66 of 1,111 numbers (the replay cross-check rows). Between that control and the corrected run, **none of the 17 verdict fields changed**. The verdict above stands: no rule change passes.
