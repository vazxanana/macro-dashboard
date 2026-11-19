# Pre-registration: mean reversion of the spread between two US equity indices (14 Nov 2026)

Committed on 14 Nov 2026, alone, before `run.mjs` exists and before any trade or result was computed. Research only: no live
rule, size, filter, stop, config or council member changes, whatever the verdict. A PASS leads at most to a proposal for a paper
shadow; never a live change without the owner. Paper only.

## Question

Two US equity indices with a long shared history are hedged against each other with a hedge ratio fitted on the past year. When
their log spread is stretched two standard deviations from its 60-day mean, does betting on its return to the mean make money
after both legs' spreads and both legs' financing, on 2016 to now, with the same sign on 2009-15? Two pairs, the same rule:

- **Pair 1**: US2000 (leg A) against NAS100 (leg B).
- **Pair 2**: SPX500 (leg A) against US30 (leg B).

An earlier pairs-style study on a single cross (`audnzd-revert`, AUD/NZD z-score fade, 13 Nov 2026) failed (0 of 3). Its z-score
statistics, placebo and Holm code are copied into this study's own `run.mjs` (nothing imported across branches); the spread, the
hedge ratio, the stop and the exits here are new.

## Data

- OANDA mid daily candles, UTC-aligned, from council-data `research/daily/us2000.json`, `nas100.json`, `spx500.json`,
  `us30.json` (the weekly candle cache, read with `git show origin/council-data:…`, no network; March 2003 to 6 Nov 2026 at the
  time of writing). Kept out of git (`run.mjs fetch <dir>`).
- Each file's weekend candles (Saturday / Sunday stubs) are folded into the next weekday with `council/fills.mjs` `foldWeekend`
  first. Then the two legs of a pair are joined on the day's time: only days that both legs have are used (a day one leg lacks is
  dropped for that pair), so "60 days", "250 closes" and "20 days" count joined trading days.
- 2-year Treasury yield (for financing): copied from council-data `macro/cache.json` (FRED `DGS2`): `score.fred.DGS2` (weekly,
  Friday-dated, from 6 Jan 2006) merged with `fred.DGS2` (daily, from 2 Sep 2025; the daily value wins on a date both carry).
  The merged series is written to `rates.json` next to `run.mjs` by the fetch step, so the run is repeatable. A trade uses the
  last value dated on or before its entry day, held for the whole trade.

## Rule

At each joined daily close *i* (every input from closes up to and including *i*; nothing later):

- **Hedge ratio**: `beta_i` = ordinary least squares slope (with intercept) of `ln(A)` on `ln(B)` over the 250 closes
  *i-249 .. i*. No signal while fewer than 250 joined closes exist, or when `beta_i <= 0`.
- **Spread** with that ratio: `s_k = ln(A_k) - beta_i x ln(B_k)` for the 60 closes *k = i-59 .. i* (the ratio of close *i* is
  applied to the whole 60-day window, so the window is one consistent series).
- **z**: `z_i = (s_i - mean) / sd`, mean and sample standard deviation (n-1) of those 60 values.
- **Entry**, only when no position of that pair is open:
  - `z_i > +2`: SHORT the spread: sell leg A, buy leg B with weight `beta_i` (notional of B = `beta_i` x notional of A), at the
    open of joined day *i+1*;
  - `z_i < -2`: LONG the spread: buy A, sell `beta_i` of B, at that open.
  - The level is the trigger (not a fresh cross): a signal can follow straight after an exit if z is still beyond 2.
- **Frozen at the signal** for the life of the trade: `beta = beta_i`; the position's spread on any later day is
  `S = ln(A) - beta x ln(B)` from the legs' opens or closes; the stop level `L = mean_i + 3.5 x sd_i` for a short spread,
  `mean_i - 3.5 x sd_i` for a long one (the z = ±3.5 point of the signal close).
- **Entry spread** `S_e` = from the two legs' opens of day *i+1*. **1R** = `|L - S_e|`, the spread distance from the entry to the
  3.5 stop. The signal is SKIPPED (no trade, counted) when the entry open is already at or beyond the stop (z of `S_e`, measured
  with the signal close's mean and sd, at or beyond ±3.5 on the losing side) or already at or past the mean (that z at or past 0).
- **Exits**, checked day by day from the entry day *e* on. On each day *j* the trade's own z is `z_j = (S_j - m_j) / sd_j`, with
  `m_j`, `sd_j` the mean and sample sd of the frozen-beta spread over the 60 closes *j-59 .. j*:
  1. **Gap stop at the open** (days after *e*): if the open spread, measured against the previous close's 60-day mean and sd, is
     at or beyond 3.5 on the losing side, exit at that open.
  2. **Stop at the close**: `z_j >= +3.5` (short spread) or `z_j <= -3.5` (long spread): exit at the close.
  3. **Mean**: `z_j <= 0` (short) or `z_j >= 0` (long): exit at the close.
  4. **Time**: at the close of the 20th joined day counted from the entry day (the entry day is day 1).
  Checked in that order; the first that applies closes the trade.
- **The stop.** Every position has the pair's stop (z ±3.5). The data holds two prices of the spread a day (the legs' opens and
  closes; an intraday spread path cannot be built from two legs' highs and lows), so the stop is checked at those two moments and
  a stop exit fills at the spread it was found at, beyond the level: a stop loss can be larger than 1R. A real execution that
  watched the spread all day could only exit nearer the level. Stated, not changed.
- **R** of a trade = `dir x (S_exit - S_e) / 1R`, dir = +1 long spread, -1 short spread (log returns of the legs, weighted 1 and
  beta). Trades still open at the end of the data are left out.
- One position at a time per pair: a new signal is taken only from a close at or after the exit day's close.

## Costs (net R)

All in the spread's own units (fractions of notional of leg A), then divided by 1R:

- **Spreads**, both legs, round trip, stated: US2000 **0.4** points, NAS100 **3**, SPX500 **1**, US30 **4**. Cost =
  `spreadA / A_entry + beta x spreadB / B_entry`. No separate slippage or commission is added.
- **Financing**, both legs, per rollover night counted by `council/fills.mjs` `nights` (Monday-Friday 22:00 UTC, Wednesday three;
  the entry is at 00:00 UTC of the entry day, an open exit at 00:00 UTC of its day, a close exit at the end of its day), rate / 365
  a night, with `r` = the 2-year yield of the entry day (above):
  - the LONG leg pays `r + 2.5 %` a year;
  - the SHORT leg pays `max(0, 2.5 % - r)` a year (never a credit).
  - Short spread: long leg B (weight beta), short leg A (weight 1). Long spread: long leg A (weight 1), short leg B (weight beta).
- cost R = (spreads + financing) / 1R.

## Windows and statistics

- By entry date: **2009-01-01 to 2015-12-31** (replication) and **2016-01-01 to the end of the data** (decisive).
- t on calendar-month sums of net R (every calendar month of the window; a month with no exit counts 0; a trade is booked to its
  exit month): t = mean / sd x sqrt(months). One-sided p from the normal approximation of t.
- Holm over the two pairs on the decisive window, alpha 0.05.

## Placebo (part of the bar)

Per pair, decisive window: 40 draws, each with its own seed (mulberry32, seeds fixed in `run.mjs`), each of as many random entries
as the pair had real decisive trades, with the real trades' side mix (the real list of sides, shuffled): a uniformly drawn signal
close of the window (with beta > 0, z defined and the next day in the window) as the signal day, the same frozen beta, stop level,
1R, skip rule and exits as above, no one-at-a-time limit (a skipped draw is drawn again). Each draw's net R a trade; reported: the
median, 5th and 95th percentile, and how many draws match or beat the real figure.

## Pass bar

A pair passes when, in the decisive window, **net R a trade > 0, month-sum t >= 2, Holm-adjusted p < 0.05**, its **2009-15 net R a
trade is > 0** too (same sign), and its **decisive net R a trade is above the placebo's 95th percentile**. The study is **PASS**
when at least one pair passes, else **FAIL**. No minimum n is set beyond these.

## Also reported, not judged

Gross R, spread cost and financing a trade; exits by kind; skipped signals; the median beta; the decisive figures with financing
off (0 %) as sensitivity; win rate, profit factor, worst drawdown.

## What a result can and cannot say

A FAIL means this rule, at these levels, is not an edge after costs on this data; no other threshold, window, hedge ratio or exit
will be tried on the same data without its own pre-registration. A PASS is at most a proposal for a paper shadow
(`research/proposals/`); never a live rule without the owner.
