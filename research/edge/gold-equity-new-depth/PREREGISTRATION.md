# Pre-registration: spot gold the day after a US equity index drawdown reaches a new depth (14 Nov 2026)

Written and pushed ALONE, before any gold return after an event was computed. Paper research only: a **stand-alone rule
on gold**, never a gate, entry, exit or size of the live gold book, and none of the book's 2006-17 positions is read
(docs/owner-decisions.md item 44). No live rule, size, filter, stop, config, cost constant or council member changes.

## Question

When the S&P 500 (or the Nasdaq 100) closes at the deepest point of its current drawdown from its 52-week high, does
spot gold do better over the next day than on an ordinary day? The story: a drawdown that keeps getting deeper is the
moment equity holders are under the most pressure, and gold either gets the haven flow (gold up) or is sold to meet
margin calls (gold down). The test is one-sided for the haven reading: a gold buy.

## Why this is not a duplicate

- `gold-equity-bear` (branch, 14 Nov): gold bought on any day the index is 10 % / 20 % below its 52-week high, held 20
  days, one at a time (n 35 out of sample). A STATE, held a month. Here the event is the DAY the drawdown makes a new
  depth (any depth from 3 %), held one day: a day inside a bear on which the index bounced is not an event here, and a
  3-9 % correction is.
- `gold-haven-shock` (14 Nov): the day after a large one-day index fall. A new-depth day need not be a large down day
  (a slow grind lower), and a large down day inside a rally is not a new depth.
- `gold-index-dispersion`, `gold-liquidation-day`, `gold-capitulation`: cross-section spread, gold's own fall, gold's own
  washout. None conditions on the index's drawdown path.
- Drawdown first crossings (-10 % / -20 %), new 52-week index lows and fresh 20/60-day lows were COUNTED for this study
  (event dates only, no gold return read): each has fewer than 100 independent events a window (S&P 500 first 2 %
  crossings of its 20-day high: 96 and 76; fresh 60-day lows: 30 and 20; new 52-week highs after a 5-day gap: 53 and
  65), so they are not testable to the bar the owner set and are not tested.

## Data (named before any result)

council-data `research/daily/` (OANDA mid, UTC daily candles, Saturday / Sunday candles folded into the next weekday by
`council/fills.mjs` `foldWeekend`): `xau` (gold), `spx500` (S&P 500 CFD), `nas100` (Nasdaq 100 CFD). Read with
`git show origin/council-data:research/daily/<key>.json` into a cache outside git, deleted at the end.

## The event

Index day D (a closed index candle) is a **new-depth day at X** when:
1. H = the highest close of the 252 index candles ending at D, at candle h (the latest one if tied);
2. the drawdown `close(D) / H - 1` is at or below `-X`;
3. close(D) is below every close from h to the candle before D (the deepest close since the 52-week high).

Only candles at or before D are read. Event counts (dates only, counted before this file was written; one trade at a
time removes none at a one-day hold):

| test | index | X | 2007-16 | 2017 - Oct 2026 |
|---|---|---|---|---|
| T1 (primary) | S&P 500 | 3 % | 166 | 135 |
| T2 | Nasdaq 100 | 3 % | 176 | 183 |
| T3 | Nasdaq 100 | 5 % | 113 | 126 |

They fall in about 45-60 distinct months a window: events cluster, which is why t is taken on calendar-month sums.
Longer holds (2, 3, 5 days, one trade at a time) leave 95, 79, 58 S&P trades out of sample and are not tested.

## The trade

Long gold at the open of the first gold candle whose day is after D; out at the close of that candle (one-day hold), or
at a stop of 2 x ATR(20) below the entry (ATR of the 20 gold candles before the entry; the stop is 1R; a stop touched
inside the candle fills at the stop). One position at a time. Every trade has a stop.

**Costs**: $0.60 a round trip plus `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price; R = (exit - entry) / stop distance, net = gross
minus costs in R. At twice the costs both terms double.

## Baseline, excess

Baseline = the same one-day long entered on EVERY gold candle of the same window (same side, same stop and costs,
overlapping allowed: one-day holds do not overlap). **Excess** = a trade's net R minus the baseline's mean net R of the
window.

## Windows and statistics

In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (signal date D in the window). t = mean / se
of the calendar-month sums of the excess (months by exit; every month of the window counts, a month with no trade is 0).
One-sided normal p of the out-of-sample month t, Holm over the three tests.

## Placebo and control

- **Placebo** (40 seeds, mulberry32 seeds 1-40): the same number of days drawn at random from every gold-tradeable index
  day of the out-of-sample window; the real T1 month t must beat at least 38 of the 40.
- **Control that keeps drift and volatility** (40 seeds, 101-140): every event day is replaced by a random index day of the
  SAME calendar month that is not an event day. Same months, so the same gold drift and volatility regime; the
  day-level information of the event is removed. The real T1 out-of-sample excess must beat at least 38 of the 40
  control draws' excess (each computed the same way against the same baseline), and the mean control excess is reported.

## Pass bar (T1 decides; T2, T3 are reported)

All of: T1 out-of-sample month t of the excess >= 2 with Holm p < 0.05; T1 in-sample excess > 0; T1 out-of-sample net R
a trade > 0 and excess > 0 at twice the costs; placebo beaten >= 38 of 40; control beaten >= 38 of 40. Else FAIL. A pass
would be a lead to replicate, never an edge.

## Deliverables

`run.mjs` (`fetch <dir>`, `full <dir>`), `result.json`, `RESULT.md`, `tests/gold-equity-new-depth.test.mjs`.
