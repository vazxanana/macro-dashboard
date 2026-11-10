# ICT index long-only: a real edge, or just being long equities?

> **Clock correction, 10 Nov 2026.** Re-run on the corrected candle clock. The verdict is unchanged: the dip-buying candidate still passes (out-of-sample n 117, +0.434R, t 2.99). One pooled row moved from INCONCLUSIVE to FAIL. Details: the last section of this page.

**Question.** `ict-universe` found that the gold A-rule (buys only, stop 0.3-0.75x the daily ATR, size 1, no break-even)
passes on NAS100/SPX cash. Equities rose over 2018-26. Is the profit an edge, or just being long?

**Verdict: PASS. The edge is real, but it is a dip-buying edge, not an all-weather long.**
- **Bear windows:** the buys beat random longs in all five bear/correction windows (NAS100+SPX pooled). The buys made
  +0.10R a trade in those windows, while random longs with the same stop, exit and costs lost −0.11R. The edge over
  random longs is +0.22R a trade (t 1.96).
- **Trend gate:** the buys make the most money when the index trend is DOWN. With a negative 20-day return they make
  +0.21R IS and +0.48R OOS a trade. Drift-adjusted OOS is +0.47R, with a block-bootstrap 95% CI of +0.19 to +0.75 (it
  excludes 0). The result is positive in 9 of 9 years. With a positive 20-day return, the buys earn only drift: −0.02R
  OOS, drift-adjusted −0.05R.
- **Mirror sells fail:** sells with the same rule lose IS (−0.06R). In the bear windows they make money (+0.15R), but
  random shorts make more (+0.25R). So the sell signal has no edge. The asymmetry is real: on indices, the iFVG model
  only works as a buy after a sell-side sweep.
- **Ungated buy rule (as in ict-universe):** drift-adjusted OOS is +0.13R, but the CI is −0.03 to +0.30, so it does not
  exclude 0. On its own it would be INCONCLUSIVE.
- **Proposal** (`proposal.md`): on NQ/ES only, replace the index A-rule with "gold-rule buys when the last daily close is
  below the close 20 trading days earlier".

## Method
- **Same code as the desk:**
  - `signals()`, `isASetup()`, `sizeOf()`, `MIN_GRADE`, `RISK_FLOOR` and `RISK_CAP` from `ict/tracker.mjs`.
  - `simulate()` from `ict/replay.mjs` (post-#413).
  - The data loader is copied from `ict-universe/universe.mjs`: HistData M1 2018-01 to 2026-10, EST → UTC, resampled to
    5m, H1 and D1 with the 17:00 NY rollover, halt hour dropped.
  - One open trade per stream.
- **Streams per market:**
  - `goldbuy`: the gold A-rule as live, `isASetup(g,'gc')`.
  - `goldsell`: its exact mirror (sells with the same stop band, size 1, gold exit). This is the only new rule code.
  - `index`: the desk's current NQ/ES A-rule, both directions, with DOL sizing and break-even at +1.5R.
  - Random controls: 1 in 10 H1 closes, both sides, stop 0.3-0.75x ATR, gold exit, same costs.
- **Costs:** 0.02% of price + 0.25 point per round trip (council `spreadOf`), converted to R per trade. Gross is in
  result.json; it is about 0.03-0.05R a trade better.
- **Drift adjustment:**
  - `adj` = net minus the control's mean for the same market, year and side.
  - `adjRg` = the same, but also matched on the D1 200-MA regime. This is stricter.
  - The bear-window "edge" subtracts the control's mean in the same window and side.
- **Regime:** uses only the last completed D1 candle at the signal. One test is close vs its 200-day MA, the other is the
  sign of the 20-day return.
- **Bootstrap:** calendar-month blocks, resampled with replacement, 5000 reps. Pooled NAS+SPX trades from the same month
  stay in one block, so the two markets' correlation is kept.
- **Periods:** IS 2018-2023, OOS 2024 to 2026-10. The index A-rule was designed on 2023-26 cash data, so its OOS is not
  clean. Its 2018-23 window is.

## Baseline vs candidates (NAS100 + SPX pooled, net of costs)

| rule | IS n | IS WR | IS exp | IS R | IS DD | IS t | OOS n | OOS WR | OOS exp | OOS R | OOS DD | OOS t | drift-adj IS / OOS (CI) | yrs + | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **baseline: current index A-rule (both sides)** | 550 | 35% | +0.03 | +15.7 | 30.3 | 0.45 | 247 | 38% | +0.14 | +35.4 | 15.7 | 1.44 | +0.08 / +0.17 (−0.03..+0.40) | 6/9 | baseline |
| gold-rule buys, ungated (ict-universe) | 694 | 45% | +0.16 | +112.7 | 18.4 | 2.91 | 338 | 44% | +0.15 | +50.3 | 19.2 | 1.90 | +0.11 / +0.13 (−0.03..+0.30) | 9/9 | INCONCLUSIVE |
| **gold-rule buys, 20-day return < 0** | 256 | 45% | **+0.21** | +53.2 | 13.7 | 2.20 | 114 | 54% | **+0.48** | +54.7 | 9.3 | 3.21 | +0.17 / **+0.47 (+0.19..+0.75)** | **9/9** | **PASS** |
| gold-rule buys, 20-day return > 0 | 437 | 45% | +0.13 | +57.5 | 13.5 | 1.90 | 224 | 39% | −0.02 | −4.4 | 28.2 | −0.22 | +0.06 / −0.05 | 8/9 | FAIL |
| gold-rule buys, close < 200-MA | 179 | 48% | +0.30 | +53.2 | 11.5 | 2.54 | 21 | 57% | +0.67 | +14.0 | 4.1 | 1.68 | +0.23 / +0.49 | 7/9 | FAIL (OOS n 21) |
| gold-rule buys, close > 200-MA | 429 | 44% | +0.12 | +52.0 | 18.4 | 1.74 | 317 | 43% | +0.11 | +36.2 | 21.6 | 1.44 | +0.06 / +0.10 | 6/9 | FAIL |
| mirror: gold-rule sells | 655 | 35% | −0.06 | −41.4 | 62.9 | −1.10 | 299 | 40% | +0.11 | +34.0 | 24.9 | 1.20 | −0.02 / +0.17 | 5/9 | FAIL |
| gold rule, both sides | 1349 | 40% | +0.05 | +71.3 | 35.2 | 1.32 | 637 | 42% | +0.13 | +84.3 | 26.1 | 2.17 | +0.04 / +0.15 | 8/9 | FAIL (OOS < baseline) |
| buys above 200-MA + sells below 200-MA | 588 | 40% | +0.04 | +24.9 | 35.7 | 0.73 | 343 | 43% | +0.12 | +42.5 | 22.1 | 1.57 | −0.01 / +0.12 | 5/9 | FAIL |

**Worst losing streaks (IS / OOS):** baseline 12/8, ungated buys 12/11, buys with 20-day return < 0: 10/9.

**Per market, buys with 20-day return < 0:**
- NAS100: IS +0.21 (n 125), OOS +0.56 (n 62). Drift-adjusted OOS +0.55, CI +0.31 to +0.83. 6 of 9 years positive
  (2019, 2020 and 2022 slightly negative).
- SPX: IS +0.21 (n 131), OOS +0.38 (n 52). Drift-adjusted OOS +0.37, CI −0.06 to +0.76. **9 of 9 years positive.**
- Neither market reaches OOS n ≥ 100 alone. The pooled desk does (114).

## (1) Bear / correction windows: buys vs random buys in the same window (pooled)

| window | gold-rule buys exp (n, R) | random buys exp | **buy edge** | gold-rule sells exp (n) | random sells exp | sell edge | index rule exp (n, R) |
|---|---|---|---|---|---|---|---|
| 2018 Q4 | +0.31 (29, +8.9) | −0.21 | **+0.51** | +0.45 (26) | +0.53 | −0.08 | −0.19 (25, −4.8) |
| Feb-Mar 2020 | −0.01 (19, −0.3) | −0.09 | **+0.08** | +0.09 (18) | +0.16 | −0.07 | −0.06 (11, −0.7) |
| 2022 | +0.03 (115, +3.1) | −0.14 | **+0.17** | +0.11 (115) | +0.24 | −0.14 | +0.21 (104, +21.7) |
| Aug 2024 | +0.59 (7, +4.1) | +0.28 | **+0.33** | −0.66 (7) | −0.04 | −0.60 | +0.97 (7, +6.8) |
| Apr 2025 | +0.28 (8, +2.2) | +0.15 | **+0.14** | +0.53 (10) | −0.04 | +0.62 | +1.60 (5, +8.0) |
| **all windows** | **+0.10 (178, +18.1)** | **−0.11** | **+0.22 (t 1.96)** | +0.15 (176) | +0.25 | −0.10 (t −0.79) | +0.20 (152, +30.9) |

- **Buys:** they beat random longs in 5 of 5 windows pooled, and in 9 of 10 market-windows. The exception is SPX
  Apr 2025, n = 3. The bootstrap CI of the pooled edge, −0.08 to +0.56, does include 0.
- **Sells:** they lose to random shorts in 4 of 5 windows. If the buy profit were drift, mirror sells would earn the
  drift back in bear windows, and they do not.
- **Index rule:** it holds up in bear windows, mostly in 2022, with +21.7R pooled.

## (2) Regime gate: does it make money when the index trend is down?
**Yes, and that is where the edge is.**

| gold-rule buys | all-years exp (n) | t | regime-matched drift-adj | t |
|---|---|---|---|---|
| close < D1 200-MA | +0.34 (200) | 2.99 | +0.26 | 2.31 |
| close > D1 200-MA | +0.12 (746) | 2.26 | +0.08 | 1.51 |
| 20-day return < 0 | +0.29 (370) | 3.64 | +0.27 | 3.34 |
| 20-day return > 0 | +0.08 (661) | 1.47 | +0.02 | 0.44 |

Random buys earn about the same in either state: +0.05R a trade with a 20-day return below 0, +0.04R above it. So the
extra profit in down-trends comes from the signal's timing, not from the market. The ICT reading is "buy in discount
after sell-side liquidity is taken". In plain terms, it is a short-term dip-buy on indices that tend to rise.

## (4) Current index rule (both directions) on NQ/ES, split by side
- **Buys:** IS +0.11 (173), OOS +0.38 (64).
- **Sells:** IS −0.01 (377), OOS +0.06 (183).
- **How it compares:**
  - The current rule's profit also comes mostly from its buys. Its "against the daily bias" condition already leans
    toward dips.
  - Its 2018-23 result is flat: +0.03R a trade, +15.7R, drawdown 30R.
  - The proposed rule has twice the per-trade expectancy and more total R, with a smaller drawdown, in both windows.

## (5) Per year, NAS100+SPX pooled, net R (drift-adjusted exp per trade in brackets)

| rule | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* |
|---|---|---|---|---|---|---|---|---|---|
| index A (baseline) | −10.0 (−0.16) | −7.5 (+0.03) | +19.0 (+0.27) | −13.2 (−0.10) | +21.7 (+0.23) | +5.6 (+0.15) | +14.5 (+0.19) | +8.5 (+0.14) | +12.4 (+0.19) |
| gold-rule buys | +17.0 (+0.16) | +31.8 (+0.12) | +17.1 (+0.07) | +23.3 (+0.12) | +3.1 (+0.17) | +20.5 (+0.03) | +22.6 (+0.03) | +19.4 (+0.22) | +8.3 (+0.14) |
| buys, 20d ret < 0 | +10.7 | +1.6 | +3.7 | +17.2 | +2.3 | +17.7 | +8.7 | +18.4 | +27.6 |
| gold-rule sells | −0.7 (−0.08) | +3.9 (+0.22) | −14.4 (−0.02) | −29.8 (−0.23) | +12.2 (−0.14) | −12.6 (+0.07) | +13.5 (+0.25) | +11.9 (+0.15) | +8.6 (+0.11) |
| random buys (exp) | −0.01 | +0.16 | +0.06 | +0.10 | −0.14 | +0.15 | +0.15 | −0.04 | −0.06 |

*2026 runs to 30 Oct.

- **Ungated buys:** drift-adjusted, they are positive in 9 of 9 years. The years are individually small: +0.03 to
  +0.22R a trade.
- **Block-bootstrap CIs:** all-years drift-adjusted +0.11R, CI −0.01 to +0.22, P(>0) 0.97. OOS +0.13, CI −0.03 to +0.30.
  NAS alone OOS +0.15, CI −0.01 to +0.34. SPX alone OOS +0.09, CI −0.10 to +0.29.

## Multiple testing and caveats
- **Variants tried:** 26 in all:
  - 3 rule streams and 2 controls.
  - 2 regime gates × 2 states × 3 streams.
  - 4 gated combinations.
  - 5 windows.
  - Each on 2 markets plus the pool.
- **The 20-day gate:** it was one of the two gates specified in the question, not one found by search. Its pooled OOS
  t = 3.21 survives a rough 26-test Bonferroni bar (about 3.0). Its IS t = 2.2 does not.
- **Expect less live.** OOS (+0.48) is far above IS (+0.21). Plan on about +0.2R a trade.
- **Correlated markets:** NAS and SPX trades often fall on the same days. The month-block bootstrap keeps them together,
  but "n = 114" overstates the number of independent bets. SPX alone has a CI that includes 0.
- **Cash vs futures:** the data is HistData cash, while the desk trades futures. The 20-day return should be computed
  on the same continuous daily series the tracker already uses for its bias.
- **What is lost:** the proposed rule drops the index rule's sell A-setups (pooled +0.06 OOS, −0.01 IS). Short exposure
  in a crash then comes only from not buying.
- **Strong up-trends:** in years like 2019 and 2023, the gate leaves most buys untaken: 2019 makes only +1.6R gated vs
  +31.8R ungated.
- Paper research only. No live rule, config, tracker or replay code was changed.

## Files
- `run.mjs`: runs the desk's code on one market and writes the trades with their regime tags.
  `ICTU_DATA=<candles dir> node run.mjs nas100|spx out.json`.
- `analyze.mjs`: computes everything above and writes result.json.
  `node analyze.mjs nas100.json spx.json result.json`.
- `result.json`: baseline, every candidate per market and pooled (IS/OOS, gross, drift-adjusted with CI, years), bear
  windows and all bootstrap cells.
- `proposal.md`: the proposed NQ/ES rule change.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Re-run on the corrected clock on 10 Nov 2026. No rule, parameter, filter or cost was changed.** A control run of the old loader on the same day, with today's code, reproduced the published file exactly, so every change below is the clock and nothing else. ICT stays a separate, paper-only edge; nothing on the desk, the tracker or the replay was changed. `result.json` holds the new numbers.

| | Before: in-sample n, R a trade, t; out-of-sample n, R a trade, t | After |
|---|---|---|
| Current index A-rule (the baseline) | 550, +0.028, 0.45; 247, +0.143, 1.44 | 561, +0.045, 0.73; 256, +0.153, 1.59 |
| NAS100 + SPX, gold rule buys, 20-day return below 0 | 256, +0.208, 2.20; 114, +0.479, 3.21: PASS | 254, +0.234, 2.46; 117, +0.434, 2.99: PASS |
| NAS100 + SPX, gold rule buys, all | 694, +0.162, 2.91; 338, +0.149, 1.90: INCONCLUSIVE | 685, +0.202, 3.58; 342, +0.152, 1.98: FAIL |
| NAS100, gold rule both sides | 650, +0.081, 1.40; 312, +0.270, 2.93: PASS | 641, +0.117, 1.99; 317, +0.225, 2.53: PASS |

Of the 24 candidate verdicts, one changed (the pooled row above). **The verdict is unchanged.**
