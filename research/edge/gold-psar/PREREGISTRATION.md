# Pre-registration: gold's daily Parabolic SAR stop-and-reverse, both sides (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), reads none of its 2006-17 positions, is never read as one and says nothing about it. Paper
research only: nothing live changes, and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Dedupe
No committed or branch study computes a Parabolic SAR. Closest, read first: `gold-h4-supertrend` (an ATR band trail on H4),
`gold-adx-trend`, `gold-tsmom`, `gold-macd`, `gold-ichimoku`, `gold-heikin-ashi` (other daily trend signals, all FAIL). The SAR
is an accelerating trailing stop whose touch both exits and reverses: neither an ATR band, a return-sign rule nor a moving-average
cross. No remote branch has "sar" or "parabolic" in its name, the 14 Nov untested backlog does not list it, and the scratchpad
topic list had no such slug when `gold-psar` was claimed.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git). Complete UTC days; Saturday / Sunday candles folded into the next weekday with
`council/fills.mjs` `foldWeekend`.

## Parabolic SAR (Wilder), known at the close of each day
Start: day 1 is long when close(1) >= close(0), SAR = low(0), extreme point EP = high(1) (short: SAR = high(0), EP = low(1)),
acceleration AF = start. Each next day j, SAR(j) = SAR(j-1) + AF x (EP - SAR(j-1)), then clamped: in a long trend never above the
lows of days j-1 and j-2, in a short trend never below their highs. SAR(j) is therefore known before day j opens.
- Long trend, day j's low <= SAR(j): the trend reverses on day j (a **flip to short**); the new SAR = the old EP (the highest
  high of the long trend, at least day j's high), EP = day j's low, AF = start.
- Short trend, day j's high >= SAR(j): **flip to long**, new SAR = the old EP (the lowest low, at most day j's low), EP = day
  j's high, AF = start.
- No flip: when day j makes a new extreme in the trend's direction, EP takes it and AF += step, capped at max.

## Rule
- **Signal day i** = a flip day. Side = the new trend (flip to long -> BUY, flip to short -> SELL).
- Entry at the open of day i+1 (market). The stop for day i+1 is SAR(i+1) as computed from days up to i; every later day j the
  stop is SAR(j) (it only moves with the trade). The trade is skipped when the entry is already on the wrong side of that first
  stop (a gap through it), so every trade has a positive risk = |entry - first stop| (1R).
- Exit: the first day whose range reaches the day's SAR: at the SAR, or at the open when that day opens beyond it (a gap). That
  is the flip day of the opposite trend; its new trade enters the next open. Time exit at the close of the 60th day held (a
  safety cap). The stop is checked before anything else on every day, including the entry day.
- One position at a time per test (a flip while a trade of that test is open is skipped; by construction the exit day is
  itself a flip, so a test trades almost every flip).
- **T1 (primary)**: AF start 0.02, step 0.02, max 0.20 (Wilder's values), both sides.
- **T2**: AF start 0.01, step 0.01, max 0.10 (a slower SAR), both sides.
- **T3**: as T1, both sides, a flip taken only in the direction of the close of day i against its 200-day simple average of
  closes (days i-199..i; BUY above, SELL below).
- Baselines (comparison, not tests): unconditional same-side trades: BUY at every day's open and SELL at every day's open, stop
  2 x ATR(14) (days i-13..i) never moved, 10-day hold, one at a time. Reported beside T1-T3, not part of the bar.

## Costs, and the cost share of R (stated before the run)
$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders), as gold-streak / gold-heikin-ashi. Buys pay
financing: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three;
the demo broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year.
2x costs = both the round trip and the financing doubled.
Expected size: the first SAR after a flip is the old trend's extreme, typically 1-4 daily ATRs away, so a median stop of roughly
$30-100 (well over the $10 required). The round trip is then about 0.01-0.02R a trade; financing on a buy held about two weeks
costs about 0.05-0.10R. Total cost share expected at about 0.03-0.06R a trade averaged over buys and sells, measured and reported.

## Windows
In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves: 2017-2021 and
2022-2026-10 (reported).

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing closed; a trade is
dated by its entry). One-sided p from that t (normal), Holm over the three tests (T1-T3).
Placebo: 40 seeds (1..40); each keeps a test's own OOS trades (entry day, risk in dollars, exit day) and draws the side at random
(buy or sell, 50/50): stop fixed at entry -/+ the same risk, exit at that stop (gap fills at the open) or at the original trade's
exit day's open price if the stop was not reached; financing on the buys. The statistic is OOS net R a trade.

## Pass bar (the verdict is the primary test T1's; T2 and T3 are reported with their own checks)
1. T1 OOS net R a trade > 0;
2. T1 OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228 (the p of t = 2);
3. T1 net R a trade > 0 in sample (same sign);
4. T1 OOS net R a trade > 0 at 2x costs;
5. T1 OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported, not part of the bar: gross figures, both OOS halves, the baselines, the OOS difference of each test's buys and
sells to the same-side baseline (Welch t on trades), exits by kind, median stop in dollars, median hold, years.

Files: `run.mjs`, `result.json`, `RESULT.md`; tests `tests/gold-psar.test.mjs`.
