# Pre-registration: point-and-figure double-top buys on gold, judged against gold's own drift (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of these rules was computed. Only the NUMBER of signals per
window was counted for five box sizes before this file was written (no price after a signal was read), to choose a box size
that gives at least 100 signals a window.

**Question.** A point-and-figure chart drops time and keeps only moves of a fixed size: a column of X while price rises box by
box, a column of O while it falls, and a new column only after a reversal of three boxes. Its oldest buy signal, the
**double-top buy**, fires when a rising column climbs one box above the top of the previous rising column (a swing high
taken out, swings measured in price, not days). Does a gold buy at the next open after a double-top buy do better than the
same buy taken after every day? The mirror (double-bottom sell) and a longer hold are the other two tests.

**Why this topic.** A stand-alone gold rule of my own choosing, said as such; chosen from the charting method's long use
among gold traders, not from any gold table. Dedupe (14 Nov): no folder under `research/edge/`, no remote branch, no line of
`topics.txt` and no line of the 14 Nov untested-backlog list names point and figure, Renko or Kagi. Closest done studies:
`gold-trend` / `gold-tsmom` (time-based breakouts), `gold-swing-123`, `gold-measured-move`, `gold-daily-turtle-soup`
(bar-count swing patterns), `gold-aroon`, `gold-adx-trend`. The difference: swings here are defined by a fixed percentage
reversal, not by a number of days; and the primary test is an EXCESS over the same-side trade entered on EVERY eligible
day, so gold's rise from 2007 to 2026 cannot pass as an edge.

**What this is not.** Not a gate, exit, entry, filter or size of the live gold book (Gold trend + Gold daily engulf); it reads
nothing of it; owner decision 44 is untouched. Paper research only: nothing live changes.

## Data (fixed before any result)

- Market: **spot gold only (XAU/USD)**, OANDA mid daily candles, council-data `research/daily/xau.json`
  (`git show origin/council-data:research/daily/xau.json`, no network; kept outside git). Rows start March 2006.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`; complete days only.
- Signals from 1 January 2007 on (2006 is warm-up for the chart and the ATR).

## The chart (box 0.5 %, three-box reversal, high / low method)

- Log scale: a price x sits in box level `L(x) = log(x) / log(1.005)`. A day's high reaches box `floor(L(high))`, its low box
  `ceil(L(low))`.
- Start: on the first candle, top = bottom = `floor(L(close))`, direction up (an X column with no previous X column).
- Each later day, in an **X column**: if the high's box is above the top, the top rises to it; ELSE, if the low's box is at
  or below top - 3, the column reverses: the X column's top is stored as "previous X top", a new O column starts with bottom =
  the low's box. In an **O column** the mirror (the low first, then a reversal when the high's box is at or above
  bottom + 3; the O column's bottom is stored as "previous O bottom"). Continuation is checked before reversal.
- **Double-top buy** on day i: the X column's top rises above the previous X top for the first time in this column (also on
  the day an X column begins, if it starts above it). **Double-bottom sell**: the mirror. At most one signal per column.
- Box size: 0.5 %. Counted beforehand (signals only, no returns): box 0.5 % gives 167 / 141 buys and 156 / 116 sells in sample
  / out of sample; 0.75 % gives 97 / 61, 1 % 63 / 45 buys. 0.5 % is the only one of the five reaching 100 a window.
- ATR(14) = simple mean of the last 14 true ranges up to and including day i.
- Everything is read on the close of day i (the full high and low of day i); the order fills at the OPEN of day i+1. Nothing
  of day i+1 or later is read.

## The trade (signal and baseline alike)

- Enter at the open of day i+1 on the given side. **Every trade has a stop**: 2 x ATR(14) of day i from the entry, never
  moved, checked from the entry day on (a day opening beyond it fills at the open). Otherwise out at the open of day
  i+1+H (H = holding days). 1R = the stop distance; R = (exit - entry) x side / stop distance.
- Every signal is its own trade (trades may overlap). The same trade is the **baseline**, entered after EVERY day of the
  window (same side, same H): the baseline mean is gold's drift for that trade shape.

## Costs

- **$0.60 an ounce a round trip**, as 0.60 / stop distance in R.
- **Financing on buys**: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, demo broker XAUUSD swap of
  11 Nov 2026, `council/fills.mjs`) x entry / stop distance; sells charged and credited nothing. Today's rate every year.
- **2x costs**: $1.20 and twice the financing (signal and baseline both).

## The three tests

- **T1 (primary): double-top buy, buy, H = 10.** Excess = mean net R of the signal trades minus the mean net R of the
  every-day buy (H = 10) in the same window.
- **T2: double-bottom sell, sell, H = 10.** Excess against the every-day sell (H = 10).
- **T3: double-top buy, buy, H = 20.** Excess against the every-day buy (H = 20).

## Windows

- **In sample**: entry day 2007-01-01 .. 2016-12-31. **Out of sample**: 2017-01-01 .. the last complete candle
  (November 2026). OOS halves (2017-21, 2022 on) reported only.

## Statistics

- Per test and window: n, R a trade gross and net (signal and baseline), excess net, excess at 2x costs.
- **Month t of the excess**: for each signal trade, x = net R - baseline mean net R (same window); x summed by the calendar
  month of the ENTRY, over every calendar month of the window (no entry = 0); t = mean / (sd / sqrt(months)), two-sided p
  from Student's t. Also reported: the plain month t of the signal's net R, gross and net.
- **Holm** over the three OOS excess p-values.
- **Placebo**: 40 seeded draws (mulberry32, seeds 1..40); each draws as many OOS entry days as the test has OOS signals,
  uniformly from the OOS days, same side and H; its excess is recorded.

## Pass bar (per test; the study passes when T1 passes; T2 / T3 passing alone is reported, not a pass)

1. OOS excess t >= 2 with Holm p < 0.05;
2. IS excess > 0 (same sign);
3. OOS excess at 2x costs > 0;
4. OOS excess above at least 38 of the 40 placebos;
5. n >= 100 signals in each window (fewer: descriptive only).

Anything else is FAIL. No parameter (box, reversal, H, stop multiple) will be changed after a result is seen; any variant
would be a new pre-registration on other data.
