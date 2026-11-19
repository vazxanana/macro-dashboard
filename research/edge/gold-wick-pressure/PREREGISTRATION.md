# Pre-registration: ten days of wick pressure on gold (14 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any number of this study is computed. Paper research only.

## Question

When gold's daily candles keep leaving long LOWER wicks over two weeks (prices below the open / close were tried and rejected,
day after day), does gold rise over the next week more than it rises on an ordinary day? When they keep leaving long UPPER
wicks, does it fall more than an ordinary short would? A slow "absorption" reading built from many candles, not one pin bar.

The primary test is measured **against the same-side every-day baseline**: each signal trade's net R minus the average net R
of the identical trade (same stop, same exit) taken on every trading day of the same window and side. Gold's rise in 2017-26
pays every buy; this test only passes if the signal days beat an ordinary day.

**Item 44 (docs/owner-decisions.md).** A new stand-alone daily rule on gold, judged on 2017-26. It is not a gate, exit, entry
or size change of the live gold book (Gold trend / Gold daily engulf), reads none of that book's positions or signals, and
says nothing about it. Nothing live changes whatever the verdict; a PASS would only be written up as a proposal to the owner.

## What is already tested (dedupe, read before this was written)

- `gold-weekly-wick` (branch): one WEEKLY candle with a wick over 60 % of its range, held 1-2 weeks. One candle, weekly.
- `gold-h4-pinbar` (H4 pin at a 20-candle extreme, 2 days), `gold-key-reversal` (daily key / outside reversal),
  `gold-ibs` (one day's close location, next-day reversion), `council-lone-wick` (a display layer, no test).
- None accumulates the lower-minus-upper wick imbalance over many days, and none scores it against an every-day baseline.
  No branch or folder named wick-pressure, accumulation, Chaikin, close-location or money-flow exists (checked
  `git branch -r`, `research/edge`, `research/proposals/2026-11-14-untested-backlog.md`).

## Data (named before any result)

- One market: spot gold, council-data `research/daily/xau.json` (OANDA mid, UTC days, 2006 on), read with `git show
  origin/council-data:…` (no network). Saturday / Sunday stubs folded into the next Monday with `council/fills.mjs`
  `foldWeekend` (imported, not edited). No other market.
- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample (decisive): 2017-01-01 to 2026-10-31. A trade belongs to
  the window of its entry day. 2006 is warm-up only.

## Rule (fixed here)

For each trading day d (closed candle):
- lower wick = min(open, close) − low; upper wick = high − max(open, close).
- ATR14(d) = mean true range of the 14 days ending d.
- **WP(d)** = Σ over the 10 days ending d of (lower wick − upper wick), divided by (10 × ATR14(d)).
- Thresholds from the past only: the 20th and 80th percentiles of WP over the 250 trading days BEFORE d (d excluded).
  Fewer than 250 earlier WP values = no signal.
- **Buy** when WP(d) ≥ its 80th percentile; **sell** when WP(d) ≤ its 20th percentile.
- Entry at the open of the next trading day. Stop = 1.5 × ATR14(d) from the entry (every trade has a stop). No target.
- Exit at the close of the 5th trading day counting the entry day, or at the stop: from the entry day on, a low (buy) /
  high (sell) through the stop exits at the stop, or at the day's open when the open is already beyond it (gap). On the entry
  day the open is the entry, so only the intraday touch counts.
- One position at a time: a signal on a day before the open position's exit day is skipped; a signal on the exit day itself
  (read at that day's close) may enter the next day.

## Costs

- $0.60 a round trip on every trade (in R: 0.60 / stop distance).
- Buys pay overnight financing: `nights(entry, exit)` × `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) × entry / stop distance. Sells pay and receive nothing (as `FIN`). Entry
  time = the entry day's 00:00 UTC; exit time = the end of the exit day (23:59:59 UTC). Today's rate for every year.
- "At 2x costs" doubles both the round trip and the financing, for the signal trades AND the baseline.
- Cost share reported = total cost R ÷ total gross |R| of the signal trades, per window.

## Baseline (same side, every day)

On every trading day d of a window (warm-up as above), a buy and a sell entered at d's open with the stop 1.5 × ATR14(d−1)
and the same 5-day exit: overlapping, every day, the same costs. Baseline mean net R per side per window (and at 2x costs).

## Tests (Holm over these three; t on calendar-month sums, every calendar month of the window counted, months with no trade
= 0; two-sided normal p)

- **T1 (primary): excess over the same-side baseline**, 5-day hold. Per trade: net R − the baseline mean net R of its side in
  its window. OOS t of the monthly sums.
- **T2: the both-sided stream's net R**, 5-day hold (buys and sells together, no baseline subtracted).
- **T3: excess over the same-side baseline with a 10-day hold** (exit at the close of the 10th trading day; its own 10-day
  baseline). Same signals, same one-at-a-time rule.

**PASS** only if all hold: T1's OOS t ≥ 2 and its Holm-adjusted p < 0.05; T1's in-sample mean excess > 0 (same sign);
T1's OOS mean excess still > 0 at 2x costs (both sides recosted). Otherwise **FAIL**. T2 and T3 are reported with Holm and
do not change the verdict on their own.

## Placebo (seeded, 40 draws)

Keep the actual signal entry days and the one-at-a-time sequence; shuffle the buy / sell labels among them (same numbers of
buys and sells per window), seeds 1..40 (mulberry32). Recompute T1's OOS t each time. Reported: the median, the largest, and
how many of 40 reach the actual t. This asks whether the DIRECTION the wicks point carries information beyond the timing.

## Also reported, never judged

Buys and sells apart (n, gross, net, excess per window); the median stop in $ per window (the brief asks for $10 or more:
if the OOS median is under $10, that is said plainly); year by year net R; win rate; worst drawdown on summed R.
