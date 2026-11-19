# Pre-registration: the "double seven" pullback buy on gold's daily chart, judged against gold's own drift (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of these rules was computed. Before writing it only the
NUMBER of signal days per window was counted (to check the tests have power; no price after a signal was read): about 140
long and 80 short first-of-a-run signal days in sample, 160 and 75 out of sample.

**Question.** Connors and Alvarez ("Short Term Trading Strategies That Work", 2009) describe the "double seven": in a
market above its 200-day average, buy the close that is the lowest close of the last seven days and sell the first close
that is the highest of the last seven. Does that pullback buy on gold do better than the SAME trade (same filter, same exit
rule, same stop) taken after every day gold is above its 200-day average? And does the mirror sell work below the average?
The idea: a short pullback inside a long uptrend is a cheap entry, not just a day in the trend.

**Why this topic.** A stand-alone gold rule of my own choosing, said as such, chosen from its published origin, not from any
gold table. Dedupe (14 Nov 2026): no folder under `research/edge/`, no remote branch and no line of the 14 Nov
untested-backlog list names the double seven, a seven-day low close or this exit. Closest done studies: `metals-rsi2` /
`rsi2-pullback` (an RSI(2) threshold), `gold-ibs` (close location in the day's range), `gold-momentum-pullback`,
`gold-streak`, `gold-200d-stretch`. This study differs in its trigger (a seven-day lowest close, no oscillator), its exit
(a seven-day highest close) and its primary test: an EXCESS over the same-side trade entered on EVERY eligible day, so
gold's rise from 2007 to 2026 cannot pass as an edge.

**What this is not.** Not a gate, exit, entry, filter or size of the live gold book (Gold trend + Gold daily engulf); it reads
nothing of it; owner decision 44 is untouched. Paper research only: nothing live changes, no file under `ict/` or
`council/` is edited (`council/fills.mjs` is imported for `nights`, `FIN` and `foldWeekend` only).

## Data (fixed before any result)

- Market: **spot gold only (XAU/USD)**, OANDA mid daily candles, council-data `research/daily/xau.json`
  (`git show origin/council-data:research/daily/xau.json`, no network; kept outside git). Rows start March 2006.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`; complete days only.
- Signals whose entry day is 1 January 2007 or later (2006 is warm-up for the 200-day average).

## The rule (everything read on the close of day i; the order fills at the OPEN of day i+1)

- `SMA200[i]` = mean of the closes of days i-199 .. i. `ATR14[i]` = simple mean of the last 14 true ranges up to day i.
- **Low-7 day**: close[i] < every close of days i-6 .. i-1 (the lowest close of seven, strictly). **High-7 day**: the mirror.
- **Buy signal** (T1): a low-7 day with close[i] > SMA200[i]. **Sell signal** (T2): a high-7 day with close[i] < SMA200[i].
  **T3**: a low-7 day, no average filter.
- **One position at a time** in each signal stream (as the published rule): a signal is taken only when the stream's
  previous trade has already exited (its exit open is at or before the new entry open).

## The trade (signal and baseline alike)

- Enter at the open of day e = i+1 on the given side. **Every trade has a stop**: 2 x ATR14[i] from the entry, never moved,
  checked from the entry day on (a day opening beyond it fills at that open; else at the stop).
- **Exit**: buy: the first day j >= e whose close is a high-7 close (higher than every close of days j-6 .. j-1); out at
  the open of j+1. Sell: the first low-7 close. **Time limit**: if no such close by day e+14, out at the open of day e+15.
- 1R = the stop distance; R = (exit - entry) x side / stop distance.
- **Baseline**: the same trade entered after EVERY eligible day of the window (T1: every day with close > SMA200; T2:
  every day with close < SMA200; T3: every day), each its own trade, overlapping. Its mean is gold's drift for this trade
  shape and filter.

## Costs

- **$0.60 an ounce a round trip**, as 0.60 / stop distance in R.
- **Financing on buys**: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, demo broker XAUUSD swap of
  11 Nov 2026, `council/fills.mjs`) x entry / stop distance; sells charged and credited nothing. Today's rate every year.
- **2x costs**: $1.20 and twice the financing (signal and baseline both).

## The three tests

- **T1 (primary)**: buy signal, excess net R a trade over the every-day buy above the 200-day average.
- **T2**: sell signal, excess over the every-day sell below the 200-day average.
- **T3**: low-7 buy with no filter, excess over the every-day buy.

## Windows

- **In sample**: entry day 2007-01-01 .. 2016-12-31. **Out of sample**: 2017-01-01 .. the last complete candle
  (mid November 2026). OOS halves (2017-21, 2022 on) reported only.

## Statistics

- Per test and window: n, win share, R a trade gross and net (signal and baseline), excess net, excess at 2x costs.
- **Month t of the excess**: for each signal trade, x = net R - baseline mean net R (same window); x summed by the calendar
  month of the ENTRY over every calendar month of the window (no entry = 0); t = mean / (sd / sqrt(months)), two-sided p
  from Student's t. Also reported: the plain month t of the signal's net R.
- **Holm** over the three OOS excess p-values.
- **Placebo**: 40 seeded draws (mulberry32, seeds 1..40); each draws as many OOS entries as the test has OOS signals,
  uniformly from that test's OOS baseline trades; its excess is recorded.

## Pass bar (per test; the study passes when T1 passes; T2 / T3 passing alone is reported, not a pass)

1. OOS excess t >= 2 with Holm p < 0.05;
2. IS excess > 0 (same sign);
3. OOS excess at 2x costs > 0;
4. OOS excess above at least 38 of the 40 placebos;
5. n >= 100 signals in each window (fewer: descriptive only; T2 is expected to fall short of this).

Anything else is FAIL. No parameter (7 days, 200-day average, 2 ATR stop, 15-day limit) will be changed after a result is
seen; any variant would be a new pre-registration on other data.
