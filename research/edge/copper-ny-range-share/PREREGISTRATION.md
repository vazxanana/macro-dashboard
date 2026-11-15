# Pre-registration: copper, the share of the day's range New York made, followed for 2-5 days (14 Nov 2026)

Pushed alone, before any trade or return of this rule on copper was computed. Only the event and day counts below were read
(`run.mjs count`, and the number of H1 candles per day). A replication: paper research only, a stand-alone rule on copper
(OANDA XCU/USD CFD). It is **not a gate, exit, entry or size of the live gold book** and reads none of the book's positions
(docs/owner-decisions.md item 44). Nothing live changes and no proposal is written whatever the result.

## Why this study

`gold-ny-range-share` (branch `gold-ny-range-share`, PR #1209) found on gold that a day whose New York session (13-21 UTC)
made most of the day's range was followed by a 5-day move the same way that beat the every-day trade of the same side out of
sample (2017-26: excess +0.138R, month t +2.63, n 198) but not in sample (2007-16: -0.012R, t -0.25): FAIL. Its replications
`silver-ny-range-share` (silver: OOS excess +0.078R, t +1.46, FAIL) and `index-ny-range-share` (NAS100 / SPX500) used the rule
unchanged. Copper is a metal the rule was never read on, traded on COMEX in New York hours but also heavily in Asia
(Shanghai) and London (LME). Nothing is changed to fit copper: thresholds, hold, stop, baseline, placebo, control and the
three-test layout are silver-ny-range-share's (gold's rule), copied; only the market and its cost differ.

## Data (named before any result)

- OANDA mid XCU/USD H1 through the site's keyless candle proxy (`/md/bars`, `run.mjs fetch`), 3 Jan 2006 to 30 Oct 2026,
  116,949 candles; kept out of git (scratch directory, deleted at the end). One market only: XCU/USD.
- Day = UTC calendar day; Saturday / Sunday candles belong to the next Monday; a day needs 18 or more H1 candles.
- **The copper H1 history is thin before 2013**: the median day had 17 candles in 2006 and 22 in 2007-10, so fewer days
  qualify (eligible days a year: 2007 150, 2008 157, 2009 178, 2010 200, 2011 213, 2012 206; 257-259 from 2013). The windows
  are kept as the gold study's (in sample 2007-01-01 → 2016-12-31, out of sample 2017-01-01 → 2026-10-31); the in-sample
  window is effectively the qualifying days only. Eligible days 4,654 in all (gold 5,236).

## Rule (gold-ny-range-share's, unchanged)

- Segments by the UTC hour a H1 candle opens, candles of that UTC date only: **pre** = 00-12 (Asia + London, at least 10
  candles), **NY** = 13-20 (at least 6 candles). 21-23 UTC unused.
- R = max(high) - min(low) over both segments. **NY share** = 1 - (pre high - pre low) / R.
- NY move = close of the last NY candle - open of the first.
- Signal: NY share >= 0.60 and NY move != 0 → trade the sign of the NY move, entry at the first H1 open of the next day, stop
  2 x ATR(14) of the daily candles up to the signal day (every trade has a stop; a stop fills at the stop, or at the open when
  gapped through), out at the close of the last day of the hold or at the stop.
- Signals use only candles of the signal day and before. Each signal is its own trade. R = move / stop distance.

## Tests (Holm over these three p)

- **T1 (primary)**: the signal, 5-day hold, judged out of sample 2017-26.
- **T2**: the signal, 2-day hold, judged out of sample 2017-26.
- **T3**: the signal, 5-day hold, 2007-01-01 → 2026-10-31 pooled as one test.
- In sample 2007-16 reported for every test; out-of-sample halves 2017-21 / 2022-26 reported.

## Costs

- Spread: **0.10 % of the entry price a round trip** (each R charged 0.001 x entry / stop distance): the cost group "silver,
  copper, energies" of `research/edge/trend-breadth` (PREREGISTRATION.md, Costs table). `council/fills.mjs` has no copper
  spread. A 2x cost run doubles it.
- **Financing: none.** `council/fills.mjs` `FIN` holds a rate for gold only; no measured copper rate exists in the repository.
  Copper buys and sells are charged no financing. Said plainly: this flatters the buys (a long copper CFD pays a swap at a
  real broker).

## Baseline and measures (unchanged)

- Baseline = the **same-side every-day trade**: on every eligible day a long and a short trade with the same entry, stop,
  hold and costs. Excess = signal net R minus the mean net R of the baseline trades of the same side entered in the same
  calendar year.
- t = on calendar-month sums of the excess over the judged window (months with no signal count as 0), two-sided p.

## Event counts (read before this file was written; no outcome read)

| Signal (NY share >= 0.60) | in sample 2007-16 | out of sample 2017-26 |
|---|---|---|
| T1 / T2 / T3 days | 77 | 79 |

Median NY share on copper 0.19 (gold 0.275, silver 0.270): New York adds less of copper's day range.

**Both windows hold fewer than 100 events. By the rule set for this replication (at least 100 per window), the study is
DESCRIPTIVE ONLY: it is run and reported in full, but it cannot pass and is never read as evidence for or against the gold
result beyond its sign.** The pre-registered verdict is therefore FAIL on the n check whatever the other numbers show; the
other checks are reported so the numbers can be compared with gold and silver.

## Placebo and control (judged window of each test)

- **Placebo** (40 seeds, mulberry32 1-40): the real signal days, each given a random side; excess month t.
- **Control** (40 seeds): per calendar year, as many random eligible days as that year has signal days, each traded on that
  day's own rule side (keeps each year's drift, volatility and side mix; drops which days were signals).

## Pass bar (per test; the verdict is T1's)

All of: judged-window excess month t >= 2 with Holm p < 0.05; judged-window net R a trade > 0 with net month t >= 2; in-sample
excess > 0; judged-window excess and net still > 0 at 2x costs; the real t above at least 38 of 40 placebo AND 38 of 40
control draws; n >= 100 in both windows (fails here, see above). Never called an edge without n and t.
