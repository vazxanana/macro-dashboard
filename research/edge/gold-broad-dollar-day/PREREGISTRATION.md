# Pre-registration: a broad dollar day and gold over the next five days (study 120, 14 Nov 2026)

Written and pushed alone, before any return of the rule below was computed. Only the signal counts per window were read
(`run.mjs count`, which reads no price after an entry), to check the 100-event floor. Paper research only: a
**stand-alone rule on gold**, never a gate, entry, exit or size change of the live gold book, and no position of that book's
2006-17 study window is read (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member
changes, whatever the result.

## The idea, and why it is not a duplicate

A **broad dollar day** is a day on which the US dollar moves the same way against ALL six majors (EUR, GBP, AUD, JPY, CAD,
CHF) and the dollar index moves more than its usual daily size. A uniform dollar rally is the shape of a dollar funding
squeeze or a broad deleveraging, in which gold is sold with everything else for dollars; the hypothesis is that the selling
pressure on gold is temporary and gold recovers over the next week (T1, buy). The mirror (a uniform dollar fall, a dollar
glut) is tested as a sell (T2). T3 narrows T1 to the days on which gold itself was also sold.

What the tested dollar studies did, and why this differs in substance:
- `gold-dollar-divergence` (FAIL): gold and the index moving the SAME way on one day (both bid / both offered), continuation.
  Here gold's own move is not part of T1 / T2 at all; the signal is the dollar's **breadth** across six currencies.
- `gold-dollar-lead` (FAIL): a dollar down WEEK that gold lagged. Weekly, and conditioned on gold lagging.
- `gold-currency-breadth` (FAIL): gold's 20-day trend in six currencies (gold's breadth, not the dollar's).
- `gold-dxy-month-shock`: a monthly dollar move. `gold-fx-high-count`: gold at 20-day highs in other currencies.
- `gold-em-fx-stress`, `gold-eurchf-stress`, `gold-yen-surge`, `gold-carry-crash`, `gold-aud-haven-day`: one currency or
  one cross as the stress gauge, not the uniformity of the dollar across all majors.
No study in `research/edge/`, on a remote branch or in the topics list conditions on all six majors agreeing on one day.

## Data (named before any result)

- OANDA mid daily candles (UTC), council-data `research/daily/<key>.json` at commit `338cfb45` for `xau`, `eurusd`,
  `gbpusd`, `audusd`, `usdjpy`, `usdcad`, `usdchf`; weekends folded into Monday with `council/fills.mjs` `foldWeekend`.
- Dollar index = the council's ICE DXY build (`council/macro.mjs` `dxySeries`, USD/SEK = 11.2 / EURUSD) on the five pairs it
  uses; AUD/USD enters the breadth count only.
- A day counts only when gold and all six pairs have a candle; a return spanning a hole of more than 5 days is dropped and
  the 20-day window restarts after it.

## The rule

- Per day: each pair's close-to-close return signed so that positive = the dollar stronger (EURUSD, GBPUSD, AUDUSD falling;
  USDJPY, USDCAD, USDCHF rising). The index and gold returns are each divided by the sample sd of their 20 previous daily
  returns (the day itself excluded): `zd`, `zg`.
- **Broad dollar-up day**: all six pairs signed > 0 AND `zd > +1.0`. **Broad dollar-down day**: all six < 0 AND `zd < -1.0`.
- T1 (primary): broad dollar-up day -> **buy gold**. T2: broad dollar-down day -> **sell gold**. T3: broad dollar-up day with
  `zg < -0.5` -> buy gold.
- Trade: entry at gold's next UTC daily open after the signal day; stop 2.0 x ATR(14) of the 14 candles before the entry
  (= 1R; a gap through the stop fills at that open); exit at the close of the 5th daily candle (the entry candle counts as
  the first). One position at a time per test (a signal while a trade is open is skipped).
- Costs: $0.60 a round trip on every trade, plus financing on buys = `nights(entry, exit)` x `FIN.xau.long` (0.000148 of
  price a rollover, the demo broker's rate of 11 Nov 2026, charged for every year) x entry / risk. Sells pay and receive no
  financing.

## Baseline, excess, control, placebo

- **Same-side every-day baseline**: the same trade (same side, stop, hold, costs) entered after every eligible day of the
  window, overlaps allowed. Its mean net R is taken per calendar year of the entry.
- **Excess** of a trade = its net R minus that year's baseline mean. The tested figure is the mean excess; t is computed on
  **calendar-month sums of excess** (months with no exit count as 0).
- **Placebo**: 40 seeded draws (seeds 1-40) of as many random eligible days of the window as there were signals, traded by
  the same rule; their month-sum excess t is recorded.
- **Control** (keeps drift and volatility, removes the signal): 40 seeded draws (seeds 1001-1040) of random eligible days
  taken WITHIN each calendar year, as many in each year as the signal had in that year, traded by the same rule.

## Windows and statistics

- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- Signal counts read before this was written (`run.mjs count`): IS T1 176, T2 179, T3 110; OOS T1 237, T2 256, T3 155 signal
  days (one-at-a-time trades about 136 / 136 / 94 and 176 / 181 / 126).
- Holm over T1-T3 on the one-sided (positive) OOS p of the month-sum excess t.

## Pass bar (per test; the verdict is PASS only if T1 passes, PARTIAL if only T2 or T3 does)

1. OOS month-sum excess t >= 2 and Holm p < 0.05;
2. IS mean excess > 0;
3. OOS mean net R > 0, and still > 0 at twice the costs;
4. the real OOS excess t above at least 38 of 40 placebo draws AND at least 38 of 40 control draws;
5. at least 100 signal days in each window.

A pass would be a lead to replicate on data it did not use, never an edge for the book, and nothing live changes.

## Files

`run.mjs` (fetch / count / full), `RESULT.md`, `result.json`, `tests/gold-broad-dollar-day.test.mjs`. Candle caches stay
outside git and are deleted at the end.
