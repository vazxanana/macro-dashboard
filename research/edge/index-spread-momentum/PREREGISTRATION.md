# Pre-registration: momentum of the spread between two non-US equity indices (14 Nov 2026)

Committed on 14 Nov 2026, alone, before `run.mjs` exists and before any trade or result of this rule was computed. Research
only: no live rule, size, filter, stop, config or council member changes, whatever the verdict. A PASS leads at most to a
proposal for a paper shadow; never a live change without the owner. Paper only.

## Where the hypothesis comes from, and why the US pairs are excluded

The study `index-pair` (branch `index-pair`, draft PR #881, `research/edge/index-pair/`) faded 2-sd z-scores of the US2000 /
NAS100 and SPX500 / US30 log spreads. Both pairs lost even before costs, did worse than random entries with the same exits, and
the stretched spreads tended to keep running instead of coming back. **The hypothesis tested here, that FOLLOWING such a stretch
pays, was formed from that result.** Testing it on those two US pairs would be fitting on the very data that suggested it, so
US2000, NAS100, SPX500 and US30 are excluded from this study entirely. It is tested only on index pairs `index-pair` never saw.

## Question

Two non-US equity indices are hedged against each other with a hedge ratio fitted on the past year. When their log spread is
stretched two standard deviations from its 60-day mean, does betting that the stretch CONTINUES make money after both legs'
spreads and both legs' financing, pooled over four pairs, on 2016 to now, with the same sign on 2009-15?

## Pairs (leg A / leg B)

| Pair | Leg A (OANDA key, instrument) | Leg B |
|---|---|---|
| P1 | DE40 (`de40`, DE30_EUR) | UK100 (`uk100`, UK100_GBP) |
| P2 | EU50 (`eu50`, EU50_EUR) | UK100 (`uk100`, UK100_GBP) |
| P3 | JP225 (`jp225`, JP225_USD) | AU200 (`au200`, AU200_AUD) |
| P4 | DE40 (`de40`, DE30_EUR) | FR40 (`fr40`, FR40_EUR) |

All six keys are in council-data `research/daily/_index.json` with status `ok` (first candles March 2003 to March 2004, last
6 Nov 2026), so no replacement was needed. The pairs are the brief's, fixed before any figure was looked at.

## Data

- OANDA mid daily candles, UTC-aligned, from council-data `research/daily/<key>.json` (the weekly candle cache), read with
  `git show origin/council-data:…`, no network; kept out of git (`run.mjs fetch <dir>`).
- Each file's weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` first. Then the two legs
  of a pair are joined on the day's time: only days both legs have are used, so "60 days", "250 closes" and "20 days" count
  joined trading days.
- The legs are quoted in different currencies (EUR, GBP, USD for the JP225 CFD, AUD). Each leg's result is its own log return
  as a fraction of its own notional; currency moves on the open profit are a second-order effect and are ignored (stated).

## Rule (the `index-pair` code, copied into this folder; only the direction and the exit levels change)

The hedge ratio, spread, z-score, joining, gap check and stop ordering are copied from `research/edge/index-pair/run.mjs`
(copied, not imported across branches). At each joined daily close *i* (inputs from closes up to and including *i* only):

- **Hedge ratio**: `beta_i` = OLS slope (with intercept) of `ln(A)` on `ln(B)` over the 250 closes *i-249 .. i*. No signal while
  fewer than 250 joined closes exist, or when `beta_i <= 0`.
- **Spread** `s_k = ln(A_k) - beta_i x ln(B_k)` for *k = i-59 .. i*; **z** `z_i = (s_i - mean) / sd`, mean and sample sd (n-1)
  of those 60 values.
- **Entry** (the direction of `index-pair`, reversed), only when no position of that pair is open:
  - `z_i > +2`: **BUY** the spread (buy leg A, sell `beta_i` of leg B), at the open of joined day *i+1*;
  - `z_i < -2`: **SELL** the spread (sell A, buy `beta_i` of B), at that open.
  - The level is the trigger, not a fresh cross: a signal can follow straight after an exit if z is still beyond 2.
- **Frozen at the signal** for the life of the trade: `beta = beta_i`; the position's spread on a later day is
  `S = ln(A) - beta x ln(B)` from the legs' opens or closes.
- **Entry spread** `S_e` = from the legs' opens of day *i+1*. **The stop is z = 0. 1R** = `|mean_i - S_e|`, the spread distance
  from the entry to the z = 0 level of the signal close (the 60-day mean at the signal). Every trade has this stop.
- **Skip** (no trade, counted): when the entry open, measured with the signal close's mean and sd, is already at or past the
  stop (z of `S_e` at or past 0 on the losing side) or already at or past the target (|z| >= 4 on the winning side).
- **Exits**, checked day by day from the entry day *e*. On day *j* the trade's own z is `z_j = (S_j - m_j) / sd_j`, `m_j`,
  `sd_j` the mean and sample sd of the frozen-beta close spread over the 60 closes *j-59 .. j* (as `index-pair`):
  1. **Gap stop at the open** (days after *e*): the open spread, against the previous close's 60-day mean and sd, at or past
     z = 0 on the losing side (long spread: z <= 0; short spread: z >= 0): exit at that open.
  2. **Stop at the close**: `z_j <= 0` (long spread) or `z_j >= 0` (short spread): exit at the close.
  3. **Target at the close**: `z_j >= +4` (long spread) or `z_j <= -4` (short spread): exit at the close.
  4. **Time**: at the close of the 20th joined day counted from the entry day (entry day = day 1).
  In that order; the first that applies closes the trade. As in `index-pair` the target is checked at the close only (no gap
  target at the open), and the stop at the open and the close only (two spread prices a day: an intraday spread path cannot be
  built from two legs' highs and lows), so a stop fills at the spread it was found at, beyond the level, and can lose more than
  1R. Stated, not changed.
- **R** = `dir x (S_exit - S_e) / 1R`, dir = +1 long spread, -1 short spread. Trades still open at the end of the data are left
  out. One position at a time per pair: a new signal only from a close at or after the exit day's close.

## Costs (net R)

In the spread's own units (fractions of leg A's notional), then divided by 1R:

- **Spreads**, both legs, round trip: none of the six instruments is listed in council-data `ctrader/symbols.json` (it holds
  XAUUSD, five forex majors, three coins, NAS100, US500, US30, US2000), so the stated figures are used: **DE40 2, UK100 2, EU50
  2, FR40 2, JP225 10, AU200 2 points**. Cost = `spreadA / A_entry + beta x spreadB / B_entry`. No separate slippage or
  commission.
- **Financing**, both legs, per rollover night counted by `council/fills.mjs` `nights` (Mon-Fri 22:00 UTC, Wednesday three;
  entry at 00:00 UTC of the entry day, an open exit at 00:00 UTC of its day, a close exit at the end of its day), rate / 365 a
  night, with `r` = the leg's local policy rate of the entry date's calendar year:
  - the LONG leg pays `max(0, r + 2.5 %)` a year; the SHORT leg pays `max(0, 2.5 % - r)` a year (never a credit, as
    `index-pair`).
  - Local rate: DE40, EU50, FR40 euro (ECB deposit facility); UK100 Bank of England Bank Rate; JP225 Bank of Japan policy rate
    (the index's own currency, although OANDA quotes this CFD in USD); AU200 Reserve Bank of Australia cash rate.
  - The euro, sterling and yen yearly figures are **copied** from the `turnaround-replicate` branch
    (`research/edge/turnaround-replicate/run.mjs` `RATES`: approximate yearly mean policy rates, stated there, not fetched;
    that branch's `rates.json` holds only the US 2-year yield, which no leg here uses). That table has no Australian rate, so
    one is **added here** in the same form (approximate yearly mean RBA cash rate, %): 2007 6.4, 2008 6.6, 2009 3.3, 2010 4.35,
    2011 4.6, 2012 3.6, 2013 2.9, 2014 2.5, 2015 2.15, 2016 1.7, 2017 1.5, 2018 1.5, 2019 1.05, 2020 0.3, 2021 0.1, 2022 1.3,
    2023 3.9, 2024 4.35, 2025 3.9, 2026 3.6. The whole table is written to `rates.json` in this folder. A year before the
    table's first takes its first year (such trades are before both windows).
- cost R = (spreads + financing) / 1R.

## Windows and statistics

- By entry date: **2009-01-01 to 2015-12-31** (replication) and **2016-01-01 to the end of the data** (decisive).
- **Pooled**: the four pairs' trades together. t on calendar-month sums of net R (every calendar month of the window, all four
  pairs' trades booked to their exit month summed; a month with no exit counts 0): t = mean / sd x sqrt(months).
- Per pair, the same figures, reported.

## Placebo (part of the bar)

40 draws, each with its own seed (mulberry32, seed `20261114 + d`). In each draw and for each pair: as many random entries as
that pair had real decisive trades, with that pair's real side mix (its list of sides, shuffled), each a uniformly drawn signal
close of the decisive window (beta > 0, z defined, the next day in the window), with the same frozen beta, stop, 1R, target,
skip rule, exits and costs, no one-at-a-time limit (a skipped draw is drawn again). A draw's figure is the pooled net R a trade
over all four pairs' random entries. Reported: median, 5th and 95th percentile, and how many draws match or beat the real figure;
per-pair placebos reported too.

## Pass bar (all must hold)

1. Pooled decisive (2016-now) net R a trade **> 0**;
2. pooled decisive month-sum **t >= 2**;
3. pooled 2009-15 net R a trade **> 0** (same sign);
4. at least **3 of the 4 pairs** with decisive net R a trade > 0;
5. pooled decisive net R a trade **above the placebo's 95th percentile**.

PASS when all five hold, else FAIL. One pooled test, so no multiple-test correction. No minimum n beyond these.

## Also reported, not judged

Gross R, spread cost and financing a trade; exits by kind; skipped signals; |z| at the signal; median 1R; beta; win rate, profit
factor, worst drawdown; the decisive figures with financing off.

## What a result can and cannot say

A FAIL means this rule, at these levels, is not an edge after costs on these pairs; no other threshold, window, hedge ratio or exit
will be tried on the same data without its own pre-registration. A PASS is at most a proposal for a paper shadow
(`research/proposals/`), never a live rule without the owner. Either way it says nothing new about the US pairs, which are kept
out on purpose.
