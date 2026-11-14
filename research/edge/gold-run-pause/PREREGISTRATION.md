# Pre-registration: gold after a run of daily closes broken by ONE opposite close (14 Nov 2026)

Written and pushed alone, before any trade, return or R of this rule was computed. The only thing read from the data before
this file was the number of signal days per window (below), as the study brief requires. Paper research only: nothing live
changes, and no proposal follows from this file.

**Item 44.** A new stand-alone daily rule on spot gold, judged on 2017-26. It is not a gate, exit, entry or size change of
the gold book (Gold trend / Gold daily engulf), and none of that book's 2006-17 positions is read.

## Why this is not a duplicate
- `gold-streak` (FAIL) traded the day(s) right after a run that is STILL running at the signal (3+ / 4+ closes one way ending
  at the signal day), holds 1 and 3 days. This study waits for the run to be broken by exactly one opposite close and only
  then trades, for five days: the signal day is a pause, not a run, and the hold is longer. Not one signal day of this study
  is a signal day of `gold-streak` (a run ending at day i and a one-day pause at day i are exclusive).
- `gold-staircase` (higher highs and higher lows, runs ending at the signal), `gold-week-exhaustion` (a stretched week faded to
  Friday), `gold-weekly-momentum` (last week's sign) and the intraday pullback studies (`gold-ny-impulse-pullback`,
  `gold-h4-pullback-resume`) condition on other things. The live momentum-pullback system is not read.

## Hypotheses
- **H1 (primary, T1)**: after three or more up closes in a row, the first down close is a pause inside a run that continues: a
  buy at the next open, held five trading days, does better than a buy on any day.
- **H2 (T2)**: the mirror: after three or more down closes in a row, the first up close is a pause in a fall that continues: a
  sell held five days does better than a sell on any day.
- **H3 (T3)**: the opposite reading of the same days as T2: the first up close after three or more down closes marks the turn:
  a buy held five days does better than a buy on any day.

## Data
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show origin/council-data:…`, no network), 2006-03-20 to
2026-11-13, weekend candles folded into the next weekday by `council/fills.mjs` `foldWeekend`: 5,369 trading days. The candle
copy is kept outside git and deleted at the end. Market set fixed now: spot gold only.

## Rule (exact)
- Close direction of day i: up when close(i) > close(i-1), down when below; an equal close is neither and ends any run.
- Run length r(i): +n = n up closes in a row ending at day i, -n = n down closes; 0 on an equal close.
- **Signal day i** for an up-run pause: r(i) = -1 (day i is a down close) and r(i-1) >= +3. Down-run pause: r(i) = +1 and
  r(i-1) <= -3. Everything is known at the close of day i.
- Entry at the open of day i+1. Stop 2 x ATR(14) (true range of days i-13 .. i, known at the signal) on the losing side;
  a day that opens through the stop exits at that open; otherwise a touch exits at the stop. Out at the close of the fifth
  trading day (i+5) when not stopped. No target.
- One position at a time per test: a signal while that test's position is open is skipped.
- R = (exit - entry) / risk x side, risk = the stop distance.

## Costs
$0.60 a round trip on every trade (the brief's figure; above the measured 0.0042 % demo round trip at today's price), plus on
buys overnight financing `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the cTrader demo's XAUUSD swap of
11 Nov 2026, `council/fills.mjs`) x entry price, in R by dividing by the risk. Sells pay and receive nothing. The same rate is
used for every year (a stated assumption). 2x costs = both doubled.

## Windows
In sample (IS) 2007-01-01 to 2016-12-31; out of sample (OOS) 2017-01-01 to 2026-10-31; a trade belongs to the window of its
entry day; month sums by entry month. Signal days counted before this file (all signal days, before the one-position rule):
up-run pauses (T1) IS 172, OOS 185; down-run pauses (T2, T3) IS 137, OOS 126.

## Statistics
- Per test and window: n, gross R a trade, cost and financing R, net R a trade, total, win rate, stop exits.
- **t on calendar-month sums of net R** (every month of the window counts, empty months 0), one-sided p from the normal.
- **Same-side every-day baseline**: the same side, stop, hold and costs entered at the open after EVERY trading day of the window
  (overlapping, a pool, not a test). Excess = test net R a trade minus baseline net R a trade, with a Welch t.
- **Holm** over the three one-sided OOS p values.
- **Placebo** (40 seeds, mulberry32 seeds 1-40): the same OOS trade days and hold with the side drawn at random per trade.
- **Control that keeps drift and volatility but removes the signal** (40 seeds, seeds 101-140): for each calendar year of the
  OOS window, the same number of trades as the test took that year, entered on random trading days of that year (drawn
  without replacement, one position at a time, the same side, stop, hold and costs). It keeps the year's drift and volatility
  and the trade count, and removes which days were picked.

## Pass bar (per test; the study's verdict is PASS only if T1 passes)
1. OOS net month t >= 2 and Holm-adjusted one-sided p <= 0.0228.
2. IS net R a trade > 0 (same sign).
3. OOS net R a trade > 0 at 2x costs.
4. OOS excess over the same-side baseline > 0.
5. OOS net R a trade above at least 38 of 40 placebo draws AND at least 38 of 40 control draws.
T2 and T3 passing alone would be a lead to replicate, not an edge. Nothing about the rule (run length 3, the hold of 5 days,
the 2 x ATR(14) stop) is changed after a result. Any later variant needs its own pre-registration on other data.

## Deliverables
`run.mjs` (`fetch <dir>`, then `full <dir>`), `RESULT.md` with the bold verdict line, `result.json`, and
`tests/gold-run-pause.test.mjs` (rule on hand-made candles, no look-ahead, the report against result.json).
