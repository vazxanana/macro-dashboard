# Pre-registration: gold in the month after a washout month (a month that closed at its low), 14 Nov 2026

Written and pushed alone, before any trade of this rule was simulated. Paper research only: nothing live reads it, no
rule, size, filter, stop, config or council member changes whatever the result.

## Question
When a calendar month of gold closes in the bottom tenth of its own high-low range (a "washout" month: sellers in control
into the month end), or posts the worst monthly return of the past year, does gold rise over the following weeks by more
than it does on an ordinary day of the same year, net of costs? And does a month that closed in the top tenth of its range
fall afterwards?

A **stand-alone multi-day rule** with wide stops. It is not a gate, exit, entry or size change of the live gold book (Gold
trend / Gold daily engulf) and reads none of that book's 2006-17 positions (owner decision 44). Not covered by an earlier
study: the nearest are `gold-month-engulf` (an outside month, held a month), `gold-month-levels` (last month's high / low as
price levels), `gold-capitulation` (the largest 5-DAY move of the year), `gold-13w-low` (a 13-week closing low),
`gold-week-close-extreme` (the WEEKLY close location, in progress elsewhere) and `gold-month-of-year`; none conditions on the
MONTH's close location in its range or on the month's return rank in the past year.

## Data (named before any result)
- One market: XAU/USD only. council-data `research/daily/xau.json` at commit `c721916f3` (OANDA mid daily candles, UTC days,
  2006-03-20 to 2026-11), weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend`. Calendar months
  are built from these days (open = first day's open, high / low over the month, close = last day's close).

## Events (counted before any trade was simulated; only the signal months were counted, no return read)
- **Washout month** M: close location `(C - L) / (H - L) <= 0.10`.
- **Worst month of the year** M: `C(M) / C(M-1) - 1` strictly lower than each of the 11 months before it.
- **Top-close month** M: close location `>= 0.90`.
- Signal months whose NEXT month falls in 2007-01 to 2016-12 / 2017-01 to 2026-10: washout 6 / 7 (129 / 155 trading days in
  the next months), worst month 12 / 11 (259 / 245 days), top-close 16 / 20 (348 / 435 days).
- **Few independent events.** A monthly signal gives about 7 a decade. To reach 100+ trades a window, as asked, the rule
  takes **a daily entry on every trading day of the month after the signal month** (overlapping positions). The trades of
  one signal month are strongly correlated: the honest count of independent events is the 6-20 signal months, and the
  calendar-month t (below) is what carries that.

## Rule
- Signal known at the close of the last day of month M (closed candles only).
- On every trading day d of month M+1: entry at the open of day d. **Stop** = 3 x ATR(20) at day d-1 (true range of the 20
  days ending at d-1) from the entry, every trade. Exit at the close of day d+9 (ten trading days held), or at the stop: a
  day that opens through the stop fills at its open, else a touch of the stop (low for a buy, high for a sell) fills at the
  stop. No target.

## Tests (three, Holm over the three)
- **T1 (primary): long after a washout month.**
- **T2: long after the worst month of the past year.**
- **T3: short after a top-close month** (the mirror reversal).
- **Baseline** (the comparison every test is judged against): the same-side trade (same entry, stop, hold, costs) on EVERY
  trading day of the same calendar year. `excess` of a trade = its net R minus the mean net R of that year's baseline
  trades of the same side (year of entry).

## Costs
- $0.60 a round trip (spread $0.30 + $0.15 slippage each side).
- Buys pay overnight financing: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price; sells pay and earn nothing.
- Cost share of R, measured on all days (no signal read): median 3 x ATR(20) is $56.0 in 2007-16 (median price $1,223) and
  $71.8 in 2017-26 ($1,823): the $0.60 is about 1 % of R; a 14-night buy's financing about 4.5 % / 5.3 % of R.
- 2x costs = both the round trip and the financing doubled.

## Statistics and windows
- R a trade, 1R = the stop distance. Trades counted by EXIT month. In sample 2007-01 to 2016-12, out of sample 2017-01 to
  2026-10. t = mean / standard error of R summed by calendar month over EVERY calendar month of the window (months with no
  trade count as 0). One-sided p from t (normal), Holm over the three tests, on the OOS net month t.
- Excess t: the same, on each trade's `excess` summed by exit month.
- **Placebo** (40 seeds, mulberry32 seeds 1-40): each seed draws, without replacement, as many months as the test has
  signal months in the window, from all months of the window whose next month lies in it, and takes the baseline trades
  entered in the month after each drawn month; the OOS net month t of each seed. The real t must beat at least 38 of 40.
- **Pass** (each test on its own): OOS net month mean > 0 with t >= 2 and Holm p < 0.05; OOS excess month mean > 0 with
  t >= 2; in-sample net month mean of the same sign; OOS mean still > 0 at 2x costs; beats at least 38 of 40 placebos. The
  verdict is PASS only if T1 (the primary) passes; a pass of T2 or T3 alone is reported as such, not as a verdict on the
  rule.
- Nothing is changed after the run; if it fails, no variant is tried here.
