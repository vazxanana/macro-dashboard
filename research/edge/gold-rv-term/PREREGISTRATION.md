# Pre-registration: gold's realised-volatility term structure and its 60-day trend (14 Nov 2026)

Written and pushed ALONE, before `run.mjs` exists and before any return, R or t of the rule below was computed. Only the
number of qualifying signal days per window was counted (below), from the price series' own volatility; no return was read.
Anything added later is labelled post hoc in `RESULT.md`.

## What this is, and what it is not

A **stand-alone daily rule of its own** on spot gold. It reads no trade, position or record of the live gold book (Gold trend,
Gold daily engulf, the Mosha cycle), is not a gate, exit, entry or size of it, and uses none of that book's 2006-17 positions
(docs/owner-decisions.md item 44). Paper research only; nothing live changes whatever the verdict. A pass would only be written
up as a lead for the owner. ICT is not involved.

## Question

Gold's realised volatility has a term structure: the volatility of the last week against that of the last quarter. When the
short end falls far below the long end (a calm week after a volatile quarter: "compression"), or rises far above it (a sudden
burst: "expansion"), is a multi-day trade in the direction of gold's 60-day trend better than the same trend trade taken on any
day of the same year?

The question is the EXCESS of the conditioned trend trade over the unconditioned one, not whether the trend trade itself pays.

## Dedupe (each read before writing)

- `gold-lowvol-hold` (FAIL; a near miss the brief says not to re-test): buys gold when the 20-day realised volatility is in the
  lowest third of its own past year, long only, held 20 / 60 days. A LEVEL percentile of one window, no trend direction, no
  short side. Here: the RATIO of two windows (5 vs 60 days), two-sided, the side set by the 60-day trend.
- `gold-volvol-switch` (FAIL): the 20-day ATR now vs ten days earlier picks between a 20-day breakout and a 5-day reversal.
  Here there is no breakout or reversal trigger; the trade is always with the 60-day trend and the condition is the 5 / 60-day
  ratio's extreme.
- `gold-squeeze` (FAIL): Bollinger-inside-Keltner squeeze release breakout. `nr7-breakout`, `gold-inside-day`: one narrow
  candle. `gold-vol-breakout*`: intraday break of the open +/- k x yesterday's range. `gold-range-expansion`: one wide day.
  `gold-vol-target`, `vol-managed*`: exposure scaled by volatility, no event. `gold-atr-barrier-hold`, `gold-bond-vol-spike`,
  `gold-silver-vol-ratio`, `gold-weekly-vol-breakout`: other triggers (a barrier, bond volatility, a cross-asset ratio, weekly
  breakouts).
- `vol-spike-rebound` and its replications: buy US indices after the 5-day realised volatility exceeds twice its prior 120-day
  level; indices, long only, a rebound bet. Here: gold, two-sided, with the trend, both ends of the ratio, measured as an
  excess over the every-day trend trade.
- `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): not listed. The scratchpad topics list did
  not hold it; slug taken there first.

## Data and market set (named now)

- **Spot gold only**: council-data `research/daily/xau.json` (OANDA mid XAU/USD, complete UTC daily candles, 20 Mar 2006 to the
  file's last day), read with `git show origin/council-data:...`; no network, no cache written. Saturday / Sunday candles folded
  into the next weekday with `council/fills.mjs` `foldWeekend` (read only), so every candle is a trading day.
- Windows by the month of the SIGNAL candle: in sample **2007-01 to 2016-12**, out of sample **2017-01 to 2026-10**. A signal
  whose exit candle is not on file is dropped and counted.

## The rule (every setting fixed now; no other setting will be run)

On folded daily candle i (all inputs known at its close):
- r(k) = ln(close(k) / close(k-1)).
- RV5(i), RV60(i) = sample standard deviation of r over the 5 / 60 candles ending at i (i included).
- **Ratio** q(i) = RV5(i) / RV60(i). Over the whole file its median is about 0.87; about 20 % of days are under 0.6 and about
  20 % over 1.2 (counted from volatility alone).
- **Trend side** s(i) = sign(close(i) - close(i-60)): +1 buy, -1 sell; 0 = no trade.
- **T1, compression (primary)**: q(i) < 0.6. **T2, expansion (secondary)**: q(i) > 1.2. Every qualifying day is a signal
  (not only the first day of a run), subject to one position at a time per test.
- Trade: market entry at the **open of candle i+1**, side s(i). Stop **2 x ATR20(i)** from the entry (ATR20 = mean true range
  of the 20 candles ending at i), on the losing side, checked on every candle from i+1; a gap through it fills at the open
  (`fills.mjs` `stopFill`). No target. Time exit at the **close of candle i+10**. One position at a time per test: a signal whose
  entry candle comes before the previous trade's exit candle is skipped and counted.
- R = move in the trade's favour / (2 x ATR20(i)).

## Costs

$0.60 a round trip on every trade (in R: 0.60 / risk), plus financing on buys = `nights(entry, exit)` x `FIN.xau.long`
(0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry / risk. Sells pay and
receive nothing. 2x costs = $1.20 and twice the financing.

## The baseline and the excess

- **Every-day trend trade**: on EVERY candle d of the window with s(d) != 0, the same trade (same side rule, entry, stop, hold,
  costs), overlapping allowed (it is a reference distribution, not a traded stream).
- b(side, year) = mean net R of the every-day trades of that side whose signal candle falls in that calendar year (gross
  likewise for gross).
- **Excess** of a rule trade = its net R - b(its side, its signal year). This keeps gold's drift and the trend trade's own pay
  in that year out of the excess.

## Statistics and the pass bar

- t on **calendar-month sums** of excess (net) per signal month; one-sided upper p from Student t with months - 1 df. Gross
  excess reported beside it.
- **Holm** over the two tests (T1, T2) on the out-of-sample p.
- **Placebo** (40 seeded draws, seed 20261114 + k): every out-of-sample rule trade replaced by the every-day trend trade of a
  random candle of the same calendar year (with s != 0); mean excess of the draw.
- **Control: day-shuffled path** (40 seeded draws, seed 20261114 + 1000 + k): within each calendar year the folded candles'
  relative moves (open, high, low, close each divided by the previous close) are permuted, the path rebuilt from the year's
  first previous close, and the WHOLE rule (q, trend, signals, baseline, excess) run again on it. It keeps each year's drift
  and volatility level and removes the ordering the ratio reads (volatility clustering). Mean OOS excess per draw.
- **T1 passes only if all hold**: out-of-sample mean excess > 0; out-of-sample month t >= 2; Holm p < 0.05; in-sample mean
  excess > 0 (same sign); out-of-sample mean excess > 0 and mean net R > 0 at 2x costs; the rule's out-of-sample mean excess
  above at least 38 of 40 placebo draws AND at least 38 of 40 control draws. T2 is judged on the same checks; the verdict
  rests on T1 (a T2 pass alone is reported as secondary, never called an edge).

## Event counts (counted before any return, from volatility and trend sign only)

One position at a time with the 10-day time exit only (stops not yet applied, so the run's counts can only be equal or higher),
signals through the file's end:

| Test | In sample 2007-16 | Out of sample 2017-26 |
|---|---|---|
| T1 compression q < 0.6 | 141 | 129 |
| T2 expansion q > 1.2 | 106 | 112 |

Both windows hold 100 or more events per test. Thresholds 0.6 / 1.2 were chosen from the ratio's distribution (about a fifth of
days in each tail) and the 100-event floor, before any return was read.

## Reported, not judged

Per side (buys / sells), by year, the every-day baseline itself, stops, median stop in $, cost share, financing.

## Files to follow

`run.mjs` (pure pieces exported), `RESULT.md` and `result.json` written by it, `tests/gold-rv-term.test.mjs` (offline: the ratio,
trend side and trade on hand-made candles, no look-ahead, the report against result.json), `out/` rebuilt.
