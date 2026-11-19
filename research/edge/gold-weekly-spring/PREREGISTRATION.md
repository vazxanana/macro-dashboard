# Pre-registration: gold after a weekly spring (a week that undercut the last four weeks' low and closed in its top half), 14 Nov 2026

Written and pushed alone, before `run.mjs` exists and before any trade or return after a signal week is computed. The only
numbers read before writing this were the COUNTS of signal weeks and of the trading days of the week after them (below), which
use the candles' dates and the signal weeks' own high / low / close only. Paper research only: nothing live reads this study,
and no rule, size, filter, stop, config, cost constant or council member changes whatever the result.

## Question

A "spring" in the classical tape-reading sense: price takes out a well-watched low (here the lowest low of the four weeks
before), sellers fail to hold it, and the week closes back in the upper half of its own range. Does spot gold rise more in the
following week than it does on an ordinary week of the same year, after costs and financing? The mirror (an "upthrust": a week
whose high took out the four weeks' high and closed in its bottom half) is tested as a sell.

## Not a duplicate (checked 14 Nov 2026)

`ls research/edge`, `git branch -r`, the shared topics list and `research/proposals/2026-11-14-untested-backlog.md` (branch
`untested-backlog`). Close studies and why this is different:
- `gold-weekly-wick` (FAIL): a lower wick over 60 % of the week's range, with no condition on any earlier week. A spring needs
  the week's low to be below the low of the previous FOUR weeks and only a close in the top half; most springs are not
  long-wick weeks and most long-wick weeks take out no four-week low.
- `gold-week-raid` (FAIL): an intraday H1 raid of LAST week's high / low and a close back inside, traded inside the same week.
- `gold-13w-low` (FAIL): a weekly CLOSE at a 13-week closing low (a breakdown that held, the opposite reading).
- `gold-week-close-extreme`, `gold-outside-week`, `gold-inside-week`, `gold-weekly-momentum`, `gold-weekly-stoch`,
  `gold-week-exhaustion`, `gold-weekly-vol-breakout`, `gold-weekly-open`: other weekly conditions, none reads a four-week
  extreme undercut and reclaimed. `gold-daily-turtle-soup` reads a 20-DAY low undercut on the daily chart.
Not a re-test of the near misses named off-limits (Nikkei drop, carry crash, euro divergence, low-vol hold).

## Data (named before any result)

One market: spot gold, OANDA mid daily XAU_USD, council-data `research/daily/xau.json` at commit `67bac79eb` (`git show`, no
network), 20 Mar 2006 to 13 Nov 2026. Weekend candles folded into the next weekday (`council/fills.mjs` `foldWeekend`). A week
= the trading days of one calendar week (Monday-based, UTC); the last week is used only once it ends on a Friday.

## Rule

- Signal week k: at least 4 trading days, and weeks k-4 .. k-1 all exist (any length).
- **Spring (buy)**: low(k) < min(low(k-4) .. low(k-1)) AND close(k) >= (high(k) + low(k)) / 2.
- **Upthrust (sell)**: high(k) > max(high(k-4) .. high(k-1)) AND close(k) <= (high(k) + low(k)) / 2.
- Known at the close of week k; nothing of week k+1 is read to decide.
- **Daily entries inside the next week** (the signal is weekly and too rare for 100 trades a window, so every trading day of
  week k+1 is an entry): one trade at the OPEN of each trading day d of week k+1, all held in parallel.
- **Stop** (every trade has one): 2 x ATR(20) of daily true range ending the day before d, never moved; a stop gapped through
  fills at that day's open; a stop and nothing else inside a day is filled at the stop.
- **Exit**: T1 and T3 at the last close of week k+1 (a Monday entry is held about five days, a Friday entry one); T2 at the
  last close of week k+2.
- R = the stop distance. Costs: $0.60 a round trip ($0.30 spread + $0.15 slippage each side, the rate the other weekly gold
  studies used), and on buys `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, `council/fills.mjs`: the demo
  broker's XAUUSD `swap.long` of 11 Nov 2026) x entry price. Sells are charged spread only, credited nothing.

## Counts (signal weeks, and entries = trading days of week k+1)

| Window (by the year of week k+1) | Springs | Spring entries | Upthrusts | Upthrust entries |
|---|---|---|---|---|
| In sample 2007-01 .. 2016-12 | 37 | 184 | 48 | 240 |
| Out of sample 2017-01 .. 2026-10 | 44 | 218 | 60 | 297 |

All three tests have at least 100 entries in each window. Trades are counted in the window of their exit month.

## Tests (three, Holm over the three)

- **T1 (primary)**: spring, buy at every open of week k+1, out at the close of week k+1.
- **T2**: spring, buy at every open of week k+1, out at the close of week k+2.
- **T3**: upthrust, sell at every open of week k+1, out at the close of week k+1.

## Baseline and control (drift and volatility kept, the signal's information removed)

- **Same-side baseline**: the same-side trade, same stop and costs, at the open of EVERY trading day of the same year, held
  to the last close of that day's own week (T1, T3) or of the following week (T2). Excess = a trade's net R minus that year's
  baseline mean (same side, same hold rule). So a Monday-to-Friday hold is compared with a mix of holds of the same shape.
- **Placebo** (40 seeds, mulberry32 1..40): every out-of-sample signal week is replaced by a week drawn at random from the
  weeks (4+ days) of the same year of week k+1; the same daily entries, side, stop and exit are taken; the OOS month t of net R
  is recomputed. Same year keeps the drift and the volatility; the random week removes the spring.

## Statistics

- Net R and gross R a trade; t on calendar-month sums of net R by exit month (empty months count as 0), IS 2007-01 .. 2016-12,
  OOS 2017-01 .. 2026-10. One-sided p from the OOS month t (normal), Holm over T1-T3.
- **Pass bar, each test**: OOS month t >= 2 and Holm p < 0.05; in-sample net R a trade > 0; OOS net R a trade > 0 with costs
  and financing doubled; OOS excess over the same-side baseline > 0; OOS month t above at least 38 of the 40 placebos.
- **The verdict follows T1.** T2 and T3 are reported on the same bar. Also reported, not tests: per year, stopped share,
  spread and financing cost a trade, the baseline itself.

## What a result means

A PASS would be a stand-alone weekly rule on spot gold for the owner to read, never a gate, exit, entry or size of the live
gold book (Gold trend / Gold daily engulf), and none of that book's 2006-17 positions is read (owner decision 44). It would need
a forward record before any use. A FAIL closes this reading of the weekly spring on gold: no other lookback, close cut, hold or
stop will be run on these years.
