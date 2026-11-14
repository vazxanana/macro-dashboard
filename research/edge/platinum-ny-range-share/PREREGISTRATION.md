# Pre-registration: platinum, the share of the day's range New York made, followed for 2-5 days (14 Nov 2026)

Pushed alone, before any trade or return of this rule on platinum was computed. Only the event counts below were read
(`run.mjs count`). A replication: paper research only, a stand-alone rule on spot platinum (XPT/USD). It is **not a gate,
exit, entry or size of the live gold book** and reads none of the book's positions (docs/owner-decisions.md item 44). Nothing
live changes and no proposal is written whatever the result.

## Why this study

`gold-ny-range-share` (branch `gold-ny-range-share`, 14 Nov 2026) found on gold that a day whose New York session (13-21 UTC)
made most of the day's range was followed by a 5-day move the same way that beat the every-day trade of the same side out of
sample (2017-26: excess +0.138R a trade, month t +2.63, n 198), but not in sample (2007-16: -0.012R, t -0.25); verdict FAIL.
`silver-ny-range-share` replicated the sign but not the size (out-of-sample excess +0.078R, t +1.46, FAIL);
`index-ny-range-share` tried NAS100 / SPX500. Platinum is a third precious metal the rule was never read on (NYMEX-centred
liquidity, the same trading hours). Nothing is changed to fit platinum: thresholds, hold, stop, baseline, control, placebo and
the three-test layout are the silver replication's (which is gold's rule, unchanged), copied; only the market and its cost
differ. `run.mjs` is the silver study's code with those two things changed (a diff against gold's `run.mjs` shows the rule
functions are identical).

## Data (named before any result)

- OANDA mid XPT/USD H1 through the site's keyless candle proxy (`/md/bars`, `run.mjs fetch`), 1 Jan 2006 to 30 Oct 2026,
  121,786 candles; kept out of git (scratch directory). One market only: XPT/USD.
- Day = UTC calendar day; Saturday / Sunday candles belong to the next Monday; a day needs 18 or more H1 candles.

## Rule (gold-ny-range-share's, unchanged)

- Segments by the UTC hour a H1 candle opens, candles of that UTC date only: **pre** = 00-12 (Asia + London, at least 10
  candles), **NY** = 13-20 (at least 6 candles). 21-23 UTC unused.
- R = max(high) - min(low) over both segments. **NY share** = 1 - (pre high - pre low) / R.
- NY move = close of the last NY candle - open of the first.
- Signal: NY share >= 0.60 and NY move != 0 → trade the sign of the NY move, entry at the first H1 open of the next day, stop
  2 x ATR(14) of the daily candles up to the signal day (every trade has a stop; a stop fills at the stop, or at the open when
  gapped through), out at the close of the last day of the hold or at the stop. No oscillator is used.
- Signals use only candles of the signal day and before; the trade starts the next day. Each signal is its own trade.
  R = move / stop distance.

## Tests (Holm over these three p)

- **T1 (primary)**: the signal, 5-day hold, judged out of sample 2017-01-01 → 2026-10-31.
- **T2**: the signal, 2-day hold, judged out of sample 2017-26.
- **T3**: the signal, 5-day hold, the whole period 2007-01-01 → 2026-10-31 pooled as one test.
- In sample 2007-01-01 → 2016-12-31 reported for every test; out-of-sample halves 2017-21 / 2022-26 reported.

## Costs

- Spread and slippage: **0.30 % of the entry price a round trip** on every trade (R charged 0.003 x entry / stop distance):
  the platinum cost model of `research/edge/ict-breadth-2` (silver's spread + a third of it in slippage, scaled to platinum's
  typical OANDA spread of about 0.22 % of price, ~$3 at $1,400). `council/fills.mjs` has no platinum cost; this is the most
  conservative platinum figure in the repository (`research/edge/trend-breadth` used 0.20 %, its "wide" class). A share of price,
  because platinum ran $750-$2,250 over the window.
- **Financing: none.** `council/fills.mjs` `FIN` holds a rate for gold only; there is no measured or sourced platinum rate in
  the repository, so platinum buys are charged no financing. Said plainly: this flatters the buys. A sensitivity column
  applies gold's rate (`FIN.xau.long`, 0.000148 of price a rollover) to platinum buys; reported only, never a pass check.
- A 2x cost run doubles the 0.30 %.

## Baseline and measures (unchanged)

- Baseline = the **same-side every-day trade**: on every eligible day a long and a short trade with the same entry, stop, hold
  and costs. Excess of a signal trade = its net R minus the mean net R of the baseline trades of the same side entered in the
  same calendar year.
- t = on calendar-month sums of the excess over the judged window (months with no signal count as 0), two-sided p (Student t).

## Event counts (read before this file was written; no outcome read)

| Signal (NY share >= 0.60) | in sample 2007-16 | out of sample 2017-26 |
|---|---|---|
| T1 / T2 / T3 days | 191 | 145 |

Eligible days 4,912 in all. At least 100 in each window, so no test is downgraded to descriptive.

## Placebo and control (judged window of each test)

- **Placebo** (40 seeds, mulberry32 1-40): the real signal days, each given a random side; excess month t.
- **Control** (40 seeds): per calendar year, as many random eligible days as that year has signal days, each traded on that
  day's own rule side (keeps each year's drift, volatility and side mix; drops which days were signals).

## Pass bar (per test; the verdict is T1's)

All of: judged-window excess month t >= 2 with Holm p < 0.05; judged-window net R a trade > 0 with net month t >= 2; in-sample
excess > 0 (the same sign in 2007-16); judged-window excess and net still > 0 at 2x costs; the real t above at least 38 of 40
placebo AND 38 of 40 control draws; n >= 100 in both windows. Otherwise FAIL. A PASS on platinum would be a replication of the
gold out-of-sample result on new data, not a council rule; never called an edge without n and t.
