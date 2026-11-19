# The US cash-session midday turn on index CFDs: pre-registration

Written and committed **before** any midday-turn quantity was computed (14 Nov 2026). The calendar, the morning move, the
rule, the stop, the filter, the costs, the windows, the statistics, the placebo and the pass bar are fixed here; nothing in them
changes after the results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved (nothing under
`ict/` is read or written; ICT is a separate edge). A pass would be a hypothesis for a forward paper shadow that the owner
decides on; never a live rule.

## The question

Does the move of a US index CFD over the first two hours of the New York cash session (09:30 to 11:30 New York time) predict
the midday window that follows (11:30 to 14:00 New York) in the OPPOSITE direction (a midday reversal, "fade") or in the SAME
direction (continuation, "follow")? Both signs are tested, on NAS100 and SPX500, net of a CFD trader's costs.

## How this differs from `intraday-momentum`

`research/edge/intraday-momentum` (branch `intraday-momentum`, FAIL) tested Gao, Han, Li and Zhou (2018): the signal there is
the previous 16:00 close to 10:00 (so it includes the overnight gap and only the first half hour of the session), the trade is
the LAST half hour (15:30-16:00), the side is "follow" only, the stop is 1.5 x the 20-day mean last-half-hour move and the
costs are fixed points. Here the signal is the cash-session morning only (09:30 to 11:30, no overnight gap), the trade is the
MIDDLE of the day (11:30 to 14:00, two and a half hours, before the closing auction and the last-hour flows), both signs are
tested, the stop is 1 x the 20-day ATR of daily candles, small mornings are skipped, the cost is a percentage of notional and
t is taken on calendar-month sums. The two studies share no window of the day: 11:30-14:00 does not overlap 15:30-16:00.

## What is already known (seen before this was written)

- The intraday-momentum result above (its signal and trading window are different from this one) and the index-overnight
  result (close-to-open longs, FAIL). No figure from either is used here.
- OANDA mid M5 candles of SPX500 and NAS100 from 1 Oct 2007 to 13 Nov 2026 were already fetched in this session for other
  studies; only their first / last candle times and counts were looked at for this study. No return at 09:30, 11:30 or 14:00
  New York, and no 11:30-14:00 trade, has been computed for this study.

## Data

OANDA mid M5 candles of `spx500` and `nas100` through the site's keyless candle proxy (`/md/bars`), 1 Oct 2007 to 13 Nov 2026,
complete candles only: `node --use-env-proxy research/edge/index-midday-turn/fetch.mjs <dir>` (files `<market>-5m.json.gz`,
rows `[t, o, h, l, c]`, the same format as the earlier index studies, so their caches are reused). Files stay out of git.

A price "at" a New York clock time = the close of the M5 candle that ENDS at that time (candle start = time − 5 min); if that
candle is missing, the last candle ending in the 10 minutes before it; none → the day is skipped and counted. New York times are
converted to UTC with the zone rules of that date (`council/events.mjs` `zonedToUtc`; DST-correct).

## Calendar (stated, written in `run.mjs`, not read from any file; the same rules as `intraday-momentum`)

NYSE trading days = weekdays that are not a full closure. Full closures: New Year's Day (Sunday → Monday; Saturday → no
closure), Martin Luther King Day (3rd Monday of January), Presidents' Day (3rd Monday of February), Good Friday, Memorial Day
(last Monday of May), Juneteenth (19 June from 2022; Saturday → Friday, Sunday → Monday), Independence Day (4 July; Saturday →
Friday, Sunday → Monday), Labor Day (1st Monday of September), Thanksgiving (4th Thursday of November), Christmas (25 December;
Saturday → Friday, Sunday → Monday); and the special closures 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025. Half days (13:00 close):
3 July when it is a trading day and 4 July falls Tuesday to Friday; the day after Thanksgiving; 24 December when it is a
trading day. **Eligible days = full trading days** (every half day is skipped: its cash session ends inside the window).

## Daily candles and the ATR

Daily candles are built from the same M5 candles: one candle per weekday, from 17:00 New York of the previous calendar day to
17:00 New York of that day (Monday's candle starts Sunday 17:00), open / high / low / close of the M5 candles that start in that
span; a weekday with no candle is absent. True range = max(high, previous close) − min(low, previous close). **ATR20 of trading
date d** = the simple mean of the true ranges of the 20 last daily candles that END at or before 17:00 New York of the
calendar day before d (so it reads nothing of day d). Fewer than 20 → no trade.

## The morning move, the filter and the rule

- **Morning move** m = P(11:30) / P(09:30) − 1 (09:30 = the close of the candle ending at 09:30, the last print before the cash
  open). It reads nothing after 11:30.
- **Filter**: M = the median of |m| over the 20 previous ELIGIBLE days with prices (strictly before today, filtered or not).
  The day is skipped when |m| < 0.25 × M, when m = 0, or when fewer than 20 such days exist.
- **Entry** at P(11:30). **Fade**: short if m > 0, long if m < 0. **Follow**: long if m > 0, short if m < 0.
- **Exit** at P(14:00), the close of the M5 candle ending at 14:00.
- **Stop (every trade has one)**: entry ∓ 1 × ATR20. Checked on the M5 candles that start at 11:30, 11:35 … 13:55: a candle
  that opens at or beyond the stop exits at its open (a gap), otherwise a high / low at or beyond the stop exits at the stop.
  Never moved. No target.
- **R** = side × (exit − entry) / ATR20. **Cost** = 0.04 % of notional round trip = 0.0004 × entry, so cost R = 0.0004 × entry /
  ATR20 and **net R** = R − cost R. A check at 2x (0.08 %) is reported and decides nothing. No financing: the trade opens and
  closes inside the cash session.
- One trade a day per market and test; no overlap.

## Tests

| test | market | side |
|---|---|---|
| T1 | NAS100 | fade the morning move |
| T2 | NAS100 | follow the morning move |
| T3 | SPX500 | fade |
| T4 | SPX500 | follow |

## Windows

**Decisive: 2016-01-01 to 2026-11-13.** Replication: from the first tradeable day of the data (after the 20-day warm-ups) to
2015-12-31. By New York trading date.

## Statistics

- t on **calendar-month sums**: the net R of a test's trades summed per calendar month (months with at least one trade), t =
  mean / (sd / √months). One-sided p = the upper normal tail of t.
- **Holm** over the four decisive p values at 5 %.
- **Placebo, 40 seeds** (seeded generator, seeds 1-40), per market: on every day the tests trade (same days, same n), a random
  2.5-hour window of the cash session with a start on the 5-minute grid from 09:30 to 13:30 other than 11:30 (so it ends by
  16:00), and a random sign; the same ATR20 stop, the same rules for prices, gaps and stops, the same 0.04 % cost. Per seed: the
  decisive mean net R a trade and month-sum t. Reported for each test: the placebo's mean, 95th percentile and how many seeds
  the test beats. **The placebo decides nothing**; it says whether a result stands out from any window of the day traded with a
  random side.

## Pass bar (per test)

1. mean net R a trade > 0 in the decisive window AND in the replication window;
2. decisive Holm p < 0.05;
3. decisive n ≥ 200 trades.

**Verdict PASS** if at least one test meets 1, 2 and 3; otherwise **FAIL**. The gross figures, the 2x cost check, the placebo,
the stops, the by-year table and the regression decide nothing.

## Descriptive (decides nothing)

Per market and window: OLS of the midday return P(14:00) / P(11:30) − 1 on m (both in %), on all eligible days with prices and
the warm-ups done (filtered or not): slope, OLS t, White (HC0) t, R², n. Net R by year.

## Not done (said now)

No other split of the day, no other filter level, no other stop, no target, no session filter, no news filter, no US30. Any of
those after seeing the result would be post hoc and would need its own pre-registration on other data.
