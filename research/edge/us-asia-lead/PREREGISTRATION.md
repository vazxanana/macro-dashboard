# Does the US cash session lead the Asian index session? (JP225, HK33): pre-registration

Written and committed on 14 Nov 2026, before any trade of this study was simulated and before any return of these
markets was computed for it. Paper research only: no live rule, size, filter, council member, page or mirror setting is
changed by this study, whatever it finds.

## Why

The question: **does the sign of the US cash session's return (SPX500, 09:30 to 16:00 New York) predict the direction of
the Asian cash session that follows (Tokyo, Hong Kong), measured from the Asian open, so that the opening gap has already
priced the overnight news?** A lead-lag between markets that close and open at different hours is a known idea; the
narrow version here asks whether anything is LEFT for the Asian session once its own opening price has moved.

What I already know, said plainly.
- Asian index opens are well known to gap in the direction of the previous US session. The rule here enters at the
  Asian open, after that gap, so the gap's move is not counted as profit. The study asks about the continuation inside
  the Asian session, which I expect to be small or nil.
- `research/edge/index-overnight` (14 Nov 2026, FAIL) found the US500 overnight drift real before costs but too small
  per trade to pay a CFD spread. The same arithmetic may bite here: one session of an index moves about one daily ATR or
  less, and a 0.04 % round trip at a one-ATR stop is a few hundredths of an R.
- I have not computed any Asian-session or US-session return of these markets before writing this file. A probe of the
  first candle window (January 2005) of `jp225`, `hk33` and `spx500` on M15 was made only to see where history starts
  (all three start in the first days of January 2005; JP225's early candles are thin).

## Data

- OANDA mid **M15** candles of `SPX500_USD` (US500), `JP225_USD` (JP225) and `HK33_HKD` (HK33), UTC, through the site's
  keyless candle proxy (`/md/bars?sym=spx500|jp225|hk33&tf=15m`), 1 January 2005 to 14 November 2026 00:00 UTC, fetched
  in windows of at most 4,999 candles, complete candles only, kept out of git (`node --use-env-proxy run.mjs fetch
  <dir>`). M15 has a boundary at every time the rule uses (09:30 and 16:00 New York in both summer and winter time, 00:00,
  01:30, 06:00 and 08:00 UTC).
- **Daily candles for the ATR** are built from the same M15 file of each instrument: a day is the CFD's own day, from
  17:00 New York to 17:00 New York, named by the New York date it ends on (the `index-overnight` definition, copied).

## Calendars

- **US cash trading days** and early closes (13:00 New York): copied from `research/edge/index-overnight/run.mjs`
  (NYSE holidays and special closures by rule; early close the day after Thanksgiving, 24 December, and 3 July when 4 July
  is a Tuesday-Friday weekday). New York time with the US daylight-saving rules of each year.
- **Asian session day** for a US cash day D: the next weekday after D by calendar date (D + 1 for Monday to Thursday,
  the following Monday for a Friday). Japan and Hong Kong have no daylight saving: Tokyo 09:00 JST = 00:00 UTC, 15:00 JST
  = 06:00 UTC; Hong Kong 09:30 HKT = 01:30 UTC, 16:00 HKT = 08:00 UTC. **Japanese and Hong Kong exchange holidays are not
  excluded** (no calendar of them exists in this repository): the CFD trades on most of them and such a day is traded when
  its candles exist; this is said, not corrected. Tokyo's cash close moved to 15:30 JST in November 2024; the rule keeps
  15:00 JST throughout as the brief states it.

## The rules (fixed; no parameter is tuned)

Constants: `ATR_N = 20`, `STOP_ATR = 1.0`, `COST = 0.0004` of the entry price a round trip, `SD_N = 20`.

**Signal** on US cash day D: `ret = C / O - 1`, with O = the open of the SPX500 M15 candle starting at 09:30 New York and
C = the close of the M15 candle ending at D's cash close (16:00, or 13:00 on an early close). Direction `s = +1` (buy)
when `ret > 0`, `-1` (sell) when `ret < 0`; no trade when `ret = 0` or either candle is missing.

- **T1, JP225, every US day.** Position in direction s on JP225 on D's Asian day: entry at the **open of the M15 candle
  starting at 00:00 UTC**, exit at the **close of the M15 candle ending at 06:00 UTC**.
- **T2, JP225, strong US days only.** As T1, only when `|ret|` is greater than the sample standard deviation of the
  `SD_N` = 20 US cash-session returns of the 20 US cash days BEFORE D (D itself excluded, so the filter is known at D's
  close). No T2 trade before 20 earlier returns exist.
- **T3, HK33, every US day** (replication market). Entry at the open of the M15 candle starting at 01:30 UTC, exit at
  the close of the M15 candle ending at 08:00 UTC.

For every trade:
1. **Stop** (every trade has one, on the losing side): `entry - s x 1.0 x ATR20` (below a buy, above a sell); ATR20 =
   the simple mean of the true range of the 20 most recent daily candles of THAT instrument that ended at or before the
   entry time; no trade without 21 such days. `r0 = |entry - stop|`. No target; the stop never moves.
2. **Stop checks** on every M15 candle from the entry candle to the exit candle, both included: a candle that opens
   through the stop exits at its open (a gap through); otherwise a candle whose range reaches the stop exits at the stop
   (the stop first when the exit candle also reaches it).
3. **Data holes**: no trade when the entry candle or the exit candle is missing; dropped days are counted and reported.
4. **R** = `s x (exit - entry) / r0` (gross). **Costs**: `0.0004 x entry / r0` a round trip (spread and slippage on an
   index CFD, as the brief gives it); also reported at twice that. **No financing**: the hold (00:00-06:00 or 01:30-08:00
   UTC) contains no 17:00 New York rollover (21:00 or 22:00 UTC). Net R = R - cost.

## Windows (by the US signal day D)

- **Decisive: 1 Jan 2016 to the end of the data.** Holm p is read here.
- **Replication: the start of the data (January 2005, after the 20-day warm-up) to 31 Dec 2015.** The sign must agree.

## Statistics

- **t on calendar-month sums**: net R summed by the month of D, every month with at least one trade; `t = mean /
  (sd / sqrt(months))`; one-sided p by the normal approximation (H1: net R > 0).
- **Holm** over T1, T2 and T3 (decisive window).
- **Placebo, 40 seeds**, two kinds, per test and window, same trade days, same entry, exit, stop, checks and costs; only
  the direction changes: (a) **random sign**: each day's direction drawn from a fair coin; (b) **other day's signal**:
  the direction of a uniformly drawn other US cash day of the same window (for T2 the strong days stay the real ones).
  Seeded (mulberry32, seed = s + 1 for (a), s + 101 for (b)). Reported: the real mean net R against each placebo's 5th,
  50th and 95th percentile and its rank among the 40. **Reported, not a pass condition.**

## Pass rules (fixed, as the brief gives them)

A test **passes** when all hold:
1. mean net R > 0 in the decisive window;
2. mean net R > 0 in the replication window;
3. Holm-adjusted one-sided p < 0.05 in the decisive window;
4. n >= 100 in each window (T2: n >= 50 in each window).

## Verdict (fixed here)

- **PASS**: at least one test passes.
- **FAIL**: no test has a positive mean net R in both windows.
- **INCONCLUSIVE**: anything else.

## Reported, not tested (never a verdict)

Per test and window: n, win rate, buys / sells, mean R gross, cost in R, net R, net at 2x cost, month-sum t gross and
net, total, max drawdown (closed), stop exits, median stop distance as % of price, by year; buy days and sell days apart.
**How much the gap took**: the move from the Asian instrument's price at the US close (the close of its M15 candle ending
at D's cash close) to the Asian entry, in the signal's direction, in R of the same trade; and the correlation of the US
session return with the gap and with the Asian session return. Placebo tables.

## What I had to decide (the brief leaves it open)

- M15 candles (the brief allows M5 or M15) for all three markets; the exit at the close of the candle ending at the
  Asian close.
- The signal's standard deviation for T2 is over the 20 PRIOR sessions, so it is known when the trade is placed.
- A US Friday leads the next Monday's Asian session; a US holiday gives no signal, so the Asian session after it has no
  trade (a session is traded only after a US cash day).
- Asian exchange holidays are not excluded (above).
- The placebo is a diagnostic, not a pass condition, because the brief's pass bar does not include it.
- n >= 100 is read in each window, not only the decisive one.

## What happens next

Nothing changes live on any outcome. On PASS the proposal to the owner would be a forward paper shadow, never a live rule
before a forward record exists. A bug found after the run is fixed, said in RESULT.md, and everything is re-run.
