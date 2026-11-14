# Pre-registration: Aroon crosses on gold's daily chart, judged against gold's own drift (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of these rules was computed.

**Question.** Tushar Chande's Aroon indicator (1995) measures how RECENTLY the highest high and the lowest low of the last
25 days were made, not how far price moved. When Aroon-Up crosses above Aroon-Down (the latest 25-day high is now more recent
than the latest 25-day low), does a gold buy at the next open do better than the same buy taken on every day? And the mirror
for sells? The idea: the time since an extreme, rather than the size of a move, carries information about the trend.

**Why this topic.** A stand-alone gold rule of my own choosing, said as such; chosen from its published origin, not from any
gold table. Dedupe: no folder under `research/edge/`, no remote branch and no line of the 14 Nov untested-backlog list
names Aroon or "time since high" (checked 14 Nov). Closest done studies: `gold-adx-trend`, `gold-macd`, `gold-psar`,
`gold-tsmom`, `gold-streak`, `gold-record-high` (trend indicators judged as stand-alone trade lists). This study differs on
purpose in its primary test: the signal is measured as an EXCESS over the same-side trade entered on EVERY eligible day, so
gold's rise from 2007 to 2026 cannot pass as an edge.

**What this is not.** Not a gate, exit, entry, filter or size of the live gold book (Gold trend + Gold daily engulf); it reads
nothing of it; owner decision 44 is untouched. Paper research only: nothing live changes.

## Data (fixed before any result)

- Market: **spot gold only (XAU/USD)**, OANDA mid daily candles, council-data `research/daily/xau.json`
  (`git show origin/council-data:research/daily/xau.json`, no network; kept outside git). Rows start March 2006.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`; complete days only.
- Signals from 1 January 2007 on (2006 is warm-up).

## The indicator (N = 25)

- On the close of day i, over the N + 1 = 26 days i-25 .. i: `daysSinceHigh` = i minus the index of the highest high (the
  LATEST one when tied), `daysSinceLow` likewise for the lowest low.
- Aroon-Up = 100 x (25 - daysSinceHigh) / 25; Aroon-Down = 100 x (25 - daysSinceLow) / 25.
- **Up-cross** on day i: Up[i-1] <= Down[i-1] and Up[i] > Down[i]. **Down-cross**: the mirror.
- ATR(14) = simple mean of the last 14 true ranges up to and including day i.
- Everything is read on the close of day i; the order fills at the OPEN of day i+1. Nothing of day i+1 or later is read.

## The trade (signal and baseline alike)

- Enter at the open of day i+1 on the given side. **Every trade has a stop**: 2 x ATR(14) of day i from the entry, never
  moved, checked from the entry day on (a day opening beyond it fills at the open). Otherwise out at the open of day
  i+1+H (H = holding days). 1R = the stop distance; R = (exit - entry) x side / stop distance.
- Every signal is its own trade (trades may overlap). The same trade is the **baseline**, entered after EVERY day of the
  window (every eligible day, same side, same H): the baseline mean is gold's drift for that trade shape.

## Costs

- **$0.60 an ounce a round trip**, as 0.60 / stop distance in R.
- **Financing on buys**: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, demo broker XAUUSD swap of
  11 Nov 2026, `council/fills.mjs`) x entry / stop distance; sells charged and credited nothing. Today's rate every year.
- **2x costs**: $1.20 and twice the financing (signal and baseline both).

## The three tests

- **T1 (primary): up-cross, buy, H = 10.** Excess = mean net R of the signal trades minus the mean net R of the every-day
  buy (H = 10) in the same window.
- **T2: down-cross, sell, H = 10.** Excess against the every-day sell (H = 10).
- **T3: up-cross, buy, H = 20.** Excess against the every-day buy (H = 20).

## Windows

- **In sample**: entry day 2007-01-01 .. 2016-12-31. **Out of sample**: 2017-01-01 .. the last complete candle
  (early November 2026). OOS halves (2017-21, 2022 on) reported only.

## Statistics

- Per test and window: n, R a trade gross and net (signal and baseline), excess net, excess at 2x costs.
- **Month t of the excess**: for each signal trade, x = net R - baseline mean net R (same window); x summed by the calendar
  month of the ENTRY, over every calendar month of the window (no entry = 0); t = mean / (sd / sqrt(months)), two-sided p
  from Student's t. Also reported: the plain month t of the signal's net R.
- **Holm** over the three OOS excess p-values.
- **Placebo**: 40 seeded draws (mulberry32, seeds 1..40); each draws as many OOS entry days as the test has OOS signals,
  uniformly from the OOS days, same side and H; its excess is recorded.

## Pass bar (per test; the study passes when T1 passes; T2 / T3 passing alone is reported, not a pass)

1. OOS excess t >= 2 with Holm p < 0.05;
2. IS excess > 0 (same sign);
3. OOS excess at 2x costs > 0;
4. OOS excess above at least 38 of the 40 placebos;
5. n >= 100 signals in each window (fewer: descriptive only).

Anything else is FAIL. No parameter (N, H, stop multiple) will be changed after a result is seen; any variant would be a new
pre-registration on other data.
