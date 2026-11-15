# Pre-registration: palladium, the share of the day's range New York made, followed for 2-5 days (14 Nov 2026)

Pushed alone, before any trade or return of this rule on palladium was computed. Only the event counts below were read
(`run.mjs count`). A replication: paper research only, a stand-alone rule on spot palladium (XPD/USD). It is **not a gate,
exit, entry or size of the live gold book** and reads none of the book's positions (docs/owner-decisions.md item 44). Nothing
live changes and no proposal is written whatever the result.

## Why this study

`gold-ny-range-share` (branch `gold-ny-range-share`, 14 Nov 2026) found on gold that a day whose New York session (13-21 UTC)
made most of the day's range was followed by a 5-day move the same way that beat the every-day trade of the same side out of
sample (2017-26: excess +0.138R a trade, month t +2.63, n 198), but not in sample (2007-16: -0.012R, t -0.25). Its verdict was
FAIL. Its replications so far: silver (`silver-ny-range-share`, FAIL: OOS +0.078R, t +1.46) and NAS100 / SPX500
(`index-ny-range-share`). Palladium is another New York-traded metal (NYMEX) that none of these studies read. Nothing is
changed to fit palladium: thresholds, hold, stop, baseline, control and placebo are gold-ny-range-share's, copied (the silver
study's code); only the market and its cost differ.

## Data (named before any result)

- OANDA mid XPD/USD H1 through the site's keyless candle proxy (`/md/bars`, `run.mjs fetch`). The proxy serves palladium from
  1 Jan 2006 13:00 UTC; fetched to 30 Oct 2026 20:00 UTC, 119,286 candles; kept out of git (scratch directory, deleted at the
  end). One market only: XPD/USD.
- Day = UTC calendar day; Saturday / Sunday candles belong to the next Monday; a day needs 18 or more H1 candles (palladium is
  thinner than gold: 4,600 eligible days against silver's 5,231 on the same rule).

## Rule (gold-ny-range-share's, unchanged)

- Segments by the UTC hour a H1 candle opens, candles of that UTC date only: **pre** = 00-12 (Asia + London, at least 10
  candles), **NY** = 13-20 (at least 6 candles). 21-23 UTC unused.
- R = max(high) - min(low) over both segments. **NY share** = 1 - (pre high - pre low) / R.
- NY move = close of the last NY candle - open of the first.
- Signal: NY share >= 0.60 and NY move != 0 → trade the sign of the NY move, entry at the first H1 open of the next day, stop
  2 x ATR(14) of the daily candles up to the signal day (every trade has a stop; a stop fills at the stop, or at the open when
  gapped through), out at the close of the last day of the hold or at the stop.
- Signals use only candles of the signal day and before; the trade starts the next day. Each signal is its own trade.
  R = move / stop distance.

## Tests (Holm over these three p)

- **T1 (primary)**: the signal, 5-day hold, judged out of sample 2017-01-01 → 2026-10-31.
- **T2**: the signal, 2-day hold, judged out of sample 2017-26.
- **T3**: the signal, 5-day hold, the whole period 2007-01-01 → 2026-10-31 pooled as one test.
- In sample 2007-01-01 → 2016-12-31 reported for every test; out-of-sample halves 2017-21 / 2022-26 reported.

## Costs

- Spread: **0.20 % of the entry price a round trip** on every trade (each R charged 0.002 x entry / stop distance): the
  repository's palladium cost, `research/edge/trend-breadth/PREREGISTRATION.md` cost table ("platinum, palladium: 0.20").
  `council/fills.mjs` has no palladium spread. Palladium CFDs are wide; this figure is the conservative one already used here.
- **Financing: none.** `council/fills.mjs` `FIN` holds a rate for gold only; there is no measured palladium rate in the
  repository, so palladium buys are charged no financing. Said plainly: this flatters the buys (a long palladium CFD held 5
  nights pays financing at most brokers). A sensitivity column applies gold's rate (`FIN.xau.long`, 0.000148 of price a
  rollover) to palladium buys; it is reported only, never a pass check.
- A 2x cost run doubles the spread.

## Baseline and measures (gold-ny-range-share's, unchanged)

- Baseline = the **same-side every-day trade**: on every eligible day a long and a short trade with the same entry, stop, hold
  and costs. Excess of a signal trade = its net R minus the mean net R of the baseline trades of the same side entered in the
  same calendar year.
- t = on calendar-month sums of the excess over the judged window (months with no signal count as 0), two-sided p (Student t).

## Event counts (read before this file was written; no outcome read)

| Signal (NY share >= 0.60) | in sample 2007-16 | out of sample 2017-26 |
|---|---|---|
| T1 / T2 / T3 days | 311 | 200 |

Eligible days 4,600 in all. At least 100 in each window, so every test is judged (none is descriptive only).

## Placebo and control (judged window of each test)

- **Placebo** (40 seeds, mulberry32 1-40): the real signal days, each given a random side; excess month t.
- **Control** (40 seeds): per calendar year, as many random eligible days as that year has signal days, each traded on that
  day's own rule side (keeps each year's drift, volatility and side mix; drops which days were signals).

## Pass bar (per test; the verdict is T1's)

All of: judged-window excess month t >= 2 with Holm p < 0.05; judged-window net R a trade > 0 with net month t >= 2; in-sample
excess > 0 (the same sign in 2007-16); judged-window excess and net still > 0 at 2x costs; the real t above at least 38 of 40
placebo AND 38 of 40 control draws; n >= 100 in both windows. Otherwise FAIL. A PASS on palladium would be a replication of
the gold out-of-sample result on new data, not a council rule; never called an edge without n and t.
