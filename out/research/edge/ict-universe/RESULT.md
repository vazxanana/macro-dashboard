# ICT universe: does the iFVG model work outside gold?

> **Clock correction, 10 Nov 2026.** Re-run on the corrected candle clock. The basic gate now returns PASS for EUR/USD A-setups (out-of-sample n 141, +0.091R, t 0.77) and for the live gold rule; the t values are low and no market is added. The text below quotes the old numbers. Details: the last section of this page.

**Question.** Gold carries most of the ICT desk's replay profit. Does the same H1 iFVG model, with its rules unchanged
(post-#413 code), have an edge on the other liquid markets the council already watches: EURUSD, GBPUSD, USDJPY, AUDUSD,
USDCAD, USDCHF, XAGUSD and NAS100/SPX cash? And is GC's edge there in every year, or only in the 2024-26 gold bull run?

**Verdict.**
- **No new market passes. Do not add any FX pair or silver to the ICT desk.** Of the eight new markets, none passes the
  robustness gate. EUR/USD passes only the basic out-of-sample test, but loses in-sample and is positive in only 4 of 9
  years. Silver passes the basic test, but only because of the 2025-26 silver rally: it loses heavily in 2018-23 (t = -3.3).
- NAS100 and SPX cash pass, but the desk already trades them as NQ and ES. So this result supports the existing
  markets and adds nothing new. Their 2024-26 "out-of-sample" years were also used when the index A-rule was designed.
- **Gold's edge is not limited to the 2024-26 bull run, but most of it is gold's uptrend.** The live gold A-rule (buys only)
  is positive in 7 of 9 years: 2018-23 makes +0.13R a trade, and 2024-26 makes +0.10R. However, random gold buys with the
  same stop band, exit and costs make +0.06R a trade in 2018-23 and +0.14R in 2024-26. After subtracting that drift, the
  iFVG signal adds only +0.07R a trade before 2024 (t 0.9, not significant) and −0.05R from 2024. Since 2024, all of
  gold's ICT profit comes from being long gold.

## Method
- **Same code as the desk:** `signals()`, `isASetup()`, `sizeOf()` and `MIN_GRADE` from `ict/tracker.mjs`, and `simulate()`
  from `ict/replay.mjs`, including the post-#413 4-day gap guard. Busy rule as in `replay.mjs`: one trade per market, and an
  A-setup can only be blocked by another open A-setup. Nothing was reimplemented except the candle loading.
- **Data:** HistData M1 files from council-data `research/candles/`, 2018-01 to 2026-10. They are in EST with no DST, so
  +5 h converts them to UTC. They are resampled to 5m (exits), H1 (signals) and D1 (17:00 New York rollover, DST-aware). The
  CME halt hour (17:00 ET) is dropped, as the tracker's feed does. Sessions and the NFP filter use New York time, DST-aware,
  through the tracker's own Intl code.
- **Rule sets, used unchanged:**
  - *Index default.* The rule for a market without an aRule. A-setup = against the daily bias, grade ≥ 7, stop 0.3-0.75x
    the daily ATR, plus the tight A+ at half size; DOL sizing; break-even at +1.5R.
  - *Gold aRule.* A-setup = buys with a stop of 0.3-0.75x the daily ATR; size 1; no break-even.
  - Every market was run under both rule sets, for all signals (grade ≥ 3) and for A-setups only.
  - The **primary** cell is the A-setups under the rule set the desk would actually use: gold aRule for GC and silver, the
    index default for the FX pairs and the indices.
- **Costs** (one round-trip spread plus 1 tick, in price units, converted to R using each trade's own risk):
  - GC: 0.50 (ICT skill §12).
  - NAS/SPX: 0.02% of price plus 0.25 (council `spreadOf`).
  - EUR/AUD: 1.5 pips. GBP/CAD/CHF: 2 pips. JPY: 1.5 pips (0.015).
  - XAG: 0.03.
  - Net R = size × (R − cost). Gross is in result.json.
- **Periods:** in-sample (IS) 2018-2023; out-of-sample (OOS) 2024 to 2026-10. No parameter was tuned here, so IS is just
  another test window.
- **Drift control (new):**
  - For every market: random H1-close entries, buys and sells separately, about 1 in 25 candles, stop 0.3-0.75x the daily
    ATR, the gold exit, the same costs.
  - "Drift-adjusted" = each trade's net R minus the control's average for the same market, year and side.
  - A buys-only rule has to beat simply being long that market that year with the same stop and exit.
- **Gates:**
  - Preamble gate: OOS n ≥ 50, OOS net expectancy > 0, and at least 2 of 3 OOS years positive.
  - **Robust gate**, added after the first look because 40 cells were tested: also IS net expectancy > 0, at least 6 of 9
    years positive, and drift-adjusted OOS expectancy > 0.

## Primary cells: A-setups under the rule set the desk would use (net of costs)

| market | rules | IS n | IS exp | IS R | IS DD | IS t | OOS n | OOS WR | OOS exp | OOS R | OOS DD | OOS t | yrs + | drift-adj IS / OOS | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **GC (live)** | gold | 362 | **+0.13** | +45.8 | 20.0 | 1.50 | 165 | 44% | **+0.10** | +16.8 | 7.4 | 0.91 | 7/9 | +0.07 / **−0.05** | baseline (drift only since 2024) |
| NAS100 (= NQ) | index | 279 | +0.06 | +16.1 | 19.4 | 0.65 | 114 | 40% | +0.21 | +23.9 | 9.7 | 1.31 | 7/9 | +0.11 / +0.17 | PASS (already on the desk) |
| SPX (= ES) | index | 271 | −0.00 | −0.4 | 19.8 | −0.02 | 133 | 36% | +0.09 | +11.4 | 13.9 | 0.69 | 5/9 | +0.02 / +0.13 | inconclusive (already on the desk) |
| EUR/USD | index | 291 | −0.03 | −7.3 | 27.4 | −0.35 | 140 | 43% | +0.11 | +15.1 | 11.4 | 0.90 | 4/9 | +0.02 / +0.18 | inconclusive: IS < 0, 4/9 years |
| GBP/USD | index | 280 | −0.09 | −24.6 | 30.9 | −1.12 | 142 | 33% | −0.04 | −5.5 | 17.7 | −0.38 | 3/9 | −0.04 / +0.02 | FAIL |
| USD/JPY | index | 229 | +0.22 | +49.5 | 8.5 | 2.21 | 130 | 34% | −0.03 | −4.3 | 13.2 | −0.31 | 6/9 | +0.26 / −0.06 | FAIL (edge stopped after 2022) |
| AUD/USD | index | 291 | −0.05 | −13.9 | 28.1 | −0.67 | 146 | 34% | −0.13 | −19.0 | 27.3 | −1.62 | 4/9 | +0.02 / −0.04 | FAIL |
| USD/CAD | index | 321 | +0.07 | +23.0 | 11.8 | 0.88 | 153 | 33% | −0.12 | −18.3 | 22.6 | −1.26 | 5/9 | +0.12 / −0.05 | FAIL |
| USD/CHF | index | 314 | −0.17 | −54.4 | 56.1 | −2.74 | 138 | 38% | −0.06 | −7.7 | 16.3 | −0.62 | 3/9 | −0.11 / +0.02 | FAIL |
| XAG/USD | gold | 375 | −0.21 | −79.5 | 86.3 | −3.33 | 185 | 42% | +0.17 | +32.3 | 12.6 | 1.53 | 2/9 | −0.11 / +0.20 | inconclusive: 2025-26 silver rally only |

Worst losing streaks (IS / OOS): GC 10/6, NAS 9/9, SPX 10/8, EUR 12/11, GBP 16/11, JPY 14/11, AUD 10/11, CAD 13/8, CHF 10/13, XAG 15/7.

Other cells that passed the preamble gate:
- USD/JPY under the gold rule (buys): OOS +0.09, but IS only +0.03 and 5 of 9 years positive. Inconclusive.
- **The gold rule (buys only) on the equity indices passed the robust gate:**
  - NAS100: IS +0.20 (t 2.4), OOS +0.19, 8 of 9 years positive.
  - SPX: IS +0.13, OOS +0.10, **9 of 9 years positive**.
  - Drift-adjusted, that is still +0.08 to +0.13R a trade (t ≈ 1.0-1.2).
  - This would change the rule on NQ/ES, not add a market, and it is long-only on a market that rose over the sample. It
    is a lead for a separate study, not a proposal.

## Per year, net R (primary cells)

| market | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* |
|---|---|---|---|---|---|---|---|---|---|
| GC gold-A | −9.9 | +20.5 | +13.3 | −5.8 | +9.6 | +18.1 | +6.2 | +10.5 | +0.1 |
| GC random buys (exp/t) | −0.20 | +0.22 | +0.25 | −0.05 | 0.00 | +0.14 | +0.07 | +0.29 | +0.05 |
| GC gold-A drift-adj (exp/t) | +0.06 | +0.13 | −0.04 | −0.05 | +0.18 | +0.17 | +0.03 | −0.12 | −0.04 |
| NAS100 index-A | −3.8 | −7.7 | +14.0 | +0.6 | +6.2 | +6.9 | +3.1 | +16.6 | +4.2 |
| SPX index-A | −6.1 | +0.2 | +4.9 | −13.7 | +15.5 | −1.2 | +11.4 | −8.2 | +8.2 |
| EUR/USD index-A | +15.1 | +2.4 | −4.2 | −8.9 | −0.4 | −11.4 | +9.3 | −5.2 | +11.0 |
| GBP/USD index-A | −9.0 | −2.8 | +2.5 | −1.9 | −18.8 | +5.5 | −11.4 | −1.9 | +7.8 |
| USD/JPY index-A | +11.2 | +10.6 | +18.4 | +5.0 | +6.1 | −1.8 | +4.6 | −5.1 | −3.8 |
| AUD/USD index-A | +1.5 | +2.3 | −6.2 | +9.2 | −3.9 | −16.8 | −9.9 | −10.3 | +1.2 |
| USD/CAD index-A | +10.3 | +2.7 | −2.2 | −1.7 | +7.2 | +6.8 | −10.5 | −8.1 | +0.3 |
| USD/CHF index-A | −9.9 | −1.9 | +1.1 | −18.6 | −16.6 | −8.5 | +3.9 | −13.3 | +1.6 |
| XAG gold-A | −13.1 | −19.1 | −10.3 | −29.9 | −4.8 | −2.4 | −1.0 | +15.0 | +18.3 |

*2026 runs to 30 Oct. The GC rows marked exp/t are expectancy per trade in R, not total R.

**Every signal (grade ≥ 3, no A filter)** loses or breaks even on all FX pairs and silver in both windows under both rule
sets. Example: AUD/USD −0.14 | −0.07, USD/CHF −0.13 | −0.11. GC itself makes only +0.02 | +0.02 under the gold rule. Any
edge needs the A filter, and for gold that filter is mostly "buy gold".

## Is GC's edge concentrated in 2024-26?
**Not in raw R.** 2018-23 makes +45.8R (+0.13R a trade); 2024-26 makes +16.8R (+0.10R a trade). The losing years are 2018
and 2021, and 2026 is flat so far. **But the edge is mostly gold's uptrend.**
- Random gold buys, with the same 0.3-0.75 ATR stop and the trailing exit, make +0.06R a trade IS and +0.14R OOS, net.
- The A-setup beats that control by +0.07R a trade before 2024, which is not significant (t 0.86).
- It trails the control by −0.05R from 2024 onwards.
- So the iFVG timing adds little or nothing on gold. The profit comes from a buys-only rule with a trailing stop on a
  market that went up.
- **Caveat:** the gold aRule was itself chosen on 2019-26 spot gold (skill §26), so neither window is truly unseen data
  for gold.

Practical reading: GC's ICT P&L will track gold's trend. In a sideways or falling gold year (2018, 2021 style) expect the
gold A-setups to lose.

## Multiple testing and caveats
- **Variants tried:** 40 rule cells (10 markets × 2 rule sets × {all, A}) plus 20 drift-control cells. With 40 cells at
  t ≈ 1, a handful of preamble-gate "passes" (13 here) is about what noise alone gives. Hence the stricter robust gate.
- **Index A-rule:** it was developed on 2023-26 cash indices (skill §14/§20), so NAS/SPX 2024-26 is not clean OOS. On the
  untouched 2018-22, the index A-rule makes about +0.04R a trade on NAS100 and about 0 on SPX.
- **HistData cash and spot vs futures:** the desk trades futures. Cash indices have no gaps across the 17:00 halt the same
  way, and FX/XAG spreads vary by broker. The costs used are moderate. Gross results (result.json) are only about
  0.03-0.05R a trade better, so costs do not explain the FX failures.
- Paper research only. No live rule, config, tracker or replay code was changed.

## Files
- `universe.mjs`: loads the M1 data, runs the desk's code for every market and rule set, and builds the random-entry controls.
- `analyze.mjs`: IS/OOS, per-year and drift-adjusted stats, the gates, and result.json.
- `result.json`: every cell with IS/OOS {n, wr, exp, R, maxDD, t, streak}, gross, drift-adjusted, per year, and the verdict.

No `proposal.md`: no new market passes.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Re-run on the corrected clock on 10 Nov 2026. No rule, parameter, filter or cost was changed.** A control run of the old loader on the same day, with today's code, reproduced every verdict field of the published file (250 of 3,614 numbers differ in the second or third decimal: the code moved a little since the first run), so the verdict changes below are the clock. ICT stays a separate, paper-only edge; nothing on the desk, the tracker or the replay was changed. `result.json` holds the new numbers.

| Candidate (basic gate) | Before: in-sample n, R a trade, t; out-of-sample n, R a trade, t | After |
|---|---|---|
| GC, live gold rule A-setups (the baseline) | 362, +0.127, 1.50; 165, +0.102, 0.91: INCONCLUSIVE | 363, +0.151, 1.82; 167, +0.202, 1.68: PASS |
| GC, gold rules, all signals | 930, +0.023, 0.44; 434, +0.019, 0.29: INCONCLUSIVE | 935, +0.045, 0.88; 443, +0.056, 0.82: PASS |
| EUR/USD, index rules, A-setups | 291, −0.025, −0.35; 140, +0.121, 1.01: INCONCLUSIVE | 283, +0.051, 0.66; 141, +0.091, 0.77: PASS |
| EUR/USD, index rules, all signals | 1,049, −0.049, −1.19; 472, +0.028, 0.43: INCONCLUSIVE | 1,054, −0.035, −0.85; 475, +0.005, 0.08: FAIL |
| GBP/USD, index rules, A-setups | 280, −0.088, −1.12; 145, −0.031, −0.31: FAIL | 269, −0.059, −0.73; 153, +0.012, 0.12: INCONCLUSIVE |

The other 35 candidate verdicts are unchanged. **The written verdict above ("no new market passes") was about the stricter robustness gate, which was judged by hand and was not re-judged here.** What can be said from the numbers: EUR/USD A-setups now pass the basic gate with t under 1 in both halves, which is far from an edge; no FX pair or silver is added to the desk, and adding a market is the owner's call.
