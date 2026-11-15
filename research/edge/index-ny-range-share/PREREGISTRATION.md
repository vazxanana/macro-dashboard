# Pre-registration: US indices, the share of the day's range New York made, followed for 2-5 days (14 Nov 2026)

Pushed alone, before any trade or return of this rule was computed on these markets. Only the event counts below were read
(`run.mjs count`). Paper research only: no council system, rule, filter, size or live setting reads it, nothing of `ict/` is
touched, nothing live changes and no proposal is written whatever the result.

## Why this study

`research/edge/gold-ny-range-share` (branch `gold-ny-range-share`, 14 Nov 2026) found a near miss on spot gold: on days where
New York (13-21 UTC) made at least 60 % of the 00-21 UTC range, following New York's move for 5 days beat the same-side
every-day trade out of sample (excess +0.138R, month t +2.63, n 198) but not in sample (-0.012R, t -0.25). A result found in one
decade on one market is not an edge. This study asks whether the "New York made the day" effect is general by testing **the
same rule, unchanged**, on markets it was not found on: the US index CFDs NAS100 (primary) and SPX500. New York hours matter
for US indices (the cash session opens inside the NY segment), so if the effect is real it should show there. Silver is tested
by another study in parallel (`silver-ny-range-share`) and is not part of this one.

Not a duplicate: `index-overnight` (close-to-open drift), `index-midday-turn` (an intraday turn traded the same day),
`orb-nas100` (5-minute opening range, intraday) and the other `index-*` studies neither measure which session made the day's
range nor hold 2-5 days.

## Data (named before any result)

- OANDA mid H1 through the site's keyless candle proxy (`/md/bars`, `run.mjs fetch`), keys `nas100` and `spx500`, both served
  from 2 Jan 2006 to 30 Oct 2026 (124,672 and 124,687 candles); kept out of git (scratch directory, deleted at the end).
- Day = UTC calendar day; Saturday / Sunday candles belong to the next Monday; a day needs 18 or more H1 candles. The first H1
  candle served is 2 Jan 2006, so the in-sample window starts on 1 Jan 2007 as in the gold study (a year of warm-up spare).

## Rule (identical to gold-ny-range-share's T1 / T3)

- Segments by the UTC hour a H1 candle opens, candles of that UTC date only: **pre** = 00-12 (at least 10 candles),
  **NY** = 13-20 (at least 6 candles). 21-23 UTC unused.
- R = max(high) - min(low) over both segments. **NY share** = 1 - (pre high - pre low) / R.
- NY move = close of the last NY candle - open of the first.
- Signal: NY share >= 0.60 and NY move != 0 → trade the sign of the NY move, entry at the first H1 open of the next day, stop
  2 x ATR(14) of the daily candles up to the signal day (every trade has a stop; it fills at the stop, or at the open when
  gapped through), out at the close of the last day of the hold or the stop. Each signal is its own trade (overlap allowed);
  R = move / stop distance. Signals use only candles of the signal day and before.

## Tests (Holm over the three)

- **T1 (primary)**: NAS100, 5-day hold.
- **T2**: NAS100, 2-day hold.
- **T3**: SPX500, 5-day hold (a third market).

## Costs

A round trip in index points, the ICT lab's cost of the matching future on these OANDA CFDs (`api/_ictlab.js` `COST`: NQ 1.5,
ES 0.5): **NAS100 1.5 points, SPX500 0.5 points**, each R charged cost / stop distance. **No financing is charged**: this
repository holds no measured financing rate for index CFDs (`council/fills.mjs` `FIN` covers gold only); a long index CFD held
5 nights does pay financing at most brokers, so the net figures for buys are optimistic by that amount. A 2x cost run doubles
the round trip.

## Baseline and measures

- Baseline = the **same-side every-day trade**: on every eligible day a long and a short trade with the same entry, stop, hold
  and costs. Excess of a signal trade = its net R minus the mean net R of the baseline trades of the same side entered in the
  same calendar year (so the indices' upward drift is not credited to the rule).
- t = on calendar-month sums of the excess (months with no signal count as 0), two-sided p (Student t).
- Windows: in sample 2007-01-01 → 2016-12-31; out of sample 2017-01-01 → 2026-10-31 (halves 2017-21 / 2022-26 reported).

## Event counts (read before this file was written; no outcome read)

| Market | in sample 2007-16 | out of sample 2017-26 | eligible days |
|---|---|---|---|
| NAS100 (T1, T2) | 863 | 698 | 5,183 |
| SPX500 (T3) | 575 | 612 | 5,185 |

(More signal days than on gold, 258 / 198: on the indices the cash open falls inside the New York segment.)

## Placebo and control

- **Placebo** (40 seeds, mulberry32 1-40): the real signal days, each given a random side; out-of-sample excess month t.
- **Control** (40 seeds): per calendar year, as many random eligible days as that year has signal days, each traded on that
  day's own rule side (keeps each year's drift, volatility and side mix; drops which days were signals).

## Pass bar (per test; the verdict is T1's)

All of: out-of-sample excess month t >= 2 with Holm p < 0.05; out-of-sample net R a trade > 0 with net month t >= 2; in-sample
excess > 0; out-of-sample excess and net still > 0 at 2x costs; the real t above at least 38 of 40 placebo AND 38 of 40
control draws; n >= 100 in both windows. Otherwise FAIL. Never called an edge without n and t.
