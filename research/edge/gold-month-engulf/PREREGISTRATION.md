# Pre-registration: gold's outside (engulfing) month, held through the next month (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone monthly rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), reads none of that book's 2006-17 positions, is never read as one and says nothing about it.
The live Gold daily engulf (a daily zone candle, long only, limit entry) is a different rule on a different timeframe. Paper
research only: nothing live changes, and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Dedupe
No committed or branch study tests a MONTHLY candle that engulfs the month before. Read first: `gold-month-levels` (break or
raid of last month's high / low inside the month, FAIL), `gold-key-reversal` (daily outside / key reversal day, FAIL),
`gold-inside-week` (weekly inside bar, branch), `gold-weekly-momentum` (one-week sign, FAIL), `gold-tsmom` (12-month sign),
`gold-month-of-year`, `gold-turn-of-month`, `gold-first-week` (calendar effects). None conditions on a month whose range takes
out BOTH of the previous month's extremes. The 14 Nov untested backlog does not list it; no remote branch is named for it.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git). Complete UTC days; Saturday / Sunday candles folded into the next weekday with
`council/fills.mjs` `foldWeekend`. A month = the trading days of one UTC calendar month: open = the first day's open, high /
low = the extremes of its days, close = the last day's close. Only complete months are used.

## Rule
- **Outside month** m: high(m) > high(m-1) AND low(m) < low(m-1). **Bullish** when close(m) > open(m), **bearish** when
  close(m) < open(m) (equal: no signal).
- **Body-engulfing month** (T3 only): the previous month's body has the opposite colour, and month m's body covers it:
  max(open, close)(m) >= max(open, close)(m-1) and min(open, close)(m) <= min(open, close)(m-1), with month m's body not equal
  to the previous one. Bullish when month m closes up, bearish when down.
- Entry at the open of the first trading day of month m+1 (market). Stop 3 x ATR(20) from the entry on the losing side, ATR(20)
  = mean daily true range of the 20 days ending on the last day of month m (all closed at the signal). Exit at the close of the
  last trading day of month m+1, or the stop: checked on the daily high / low, a gap through it on a later day fills at that
  day's open. Months do not overlap, so one position at a time holds by construction.
- **T1 (primary, both sides)**: bullish outside month -> BUY month m+1; bearish outside month -> SELL month m+1.
- **T2 (long side against an unconditional same-side baseline)**: the BUY trades of T1, judged as the excess over the baseline
  in the same month. Baseline = BUY every month at the first open, same 3 x ATR(20) stop, same hold, same costs. T2's monthly
  series = (T1 buy net R - baseline net R) in a month with a bullish signal, 0 otherwise.
- **T3 (both sides)**: body-engulfing month, follow it (BUY after bullish, SELL after bearish) through month m+1, same stop and
  exit.

## Costs
$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders), as gold-key-reversal / gold-streak. Buys
pay financing: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday
three; the demo broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year.
2x costs = both the round trip and the financing doubled.

**Cost share of R, stated before the run** (estimate, from gold's typical daily range of about 1.0-1.5 % of price): the stop is
about 3-4.5 % of price, so roughly $25-40 in 2007-16 and $60-180 in 2017-26 (median expected well above $10); the round trip is
about 1-2 % of R; a held month of a buy pays about 22 nights x 0.0148 % = 0.33 % of price, about 0.07-0.11R. Financing, not the
spread, is the cost that matters here; both are reported as measured (costR, finR, median stop in $).

## Windows
In sample 2007-01 to 2016-12; out of sample 2017-01 to 2026-10 (by entry month; the last complete held month on file is October
2026). OOS halves: 2017-2021 and 2022-2026-10.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing was held). One-sided
p from that t (normal), Holm over the three tests (T1-T3).
Placebo (T1): 40 seeds (1..40); each keeps T1's OOS entry months and draws the side of every trade at random (buy or sell,
50/50, financing on the buys); the statistic is OOS net R a trade.

## Pass bar (the study passes only if T1, the primary, passes; T2 and T3 are reported under the same Holm family)
1. OOS net R a trade > 0;
2. OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228 (the p of t = 2);
3. net R a trade > 0 in sample AND in both OOS halves;
4. OOS net R a trade > 0 at 2x costs;
5. OOS net R a trade above at least 38 of the 40 placebo draws.

Expected sample: an outside month is rare (perhaps 10-20 % of months), so each window may hold only 15-30 trades; a small n is
reported as such and cannot pass on t below 2.

Also reported, not part of the bar: gross figures, the baseline, exits by kind, years, median stop in $, cost share of R.

Files: `run.mjs`, `result.json`, `RESULT.md`; test `tests/gold-month-engulf.test.mjs`.
