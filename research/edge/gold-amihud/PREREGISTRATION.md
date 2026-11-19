# Pre-registration: gold's own illiquidity (Amihud ratio) and the next week's return (14 Nov 2026)

Written and pushed alone, before any candle of this study was read into a calculation or any trade computed. Paper research
only: nothing live reads it, and no rule, size, filter, stop, config, council member or mirror setting changes whatever the
result.

**A new stand-alone weekly rule, not a gate, exit, entry or size of the live gold book** (Gold trend + Gold daily engulf).
Owner decision 44 is respected: none of the book's positions or records are read, and nothing here changes how the book
trades.

## Question

Amihud's illiquidity ratio (the price move a unit of trading moves the price: |daily return| / daily volume) is, in the
literature, a priced state: when a market has recently been illiquid, its expected return is higher (compensation for
bearing illiquidity), and when it has been unusually liquid, lower (Amihud, "Illiquidity and stock returns: cross-section and
time-series effects", Journal of Financial Markets 2002; not opened, cited from memory as the prior). Does **gold's own**
recent illiquidity, measured on OANDA's daily candles, predict the next week's gold return **beyond gold's drift**, i.e. more
than the same side taken in every eligible week of the same calendar month, net of costs?

## Dedupe (read before writing)

- `gold-volume-spike` (branch, FAIL): one abnormal-activity H1 candle, traded 4 hours. Uses volume alone, intraday; never the
  return-per-volume ratio and never a weekly state.
- `gold-obv-divergence`: on-balance volume against price. `gold-vwap`: distance to a volume-weighted price. Neither uses
  |return| / volume.
- `gold-volvol-switch`, `gold-vol-gate`, `gold-vol-target`, `macro-vol`: volatility alone, no volume.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) lists volume ideas
  on index CFDs only (high-volume premium, volume-conditioned reversal) and notes that no study used the volume column of
  the daily cache. No study in `research/edge/` or on any branch name mentions Amihud or illiquidity.

## Data (named before any result)

- One market: **XAU/USD**, the council's daily candle cache `research/daily/xau.json` on branch `council-data` (OANDA mid,
  complete UTC days, `[t, o, h, l, c, v]`, v = OANDA's count of price updates in the day, a proxy for activity, not traded
  volume). Read with `git show origin/council-data:research/daily/xau.json` into a scratch file outside git (deleted at the end).
- Days: UTC weekdays only (Saturday and Sunday candles, the ~2-hour Sunday reopen stub, are dropped). A day with v <= 0 is
  not used in the ratio.
- **Caveat said now:** OANDA's update count grows by two orders of magnitude from 2006 to 2026, so only a ratio ranked
  against gold's own recent past is used; the proxy may not carry the papers' effect.

## Definitions (all read at the close of the week's last weekday; nothing later)

- Daily ratio of weekday t: `a_t = |ln(c_t / c_{t-1})| / v_t` (c_{t-1} = the previous weekday's close).
- **ILLIQ** at weekday D = mean of `a_t` over the 20 latest weekdays ending at D (all 20 must have a ratio).
- **Rank** at D = the share of the 250 previous ILLIQ readings (weekdays D-250 … D-1, D excluded) that are below ILLIQ_D.
  No rank before 250 earlier readings exist.
- **Week**: Monday-Friday by ISO week (UTC). The signal is the rank at the week's last weekday on file. The trade is the
  NEXT week (its first weekday on file to its last weekday on file); it needs at least 3 weekdays on file.
- **Eligible week**: a next week with at least 3 weekdays and a rank at the end of the signal week.

## Trade (every trade has a stop)

- Entry: market at the open of the next week's first weekday. Exit: market at the close of its last weekday.
- Stop: entry ∓ **2 x ATR(20)** (ATR = mean true range of the 20 weekdays ending at the signal day, weekdays only).
  Checked day by day on the daily candles: a buy is stopped when a day's low <= stop and fills at min(that day's open, stop)
  (a gap through fills at the open); a sell when high >= stop, at max(open, stop). Stop first; no target, no trail.
- R = side x (exit − entry) / (2 x ATR).
- **Costs:** $0.60 a round trip per ounce (spread + slippage). Net R = R − 0.60 / (2 x ATR); 2x costs $1.20.
  **Financing:** `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` x entry / risk on buys (the demo broker's XAUUSD
  swap.long, 0.000148 of price a rollover, source and date in `FIN`); entry time = the first weekday's 00:00 UTC, exit time =
  the last weekday's 21:00 UTC. Shorts pay nothing and are credited nothing.

## The tests (3, fixed; Holm over the three)

| # | Name | Weeks | Side |
|---|---|---|---|
| T1 (primary) | Illiquid gold, buy | rank >= 2/3 | buy |
| T2 | Liquid gold, sell | rank <= 1/3 | sell |
| T3 | Illiquid and falling, buy | rank >= 2/3 and the signal week's close-to-close return < 0 | buy |

- **Same-side baseline** (the yardstick of every test): the same trade (next week, stop 2 x ATR, same costs) in every
  eligible week, buys and sells computed apart.
- **Excess** of a trade = its net R − the mean net R of the same-side baseline trades whose week starts in the same calendar
  month (the signal week included). Monthly sums of excess remove the month's drift.
- **Statistics:** t on calendar-month sums (net, gross, net at 2x, excess), months with no trade left out. One-sided p from
  the normal on the OOS excess t; Holm over T1-T3.
- **Windows** (by the trade week's first weekday): in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to
  2026-10-31 (halves 2017-21 / 2022-26 reported, not judged).
- **Placebo** (40 seeds, mulberry32 seeds 1-40): each OOS trade of a test moved to a random other eligible OOS week, same
  side, same mechanics; the test's OOS mean net R must beat at least 38 of the 40 seed means.

## Pass bar (per test; the study passes when T1 passes)

All of: OOS mean excess > 0 with month-sum t >= 2 and Holm p < 0.05; IS mean excess > 0; OOS mean net R > 0; OOS mean net R
at 2x costs > 0; placebo beaten >= 38 of 40; OOS n >= 30. Anything else is FAIL. A pass would only be a lead to replicate
on years or markets it did not use; never an edge on its own, never a council rule without the owner.

## What will be reported whatever the result

n, win rate, gross / net / 2x-cost / excess R a trade, month-sum t of each, IS and OOS and the two halves, by year, the
baseline means, the placebo distribution. RESULT.md is written by `run.mjs` from `result.json`; `tests/gold-amihud.test.mjs`
checks the rule on hand-made candles, that nothing after the signal week is read for the signal, and the report against
`result.json`.
