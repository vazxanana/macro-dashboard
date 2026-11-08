# Pre-registration: does the NQ/ES dip-buy rule (#431) hold on 2008-2017, data it has never seen?

Written on 8 Nov 2026, **before any 2008-2017 dip-buy or gold-rule-buy statistic was computed**. This file and `run.mjs` are
committed and pushed first; the `full` stage of `run.mjs` (the only stage that reads the 2008-17 window for the tested streams)
runs once afterwards and its result is reported whatever it is. Nothing below changes after that run.

## Why

`research/edge/ict-index-longonly` (#431) found that on NAS100/SPX cash 2018-26 the gold A-rule's **buys**, taken only when the
index is down over the last 20 trading days, make +0.21R a trade in 2018-23 and +0.48R in 2024-26 (n 256 / 114), drift-adjusted
+0.47R with a block-bootstrap 95% CI of +0.19..+0.75, positive in 9 of 9 years. It proposed replacing the NQ/ES A-rule with it.
That study was **not pre-registered and tried 26 variants**; the 20-day gate was one of two gates named in advance, but the
result has never been tested on data before 2018. Every live edge found so far is regime-bound: the unchanged index A-rule fails
2008-17 (#526), and the gold rule's timing adds nothing over random gold buys there (#526). 2008-17 is the one window no ICT rule
on this desk has touched. The tracker already runs the candidate as a paper shadow stream (`isDip` / `dipGate`, variant 'dip'), so
the rule can be driven verbatim.

## Data (fixed now)

- **Source.** The OANDA 5-minute mid candle cache of #526 / #545 / #579 (`meridianx.dev/md/bars`, `sym=nas100` and `sym=spx500`,
  2007-06 to 2026-10), in the scratch directory, not in git. **No candle is refetched** (owner, 8 Nov: cost discipline).
  NQ = NAS100_USD, ES = SPX500_USD. Cash/spot vs futures differences are as declared in #526 (mid quotes, CFD basis, no roll,
  only the 17:00 ET hour and CME closures dropped).
- **Candle handling, as #526.** `inHalt(t) || cmeShut(t)` candles dropped; H1 = `agg(m5, 3600)`; D1 = `dailyNY(H)` (17:00 New
  York rollover); 5m exits on UTC days with >= 200 5m candles (the replay's complete-day rule), H1 exits otherwise.
- **Windows** by the signal H1 candle's close, UTC:
  - **A (the test): 2008-01-01 00:00 to 2017-12-31 23:59**, halves 2008-12 | 2013-17 by signal-close year.
  - **B (the confirmation, already seen by #431): 2018-01-01 to 2026-10-31**, split 2018-23 | 2024-26 as #431.

## The rule under test (the desk's own code, imported, unchanged)

- `signals()` of both sides, `grade.total >= MIN_GRADE` (3), from `ict/tracker.mjs`, on each market's H1 and D1.
- **H1 (primary) 'dip':** `isDip(g, key, D)` from `ict/tracker.mjs`: a buy signal, the gold A-rule (`atrR` in [0.3, 0.75) of the
  daily ATR), and `dipGate`: the last completed daily close (the same D1 candle `signals()` uses) is below the daily close 20
  trading days earlier. Size 1. Exit: `simulate(g, { ...M, aRule: 'dip' }, ...)` from `ict/replay.mjs`, exactly the replay's
  shadow stream: no break-even, trail 1.5R behind the best price from +2R, 36 H1 max. One open trade per market (the replay's
  shadow busy rule). A trade the gap guard rejects (`simulate()` returns null) is skipped. Sample = every closed 'dip' trade whose
  signal close is in the window, NQ and ES pooled.
- **H2 (secondary) 'goldbuy':** the same without the gate: `isASetup(g, 'gc')` (the gold A-rule's buys), size 1, gold exit, one
  open trade per market. This is the ungated rule of ict-universe / #431.
- **Baseline 'index':** the live NQ/ES A-rule as #526 ran it (`isASetup(g, key)`, `sizeOf`, both sides, break-even, the replay's
  busy rule). It is a reference only; its 2008-17 result is already published (#526: NQ −0.073R, n 541; ES −0.068R, n 534).

## Costs and R

- One round trip **0.02% of price + 0.25 point** (NQ and ES; #431 / #526), in R = cost / the trade's own risk r0.
- **Net R = size x (R − cost in R)**. Primary = costs x1. Costs x2 and gross are reported.

## The random control (same gate, stop band, exit and costs)

Random H1-close **buys**, 1 in 10 H1 candles (fixed seed 777, as #431), stop 0.3-0.75x the daily ATR14 (uniform), the gold exit,
the same costs, each tagged with the 20-day gate state at its own close. Not a rule. **Drift-adjusted margin** = each rule trade's
net R minus the control's mean net R in the same **market, year and gate state** (H1: gate on; H2: market and year, all control
buys). A cell without control trades falls back to the market's control mean. **CI** = calendar-month block bootstrap: the months
of the window are resampled with replacement, a month's rule trades and control trades travel together, the control cell means are
recomputed from each resample, 5000 reps, 95% percentile interval.

## Calibration gate (read BEFORE any 2008-17 number of the tested streams)

The `calib` stage prints only (a) the index A-rule per market in both windows and (b) the dip-buy stream in window B. The test is
read only if:
1. the index rule reproduces #526 / #579 on NQ and ES in both windows: net expectancy within ±0.02R and n within ±3% of #579's
   figures (today's calendar module: NQ 2008-17 −0.075 n 538, 2018-26 +0.106 n 423; ES −0.069 n 534, +0.039 n 425); and
2. the dip-buy stream on 2018-26 is positive and reproduces #431 on this data source: pooled net expectancy within ±0.15R of
   #431's all-years +0.29R (n 370), n between 300 and 440.

If the gate fails, the study is reported **INCONCLUSIVE (calibration)** and the 2008-17 numbers are still reported, labelled so.

## The test (H1, one primary hypothesis)

Window A, NQ+ES pooled, closed 'dip' trades, net R at costs x1.

**PASS** if all three hold:
1. **P1.** Pooled net expectancy > 0 **and** t >= 2.0 (t = mean / (sd / √n) over trades).
2. **P2.** Both halves positive: net expectancy > 0 in 2008-2012 **and** in 2013-2017.
3. **P3.** The drift-adjusted margin over random gated longs is > 0 and its block-bootstrap 95% CI excludes 0 (lower bound > 0).

**FAIL** if the pooled net expectancy <= 0, or either half <= 0, or the drift-adjusted margin <= 0 (the signal's timing is no
better than random longs on the same dips).

**INCONCLUSIVE** otherwise (positive everywhere but t < 2, or the margin's CI includes 0), with the reason stated.

PASS means the proposal has untouched-data support and becomes a **candidate for the owner** (paper; nothing goes live). FAIL
means the 2018-26 result does not hold before 2018 and the proposal should not be adopted on #431's evidence.

## H2 (secondary): the ungated gold-rule buys on NQ/ES, window A

Same statistics and the same bar shape (P1-P3 with the market-and-year control), reported next to H1 and next to the index A-rule
baseline on 2008-17 (#526's figures and this harness's own run). It is secondary: it does not change H1's verdict.

## Reported, not part of the verdict

- Costs x2 and gross; per market (NQ, ES); per year; win rate, max drawdown (net equity in close order), worst losing streak.
- Dependence check: t of the calendar-month sums of net R.
- Window B (2018-26) for both streams: all years, 2018-23, 2024-26, per market, drift-adjusted with CI (the confirmation that
  this harness reproduces #431).
- The ungated stream split by gate state in 2008-17, and the control by gate state (descriptive).

## What will not happen

- No parameter, rule, filter, cost, window or control is changed after the `full` stage runs. The `trades` stage runs once over
  2007-2026 in one pass (it prints only coverage); the `calib` stage prints nothing from 2008-17 for the tested streams.
- No live rule, config, tracker, replay or site code changes. Paper research only. No candle is refetched.
