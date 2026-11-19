# Market intraday momentum, out of sample: pre-registration

Written and committed **before** any intraday-momentum quantity was computed (13 Nov 2026). The calendar, the signal, the rule,
the costs, the windows, the placebo and the pass bar are fixed here; nothing in them changes after the results are seen.
Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved (nothing under
`ict/` is read or written). This is not the opening range breakout tested elsewhere: it trades the LAST half hour, on the
sign of the FIRST half hour. A pass is a hypothesis for a forward paper shadow that the owner decides on; never a live rule.

## The claim being tested

Gao, Han, Li and Zhou (2018, Journal of Financial Economics, "Market intraday momentum") report that the S&P 500's first
half-hour return (previous close to 10:00 New York) predicts its last half-hour return (15:30 to 16:00), on SPY data that end
in 2013 (sample starting 1993). This study asks whether a trading rule built on it pays net of a CFD trader's costs on the
council's own OANDA index feeds: 2008-2015 (descriptive; it overlaps the paper's sample in 2008-2013, only 2014-2015 are after
it) and 2016 → now (the window that decides, wholly after the paper's data).

## What is already known (seen before this was written)

- The paper's headline as above; no coefficient from it is used here.
- OANDA mid M5 candles of SPX500 and NAS100 from 1 Nov 2007 to 12 Nov 2026 were already fetched in this session for
  `research/edge/pre-fomc-drift` (candle counts per year only were looked at, to confirm coverage). No return at 10:00,
  15:30 or 16:00 New York has been computed for this study or any other study in this repository.

## Data

OANDA mid M5 candles of SPX500 and NAS100 through the site's keyless proxy (`/md/bars`), 1 Nov 2007 to 13 Nov 2026, complete
candles only: `node --use-env-proxy research/edge/intraday-momentum/fetch.mjs <dir>` (same file format as pre-fomc-drift, so
that cache is reused). Files stay out of git. A price "at" a New York clock time = the close of the M5 candle that ENDS at
that time (candle start = time − 5 min); if that candle is missing, the last candle ending in the 10 minutes before it; none →
the day is skipped and counted. New York times are converted to UTC with the zone rules of that date (DST-correct).

## Calendar (stated, written in `run.mjs`, not read from any file)

NYSE trading days = weekdays that are not a full closure. Full closures: New Year's Day (Sunday → Monday; Saturday → no
closure), Martin Luther King Day (3rd Monday of January), Presidents' Day (3rd Monday of February), Good Friday, Memorial Day
(last Monday of May), Juneteenth (19 June from 2022; Saturday → Friday, Sunday → Monday), Independence Day (4 July; Saturday →
Friday, Sunday → Monday), Labor Day (1st Monday of September), Thanksgiving (4th Thursday of November), Christmas (25 December;
Saturday → Friday, Sunday → Monday); and the special closures 29-30 Oct 2012 (Hurricane Sandy), 5 Dec 2018 (President Bush),
9 Jan 2025 (President Carter). Half days (13:00 close): 3 July when it is a trading day and 4 July falls Tuesday to Friday; the
day after Thanksgiving; 24 December when it is a trading day.

**Skipped**: every half day, and every trading day whose previous trading day was a half day (its "previous close" was not a
16:00 close). All other trading days 2008-01-01 → 2026-11-13 are eligible.

## The signal and the rule (one trade a day per market, long or short)

- **Signal** r1 = P(10:00 today) / P(16:00 of the previous trading day) − 1. It uses only prices at or before 10:00.
- **Entry** at P(15:30): long if r1 > 0, short if r1 < 0, no trade if r1 = 0.
- **Exit** at P(16:00), the close of the M5 candle ending at 16:00.
- **Stop (every trade has one)**: entry ∓ 1.5 × A, where A = the mean of |P(16:00) − P(15:30)| over the 20 previous ELIGIBLE
  days with data (traded or not; strictly before today). A day with fewer than 20 such days before it is not traded. Checked on
  the M5 candles that start at 15:30, 15:35 … 15:55: a candle that opens at or beyond the stop exits at its open (a gap),
  otherwise a high / low at or beyond the stop exits at the stop. Never moved.
- **R** = signed (exit − entry) / stop distance; **net R** = R − cost / stop distance. Costs, round trip: SPX500 1 point,
  NAS100 2 points. The trade opens and closes inside the cash session: no rollover, no financing.
- r2 (the last half-hour return) = P(16:00) / P(15:30) − 1, used for the hit rate and the regression.

## Windows

A: 2008-01-01 to 2015-12-31 (descriptive). **B: 2016-01-01 to 2026-11-13: decides.** By New York trading date.

## Pass bar (per market, window B only)

1. mean net R a trade > 0 and t ≥ 2 (t = mean / (sd / √n) over the trades; one trade a day, no overlap);
2. the signal's sign hit rate (share of traded days with r2 ≠ 0 where sign(r1) = sign(r2)) above the 95th percentile of a
   placebo of 40 seeds, each giving every traded day a random sign (seeded generator, seeds 1-40);
3. Holm over the two markets at 5 %, on one-sided p of the t in 1 (normal approximation).

SPX500 is the primary market, NAS100 the second. **Verdict PASS** if at least one market meets 1, 2 and 3; otherwise FAIL.
Window A, the gross figures, stops and the regression are reported and decide nothing.

## Descriptive: the paper's regression

Per market and window: OLS of r2 on r1 (both in %), slope, OLS t, White (HC0) t, R², n (all eligible days with data, not only
traded ones). Decides nothing.

## Not done (said now)

No other half hour as a predictor (the paper's 15:00-15:30 one too), no volatility or volume split, no other market, no
size or exit variant. Any such test needs its own pre-registration.
