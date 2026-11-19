# Pre-registration: AUD/NZD z-score mean reversion on daily candles (13 Nov 2026)

Committed on 13 Nov 2026, alone, before `run.mjs` exists and before any result was computed. Research only: no live rule,
size, filter, stop, config or council member changes, whatever the verdict. A PASS leads at most to a proposal for a paper
shadow; never a live change without the owner.

## Question

AUD/NZD is the standard range-bound cross (two closely linked economies, a narrow long-run range). Does fading a two-standard-
deviation stretch of its daily close from its moving average make money after costs, on data from 2016 to now, with the same
sign on 2008-15? This is a different trade from the FX reversal study of the same day (one cross, a statistical band, an exit
at the mean).

## Data

- OANDA mid daily candles of `AUD_NZD`, UTC-aligned, from council-data `research/daily/audnzd.json` (the weekly candle cache;
  read with `git show origin/council-data:research/daily/audnzd.json`, no network; May 2004 to 6 Nov 2026 at the time of
  writing). The file is kept out of git (`run.mjs fetch <dir>`).
- Weekend candles (Saturday / Sunday stubs) are folded into the next weekday with `council/fills.mjs` `foldWeekend` before
  anything is computed, so a "day" is a trading day and "10 days" is 10 trading days.

## Rule (base variant V1)

At each daily close *i* (all inputs from closes up to and including *i*, nothing later):
- `SMA = mean(close[i-N+1..i])`, `SD = sample standard deviation (n-1) of the same N closes`, `z = (close[i] - SMA) / SD`, N = 20.
- `ATR = simple mean of the last 14 true ranges ending at bar i` (true range = max(high, previous close) - min(low, previous close)).
- If no position is open and `z >= +2`: SELL at the open of bar *i+1*; if `z <= -2`: BUY at the open of bar *i+1*.
- Stop: `1.5 x ATR` beyond the entry (above for a sell, below for a buy), fixed for the life of the trade. Every trade has a stop.
- Exits, checked bar by bar from the entry bar (bar 1) on:
  1. the stop: a bar whose range reaches it closes the trade at the stop, or at the bar's open if the open is already past it
     (a gap); the stop is checked before anything else in the bar;
  2. the mean: a close at or past the SMA_N computed with that close (sell: close <= SMA; buy: close >= SMA) exits at that close;
  3. time: at the close of bar 10 if still open.
- One position at a time: a new signal is taken only from a close at or after the close the previous trade exited on (a
  stop-out bar's close counts).
- R = (exit - entry) x direction / (entry-to-stop distance). Trades still open at the end of the data are left out.

## Pre-stated variants

- **V1** N = 20, |z| >= 2 (base).
- **V2** N = 20, |z| >= 2.5.
- **V3** N = 50, |z| >= 2 (SMA50 / SD50; the exit is the SMA50 cross).

Everything else identical. No other threshold, length, stop multiple or exit is tested.

## Costs (net R)

AUD/NZD is not in the demo broker's `ctrader/symbols.json` (13 Nov 2026), so its spread and swap are STATED, not measured:
- spread 1.0 pip (0.0001) a round trip, plus slippage of half a spread on each market order (entry at the open; every exit is a
  market or stop order): 1.0 pip more, so **2.0 pips a round trip**;
- commission at the demo account's forex rate (section "Forex spreads" of CLAUDE.md): 22.5 USD per million USD of notional a
  side, i.e. **0.000045 x price a round trip**;
- financing: a stated **2.0 % a year of the entry price, charged on either side** (both sides of a small rate gap pay after the
  broker's markup), per rollover night counted by `council/fills.mjs` `nights` (Monday-Friday 22:00 UTC, Wednesday three; the
  entry is at 00:00 UTC of the entry bar, a close exit at the bar's end, a stop exit at the bar's middle), rate / 365 a night.
  Also reported at 0 % and 4 % as sensitivity, never judged on.
- cost R = (0.0002 + 0.000045 x entry + financing in price) / entry-to-stop distance.

## Windows and statistics

- By entry date: **2008-01-01 to 2015-12-31** (replication) and **2016-01-01 to the end of the data** (decisive).
- t on calendar-month sums of net R (every calendar month of the window; a month with no exit counts 0; a trade is booked to
  its exit month): t = mean / sd x sqrt(months). One-sided p from the normal approximation of t.
- Holm over the three variants (V1-V3) on the decisive window, alpha 0.05.

## Pass bar

A variant passes when, in the decisive window, **net R a trade > 0, n >= 60, month-sum t >= 2 and Holm-adjusted p < 0.05**, and
its **2008-15 net R a trade is > 0** too. The study is **PASS** when at least one variant passes, else **FAIL**.

## Placebo (reported, not part of the bar)

Per variant, decisive window: 40 seeded draws (mulberry32, seed fixed in `run.mjs`), each of as many random entries as the
variant had real decisive trades: a uniformly drawn bar of the window (with its indicators defined) as the signal bar, a fair
coin for the side, the same next-open entry, stop and exits, no one-at-a-time limit. Reported: the draws' net R a trade
(median, 5th and 95th percentile) and how many draws match or beat the real figure. A PASS whose real figure is not above the
draws' 95th percentile is said to be indistinguishable from random entries with these exits.

## Also reported, not judged

The same three variants on AUD/CAD and EUR/GBP (council-data `research/daily/audcad.json`, `eurgbp.json`), same stated costs:
descriptive only, no verdict, no Holm.

## What a result means

- FAIL: the z-score fade is not a tradeable edge on AUD/NZD daily after costs; nothing changes.
- PASS: a proposal in `research/proposals/` for a paper shadow, for the owner to decide; no live change.
