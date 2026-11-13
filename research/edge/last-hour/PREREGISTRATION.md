# Last hour into the US cash close on a big day: pre-registration

Written and committed **before** any quantity of this study was computed (13 Nov 2026). The calendar, the signal, both
variants, the stop, the exit, the costs, the windows, the placebo and the pass bar are fixed here; nothing in them changes
after the results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved (nothing under
`ict/` is read or written). A pass is a hypothesis for a forward paper shadow that the owner decides on, never a live rule.

## The claim being tested

Published work on the US cash close (end-of-day order flow: market-on-close imbalances, index rebalancing, leveraged and
inverse ETF rebalancing, dealer hedging) describes a drift in the last hour of the session that depends on how far the index
has already moved that day: some find continuation (rebalancing flows trade with the day's move), others an end-of-day
reversal. Neither direction is assumed here: both are tested as two variants, on large-move days only.

## How this differs from `intraday-momentum` (branch `intraday-momentum`, #835)

That study used the sign of the move from the PREVIOUS 16:00 close to 10:00 (first half hour, overnight gap included) on
EVERY day and traded 15:30-16:00 with it. This one: the signal is the move from 09:30 to 15:00 the SAME day (no overnight
gap, five and a half hours of the session); only days when that move is large against its own recent history are traded;
the trade is the last full hour, 15:00-16:00; it is tested both ways (fade and follow); the stop is set from the day's own
09:30-15:00 range; the markets are NAS100, SPX500 and US30, pooled. No figure of that study is used here.

## What is already known (seen before this was written)

- OANDA mid M5 candles of SPX500 and NAS100 from 1 Nov 2007 to 12 Nov 2026 were fetched in this session for other studies
  (`pre-fomc-drift`, `intraday-momentum`); only candle counts per file were looked at. US30 M5 candles are being fetched from
  1 Oct 2009 with `fetch.mjs`; only their count will be looked at before the run.
- No 09:30-15:00 move, no 15:00-16:00 move and no trade of this rule has been computed for this study or any other study in
  this repository.

## Data

OANDA mid M5 candles of `nas100`, `spx500`, `us30` through the site's keyless proxy (`/md/bars`), complete candles only:
`node --use-env-proxy research/edge/last-hour/fetch.mjs <dir>` (format of the `pre-fomc-drift` cache, so it is reused).
Files stay out of git. New York times are converted to UTC with the zone rules of that date (DST-correct,
`council/events.mjs` `zonedToUtc`).

A price "at" a New York clock time T = the close of the M5 candle that ENDS at T (it starts at T − 5 min); if that candle is
missing, the close of the last candle ending in the 10 minutes before T; none → the day is skipped and counted.

## Calendar (stated, written in `run.mjs`, not read from any file)

NYSE trading days = weekdays that are not a full closure. Full closures: New Year's Day (Sunday → Monday; Saturday → no
closure), Martin Luther King Day (3rd Monday of January), Presidents' Day (3rd Monday of February), Good Friday, Memorial Day
(last Monday of May), Juneteenth (19 June from 2022; Saturday → Friday, Sunday → Monday), Independence Day (4 July; Saturday →
Friday, Sunday → Monday), Labor Day (1st Monday of September), Thanksgiving (4th Thursday of November), Christmas (25 December;
Saturday → Friday, Sunday → Monday); and the special closures 29-30 Oct 2012 (Hurricane Sandy), 5 Dec 2018 (President Bush),
9 Jan 2025 (President Carter). Half days (13:00 close, so no 15:00-16:00 cash hour): 3 July when it is a trading day and
4 July falls Tuesday to Friday; the day after Thanksgiving; 24 December when it is a trading day.

**Eligible days** = full trading days (half days are skipped; they are never traded and never enter the median).

## The signal (per market, per eligible day)

- x = P(15:00) / P(09:30) − 1 (the open-to-15:00 move as a fraction). It reads nothing that ends after 15:00.
- Range = highest high − lowest low of the M5 candles that START in [09:30, 15:00). A day with fewer than 50 of those 66
  candles is skipped and counted (no x, no range).
- Median = the median of |x| over the 20 previous eligible days of that market that have an x (strictly before today). A day
  with fewer than 20 such days before it is not traded (warm-up).
- **Big day**: |x| > 1.5 × median, x ≠ 0, range > 0.

## The two variants (one trade per market per big day)

- **Fade**: side = −sign(x). **Follow**: side = +sign(x).
- **Entry** at P(15:00).
- **Stop (every trade has one)**: entry ∓ 0.5 × range (the day's 09:30-15:00 range, in points), never moved. Checked on the
  M5 candles that start at 15:00, 15:05 … 15:55: a candle that opens at or beyond the stop exits at its open (a gap);
  otherwise a high (short) / low (long) at or beyond the stop exits at the stop.
- **Exit** at P(16:00) when the stop was not hit. No target.
- **R** = side × (exit − entry) / stop distance. **Net R** = R − cost / stop distance.
- **Costs, round trip, in index points**: spread NAS100 3, SPX500 1, US30 4 (as the other index studies), plus 0.5 point of
  slippage per side (1 point a round trip): **NAS100 4, SPX500 2, US30 5**. No financing (the trade opens and closes inside
  the cash session; no rollover).

## Windows (by New York trading date)

- **Decisive: 2016-01-01 → 2026-11-12** (the last complete day in the cache).
- **Replication: 2010-01-01 → 2015-12-31.** Days from 1 Oct 2009 are read only to fill the first medians.

## Pass bar (per variant; Fade and Follow are the two tests)

Pooled = the trades of all three markets together.

1. Decisive window: pooled mean net R a trade > 0.
2. Decisive window: t ≥ 2 on calendar-month sums: every calendar month of the window is one observation (the sum of the
   variant's net R over all three markets that month; a month with no trade counts 0); t = mean / (sd / √months).
3. Replication window 2010-15: pooled mean net R a trade > 0 (same sign).
4. Holm over the two variants at 5 %, on the one-sided p of the t in 2 (normal approximation).
5. Placebo: 40 seeds (mulberry32, seeds 1-40). For each seed and each market, draw as many days as the variant has trades in
   that market in the decisive window, without replacement, from ALL eligible days of that market in the decisive window that
   have an x, a range and a full 20-day median history (big or not); apply the same side rule (fade: −sign of that day's own x;
   follow: +sign), the same entry time, stop rule, exit and costs (a day with x = 0 is drawn again). The seed's statistic is
   the pooled mean net R a trade. The variant's pooled mean net R a trade must be above the 95th percentile of the 40 seeds
   (the 38th of 40 sorted ascending).

**Verdict PASS** if at least one variant meets 1-5; otherwise FAIL. Per-market figures, gross R, stop rate, by-year figures
and the trade t (over trades) are reported and decide nothing.

## Not done (said now)

No other threshold, no other entry hour (15:30, 15:50), no target or trailing exit, no split by quarter-end / index
rebalancing dates, option expiry, volatility or day of the week, no other market (NAS100, SPX500, US30 only), no futures or
cash data. Any such test needs its own pre-registration.
