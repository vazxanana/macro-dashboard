# Gold session drift: where gold's return comes from by session (pre-registration)

Written and pushed before any trade of this study was computed. Paper research only.

**This is a new stand-alone intraday rule, not a gate, exit, entry or size of the gold book** (Gold trend + Gold daily
engulf). Item 44 of `docs/owner-decisions.md` (no further gate, exit, entry or size tested on that book's 2006-17 window) is
respected: nothing here reads, filters or changes the book's trades, and no live rule, config, council member or mirror
setting changes whatever the result.

## Question

Published and practitioner work says gold's gains come in Asian hours and its losses around the London fixes and New York
hours. As plain clock trades on OANDA spot gold, after costs and with a stop on every trade, does either side hold on
2020 to now and with the same sign on 2008-19?

## What was tested before, and what is dropped

`research/edge/seasonality` (main, 0 of 10 passed) already tested on gold:
- **H5, long 18:00 New York (the reopen after the daily break) to 08:00 London**, Sunday to Thursday evenings. In UTC that is
  23:00 → 08:00 in winter and 22:00 → 07:00 in the US / UK summer: the same session as the session long intended here
  (23:00 → 07:00 UTC), at most one hour apart at either end. Result there: +0.004 % / +0.009 % a night after costs, not
  significant, negative at double costs.
- **H4, short 15:00 → 15:30 London** (the PM fix): failed.

So **the plain session long (23:00 → 07:00 UTC, every weekday) is the same window as H5 and is dropped from the tests.** It is
computed only as a labelled reference line (not a test, not in Holm, not in the verdict). Its trend-filtered version (below)
has not been tested anywhere and stays, said plainly as a filter on H5's window. The session short (13:00 → 21:00 UTC: London
afternoon + New York, eight hours) is not H4 (30 minutes) and was never tested with a side, costs or a stop: it stays. The
seasonality study's "Asia vs London + New York" comparison was a gross control, not a trade.

## The tests (3, fixed)

| # | Name | Side | Entry | Exit | Days |
|---|---|---|---|---|---|
| T1 | Session short | short | open of the 13:00 UTC H1 candle of day D | close of the 20:00 UTC H1 candle of day D (21:00 UTC) | D Monday-Friday |
| T2 | Session long, trend on | long | open of the 23:00 UTC H1 candle of day D-1 | close of the 06:00 UTC H1 candle of day D (07:00 UTC) | D Monday-Friday, only when the last daily close > its 50-day average |
| T3 | Session short, trend on | short | as T1 | as T1 | as T1, only when the last daily close < its 50-day average |

Reference only (not a test): R0 = the session long of T2 on every day (the H5 window again).

- **Day D** is the UTC date of the trade's exit. Skipped: Saturday / Sunday, 25 December, 1 January, and any trade whose eight
  H1 candles (start hour to start hour + 7) are not all on file (holiday closures, data holes). Skips are counted.
- **Daily close** = the close of the 20:00 UTC H1 candle of a weekday (it ends at 21:00 UTC, before the daily break in either
  season). **50-day average** = the mean of the last 50 such closes. The filter reads the latest daily close whose candle
  ended at or before the entry time (for T3 at 13:00 UTC on D that is D-1's; for T2 at 23:00 UTC on D-1 it is D-1's; on a
  Monday, Friday's). No look-ahead; a test checks it.
- **Stop (every trade has one):** entry ∓ 1.5 × the median of (high − low) of the same eight-hour window over the 20 previous
  complete sessions of that window (every complete session, filtered or not, before the trade's entry). No trade before 20
  such sessions exist. Long stop below, short stop above the entry.
- **Fills:** H1 candles in order from the entry candle. A long is stopped when a candle's low ≤ stop and fills at
  min(candle open, stop) (a gap through fills at the open); a short when high ≥ stop, at max(open, stop). Otherwise out at the
  exit candle's close. No target, no break-even, no trail. One trade a day per test; the windows never overlap.
- **R** = side × (exit − entry) / (entry-to-stop distance). **Net R** = R − 0.30 / distance ($0.30 round trip, the spread
  model of the gold studies). **Financing:** `council/fills.mjs` `nights` counts rollovers at 22:00 UTC; an entry at 23:00
  and an exit at 07:00 cross none, nor does 13:00 → 21:00, so 0 nights are charged (asserted in the run and the test). The
  broker's real summer break is 21:00-22:00 UTC: T1 is out at 21:00 UTC, T2 enters after it; no night either way. Shorts are
  credited nothing.

## Data

OANDA mid H1 XAU_USD through the site's proxy (`/md/bars?sym=xau&tf=1h`), the cache already fetched for the gold playbook
studies (March 2006 to 11 November 2026), kept outside git. `node --use-env-proxy run.mjs fetch <dir>` refetches it.

## Windows

- **Decisive:** trades with D from 2020-01-01 to the end of the data.
- **Replication:** D from 2008-01-01 to 2019-12-31.

## Statistics and the pass bar

- Per test and window: n, net R a trade, total, win rate, worst closed drawdown, and **t on calendar-month sums** (every
  calendar month of the window, 0 for a month without a trade; t = mean / (sd / √months)); one-sided p from Student t with
  months − 1 degrees of freedom.
- **A test passes only if all hold:**
  1. 2020 → now: net R a trade > 0 and monthly-sum t ≥ 2;
  2. 2008-19: net R a trade > 0 (the same sign);
  3. Holm over the 3 tests on the 2020 → now one-sided p, family α 0.05;
  4. its 2020 → now net R a trade is above the 95th percentile (linear interpolation) of a 40-seed placebo.
- **Placebo:** seed s = 1..40 (mulberry32). For each trade the test took in 2020 → now, the same day D, the same side, a start
  hour drawn uniformly from the 23 UTC hours other than the test's own; an eight-hour window starting at that hour of day D
  (UTC), with the same stop rule (1.5 × the median range of THAT window over its 20 previous complete sessions), the same
  fills and $0.30. A placebo long whose window crosses 22:00 UTC is charged financing by `council/fills.mjs` `nights` and
  `FIN.xau.long` (as any long held over the rollover); shorts nothing. A placebo window that is not complete is skipped. Each
  seed gives one net R a trade.
- **Verdict:** PASS if at least one test passes all four; else FAIL. A PASS is a candidate for a paper shadow only, by a
  proposal under `research/proposals/` for the owner; never live, never a gate of the gold book.

Not part of the verdict: per-year tables, x2 costs, the R0 reference, any other hour, window or market.
