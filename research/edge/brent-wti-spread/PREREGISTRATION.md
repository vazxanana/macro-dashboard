# Pre-registration: mean reversion of the Brent - WTI crude spread (14 Nov 2026)

Committed on 14 Nov 2026, alone, before `run.mjs` exists and before any signal, trade or result was computed. Research only: no
live rule, size, filter, stop, config or council member changes, whatever the verdict. A PASS leads at most to a proposal for a
paper shadow (`research/proposals/`); never a live change without the owner. Paper and demo only (absolute rule 2).

## Claim and why it is worth one test

Brent (North Sea) and WTI (Cushing, Oklahoma) are two grades of light sweet crude that substitute for each other in refining
and in trade, so the price gap between them is held near the cost of moving and refining one instead of the other. A stretch of
the gap is therefore expected to close: a standard commodity relative-value trade. The literature reads the differential as
mean-reverting with regime changes, e.g. Fattouh (2010, "The dynamics of crude oil price differentials", Energy Economics 32)
and Buyuksahin, Lee, Moser and Robe (2013, "Physical markets, paper markets and the WTI-Brent spread", The Energy Journal 34)
(cited from memory; the papers were not opened from the build sandbox). Said plainly before any run: **the spread had structural
breaks**. From 2011 to 2013 a glut of crude at Cushing (pipeline capacity out of the hub lagged the new US shale supply) pushed
WTI up to about $25 under Brent for months: a stretch that did not close within weeks. In December 2015 the US lifted its ban on
crude exports, which changed what ties the two prices together from 2016 on. A z-score fade loses money in a break; the test
asks whether it pays on the years after 2015, and whether the same sign holds before.

## Data

- OANDA mid daily CFD candles, UTC-aligned: council-data `research/daily/bco.json` (BCO_USD, Brent, from 19 Aug 2003) and
  `research/daily/wtico.json` (WTICO_USD, WTI, from 23 Jan 2003), both to 6 Nov 2026 at the time of writing, read with
  `git show origin/council-data:research/daily/<key>.json` (no network) and kept out of git (`run.mjs fetch <dir>`).
- Each file's weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` first, then the two legs
  are joined on the day's time: only days both legs have are used, so "60 days" and "20 trading days" count joined days.
- **Contract rolls.** OANDA's commodity CFDs follow a futures contract and roll to the next one. The candles are used as quoted
  (no back-adjustment: the cache carries no roll dates and no roll adjustment to undo). A roll step that is visible in the
  candles is a jump in one leg's price that the position holder does not earn (OANDA settles a roll with a cash adjustment);
  it moves the spread and the z-score. Rule, fixed here: a **one-leg gap** on joined day *j* = one leg's overnight log gap
  `|ln(open_j / close_{j-1})|` is over 5 % while the other leg's is at most 5 %. A trade whose hold contains a one-leg gap (any
  day *j* from the day after the entry day to the exit day) is DROPPED from every statistic and counted (with its date and
  gross R, reported). A dropped trade still holds the position until its exit (one at a time, as if taken). Smaller roll steps
  stay in the data unadjusted; this is a stated limit. Before this file was written only a data-quality scan was made: the
  number of joined days and of one-leg gaps over the whole history (12 days with one leg over 5 % and the other not); no spread,
  z-score, signal or trade was computed.

## Rule

At each joined daily close *i*, from closes up to and including *i* only:

- **Spread** `s_k = ln(Brent close_k) - ln(WTI close_k)` (a hedge ratio of 1: equal notional on both legs).
- **z** `z_i = (s_i - mean) / sd`, mean and sample standard deviation (n - 1) of `s` over the 60 closes *i-59 .. i*. No signal
  before 60 joined closes exist or when sd is 0.
- **Entry**, only when no position is open: `z_i > +2` SHORT the spread (sell Brent, the rich leg; buy WTI, the cheap leg),
  `z_i < -2` LONG the spread (buy Brent, sell WTI), equal notional, at the opens of joined day *i+1* (the entry day *e*). The
  level is the trigger (not a fresh cross). No signal is skipped.
- **Frozen at the signal** for the life of the trade: `sd_i` (the signal close's 60-day sd). Entry spread
  `S_e = ln(Brent open_e) - ln(WTI open_e)`.
- **Stop (absolute rule 1: every trade has one).** Both legs are closed when the spread has moved a further `1.5 x sd_i`
  against the position from `S_e`: level `L = S_e + 1.5 x sd_i` for a short spread, `S_e - 1.5 x sd_i` for a long one.
  **1R = 1.5 x sd_i.** The stop is checked on daily CLOSES of the spread (the data has two prices of the spread a day, and an
  intraday spread path cannot be built from two legs' highs and lows); a stop exit fills at the close it was found on, beyond
  the level, so a stop loss can be larger than 1R. A real execution that watched the spread all day could only exit nearer the
  level. Stated, not changed.
- **Exits**, checked at each close *j* from the entry day *e* on, in this order; the first that applies closes the trade at
  that close:
  1. **Stop**: `dir x (s_j - S_e) <= -1.5 x sd_i` (dir +1 long spread, -1 short spread).
  2. **Back to the mean**: `|z_j| < 0.5`, with `z_j` the z of close *j* over its own 60 closes *j-59 .. j* (computed as at a
     signal close).
  3. **Time**: the close of the 20th joined day counted from the entry day (the entry day is day 1).
- **R** of a trade = `dir x (s_exit - S_e) / 1R` (log returns of the two legs, equal notional). Trades still open at the end of
  the data are left out. One position at a time: a new signal is taken only from a close after the exit day's close.

## Costs (net R)

In the spread's own units (fractions of the notional of one leg), divided by 1R. Neither figure is measured: both are
assumptions stated here.

- **Spread**: a round trip of **0.06 % of price per leg**, two legs: 0.0012 a trade.
- **Financing**: **3 % a year on EACH leg as a cost** (long or short, never a credit; conservative), per rollover night counted
  by `council/fills.mjs` `nights` (Monday-Friday 22:00 UTC, Wednesday three): `nights x 2 x 0.03 / 365`. The entry is at 00:00
  UTC of the entry day, an exit at the end of its day (the next 00:00 UTC).
- Base = the two above. **Cost sensitivity**, reported: 0 x (gross), 1 x (base), 2 x (both figures doubled). The bar is judged
  at base.

## Windows and statistics

- By entry date: **replication** = the data's start (the first possible signal) to 2015-12-31; **decisive** = 2016-01-01 to the
  end of the data. **2011-01-01 to 2013-12-31** (the Cushing glut, a known break) is reported separately and stays inside the
  replication window. Per-year rows are reported.
- t on calendar-month sums of net R: every calendar month of the window (a month with no exit counts 0; a trade is booked to
  its exit month), t = mean / sd x sqrt(months).
- One test (one rule, one pair), so no Holm step.

## Placebo (part of the bar)

40 draws, seeds fixed in `run.mjs` (mulberry32). Each draw takes, for every calendar year of the decisive window, as many entries
as the real decisive trades entered that year, on signal closes drawn uniformly from that year's closes (z defined and the next
joined day in the window), each with a random side (long or short spread, 1/2 each), the same frozen sd, stop, 1R, exits, base
costs and one-leg-gap drop as above, no one-at-a-time limit (a dropped draw is drawn again). Each draw's net R a trade; reported:
the median, the 5th and the 95th percentile, and how many draws match or beat the real figure.

## Pass bar (judged on the base rule, entry |z| > 2)

**PASS** only when all hold: net R a trade **> 0 in the decisive window AND > 0 in the replication window**; decisive month-sum
**t >= 2**; decisive **n >= 40**; decisive net R a trade **above the placebo's 95th percentile**. Else **FAIL**.

## Variant, reported only, never judged

**V1: entry at |z| > 1.5**, everything else the same. Its figures are reported beside the base rule's; whatever they show, they
do not change the verdict and are not a candidate without their own pre-registration on other data.

## Also reported, not judged

Gross R, spread cost and financing a trade; exits by kind; sides; win rate, profit factor, worst drawdown; the 2011-13 rows; the
dropped trades; 1R as a percentage.

## What a result can and cannot say

A FAIL means this rule, at these levels and these assumed costs, is not an edge on this data; no other threshold, window, hedge
ratio, stop or exit will be tried on the same data without its own pre-registration. A PASS is at most a proposal for a paper
shadow, with a measured spread and financing first; never a live rule without the owner. ICT is not involved.
