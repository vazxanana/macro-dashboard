# Pre-registration: inside weeks, narrow weeks and the held Monday range on spot gold (14 Nov 2026)

Written and committed alone, before any trade of this study was computed. Paper research: nothing here is read by the council,
the mirror or the page, and no live rule changes whatever the verdict. Not a study of the gold book.

**Item 44 (docs/owner-decisions.md).** No gate, exit, entry or size of the supported gold book (Gold trend, Gold daily engulf) is
tested here. These are new stand-alone rules, judged on their own trades; nothing of the book's positions or record is read.

## Dedupe (read before writing this)
- `nr7-breakout` (branch `nr7-breakout`, FAIL): DAILY NR7 on six markets including gold, next-day bracket, H1 path. Not weekly.
- `gold-squeeze` (FAIL): Bollinger-inside-Keltner release on gold H4 / D1. Not a range-contraction bracket.
- `gold-week-raid` (FAIL): a raid of the previous week's high / low and a REVERSAL back inside. The opposite direction of this.
- `fx-weekly-reversal` (FAIL): cross-sectional one-week reversal in currencies. Unrelated mechanics.
- `gold-weekly-open` (another branch): anchored on the weekly open price. Not used here: no rule below reads the weekly open.
- `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): no inside-week, NR4-week or Monday-range rule.
So the weekly inside / narrow-week breakout and the Monday-to-Wednesday held range on gold are untested here.

## The question
Range contraction on the weekly bar (an inside week; the narrowest week of the last four) is a widely taught breakout setup, and
the MMXM / ICT material the owner supplied says a Monday range that holds through Wednesday comes before a Thursday / Friday
expansion. On spot gold, after costs, does a stop-order bracket at those ranges make money?

## Data and why daily candles
- OANDA mid XAU/USD daily candles, council-data `research/daily/xau.json` (`git show origin/council-data:...`, no network;
  March 2006 to 6 Nov 2026), UTC days, folded with `council/fills.mjs` `foldWeekend` (imported): the Sunday reopen stub is part
  of Monday. Weeks = folded trading days grouped Monday to Friday (UTC).
- Why daily and not H1: weekly signals are rare (an inside week is roughly one week in six), so the sample needs 2008 on; OANDA
  H1 from 2016 would give no in-sample window. The stops here are a week's (or a Monday's) range, so a daily candle rarely holds
  both the entry and the stop; when one does it is booked as a loss (below) and the count is reported.

## Windows (fixed here)
- In sample: signals whose order window starts 2008-01-01 to 2016-12-31. Out of sample (decisive): 2017-01-01 to 2026-10-31
  (the trade must close by the last daily candle on file). Warm-up 2006-2007 only for the look-back.

## The rules (no parameter is chosen by the data)
Common: a signal week must hold at least 4 trading days (holiday-short weeks are not signals). Orders are OCO: a buy stop at
the range high and a sell stop at the range low; the first traded wins, the other is cancelled. **Every trade has a stop: the
opposite side of the range**, never moved. One position at a time: a signal whose order window starts while a trade is still
open is skipped (counted). Entries fill at the level, or at the day's open when it is already beyond the level (gap, the worse
price). After the entry day, a day trading through the stop exits at the stop, or at its open when it opens beyond (gap).
**A day that trades both the buy and the sell level is booked as a loss** of the full distance (entry at one side, stopped at
the other), whichever came first. On the entry day the stop can only be reached on such a both-levels day. 1R = |fill - stop|.
- **T1 (primary) inside week**: week N with high(N) < high(N-1) and low(N) > low(N-1). Orders live every day of week N+1;
  exit at the last close of week N+2 (or the stop).
- **T2 narrow week (NR4 week)**: week N whose range high - low is strictly smaller than each of the three weeks before it.
  Same orders, stop and exit as T1. (Overlaps T1 in part; both reported.)
- **T3 held Monday range**: in week N, Tuesday and Wednesday trade inside Monday's range (both days' high <= Monday's high and
  low >= Monday's low; Monday, Tuesday, Wednesday and Thursday all present). Orders at Monday's high / low live on Thursday and
  Friday of week N; exit at Friday's close (or the stop). (The 4-trading-day minimum applies: Mon-Thu present.)

## Costs (in R of each trade)
- $0.30 round-trip spread plus half a spread ($0.15) of slippage per market order: the stop entry and the exit (stop or close)
  are both market orders, so $0.60 a trade (a both-levels day too). 2x costs = $1.20.
- Financing on buys only: `council/fills.mjs` `nights(t, c)` x `FIN.xau.long` (0.000148 a rollover, the demo broker's XAUUSD
  swap of 11 Nov 2026, applied to every year) x entry / risk. Entry time = the start of the entry day (a rollover that day
  counts), exit time = 21:00 UTC of the exit day (before that day's rollover). Sells pay and receive nothing.

## Statistics and the bar
- Per test and window: n, gross and net R a trade, net at 2x costs, total, win rate, worst drawdown, t on calendar-month sums of
  net R by exit month (every month of the window counted, 0 where none), one-sided p.
- Holm over the three tests' out-of-sample one-sided p values (alpha 0.05).
- Placebo, 40 seeds (mulberry32, seeds 1-40), out-of-sample window: the same rule on random weeks. T1 / T2: a random week of the
  window (at least 4 trading days) stands in for each taken trade, its range bracketed in the next week with the same exit;
  T3: a random week (Monday to Thursday present), its Monday-to-Wednesday high / low bracketed on Thursday and Friday. Same count
  as the real signals, same costs. Real out-of-sample net R a trade compared with the placebo's 95th percentile.
- **A test passes only with all of**: out-of-sample net R > 0, out-of-sample month t >= 2, Holm significant, in-sample net R > 0
  (same sign), out-of-sample net at 2x costs > 0, above the placebo's 95th percentile. Verdict = how many of 3 pass; the primary
  is T1. A pass is a paper candidate for the owner, never a live rule.

## Reported, not judged
Buys vs sells, by year, both-levels-day count. Anything looked at after the results is labelled post hoc.
