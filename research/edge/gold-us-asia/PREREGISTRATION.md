# Gold: does the Asian session continue or reverse the New York cash session? (pre-registration)

Written and pushed before any trade of this study was computed. Paper research only.

**This is a new stand-alone intraday rule, not a gate, exit, entry or size of the gold book** (Gold trend + Gold daily
engulf). Item 44 of `docs/owner-decisions.md` (no further gate, exit, entry or size tested on that book's 2006-17 window) is
respected: nothing here reads, filters or changes the book's trades, and no live rule, config, council member or mirror
setting changes whatever the result.

## Why

Three studies on other branches (not on main; read, not imported) asked the same question elsewhere and failed:
- `us-asia-lead` (#913): on index CFDs the US cash-session move is already in the Asian opening gap, and the Asian session
  slightly reverses it (correlation −0.04 to −0.12);
- `eu-gap-fade` (#916): on European indices nothing is left after the gap;
- `gold-session-drift`: gold's sessions have no unconditional drift after costs.

Gold trades through the night with no cash gap, so the question can be asked without a gap taking the move first.

## Question

Does gold's Asian session (00:00 → 07:00 UTC) continue or reverse the preceding New York cash-session move?

## Definitions

- **New York cash session** = 09:30 → 16:00 New York time: 13:30 → 20:00 UTC while the US is on daylight time, 14:30 →
  21:00 UTC otherwise. US daylight time by the rule in force that year (from 2007: second Sunday of March to first Sunday of
  November; before 2007: first Sunday of April to last Sunday of October), switching at 02:00 local.
- **NY move** = close of the M15 candle that ends at the session end − open of the M15 candle that starts at the session
  start. If either candle is missing, the session is missing (a day after it is skipped and counted).
- **Trade day D** = a UTC weekday (Monday-Friday), not 25 December or 1 January. Its **preceding NY session** is the NY
  session of the previous weekday (for a Monday, Friday's); when that session is missing the day is skipped, never reaching
  further back.
- **20-day median** = the median of |NY move| over the 20 complete NY sessions before the preceding one (the preceding
  session itself is not in it). No trade before 20 such sessions exist.
- **Daily ATR20** = the mean true range of the last 20 complete New York trading days (17:00 → 17:00 New York, built from
  the M15 candles, labelled by the day they end; the Sunday reopen hours belong to Monday's day; a day ending on a Saturday
  or Sunday does not exist), all ended before the entry. True range uses the previous day's close.

## The tests (3, fixed)

| # | Name | Side | Days |
|---|---|---|---|
| T1 | Fade the NY move in Asia | against the NY move (NY up → sell, NY down → buy) | \|NY move\| ≥ 0.5 × its 20-day median |
| T2 | Follow the NY move in Asia | with the NY move | \|NY move\| ≥ 0.5 × its 20-day median |
| T3 | Fade, big NY days only | as T1 | \|NY move\| > 1.5 × its 20-day median |

- **Entry:** open of the 00:00 UTC M15 candle of D. **Exit:** close of the 06:45 UTC M15 candle (07:00 UTC). Both candles
  must be on file, else the day is skipped and counted. One trade a day per test.
- **Stop (every trade has one):** entry ∓ 1 × the daily ATR20 (long stop below, short above). No target, no break-even, no
  trail.
- **Fills:** M15 candles from 00:00 to 06:45 UTC in order. A long is stopped when a candle's low ≤ stop and fills at
  min(candle open, stop) (a gap through fills at the open); a short when high ≥ stop, at max(open, stop). Otherwise out at
  the 06:45 candle's close. A hole inside the window is simply not read (no fill is invented).
- **R** = side × (exit − entry) / stop distance. **Net R** = R − $0.30 / stop distance (round trip).
- **Financing:** none. `council/fills.mjs` `nights` counts rollovers at 22:00 UTC; a 00:00 → 07:00 UTC hold crosses none
  (asserted in the run and the test), so no gold-long financing is charged; shorts are credited nothing.

## Data

OANDA mid M15 XAU_USD through the site's candle proxy (`/md/bars?sym=xau&tf=15m`; served from June 2006),
`node --use-env-proxy run.mjs fetch <dir>`, cache kept outside git.

## Windows

- **Decisive:** trade days D from 2016-01-01 to the end of the data.
- **Replication:** D from the start of the data (June 2006) to 2015-12-31.

## Statistics

- Per test and window: n, buys / sells, gross R a trade, net R a trade, net R at 2× cost, total, win rate, stopped count,
  worst closed drawdown, and **t on calendar-month sums** of net R (every calendar month of the window, 0 for a month with
  no trade; t = mean / (sd / √months)); one-sided p from Student t with months − 1 degrees of freedom.
- **Holm** over the 3 tests on the decisive one-sided p, family α 0.05.
- **Placebo (40 seeds, mulberry32, seed 1..40):** the same trade days of each test, the same entry, stop and exit, but the
  side drawn at random (buy or sell, ½ each) per trade; reported as p5 / p50 / p95 of the 40 seeds' mean net R and the rank
  of the real mean. Reported, not a pass condition.
- **2× cost:** net R a trade with $0.60 a round trip, reported, not a pass condition.
- Descriptive, not a test: the correlation of the NY move with the following Asian session's return (00:00 → 07:00 UTC),
  and with the move from the NY session end to 00:00 UTC, per window.

## Pass bar (a test passes only if all hold)

1. Net R a trade > 0 in the decisive window AND in the replication window;
2. Holm-adjusted decisive one-sided p < 0.05;
3. n ≥ 200 in each window (T3: n ≥ 100).

The study passes if at least one test passes. Whatever the result, nothing live changes: a pass would only be a candidate
for its own forward paper record and an owner decision.
