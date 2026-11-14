# Pre-registration: gold after three strong daily candles one way (three white soldiers / three black crows) (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), does not use the book's 2006-17 positions, is never read as one and says nothing about it.
Paper research only: nothing live changes, and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Dedupe
- `candle-patterns` (branch, FAIL 0 of 14): six one- to three-candle reversal patterns (engulfing, hammer, star) on 28 CFD
  markets, **gold excluded**; no run of three same-colour bodies, no continuation reading.
- `gold-streak` (branch, FAIL 0 of 3): consecutive CLOSES one way (any body, any size), held 1-3 days, fading the streak and
  short holds. This study needs three LONG BODIES (body at least half the day's range, open-to-close the same way) as well as
  higher closes, reads the run as continuation first, and holds two weeks.
- `gold-capitulation` (largest 5-day move of the year), `gold-shock-revert` (one move over 2 x ATR), `gold-key-reversal`,
  `gold-ibs`, `gold-month-engulf`, `gold-heikin-ashi` (smoothed colour, not raw bodies): other conditions.
- No remote branch or line of the shared topic list names soldiers, crows or "three"; the 14 Nov untested backlog does not
  list it.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git). Complete UTC days; Saturday / Sunday candles folded into the next weekday with
`council/fills.mjs` `foldWeekend`.

## Rule
- A **strong up day** i: close > open, (close - open) >= `body` x (high - low), high > low, and close > the previous day's close.
  A strong down day: the mirror (open - close >= body x range, close < previous close).
- **Three white soldiers** at day i: days i-2, i-1, i all strong up days. **Three black crows**: the mirror. Known at the close
  of day i. A fourth strong day in a row is again a signal day (one position at a time decides).
- ATR(20) at day i = mean true range of days i-19 .. i (all closed at the signal).
- Entry at the open of day i+1 (market). Stop 2 x ATR(20) from the entry on the losing side. Exit at the close of the
  `hold`-th trading day held (day i+hold), or the stop: checked on the daily high / low, a gap through it on a later day fills
  at that day's open. **Every trade has a stop.** One position at a time per test (a signal while that test's trade is open
  is skipped).
- **T1 (primary, both-sided, continuation)**: body >= 0.5; soldiers -> BUY, crows -> SELL; hold 10 days.
- **T2 (both-sided, fade)**: body >= 0.5; soldiers -> SELL, crows -> BUY; hold 5 days.
- **T3 (both-sided, continuation, looser body)**: body >= 0.3; soldiers -> BUY, crows -> SELL; hold 10 days.
- Baseline (comparison, not a test): for each test, the same hold and stop entered at EVERY day's open on the side the test
  took (one at a time), buys and sells built apart and pooled by the test's own mix of sides: the OOS difference test minus
  the unconditional same-side baseline is reported with a Welch t.

Signal counts (counted before this file was written; no outcome was read, only how often the pattern prints and how large
its ATR is, to state power): body >= 0.5 gives about 50 soldiers and 30 crows 2006-26 that start a run (fewer as trades,
since one position at a time), so T1 is expected to have only about 30-45 OOS trades: **low power**; t >= 2 there needs
roughly +0.3R a trade. Body >= 0.3 gives about 150 / 100.

## Costs (and their share of R, fixed now)
$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders), as gold-streak / gold-ibs. Buys pay
financing: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three;
the demo broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year.
2x costs = both the round trip and the financing doubled.
Cost share: the median stop at the signal days 2007-26 is about $38 (2 x ATR(20)), so the round trip is about 0.016R; a
10-day buy pays about 14 nights, about 0.076R of financing at the median; a pooled continuation trade (about 60 % buys)
therefore carries roughly 0.06R of cost. Median stop well over the $10 floor.

## Windows
In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves: 2017-2021 and
2022-2026-10.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R by entry month (every month of the window counts, 0 when nothing was
entered). One-sided p from that t (normal), Holm over the three tests (T1-T3).
Placebo: 40 seeds (1..40); each keeps a test's own OOS trade days and holds and draws the side of every trade at random (buy or
sell, 50/50, financing on the buys); the statistic is OOS net R a trade.

## Pass bar (per test; the study passes if any test passes; T1 is the primary)
1. OOS net R a trade > 0;
2. OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228 (the p of t = 2);
3. net R a trade > 0 in sample (the same sign) AND in both OOS halves;
4. OOS net R a trade > 0 at 2x costs;
5. OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported, not part of the bar: gross figures, the same-side baseline and the difference to it, buys and sells apart,
exits by kind, years.

Files: `run.mjs`, `result.json`, `RESULT.md`; test `tests/gold-three-soldiers.test.mjs`.
