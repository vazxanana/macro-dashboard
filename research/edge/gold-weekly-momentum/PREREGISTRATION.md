# Pre-registration: weekly momentum or reversal on spot gold (14 Nov 2026)

Written and pushed alone, before any week of this study is simulated and before any weekly return of gold is computed.

## Question
Does the sign of gold's last week (or last four weeks) predict the sign of next week, tradeable after costs and financing? Or
does an extreme week revert the next week? Short-horizon time-series momentum is documented at the monthly scale across futures
(Moskowitz, Ooi and Pedersen 2012) and weekly reversal in single stocks (Lehmann 1990); this asks the weekly question on gold
alone.

## Dedupe (each RESULT.md read)
- `gold-tsmom` (FAIL): the sign of gold's 12-month return, rebalanced MONTHLY, volatility-sized; it also reported 1-, 3- and
  6-month lookbacks, still with monthly holding (none t 2). Never a one-week lookback or a one-week hold.
- `tsmom`, `tsmom-portfolio` (FAIL): monthly 12-1 month momentum on 25 markets. Monthly, a portfolio.
- `crypto-weekly-mom` (FAIL): weekly momentum on crypto coins. Not gold.
- `fx-weekly-reversal` (FAIL): a CROSS-SECTIONAL one-week reversal across nine currencies. Not gold, not time series.
- `gold-shock-revert` (FAIL): reversal / continuation the next 3 DAYS after an extreme gold DAY (2 x ATR). Daily, not weekly.
- `gold-weekly-open`, `gold-week-raid`, `gold-inside-week`: the weekly open as a level, raids of last week's high / low, inside
  and narrow weeks. Levels and ranges, never the sign of last week's return.
- `gold-record-high` (FAIL): 20 days after a record close. An event, not weekly momentum.
- `trend-breadth`, `trend-breadth-h1` (FAIL / not interpreted): the live Gold trend rule on other markets.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`) lists no weekly gold momentum study.
Not a duplicate.

## Relation to the gold book (owner decision 44)
Item 44 stops new gates, exits, entries and sizes being tested ON the gold book (Gold trend + Gold daily engulf) in its 2006-17
window. This is a stand-alone weekly rule: it reads nothing of the book, its records or `legs.json`, and a PASS would only be a
proposal for a paper shadow that the owner may approve. So the common windows of the recent stand-alone gold calendar / signal
studies are used: in sample 2008-01 to 2016-12, out of sample 2017-01 to 2026-10. Said plainly: the 2008-16 daily gold path has
been read by many earlier studies; the in-sample half is a check of sign, the decision rests on 2017-26. Gold rose strongly in
2017-26, so any long-biased rule earns gold's drift: the placebo (below) and the always-long comparison exist for that.

## Data
OANDA mid XAU_USD daily candles (UTC days), council-data `research/daily/xau.json` at commit `2e8d6a5c0` (March 2006 to
6 Nov 2026), read with `git show` (no network). Weekend stubs folded into the next weekday with `council/fills.mjs`
`foldWeekend` (so Monday's open is the Sunday reopen). Market set fixed here: spot gold only.

## Weeks
A week = the folded daily candles whose UTC date falls in the same Monday-Sunday calendar week (after folding there are only
weekday candles). Weekly open O = the first candle's open, weekly close C = the last candle's close (Monday open to Friday close;
a holiday week has fewer days and is used as it is). The last week of the file is used only if its last candle is a Friday.
Weekly return r(w) = C(w) / O(w) - 1.

## The three tests (signals use candles of week w and earlier only)
- **T1, one-week momentum (primary)**: at the close of week w, side = +1 (long) if r(w) > 0, -1 (short) if r(w) < 0, no trade if
  r(w) = 0. Every week is a signal.
- **T2, four-week momentum**: side = sign of C(w) / O(w-3) - 1 (the four weeks w-3 .. w, Monday open to Friday close).
- **T3, reversal after an extreme week**: when |r(w)| > 2 x the sample standard deviation of r over the 52 weeks BEFORE w
  (w-52 .. w-1; needs 52 earlier weeks), side = -sign(r(w)). Otherwise no trade.

## Trades (fixed here)
- Entry: market order at the OPEN of the first daily candle of week w+1.
- **Stop** (every trade has one): 2 x ATR(20) from the entry; ATR = simple mean of the 20 daily true ranges up to and including
  the last candle of week w. Checked on every daily candle of week w+1: a candle after the entry candle that OPENS through the
  stop exits at that open; else a low (long) / high (short) reaching the stop exits at the stop.
- **Time exit**: market order at the CLOSE of the last daily candle of week w+1 (Friday close).
- Weeks never overlap, so one position at a time holds by construction. 1R = the stop distance; results in R a trade.
- **Costs**: spread $0.30 an ounce a round trip plus half a spread ($0.15) of slippage on each market order (entry and exit; a
  stop fill is a market order too): $0.60 a trade, divided by the stop distance.
- **Financing** on longs: `council/fills.mjs` `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a rollover,
  the demo broker's XAUUSD swap of 11 Nov 2026, charged for every year as the council's studies do) x entry / stop distance.
  Entry time = the entry candle's UTC day start; exit time = the exit candle's day start for a stop, Friday 22:00 UTC for a time
  exit (the market closes before the Friday rollover; a full week is charged Monday, Tuesday, Wednesday x 3, Thursday = 6).
  Shorts are charged and credited nothing (`FIN.xau.short` = 0).

## Statistics and windows
- A trade belongs to the calendar month of its exit. Statistic = the monthly sums of net R over EVERY calendar month of the
  window (a month without a trade counts 0); t = mean / (sd / sqrt n).
- **In sample** 2008-01 to 2016-12; **out of sample** 2017-01 to 2026-10.
- **Holm** over the three tests, one-sided normal p of the OOS net month t.
- **Placebo**, 40 seeds (mulberry32, seeds 1-40): each test's own trades keep their weeks, entries, stops and costs, but their
  sides are shuffled at random among them (the same long / short share as the test); OOS net month t of each seed.
- **2x costs**: spread, slippage and financing doubled.

## Pass bar (each test on its own; verdict PASS if any test passes, FAIL otherwise)
All of: OOS net month mean > 0 with t >= 2 and Holm p < 0.05; the in-sample net month mean > 0 (the same sign); the OOS net month
mean > 0 at 2x costs; the OOS t above the placebo's 95th percentile (more than 38 of 40 seeds below it).

## Reported, not judged
Long trades and short trades of each test apart (n, R a trade, month t) per window; always long every week (same entries, stops,
exits, costs and financing) as the drift comparison; gross results; stops hit; year by year. A PASS leads only to a proposal for
a paper shadow, never a live change. Nothing live reads this study.
