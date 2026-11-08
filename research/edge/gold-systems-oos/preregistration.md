# Gold systems out-of-sample test: pre-registration

Written and committed **before** any replay result for 2006–2017 was computed. The criteria below decide the verdicts; nothing in them is changed after the results are seen. Anything added later is labelled as a post-hoc diagnostic in `RESULT.md`.

## Question

Four of Meridian's paper gold systems trade live in `council/trader.mjs`. Do they make money, **unchanged**, on gold history they were never built or tuned on? The answer decides which gold sleeve deserves the cTrader mirror budget. The gold replica already failed this test (#512).

| System | `k` | Live rule (config of 7 Nov 2026) | Claimed when approved |
|---|---|---|---|
| Gold trend | `gtrend` | Long only. A closed daily candle closes above the prior 20 daily highs, so the next run buys at market. Stop 2 × ATR(D1, 14) below. On each newly closed day the stop is lifted to (daily close − 2 ATR). No target, no time limit, one position. One add (`gold-trend-add`): when a closed day is ≥ +1R above the entry, a second unit buys at market with the same stop and exits with the first unit. | 2019–22 / 2023–24 / 2025–26: +0.31 / +1.07 / +2.42R a trade |
| Gold trend fast | `gtrend5` | The same rule on the prior **5** daily highs, run as its own position, with the same add. | 2019–22 / 2023–24 / 2025–26: +35.2 / +24.9 / +45.2R, with the add |
| Gold H4 trendline | `gtl` | Buys only. A closed H4 candle above the falling line through the last two confirmed H4 pivot highs (half-width 3, at most 120 candles apart). Entry only within 1 h of that H4 close, and only while `msnrDirection(H4, D1, 2, 2)` reads up. Buys at market. Stop 0.3 under the lowest low since the second anchor. After +2R the stop trails 1R behind the best price, capped at 10R. Out after 96 h. One trade per line, one position. | 2023–24 / 2025–26: +0.44 / +0.67R a trade |
| Gold daily engulf | `geg` | Buys only. A green daily candle closes above the high of the nearest red candle among the 3 before it. That red candle's range is the zone. The close must be above the 20-day average. A limit buy waits at the zone high for 20 days. It is cancelled by a daily close under the zone low. Stop 0.3 under the zone low. After +2R the stop trails 1R behind the best price, capped at 10R. Out 240 h after the fill. One trade per zone, at most 3 open or pending. | 2023–24 / 2025–26: +0.33 / +0.68R a trade |

`gmp` (momentum pullback) is a test system recorded as shadow trades and is **not** in scope.

## Data and periods

- **Source.** OANDA XAU/USD mid candles, the live Trader's gold feed since 7 Nov, read through the site's free `/md/bars` proxy. The timeframes are M5, H4 and D1, in UTC buckets. The daily candles include OANDA's Sunday-evening stub, as live. Free history starts on **2006-03-20**.
- **Out-of-sample (OOS) window, used for the verdict:** positions entered from **2006-07-01 to 2017-12-31**. All four rules were built and tuned on HistData spot gold from 2018 onwards, and the approvals judged them on 2019–26 or 2023–26. No study in the repo has run these four rules on pre-2018 gold. The first 3.5 months of data, from 2006-03-20, are warm-up only.
- **OOS halves**, fixed in advance, which happen to be two gold regimes:
  - **H1: 2006-07 to 2011-12**, the secular bull market from $600 to $1,900.
  - **H2: 2012-01 to 2017-12**, the 2013–15 bear market and the 2016–17 range.
- **Calibration window, not part of the verdict:** 2018-01-01 to 2026-11-06 on the same harness. It shows whether the harness reproduces the claimed in-sample edge, and it is the reference for the drawdown criterion.

## Harness: the live rules, unchanged

- **Signal and stop code** is replicated line for line from the live blocks of `council/trader.mjs`: Gold trend / Gold trend fast with the add, Gold H4 trendline, and Gold daily engulf. `msnrDirection` is copied verbatim from `trader.mjs` at run time. `stopFill`, `exitR`, `fillBarAmbiguous` and `spotSkip` are imported from `council/fills.mjs`.
- **Windows.**
  - A run happens 4 minutes after each M5 close. The live loop runs about every 5.6 minutes, around the clock.
  - Each run sees the timeframes as the live Trader reads them: 719 closed candles plus the forming one, which the systems drop (`bars.slice(0, -1)`).
  - The live freshness windows apply: a daily signal acts only within 24 h of its day's close, and an H4 trendline signal only within 1 h of its H4 close.
- **Entry.** A market entry takes the close of the M5 candle the run falls in. Live takes the last 1-minute close, about 1 minute earlier. A limit order fills at its price on the first M5 candle that touches it.
- **Management** follows the live "Manage open trades" loop on M5 candles, in the live order: fill, stop, target, time exit, then MFE, trail and add.
  - A stop gapped through fills at the candle's open.
  - Candles while spot is shut, and the 17:00–17:14 New York rollover candles, fill and stop nothing (`spotSkip`).
  - A limit fill and target in one candle counts as missed.
  - The daily ratchet of the trend legs runs after the management of that run, as live.
- **Costs.**
  - ×1: $0.30 per unit per round trip, the gold spread used in #512, charged as `0.30 / r0` R on every leg.
  - ×2: $0.60 per unit.
- **Unit of analysis.** A position is the first unit plus its add (trend legs), and its R is the sum of the legs' R. Positions are dated by entry for period splits. Expired and missed limit orders are not positions.
- **Verification** before any OOS number is read:
  - The replay is checked against the council's own recorded trades in council-data `trades.json` for the overlap (the systems went live on 5–7 Nov 2026), and against the live snapshot's state values: the 20- and 5-day highs, the last close, the engulf zone and the 20-day average.
  - The 2018–26 calibration is also compared with the HistData study `research/edge/gold-systems`.

## Statistics reported for each system

- n, win%, mean net R a position, total R and t (mean / sd × √n), by year, by OOS half, for the whole OOS window and for the calibration.
- The same at ×2 costs, and gross.
- Worst drawdown on the closed-position equity curve, in R.
- Bootstrap 95% CI of the mean, at ×1 and ×2: 10,000 resamples of positions, plus a calendar-month block bootstrap, with P(mean ≤ 0).
- Correlation between systems: Pearson correlation of **monthly** net R, ×1, over every calendar month of the OOS window (0 for a month with no closed position), for all 6 pairs. Also an equal-weight book of the four, with total R, t of monthly R and worst drawdown, against each system alone.

## Verdict rules (OOS 2006-07 to 2017-12, live config, positions)

- **FAILS** if the OOS mean net R a position is ≤ 0 at ×1 costs, **or** ≤ 0 at ×2 costs.
- **ROBUST** if it does not fail and meets **all** of these:
  1. t ≥ 2.0 at ×1 costs.
  2. The lower bound of the position-bootstrap 95% CI, at ×1 costs, is above 0.
  3. Both OOS halves (H1 2006-07 to 2011-12, H2 2012-17) have a mean net R above 0 at ×1 costs.
  4. At least half of the OOS calendar years that have a position are net positive at ×1 costs.
  5. The OOS worst drawdown, at ×1 costs, is no deeper than twice the worst drawdown of the same system in the 2018–26 calibration on this harness.
- **REGIME-BOUND** if it neither fails nor is robust: positive after both cost levels, but the edge does not survive one or more of tests 1–5.
  - The result names the tests it missed.
  - If H1 (the bull market) is positive and H2 is ≤ 0, the edge is read as long-gold bull-market exposure rather than a timing edge.

Only the four live configurations above are judged; four verdicts in all. Any variant (no add, other N, other k, sells) is a diagnostic and cannot change a verdict.

### Pre-declared diagnostic (not part of the verdict)

- **Random-entry control for the two trend legs.** Entries are made on random eligible days, matching each leg's OOS entry count, with the same 2 ATR chandelier exit and the same add. There are 1,000 seeds.
- The output is the percentile of the real leg's OOS mean within the control distribution. This separates "the breakout timing adds something" from "being long gold in that period paid".

## What the verdicts feed

- One recommendation to the owner: which gold sleeve, if any, earns the cTrader mirror budget.
- No live rule is changed by this study. It is paper research only.
