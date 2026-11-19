# Volatility targeting on a passive gold holding: pre-registration

Written and committed **alone, before** `run.mjs` exists and before any return, volatility, Sharpe ratio or drawdown of the
strategies below was computed (14 Nov 2026). Data, strategies, costs, tests and the pass bar are fixed here; anything added
later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing live changes, whatever the outcome: no council member, rule, size, filter, stop, config, cost
constant (`FIN`) or mirror setting is touched. ICT is not involved.

## Question

Moreira and Muir (2017, "Volatility-Managed Portfolios") and Harvey et al. (2018, "The impact of volatility targeting"):
does a long-only spot gold holding whose exposure is set each week to `target vol / trailing realised vol` (capped at 2x)
beat the same gold holding at a constant exposure, risk-adjusted (Sharpe ratio, maximum drawdown, worst year), after trading
costs and overnight financing? And does cutting exposure after volatility spikes reduce the drawdown without giving up return?

## Owner decision 44, how it is read here

Item 44 stops new gates, exits, entries and sizes being tested on **the gold book's systems** (Gold trend, Gold daily engulf)
over their 2006-17 window. This study is a stand-alone allocation question on a **passive** gold holding: it reads no trade
record of the book, gives no rule of the book a gate, exit, entry or size, and proposes none. It only reads the gold price
series. To keep apart from the book's window anyway, the windows are the calendar split other gold signal studies used:
in sample 2008-16, out of sample 2017 to October 2026 (below). A pass here would NOT be a proposal to size the book.

## Dedupe (read before writing)

- `vol-managed` (branch, #839) and `vol-managed-index` (branch, #909): the same idea on US / European **index** CFDs. FAIL,
  Sharpe lower after costs, drawdown about a third smaller. Gold was not read in either.
- `gold-tsmom` (branch): 12-month sign of gold, sized to 10 % volatility. FAIL. Its volatility scaling is applied to a
  direction signal, never compared with constant exposure on a long-only holding.
- `sizing`, `portfolio-v2`, `book-sizing`: weights between the council's systems and the trend add. Not a holding.
- `macro-vol`: gold and macro volatility as a direction signal, not exposure scaling. `gold-vol-gate` (branch, an old council
  change): a replica gate, not a study.
- `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): lists the two index studies only.
No study has compared a volatility-targeted gold holding with a constant one.

## Data

- `git show origin/council-data:research/daily/xau.json` (OANDA mid XAU/USD daily candles, complete UTC days, 20 Mar 2006 to
  6 Nov 2026; seen for its first and last dates and row count only). Weekend candles folded into the next weekday with
  `council/fills.mjs` `foldWeekend` (imported). Daily simple return `r_i = C_i / C_{i-1} - 1` on consecutive weekday closes.
- `sigmaN` at the close of day i = sample standard deviation of the last N daily log returns up to and including day i,
  times sqrt(252). Known at that close.

## Accounting

Capital fixed at 1 (no compounding: returns are fractions of starting capital, summed). Exposure `w` = notional / capital.

- **Rebalance**: at the close of the last weekday of each ISO week (normally Friday) the holding is set to `u = w / C`
  ounces per unit of capital, and held unchanged until the next rebalance (the exposure drifts with price in between).
- **Daily P&L** from close i to close i+1: `u (C_{i+1} - C_i)` minus financing minus the trading cost of any rebalance at
  close i.
- **Trading cost** (one formula for both strategies): every ounce traded at a rebalance pays a full spread of $0.30 plus half
  a spread of slippage, $0.45 an ounce, i.e. `cost = |u_new - u_old| x 0.45` (the opening trade included). This charges a
  whole round-trip spread on each one-way trade: conservative on purpose.
- **Financing**: `u x C_i x FIN.xau.long x nights(close_i, close_{i+1})` (`council/fills.mjs`: 0.000148 of price a rollover,
  Monday-Friday 22:00 UTC, Wednesday three; the demo broker's rate of 11 Nov 2026, applied to every year: the broker's past
  rates are unknown, stated in RESULT.md). Shorts do not occur.
- **2x costs**: the trading cost AND the financing both doubled.

## Strategies

- **M20**: `w = min(2, 0.15 / sigma20)` at each rebalance (target 15 % a year, cap 2x).
- **M60**: `w = min(2, 0.15 / sigma60)`.
- **K (benchmark)**: constant exposure `w = k`, rebalanced weekly the same way, with `k` = the managed strategy's average
  weight over the same window (so both carry the same average exposure; one K per managed strategy and window).

## Windows

- In sample (IS): 1 Jan 2008 - 31 Dec 2016. Out of sample (OOS, decisive): 1 Jan 2017 - 31 Oct 2026. The 2006-07 candles
  only warm the volatility up. A rebalance belongs to the window of the day its return accrues.

## Measures (per strategy and window, on calendar-month sums of daily net P&L)

Sharpe = mean / sd of monthly returns x sqrt(12); t = mean / (sd / sqrt(n)); annual return; maximum drawdown of the cumulative
sum; worst calendar year; average weight; share of rebalances at the cap; turnover and costs a year.

## Tests (OOS, net of costs)

- **T1** (primary): Sharpe(M20) - Sharpe(K20), monthly.
- **T2**: Sharpe(M60) - Sharpe(K60), monthly.
- **T3**: maximum drawdown of K20 minus that of M20 (positive = the managed holding's drawdown is shallower).
- **p-values**: one-sided (H1: the managed holding is better), paired circular block bootstrap of the monthly net returns of
  the two series, 6-month blocks, 5,000 draws, fixed seed; p = share of draws whose statistic minus the observed one is at
  least the observed one (the distribution centred on the null). For T1 / T2 the Jobson-Korkie z with Memmel's correction
  is also computed.
- **Holm** over T1-T3 on the bootstrap p, at 0.05.
- **Placebo** (40 seeds, reported): the managed weights of the OOS window are grouped by calendar month and the months are
  shuffled (each month's weekly weights moved as a block to another month), applied to the real prices with the real costs,
  and T1's (and T3's) statistic recomputed against the same K20. A real timing effect should beat nearly all of them.
- Return given up (reported for question 2): the mean monthly return difference M20 - K20, with its t.

## Pass bar (fixed)

A test **passes** only when all hold:
1. OOS statistic > 0 and its Holm-adjusted bootstrap p < 0.05 (for T1 / T2 also the Memmel z >= 2);
2. the same sign in sample (IS statistic > 0);
3. the OOS statistic still > 0 at 2x costs.

The verdict is **PASS** when T1 passes; **PARTLY** when T1 fails and T2 or T3 passes; **FAIL** when none passes. A pass is a
statement about a passive paper gold holding, not an edge of any council system, and proposes no live change.

## Not done, on purpose

No other target, cap, lookback, rebalance frequency, market or window is tested; no short side. Anything of that kind in
RESULT.md is post hoc and labelled.
