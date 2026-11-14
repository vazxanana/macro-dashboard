# Pre-registration: the MAX (lottery) effect on gold's own daily returns (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), is never read as one and says nothing about it. Paper research only: nothing live changes,
and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Idea
The MAX effect (stocks whose largest single daily gain over the past month was extreme earn less afterwards: lottery-like
demand overprices them) read in time series on one market: after gold has printed an unusually large single-day gain within
the last 20 days, do its next days lag? And after a month with no large day, do they lead?

## Dedupe
No committed or branch study conditions gold on the largest single daily return of a recent window. Closest:
`fx-max-effect` (branch, FAIL) ranks seven G10 currencies against each other by their monthly MAX (cross-section, FX, not
gold); `gold-realized-skew` (third moment of returns, FAIL); `gold-hourly-shock`, `gold-haven-shock`, `gold-shock-revert`,
`gold-capitulation` (a reaction to ONE big move on the day or next day, not a month-long maximum ranked against its own
history). The 14 Nov untested backlog does not list a gold MAX test.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git, deleted after the run). Complete UTC days; Saturday / Sunday candles folded into the
next weekday with `council/fills.mjs` `foldWeekend`.

## Rule
- Daily return r(i) = close(i) / close(i-1) - 1. MAX20(i) = the largest r(j) for j = i-19 .. i (known at the close of i).
- Rank: the share of the previous 250 values MAX20(i-250) .. MAX20(i-1) that are strictly below MAX20(i). HIGH = rank >= 0.80;
  LOW = rank <= 0.20. Needs 270 days of history; known at the close of day i, nothing later read.
- ATR(14) at day i = mean true range of days i-13 .. i. Entry at the open of day i+1 (market). Stop 1.5 x ATR(14) from the
  entry on the losing side, checked on daily high / low; a gap through it on a later day fills at that day's open. Out at the
  close of the last day held. One position at a time per test (a signal while a trade is open is skipped).
- **T1 (primary)**: HIGH -> SELL, hold 5 days.
- **T2**: HIGH -> SELL, hold 10 days.
- **T3**: LOW -> BUY, hold 5 days.
- Drift baseline per test: the SAME side, stop and hold entered on EVERY eligible day (every day with the rank's history), one
  position at a time. Excess = the test's OOS net R a trade minus that baseline's (Welch t on trades).

## Costs
$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders). Buys pay financing:
`council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three; the demo
broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year. 2x costs = both
doubled.

## Windows
In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves: 2017-2021 and
2022-2026-10.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing closed). One-sided
p from that t (normal), Holm over the three tests.
Placebo: 40 seeds (1..40); each draws, for a test, as many OOS entry days as the test had, at random from the eligible OOS
days, and trades them with the test's side, stop and hold (one at a time); the statistic is OOS net R a trade.

## Pass bar (per test; the study passes if any test passes)
1. OOS net R a trade > 0;
2. OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228;
3. net R a trade > 0 in sample AND in both OOS halves;
4. OOS net R a trade > 0 at 2x costs;
5. OOS excess over the same-side every-day baseline > 0 with Welch t >= 2;
6. OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported, not part of the bar: gross figures, exits by kind, years, signals, and how far HIGH days coincide with high
ATR (the MAX of a month partly measures volatility).

Files: `run.mjs`, `result.json`, `RESULT.md`; tests `tests/gold-max-effect.test.mjs`.
