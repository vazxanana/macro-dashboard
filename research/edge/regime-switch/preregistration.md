# Pre-registration: can a simple causal regime indicator tell in advance when the council's edges work?

Written and pushed before any indicator was lined up against any trade outcome. Paper research only. A pass here becomes at
most a written proposal or a paper shadow stream; no live rule changes.

## Why

Every live edge found so far is regime-bound: ICT A-setups fail 2008-17 (#526), the gold replica fails 2017-22 (#512), the NQ
New York open run makes nothing 2004-22 (#511), the gold daily systems are regime-bound 2006-17 (#530). If a simple indicator,
known before each trade, could say "this edge is in season", the desk could trade only in season. This test asks whether any
of three fixed indicators separates good from bad periods **out of sample**.

What is already known (and cannot be un-seen): the yearly results of every system below are published in their RESULT.md
files. What has not been computed by anyone: how any of the three indicators below lines up with those trades.
The NQ study (#511) already tried a 200-day-average side switch and a "previous 2 years positive" switch; both failed. Those
are not re-tested here.

## Trade histories (existing, unchanged; no system is re-run)

| System key | Source | Trades used | Net R (x1) | x2 |
|---|---|---|---|---|
| `ict` | ICT A-setups, 4 markets pooled (GC/NQ/ES/YM), `research/edge/ict-oos-2008/run.mjs` output (OANDA 5m, cached `trades.json`) | `cfg='rule'`, `aset=1`, signal close 2008-01-01 .. 2026-10-31 | size x (Rraw - costR) | size x (Rraw - 2 costR) |
| `nqopen` | NQ New York open run, `research/edge/nq-open-oos/result.json` `trades` | all, 2004-01 .. 2026-11-03 | `R` (1 point) | gross - 2 / r0 |
| `gtrend`, `gtrend5`, `gtl`, `geg` | Gold systems, `research/edge/gold-systems-oos/result.json` `positions` | all positions not `atEnd`, entry 2006-07 .. 2026-11-06 | `n` | `n2` |
| `replica` | Gold replica, `research/edge/replica-oos` replay output (cached `trades.json`, positions with leg close times) | all positions, 2017-01 .. 2026-11-06 | sum of legs (R - 0.30 / r0) x size | 0.60 |

Entry time = signal close (ICT), 09:30 ET day + entry minute (NQ), `t` (gold systems), `T` (replica). Exit time = the
trade's own close time (NQ: 11:00 ET the same day).

## Market data for the indicators

OANDA daily mid candles through the site's free proxy `meridianx.dev/md/bars?tf=1d` (xau, nas100, spx500, us30), first
candle served to 2026-11-06 (indices from 2003-03-24, gold from 2006-03-20). Candles starting on a Saturday or Sunday (UTC;
OANDA's Sunday stub) are dropped, so returns run weekday close to weekday close. A trade sees only daily candles that had
closed (start + 24 h <= entry time). Market of each trade: ICT GC -> xau, NQ -> nas100, ES -> spx500, YM -> us30; NQ open
-> nas100; all gold systems -> xau.

## The three indicators (fixed now, at most 3)

1. **VOL: trailing 12-month realised volatility percentile.** RV252 = standard deviation of the last 252 daily log returns
   (annualised x sqrt 252). VOL = its percentile rank (0-100) within that market's RV252 readings on every trading day of
   the system's **first half** (the calibration distribution; so in the second half it uses only earlier data). Needs 253
   daily closes.
2. **TREND: trailing 6-month trend strength.** TS = ln(C / C 126 days ago) / (sd of the 126 daily log returns x sqrt 126),
   a 6-month return measured in its own volatility. For the long-only gold systems (`gtrend`, `gtrend5`, `gtl`, `geg`)
   the **signed** TS is used (their edge needs gold to rise). For the two-sided systems (`ict`, `nqopen`, `replica`) the
   **magnitude** |TS| is used (trending vs ranging market). Needs 127 daily closes.
3. **META: the system's own trailing 12-month result.** Sum of the system's net R (x1) over its trades that **closed** in the
   365 days before this trade's entry (all trades count, taken or not: the switch is a shadow of the full stream). For
   `ict` it is computed per market (the GC stream for a GC trade, etc.). Threshold **fixed at 0, not fitted**: ON unless
   the trailing sum is negative (no trades in the window = ON). The first half is not used to choose anything for META.

A trade is in the study only if VOL and TREND are both computable at its entry (META always is). Warm-up trades used only
as META history: ICT 2007-06..12; gold systems before VOL exists (about 2006-07 .. 2007-03); NQ Jan-Mar 2004.

## Halves (calendar midpoint of each declared history, fixed now)

| System | Declared history | First half (choose) | Second half (judge) |
|---|---|---|---|
| `ict` | 2008-01-01 .. 2026-10-31 | entries before **2017-06-01** | 2017-06-01 on |
| `nqopen` | 2004-01-01 .. 2026-11-03 | before **2015-06-01** | 2015-06-01 on |
| gold systems | 2006-07-01 .. 2026-11-06 | before **2016-09-01** | 2016-09-01 on |
| `replica` | 2017-01-01 .. 2026-11-06 | before **2022-01-01** | 2022-01-01 on |

## Choosing the threshold (VOL and TREND only, first half only, x1 costs)

- Candidate cuts: the 20th, 30th, ..., 80th percentiles of the indicator's values over the first-half trades (7 cuts),
  each in two directions: ON when indicator >= cut, or ON when indicator < cut. 14 candidates.
- Pick the candidate with the largest first-half Welch t of (mean net R of ON trades - mean net R of OFF trades).
  Ties: the larger ON share. The cut is then frozen as a number (VOL in percentile points, TREND in TS units).
- If no candidate has a positive first-half difference, the indicator gives no switch for that system (recorded as such).

## Judging (second half only)

For each system x indicator (7 x 3 = 21 tests):

- **S1 separation:** second-half mean net R of ON trades minus OFF trades > 0 with Welch t >= 2.0, both sets n >= 10.
- **S2 the switch pays:** the ON-only book in the second half has R a trade >= always-on, and max drawdown (closed-trade
  equity, R) <= always-on's.
- **S3 costs:** the ON - OFF difference is still > 0 at x2 costs.
- **PASS** = S1 and S2 and S3. **Survives multiple testing** = PASS with Welch t >= 2.83 (Bonferroni, 21 one-sided tests at
  5%). A nominal pass below 2.83 is reported as "suggestive, not established".

Reported for every cell (second half): ON/OFF n and R a trade, Welch t, the switched book vs always-on (n, total R, R a
trade, max DD, calendar years positive / flat / negative), the same at x2. Full-history switched results are shown only as
a labelled in-sample-contaminated reference. Descriptive extras (not tests): ICT per market, lag-1 correlation of a
system's yearly R (does a good year predict a good year?).

## Verdict rule

- A system **has a usable regime switch** if at least one indicator PASSES for it; **established** only if it also survives
  multiple testing.
- The study's answer is **yes** if at least one cell survives multiple testing, **weak** if only nominal passes, **no**
  otherwise. Whatever the answer, nothing live changes; a survivor becomes at most a written proposal / paper shadow switch.

## Files

`run.mjs` builds a compact `inputs.json` (trades + daily closes) from the caches, then computes `result.json` and the
tables for `RESULT.md` from `inputs.json` alone.
