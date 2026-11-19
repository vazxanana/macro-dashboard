# Intraday momentum on gold, silver and crude oil: pre-registration

Written and committed **before** any return of this study was computed (14 Nov 2026). The sessions, the calendar, the signal,
the rule, the stop, the costs, the windows, the placebo and the pass bar are fixed here; nothing in them changes after the
results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **This is a stand-alone study.** It is not a gate, exit, entry or size on the live gold book (Gold trend,
Gold daily engulf), it does not read the 2006-17 gold-book positions or any other study's trade records, and it is not a test
of another lever on that book (owner decision 44, `docs/owner-decisions.md`). No live rule, size, filter, stop, config or
council member changes. ICT is not involved (`ict/calendar.mjs` is imported read-only for its CME calendar; nothing under
`ict/` is written). A pass is a hypothesis for a forward paper shadow that the owner decides on; never a live rule.

## The claim being tested

Gao, Han, Li and Zhou (2018, Journal of Financial Economics, "Market intraday momentum") report that the first half-hour
return of the S&P 500 predicts the sign of its last half-hour return. `research/edge/intraday-momentum` (branch
`intraday-momentum`, 13 Nov 2026) tested that on SPX500 and NAS100 and failed. Nobody here has tested it on metals or oil.
The claim here, written for the US floor session of each commodity:

> The return of the first 30 minutes of the US floor session predicts the sign of the return of the last 30 minutes before
> that session's close.

| test | market | OANDA key | floor session (New York time) | first half hour (signal) | last half hour (trade) |
|---|---|---|---|---|---|
| T1 | gold (COMEX) | `xau` | 08:20 - 13:30 | 08:20 → 08:50 | 13:00 → 13:30 |
| T2 | silver (COMEX) | `xag` | 08:20 - 13:30 | 08:20 → 08:50 | 13:00 → 13:30 |
| T3 | WTI crude (NYMEX) | `wtico` | 09:00 - 14:30 | 09:00 → 09:30 | 14:00 → 14:30 |

The prices are OANDA's spot / CFD mid prices, not the futures themselves; the session clock is the futures' floor session.

## What is already known (seen before this was written)

- The paper's headline as above; no coefficient from it is used.
- The index study's result (FAIL: the sign did not predict after 2015 on SPX500 / NAS100, and costs dominated). That study's
  code is copied (not imported) as the starting point of `run.mjs`.
- OANDA M5 gold candles were fetched in this session by other studies (pre-FOMC drift, Mosha); candle coverage only was
  looked at. No return at 08:20, 08:50, 09:00, 09:30, 13:00, 13:30, 14:00 or 14:30 New York has been computed for this study
  or any other study in this repository on these three markets.

## Data

OANDA mid M5 candles of `xau`, `xag` and `wtico` through the site's keyless proxy (`/md/bars`), 1 Nov 2006 to 14 Nov 2026,
complete candles only: `node --use-env-proxy research/edge/metals-intraday-momentum/fetch.mjs <dir>`. Files stay out of git.
A price "at" a New York clock time = the close of the M5 candle that ENDS at that time (candle start = time − 5 min); if that
candle is missing, the last candle ending in the 10 minutes before it; none → the day is skipped and counted.

New York → UTC: `council/histdata.mjs` `nyOffsetH` (US daylight time from the 2nd Sunday of March to the 1st Sunday of
November: UTC−4, else UTC−5), applied to the date's clock time (every time used is after 02:00, so the day of a switch is
converted correctly).

## Calendar

A day is **eligible** when it is a Monday-Friday New York date and `ict/calendar.mjs` `cmeShut(t)` is false at the start of
every M5 candle from the session open to 5 minutes before the session close (T1 / T2 08:20 … 13:25, T3 09:00 … 14:25). This
drops every CME full holiday (New Year, Good Friday, Christmas) and every early-close day (the calendar shuts those from 13:00
New York, before both closes). The same CME rule set is used for NYMEX crude. Columbus Day and Veterans Day are ordinary days.

## The signal and the rule (one trade a day per market, long or short)

- **Signal** r1 = P(open + 30 min) / P(open) − 1. It reads only candles that ended by open + 30 min.
- **Entry** at P(close − 30 min): long if r1 > 0, short if r1 < 0, no trade if r1 = 0.
- **Exit** at P(close), the close of the M5 candle ending at the session close, unless the stop is hit first.
- **Stop (every trade has one, absolute rule 1)**: entry ∓ 1.5 × A, where A = the mean of |P(close) − P(close − 30 min)|
  over the 20 previous eligible days with data (traded or not; strictly before today). A day with fewer than 20 such days
  before it is not traded. Checked on the M5 candles that start at close − 30, close − 25 … close − 5: a candle that opens at
  or beyond the stop exits at its open (a gap), otherwise a high / low at or beyond the stop exits at the stop. Never moved.
  Why this distance: it is measured on the very half hour that is traded, so it scales with each market's price level and
  volatility without a parameter per market, it is known before the entry, and 1.5 × a typical half-hour move leaves most
  days to run to the close (the claim is about the half-hour return, so the stop should rarely decide it). It is the index
  study's stop, so the two studies read alike. The first-half-hour range was not chosen: it measures another half hour.
- **R** = signed (exit − entry) / stop distance; **net R** = R − cost / stop distance.
- **Costs, round trip** (named constants in `run.mjs`, each with its basis):
  - gold `COST.xau` = $0.30 an ounce: the repository's standing gold round trip (`research/edge/gold-systems-oos`,
    `supported-book`, the 11 Nov edge review);
  - silver `COST.xag` = $0.03 an ounce: the silver round trip (spread + slippage on the OANDA CFD) the repository already
    uses in the ICT lab (`api/_ictlab.js` `COST.xag`, from `research/edge/ict-universe`);
  - crude `COST.wtico` = $0.04 a barrel: no crude cost exists in the repository and no broker crude spread is on file; this
    is an assumed typical retail WTI CFD spread of about $0.03 plus a cent of slippage, stated as an assumption. The 2× cost
    line shows what a wider cost does.
  Intraday: the trade opens and closes inside the session, no rollover, **no financing**. Every figure is also reported at
  **2× cost** (decides nothing).
- r2 (the last half-hour return) = P(close) / P(close − 30 min) − 1, used for the hit rate and the regression.

## Windows (by New York date)

- **A, replication**: 2007-01-01 (or the first day a market has M5 data and 20 days of history, if later) to 2015-12-31.
- **B, decisive**: 2016-01-01 to 2026-11-13.

## Pass bar (per test; T1, T2, T3)

1. mean net R a trade > 0 in **both** A and B;
2. window B **t ≥ 2 on calendar-month sums** of net R (t = mean / (sd / √m) over the months of B with at least one trade);
3. **Holm** over the three tests at 5 %, on the one-sided p of the B month-sum t (normal approximation);
4. window B n ≥ 300 trades.

A test passes when it meets 1-4. **Verdict PASS** if at least one test passes, otherwise FAIL; each test's own result is
reported.

## Reported, decides nothing

- **Placebo, 40 seeds**: on the same window-B traded days, each seed (seeded generator, seeds 1-40) gives every day a random
  long / short sign; same entry, stop, exit and cost. Reported: the placebo's mean net R a trade (mean over seeds, 95th
  percentile, max), how many seeds the rule beats, and the sign hit rate (share of traded days with r2 ≠ 0 where
  sign(r1) = sign(r2)) against the placebo's.
- **2× cost**: net R a trade and month-sum t in A and B.
- Gross R, stops hit, win rate, net R by year, the trade-level t.
- The paper's regression: OLS of r2 on r1 (both in %), slope, OLS t, White (HC0) t, R², per market and window.

## Not done (said now)

No other half hour as a predictor (no previous-close-to-open gap, no 15:00-style penultimate half hour), no volatility,
volume or news split, no other market, no size or exit variant, no combination with any council system. Any such test needs
its own pre-registration.
