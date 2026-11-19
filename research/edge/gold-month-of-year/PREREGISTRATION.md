# Pre-registration: gold's month of the year (14 Nov 2026)

Written and pushed before any number of this study is computed. Paper only: nothing live changes, whatever the verdict.

## Why
The gold terminal (`gold-trading.html`) scores the calendar month in `computeMacroScore()`:
`seasS = [10,11,0,1].includes(month) ? 9 : [2,5].includes(month) ? 5 : 7` (JavaScript months, 0 = January). Its tile reads
"Seasonal tendency (not tested here)", because no study in this repository tests gold's month of the year
(`research/edge/seasonality` tested clock and calendar windows, not months). This study tests exactly what the page encodes:

- **Strong months (the page): November, December, January, February** (score 9).
- **Weak months (the page): March and June** (score 5).

The common outside claim (January, August, September strong; March, June weak) shares the weak months and only January among
the strong ones. The page's sets are the tested ones. The outside strong set (Jan, Aug, Sep) is **reported only**, never tested,
never in Holm, never a verdict.

**This is a gold-only window and NOT a gate on the live gold book.** Owner rule (docs/owner-decisions.md item 44, 12 Nov 2026):
no further gate, exit, entry or size is tested on that book's 2006-17 window. Nothing here is proposed as a filter, size step
or rule for Gold trend, Gold daily engulf or any council system. A PASS would only change the gold terminal's wording about the
seasonal tile, and only by the owner's decision; a FAIL keeps the tile as it is (any change of its words is also the owner's
call).

## Data
- council-data `research/daily/xau.json` (OANDA mid XAU/USD daily candles, UTC days; `git show
  origin/council-data:research/daily/xau.json`, copied outside git by `run.mjs fetch <dir>`; its sha256 is recorded in
  result.json). It starts 20 March 2006 (OANDA serves gold from March 2006; the HistData files in council-data start later, so
  they add nothing). No other data, no network at run time.
- Saturday / Sunday candles (the Sunday reopen stub) are folded into the next weekday with `council/fills.mjs` `foldWeekend`
  (imported). A day's month is the UTC calendar month of its candle time.
- Only complete months are used: the month containing the file's last candle is dropped (the file ends 6 Nov 2026, so the
  last month is October 2026).

## Windows
- **Decisive: January 2016 to October 2026.**
- **Replication: everything earlier the data covers**: T2 / T3 from April 2006 (the first complete month; March 2006 is
  partial), T1 from the first month with 20 completed days before it (May 2006).

## Tests (three, Holm over the three, one-sided in the claimed direction)

**T1 (tradeable).** One gold long per strong month: buy at the open of the month's first (folded) daily candle; stop =
entry - 3 x ATR(20), ATR = the mean true range of the 20 folded daily candles before that candle; exit at the close of the
month's last daily candle, or at the stop when a day's low reaches it (filled at the stop, or at the day's open when it opens
through it: `fills.mjs` `stopFill`, imported). R = (exit - entry) / (3 x ATR). Net R = R - $0.30 / risk - financing, financing =
`nights(entry time, exit time)` x `FIN.xau.long` x entry / risk (both imported from `council/fills.mjs`, never copied); entry
time = the first candle's time (00:00 UTC), exit time = the last candle's time + 21 h on a Friday (before the Friday 22:00
rollover, the market is shut) and + 23 h on Monday-Thursday, or the stopping day's same time.
The same position is built in EVERY month (the "every month" book). Statistic: mean net R of the strong-month positions minus
mean net R of the other eight months' positions, Welch t (per position). Reported beside it: the every-month book's mean net R
(the comparison asked for: strong - every = 2/3 x (strong - rest), same sign), and the strong-only book's own mean net R, t,
total and worst drawdown.

**T2.** For each month, its mean daily return = the mean of its days' close-to-close log returns (the first day's from the
previous day's close), in basis points. Statistic: mean over the strong months minus mean over the other months, Welch t with
months as the observations.

**T3.** The same as T2 for the weak months as a SHORT claim: statistic = mean over the other ten months minus mean over the
weak months (positive = the weak months are weaker), Welch t on months.

p-values: one-sided, Student t with Welch-Satterthwaite degrees of freedom. Holm at 0.05 over T1-T3 in the decisive window.

## Placebo (each test)
1,000 random month sets of the same size (4 calendar months for T1 / T2, 2 for T3), drawn uniformly without replacement from
the twelve, seeded (mulberry32, seed 20261114). Each set's statistic is computed in the decisive window exactly as the claimed
set's. Placebo share = the share of random sets whose statistic is **at least** the claimed set's (ties count against).

## Cost check
T1 at 2x cost: $0.60 a round trip and twice the financing. T1 passes only if, at 2x, the strong-month mean net R is still above
the other months' and positive in the decisive window.

## Pass bar (per test)
1. Positive in both windows: the statistic has the claimed sign in the decisive AND the replication window (T1 also: the
   strong-month book's own mean net R > 0 in both windows).
2. Decisive Holm-adjusted p < 0.05.
3. Placebo share < 5 %.
4. T1 only: the 2x-cost check above.

**Verdict:** PASS if every test passes its bar; PARTIAL if at least one but not all do (named); FAIL if none does.
Whatever the verdict: no council rule, filter, size or trade changes; the page wording stays until the owner decides.

## Reported, not tested
Each calendar month's mean daily return and T1 book per window; the outside strong set (Jan, Aug, Sep) through T1 / T2 with
its placebo share; year by year of the strong-month book.
