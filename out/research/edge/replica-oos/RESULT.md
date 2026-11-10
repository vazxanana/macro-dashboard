# Gold replica: out-of-sample test on 2017–2022

> **Clock correction, 10 Nov 2026.** The out-of-sample result on this page is OANDA and is not affected. One cross-check block in `result.json` (`histdataLive`) quotes the gold-systems run on the old clock; the corrected numbers are in `research/edge/gold-systems/`. Details: the last section of this page.

**Question.** The robustness audit (#486, `research/robustness.md`) rates the Gold replica **fragile**. Its +0.877R a trade over 212 trades (t 3.82) comes from the council replay of 2023–26, which is the same data the rule was fitted on. Does the exact live rule make money on 2017–2022, which the rule never saw?

**Verdict: FAIL. The replica does not hold before 2023.**

- **Out of sample (2017–2022):**
  - 115 trades, **−0.05R a trade** after a 0.30 spread (t −0.17), −5.9R in total.
  - Worst drawdown **−29.3R**.
  - With costs doubled: **−0.12R a trade** (−13.8R).
  - Bootstrap 95% CI for R a trade: −0.56 to +0.59. The chance that the mean is zero or below is 61%.
- **In sample (2023–26), same harness and costs:** 226 trades, +0.58R a trade (t 2.64), CI +0.17 to +1.02.
  - This run reproduces the claimed edge in sign and size (claimed +0.88R; the earlier HistData study found +0.62R).
  - So the out-of-sample failure comes from the period, not from the harness.
- **No trades at all in 2017 and 2021, and one in 2019.**
  - The volatility gate (20-day range in the top fifth of its own past year) was shut for nearly all of those years.
  - The six out-of-sample years contain only **9 calendar months with any trade**. All 115 trades fall in those 9 months.
- **The signals behind the live filter flip sign before 2023.**
  - Taken one by one, with no risk or sizing rules, the signals that pass the live filter (v5, with the D1 trend, gate open) make **+0.36R a trade in 2023–26 (n 281, t 2.0)** and **−0.37R a trade in 2017–22 (n 170, t −1.8)**.
  - Trades against the D1 trend do the opposite: −0.16R in 2023–26 and +0.17R in 2017–22. This matches the note in the `gold-d1-with` rule: "In 2019-22 the opposite held (D1-against better), so this is a last-4-years rule."
- **The sizing rules are what kept the loss small.** The MSNR tilt and the equity filter turn −0.29R a trade at flat size into −0.05R a trade.

**Recommendation.** Do **not** make the replica the cTrader mirror's priority Meridian sleeve. No live rule was changed; the owner decides.

- Its only evidence is the in-sample period.
- On data it never saw, it makes nothing, and it trades only in rare high-volatility months.
- If it stays live on paper, size it as an unproven regime bet. Plan for a drawdown of 30–40R; −40R is the worst seen in either 2017–22 replay.

## Results

All figures are net R per position: the first unit plus its add, sized as live. "x1" charges 0.30 per unit per round trip, the gold spread, as the council replay did. "fills" is `council/fills.mjs` `tradeCost`: the spread plus half a spread of slippage on the market entry and on any exit other than the target, about 0.60 per unit. "x2" charges 0.60 per unit. Because almost no position exits at its 10R target, fills and x2 come out almost the same. Win% counts positions with net R above zero, so a breakeven exit counts as a loss after costs. Max drawdown is measured on the closed-position equity curve.

### By year (2017–2022 out of sample; 2023–26 in sample, as a calibration)

| Year | n | Win% | R/trade (x1) | Total R | t | Max DD | R/trade (fills) | R/trade (x2) |
|---|---|---|---|---|---|---|---|---|
| 2017 | 0 | – | – | – | – | – | – | – |
| 2018 | 12 | 8% | −0.68 | −8.1 | −2.02 | −8.1 | −0.79 | −0.79 |
| 2019 | 1 | 0% | −1.65 | −1.7 | – | −1.7 | −1.81 | −1.81 |
| 2020 | 52 | 21% | +0.32 | +16.8 | 0.51 | −13.4 | +0.27 | +0.26 |
| 2021 | 0 | – | – | – | – | – | – | – |
| 2022 | 50 | 16% | −0.26 | −13.0 | −1.12 | −20.2 | −0.32 | −0.32 |
| **2017–22** | **115** | **17%** | **−0.05** | **−5.9** | **−0.17** | **−29.3** | **−0.12** | **−0.12** |
| 2023 | 36 | 19% | −0.27 | −9.7 | −0.87 | −11.8 | −0.35 | −0.35 |
| 2024 | 45 | 42% | +1.07 | +48.2 | 1.89 | −6.3 | +0.98 | +0.98 |
| 2025 | 71 | 25% | +0.71 | +50.7 | 1.59 | −13.7 | +0.68 | +0.68 |
| 2026 (to 6 Nov) | 74 | 30% | +0.56 | +41.7 | 1.62 | −15.7 | +0.55 | +0.55 |
| **2023–26** | **226** | **29%** | **+0.58** | **+130.8** | **2.64** | **−20.0** | **+0.53** | **+0.53** |

Before costs, 2017–22 makes +0.017R a trade, so the 0.30 spread (0.07R a trade on average) turns it negative. The median stop is $6.2 in 2017–22, against $14 in 2023–26.

### Halves

| Half | n | R/trade (x1) | Total R | t | Max DD | R/trade (x2) |
|---|---|---|---|---|---|---|
| 2017–2019 | 13 | −0.75 | −9.8 | −2.37 | −9.8 | −0.87 |
| 2020–2022 | 102 | +0.04 | +3.8 | 0.11 | −29.3 | −0.03 |
| 2023–2024 (in sample) | 81 | +0.47 | +38.4 | 1.36 | −11.8 | +0.39 |
| 2025–2026 (in sample) | 145 | +0.64 | +92.4 | 2.26 | −15.7 | +0.61 |

Neither out-of-sample half is positive after doubled costs.

### Bootstrap, 95% CI of R a trade (10,000 resamples)

| | Resample positions | P(mean ≤ 0) | Resample calendar months | P(mean ≤ 0) |
|---|---|---|---|---|
| 2017–22, x1 | −0.56 to +0.59 | 0.61 | −0.56 to +0.50 (9 months) | 0.61 |
| 2017–22, x2 | −0.63 to +0.52 | 0.69 | −0.63 to +0.43 | 0.69 |
| 2023–26, x1 | +0.17 to +1.02 | 0.003 | +0.00 to +1.18 (18 months) | 0.02 |

- The out-of-sample interval is wide because the sample is small and bunched into 9 months.
- That interval does not rule out a small edge. It does rule out confirming one.
- The in-sample estimate (+0.58) sits at the top of it.
- The in-sample minus out-of-sample difference is +0.63R a trade (Welch t 1.68).

### Why it fails: signal-level diagnostics (each signal as one unit, live exits, no gate or risk rules, 0.30 cost)

| Signals | 2017–22 n / R a trade / t | 2023–26 n / R a trade / t |
|---|---|---|
| v5, all | 3,554 / −0.19 / −4.4 | 2,387 / −0.01 / −0.2 |
| v5 + D1 with | 1,731 / −0.27 / −4.5 | 1,090 / +0.04 / 0.4 |
| **v5 + D1 with + gate open (the live filter)** | **170 / −0.37 / −1.8** | **281 / +0.36 / 2.0** |
| v5 + D1 with + gate shut | 1,556 / −0.27 / −4.3 | 804 / −0.08 / −0.8 |
| v5 + D1 against + gate open | 361 / +0.17 / 1.1 | 189 / −0.16 / −0.9 |

- The two filters picked on 2023+ data are the D1 direction and the volatility gate. Before 2023, both pick the losing side.
- The raw v5 signal loses in both periods.
- Share of v5 signals with the gate open, by year:

  | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
  |---|---|---|---|---|---|---|---|---|---|
  | 0% | 9% | 29% | 29% | 0% | 19% | 10% | 20% | 26% | 26% |

- Of the 175 signals in 2017–22 that passed v5, D1-with and the gate, 58 were skipped by the −1.5R day stop, 5 by the news window and 1 by the 3-open cap.
- First-unit exits: 102 stops (including breakeven and trail), 12 at 48 h, 1 at the target. 35 positions added a second unit.

### Cross-checks

- **D1 candles without OANDA's Sunday stub.** The stub is folded into Monday, as in the HistData study. This deviates from live. Result: 2017–22 139 trades, −0.08R a trade (t −0.30, DD −39.4R); 2023–26 268 trades, +0.48R a trade (t 2.54). Same conclusion.
- **HistData M1 study of the same live rule (`research/edge/gold-systems`).**
  - 2019–22: 137 trades, +0.43R a trade, t 1.27, DD −27.0R. By year: 2019 −1.7R (1), 2020 +37.5R (69), 2021 +2.6R (5), 2022 +20.7R (62).
  - That study is also short of significance. Its 2022 has the opposite sign to this OANDA replay (+20.7R against −13.0R).
  - The 2019 trade is the same trade with the same R (−1.654) in both, so the code paths agree. The difference comes from the feed (HistData against OANDA) and from that study's shortcuts (full-history trends, weekday D1, M1 management).
  - A rule whose result over the same years changes sign between two gold feeds is not robust. Neither replay reaches t 2 before 2023.

## Method

- **Data.**
  - OANDA XAU/USD mid candles, the live Trader's gold feed, read through the site's `/md/bars` proxy (`fetch.mjs`).
  - M5 from 2016-12-20, H1 from 2016-10, H4 from 2016-05, D1 from 2013-06, all to 2026-11-06.
  - M15 is built from M5.
  - Most of the history came from the meridian-swing cache; only the 2016–17 warm-up was fetched.
- **Same code as live.**
  - `replicaSignals`, `platformEngulfs`, `goldLevels` and `msnrDirection` are copied verbatim out of `council/trader.mjs` at run time (`research/edge/gold-systems/live.mjs`).
  - `msAnalyze` is the engine's own, through the checked speed copy (`research/edge/setups-promote/fastms.mjs`, identical output).
  - `stopFill` and `exitR` come from `council/fills.mjs`, so a stop hit through a gap fills at the gapped open, as live.
- **Live windows.**
  - The decision runs 4 minutes after each M5 close, which is the live lag.
  - Each timeframe is read as the live Trader reads it from OANDA: 720 candles, the last one still forming, rebuilt from the M5 candles closed by then.
  - H1 Origins, the H4 trend and the D1 trend come from those 720-candle windows.
  - The volatility gate and MSNR use the closed daily and H4 candles, including OANDA's Sunday stub, as live.
- **Live config as of 7 Nov 2026** (`USER_RULES` applied in order):
  - Signal: v5, meaning clear of live H1 Origins or the ★ engulfing, a stop of at least one M15 ATR, and the H4 trend against the trade. The trade must also be with the D1 trend; the engulfing-barrier exception is off.
  - Gate: the volatility gate is open when the 20-day range is in the top fifth of its own last year (`goldVolPct` 80, no 1.5% leg).
  - Entry filters: no entry from 08:25 to 08:45 ET; signals more than 8 minutes late are skipped; round-number stops apply.
  - Risk rules: at most 3 open; a −1.5R day stop; half size below the 50-trade equity average. The equity filter starts empty in 2017 and carries through to 2026.
  - Sizing: MSNR tilt, 1.5× when MSNR is against and 0.5× when with.
  - Exits:
    - breakeven at +2R;
    - a second unit at +1.5R, stopped at the first entry, managed from the same candle as live;
    - after +4R, a 1R trail behind the best price, capped at 10R;
    - out after 48 h.
- **Departures from live.**
  - There is no M1 data. The entry is the close of the M5 candle the decision falls in, about 1 minute after the live entry.
  - Trades are managed on M5 candles in the live loop's order: stop, target, time, then trail, breakeven and add. The stop is checked before the target inside a candle.
  - On the in-sample years these departures still reproduce the claimed edge (+0.58R against +0.62R on M1 HistData), so they do not explain the out-of-sample result.

## Files

- `fetch.mjs`: the OANDA candles (reuses a cache, fetches the warm-up).
- `replay.mjs`: the replay. Writes `trades.json`, with positions, every signal and the signal-level runs, plus `positions.json`.
- `analyze.mjs`: the statistics. Writes `result.json`.
- `positions.json`: every replayed position from 2018 to 2026 (entry time, side, size, MSNR, and each leg's R, size, risk and exit).
- `result.json`: all tables above, plus the sensitivity and HistData cross-check numbers.

## Reproduce

```
export SCR=/tmp/replica-oos
CANDLES_IN=<meridian-swing candle cache, optional> node research/edge/replica-oos/fetch.mjs $SCR/candles      # ~2 min from cache
CANDLES=$SCR/candles OUT_DIR=$SCR/out node research/edge/replica-oos/replay.mjs                                # ~40 s
D1_WEEKDAYS=1 CANDLES=$SCR/candles OUT_DIR=$SCR/wd node research/edge/replica-oos/replay.mjs                   # sensitivity
node research/edge/replica-oos/analyze.mjs $SCR/out/trades.json $SCR/wd/trades.json > research/edge/replica-oos/result.json
```

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. The gold-systems study, which this page quotes as a cross-check, read every year as New York time, so from 2019 its bars were one hour early in about four weeks a year (the weeks the US is on daylight time and Europe is not).

**Not re-run, because nothing here reads the HistData files.** The replay on this page uses OANDA candles and is not affected by the correction. `analyze.mjs` copies one cross-check block, `histdataLive`, from `research/edge/gold-systems/replica.json` when it runs; the block in the committed `result.json` is from the old-clock run (replica live 391 trades at +0.479R; on the corrected clock 394 at +0.462R). It could not be refreshed here because `analyze.mjs` needs the trade file of the OANDA replay, which is not kept in the repo. The verdict above does not rest on that block.
