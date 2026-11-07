# Macro gold rule: pre-registration

Written and committed **before** any number that uses real-yield or dollar data was computed. The FRED series this test needs (DFII10, DTWEXBGS) cannot be reached from the research sandbox, so the test runs once on GitHub Actions (`.github/workflows/macro-gold.yml`, the `ict-smile` pattern) and writes council-data `research/macro-gold.json`. The rules, windows, costs and pass bars below decide the verdicts. Nothing in them changes after the results are seen. Anything added later is labelled post hoc in `RESULT.md`.

## Question

The Macro strategist (`council/macro.mjs`) treats US real yields as gold's master driver, with the dollar second. Gold and real yields move together on the same day; that is well known. The question here is narrower: **can the strategist's inputs, known the day before, make a tradable gold rule?** It is tested on gold history no rule here was built on (2006–2017) and confirmed on 2018–2026. It is compared with plain long gold and with the live Gold trend (`gtrend`, N20), whose own out-of-sample test was #530 (`research/edge/gold-systems-oos`).

Context from earlier studies: every edge found so far has been regime-bound (#508, #511, #512, #526, #530). In #530 most of the Gold trend profit came from being long gold in a rising decade; random entries made +0.28R a position.

## Data

- **Gold:** OANDA XAU/USD mid daily candles through the site's free `/md/bars` proxy (`sym=xau&tf=1d`), the live Trader's gold feed and #530's data. Free history starts 2006-03-20. Candles dated Saturday or Sunday (UTC), including OANDA's Sunday-evening stub, are dropped. A day's close is the last price of its UTC day.
- **Real yield:** FRED `DFII10` (10-year TIPS constant-maturity yield, H.15), full history (from 2003).
- **Dollar (diagnostic only):** FRED `DTWEXBGS` (broad trade-weighted dollar, H.10), from its start (2006-01-02).
- **Gold trend positions:** the 134 `gtrend` positions in `research/edge/gold-systems-oos/result.json` (#530's replay of the live rule: N20 breakout, 2 ATR chandelier, +1R add; net R at ×1 and ×2 costs). Not re-run.

## Publication lag (no look-ahead)

- A `DFII10` value dated *d* counts as known from **24:00 UTC of the second weekday after *d***. H.15 posts *d*'s value on the next business day around 16:15 New York; the second weekday adds a full day of margin and covers a holiday on the next weekday.
- A `DTWEXBGS` value dated *d* counts as known from **24:00 UTC of *d* + 10 calendar days** (H.10 is weekly; `macro.mjs` uses the same 10-day lag).
- A decision made at the close of weekday *X* (24:00 UTC) uses only values known by then. For `DFII10` that is values dated up to two weekdays before *X*: on a Wednesday close, Monday's value.
- The 20-day change is the last known value minus the value 20 observations earlier in the series.

## Rule A: real-yield regime, long or flat (daily)

- At each weekday close *X*: Δ20 = change in `DFII10` over its last 20 observations known at *X*.
- **Long gold from the close of *X* to the next weekday close if Δ20 < 0; flat otherwise** (Δ20 = 0 is flat).
- Return of a weekday *Y*: close(*Y*) / close(previous weekday) − 1, earned when the position set at the previous weekday close is long.
- **Costs as #530:** $0.30 per unit per round trip at ×1, $0.60 at ×2. Each switch (flat→long or long→flat) costs half a round trip, as a fraction of that day's close. No financing charge (#530 had none either; it would cut long gold and Rule A about in proportion to their time in the market).
- **Benchmarks:**
  - **Plain long gold** (buy and hold): long every day, one round trip per period.
  - **Price twin**: the same rule with gold's own 20-weekday change in place of the real yield (long at close *X* if close(*X*) > close 20 weekdays earlier). This asks whether the macro input adds anything beyond gold's own trend.
- **Statistics, per period:** days, time in the market, switches, mean daily net return, annualised return (×252), annualised volatility, Sharpe (mean / sd × √252, no risk-free rate), compounded total return, worst drawdown of the compounded curve, at ×1 and ×2 costs.
- **Regime spread:** mean gross daily gold return on days Rule A is long minus days it is flat (*diff*). Significance: a circular block bootstrap of the (return, signal) pairs, 20-day blocks, 10,000 resamples, P(*diff* ≤ 0). The naive Welch t is also reported.

### Rule A pass bar

Out of sample (verdict window): returns from **2006-07-03 to 2017-12-29**. Halves fixed in advance: **H1 2006-07 to 2011-12** (the bull market) and **H2 2012-01 to 2017-12** (the 2013–15 bear and the 2016–17 range).

- **A1.** Net Sharpe of Rule A > net Sharpe of plain long gold, at ×1 **and** at ×2 costs.
- **A2.** *diff* > 0 with block-bootstrap P(*diff* ≤ 0) < 0.05.
- **A3.** In each half: *diff* > 0 **and** Rule A's ×1 Sharpe > plain long gold's.
- **A4.** Rule A's ×1 Sharpe > the price twin's ×1 Sharpe (the macro input beats gold's own trend).

Confirmation: **2018-01-02 to 2026-11-06**.

- **C1.** *diff* > 0.
- **C2.** Rule A's ×2 Sharpe ≥ plain long gold's.

## Rule B: Gold trend N20, taken only when real yields are falling

- Each live Gold trend position (`gtrend`, first unit plus its add, as #530) is **taken only if Δ20 < 0 at its entry time**, with the same lag rule (values known by the entry minute). Otherwise it is skipped.
- This is exactly implementable as a shadow of the live rule: it mirrors each live `gtrend` entry and skips those with Δ20 ≥ 0. It does not seek its own entries while the live position it skipped is open.
- Units: net R a position at ×1 and ×2 costs, from #530.

### Rule B pass bar

Out of sample: positions entered **2006-07-01 to 2017-12-31** (75 positions), halves as above.

- **B1.** Mean net R of the kept positions > 0 at ×1 **and** at ×2.
- **B2.** Kept minus skipped mean net R (×1) > 0, one-sided permutation test (10,000 shuffles of the keep/skip labels) p < 0.05.
- **B3.** In each half: kept mean > skipped mean, with at least 3 kept and 3 skipped positions in that half (fewer counts as a miss).
- **B4.** Return per drawdown of the kept stream (total net R ÷ |worst drawdown| of the closed-position curve in close order, ×1) ≥ that of the unfiltered Gold trend over the same window.

Confirmation: positions entered **2018-01-01 to 2026-11-06** (positions open at the end marked as in #530).

- **C1.** Kept mean > skipped mean (×1).
- **C2.** Kept mean net R > 0 at ×2.

## Verdicts (each rule separately)

- **PASS:** every out-of-sample test and both confirmation tests pass. Only then is the rule a candidate: a written proposal for a paper shadow stream (Rule A) or a shadow variant of Gold trend (Rule B), following the existing shadow patterns. No live rule is changed; the owner decides.
- **OOS ONLY:** every out-of-sample test passes, a confirmation test fails. Not a candidate (the edge has not held recently).
- **FAIL:** any out-of-sample test fails. If both confirmation tests pass, the result says "recent only", the regime-bound pattern of earlier studies. Not a candidate.

## Pre-declared diagnostics (cannot change a verdict)

1. **Lag:** Rule A and B with values known from the first weekday after *d* (one day less margin).
2. **Lookback:** Δ5 (the strategist's own real-yield momentum window) and Δ60.
3. **Dollar:** the Rule A shape with `DTWEXBGS` Δ20 < 0; and long only when both real yields and the dollar are falling.
4. **Price twin 2×2:** Rule A's *diff* within the days the price twin is long and within the days it is flat.
5. **Same-day link:** correlation of the daily gold return with the same day's `DFII10` change, and with the previous known change, per period. It shows whether the driver is real but already priced.
6. **Against Gold trend:** monthly t of Rule A's net return, plain long gold and Gold trend's net R; correlation of Rule A's monthly return with Gold trend's monthly R.
7. **By year:** Rule A, plain long gold, and Rule B kept / skipped R, by calendar year.

## Run

- `run.mjs` fetches FRED (free `fredgraph.csv`, no key) and the OANDA daily candles, applies the rules and bars mechanically, and writes `result.json` (council-data `research/macro-gold.json`).
- A failed fetch writes `status: "incomplete"` and no verdict; the nightly schedule tries again. Once a complete result exists, later runs skip it (no re-running a finished test) unless dispatched with `force`.
- Paper research only. Nothing with a monthly cost.
