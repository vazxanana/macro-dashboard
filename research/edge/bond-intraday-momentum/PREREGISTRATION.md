# Intraday momentum in US Treasury CFDs: pre-registration

Written and committed **alone**, before any return of this study was computed (14 Nov 2026). The session, the calendar, the
signal, the rule, the stop, the costs, the windows, the placebo and the pass bar are fixed here; nothing in them changes after
the results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. A **stand-alone study**: not a gate, exit, entry or size on the live gold book (owner decision 44), and it
reads no other study's trade records. No live rule, size, filter, stop, config or council member changes. ICT is not involved
(`ict/calendar.mjs` is imported read-only for its CME calendar; nothing under `ict/` is written). A pass is a hypothesis for a
forward paper shadow the owner decides on; never a live rule.

## The claim being tested

Gao, Han, Li and Zhou (2018, Journal of Financial Economics, "Market intraday momentum") report that the S&P 500's first
half-hour return (previous close to 10:00 New York) predicts its last half-hour return. Follow-up work reports the same in
Treasury futures, linked to end-of-day hedging flows. No bond-market version's exact definitions could be checked from the
build sandbox, so none is cited by title and no coefficient from any paper is used; the session and windows below are the
equity rule translated to the Treasury session, justified here.

Already tested here: `intraday-momentum` (SPX500, NAS100: FAIL, near zero before costs after 2015) and
`metals-intraday-momentum` (gold, silver, WTI: FAIL). Nobody here has tested it on bonds.

## Session (US Treasury CFDs; New York clock, DST-correct through the America/New_York zone)

**08:20 to 15:00 New York**: the CBOT Treasury futures' former open-outcry hours (07:20-14:00 Chicago), whose end is the futures'
daily settlement time (14:00 Chicago = 15:00 New York) and which the cash Treasury market's most liquid stretch matches. 15:00
plays the role of the equity rule's 16:00 close, 08:20 the role of its 09:30 open. The equity rule's 16:00 close is not used:
the Treasury session's reference close is 15:00.

| piece | equity rule (intraday-momentum) | this study |
|---|---|---|
| previous close | 16:00 of the previous trading day | **15:00** of the previous eligible trading day |
| signal end | 10:00 (open + 30 min) | **08:50** (08:20 + 30 min; includes the 08:30 data releases, as the equity signal includes the open) |
| entry | 15:30 (close − 30 min) | **14:30** |
| exit | 16:00 | **15:00** |

The prices are OANDA's bond CFD mid prices (USB10Y_USD etc.), not the futures; the clock is the futures' session.

## What is already known (seen before this was written)

- The two earlier intraday-momentum results above; `bond-lead-intraday` (sharp M15 Treasury moves lead gold / USD/JPY: FAIL);
  `bond-month-end` (FAIL at CFD cost) and `bond-month-end-futures`. Their cost models are reused here.
- Coverage only: one request each confirmed OANDA serves M5 candles of `usb10y` and `de10yb` in January 2005 and November 2009.
  The M5 files of this study were being fetched while this was written; no return at any of this study's clock times has been
  computed for this or any other study in the repository.

## Data

OANDA mid M5 candles of `usb10y`, `usb30y` (primary), `usb02y`, `usb05y` (secondary), `de10yb`, `uk10yb` (secondary, reported
only) through the site's keyless proxy (`/md/bars`), 1 Nov 2009 to 14 Nov 2026, complete candles only:
`node --use-env-proxy research/edge/bond-intraday-momentum/fetch.mjs <dir>` (cache outside git). A price "at" a clock time =
the close of the M5 candle that ENDS at that time; if missing, the last candle ending in the 10 minutes before it; none → the
day is skipped and counted (the `intraday-momentum` rule, copied).

## Calendar (US markets)

A **session day** is a weekday that is not a US bond-market full holiday: New Year's Day, Martin Luther King Day, Presidents'
Day, Good Friday, Memorial Day, Juneteenth (from 2022), Independence Day, Labor Day, Columbus Day (2nd Monday of October),
Veterans Day (11 November; Sunday → Monday, Saturday → none), Thanksgiving, Christmas (fixed-date holidays: Saturday → Friday,
Sunday → Monday; New Year Saturday → none). A session day is **full** when, in addition, `ict/calendar.mjs` `cmeShut(t)` is
false at the start of every M5 candle from 08:20 to 14:55 (this drops every CME early close and holiday eve), and it is not a
US bond-market 14:00 early close: 24 December, 31 December, 3 July, the day after Thanksgiving, the Thursday before Good
Friday, the Friday before Memorial Day. **Eligible** = a full session day whose previous session day was also full (its
15:00 price is a full close). 2010-01-01 to 2026-11-13.

European secondaries (reported, decide nothing): `de10yb` session **08:00-17:15 Europe/Berlin** (Eurex Bund futures day,
17:15 = the daily settlement, from memory, not verified), signal previous 17:15 → 08:30, entry 16:45, exit 17:15; `uk10yb`
session **08:00-16:15 Europe/London** (the Long Gilt futures settlement time, from memory, not verified), signal previous
16:15 → 08:30, entry 15:45, exit 16:15. Session days: weekdays except 1 January, Good Friday, Easter Monday, 24-26 and 31
December, plus 1 May for `de10yb` and the first and last Mondays of May and the last Monday of August for `uk10yb`; eligible =
a session day whose previous session day is one too.

## The signal and the rule (one trade a day per market; copied from `intraday-momentum`)

`signalOf` and `trade` are copied **byte for byte** from `origin/intraday-momentum:research/edge/intraday-momentum/run.mjs`
(sha256 of each function's text pinned in the test); only the clock times passed to them change.

- **Signal** r1 = P(signal end) / P(previous close) − 1 (US: 08:50 today over 15:00 of the previous eligible-chain day).
  Reads nothing after the signal end.
- **Entry** at P(close − 30 min): long if r1 > 0, short if r1 < 0, none if r1 = 0.
- **Exit** at P(close) unless the stop is hit first.
- **Stop (every trade has one)**: entry ∓ 1.5 × A, A = the mean of |P(close) − P(close − 30 min)| over the 20 previous eligible
  days with data (strictly before today); fewer than 20 → no trade. Checked on the M5 candles starting in [entry time, close):
  a candle opening at or beyond the stop exits at its open, else a high / low at or beyond it exits at the stop. Never moved.
- **R** = signed (exit − entry) / stop distance; **net R** = R − cost / stop distance. r2 = P(close) / P(close − 30 min) − 1.

## Costs

- **CFD (base)**: `bond-month-end`'s fixed round trip as a share of the entry price: usb02y 0.02 %, usb05y 0.03 %, usb10y
  0.03 %, usb30y 0.05 %, de10yb 0.03 %, uk10yb 0.04 % (no measured spread exists for these CFDs). **No financing**: the trade
  opens and closes inside the session. Every figure is also given at **2× cost**.
- **Treasury futures (reported, decides nothing)**: `bond-month-end-futures`' round trip in price points, ZN 0.019325 pt for
  `usb10y`, ZB 0.03495 pt for `usb30y` (one tick of spread + $3.70 fees and commission; a CFD point taken as a futures point,
  the same stated weakness). Not computed for the other maturities.

## Windows (New York trading date)

- **B, decisive: 2016-01-01 to 2026-11-13.**
- **A, replication: 2010-01-01 to 2015-12-31** (data from November 2009 give the 20-day warm-up).

## Placebo (40 seeds, seeds 1-40, the repository's `mulberry32`)

For each traded day and seed, the signal is replaced by the return of a **random earlier half hour of the same day**: a start
drawn uniformly from the M5 grid 08:50, 08:55 … 14:00 New York (63 starts; each window lies after the real signal window and
ends by the 14:30 entry), r = P(start + 30) / P(start) − 1, side = its sign (zero → no trade that seed). Same entry, stop, exit
and cost as the real trade of that day. A day whose placebo window has no price contributes nothing to that seed. Per seed:
pooled net R a trade and pooled sign hit rate (share of traded days with r2 ≠ 0 where the placebo side = sign(r2)). Stated
limit: later half hours may carry information of their own, so this placebo is a strict control. European markets: the same
design on their own grid (signal end … close − 60 min).

## Tests and pass bar

**Primary (decides): usb10y + usb30y pooled** (every trade of both markets one row; t on calendar-month sums of the pooled net
R). PASS when ALL hold:

1. mean net R a trade > 0 in **A and B**;
2. B **month-sum t ≥ 2**;
3. B mean net R a trade at **2× cost > 0**;
4. B pooled **sign hit rate above the placebo's 95th percentile** (of the 40 seeds' pooled hit rates).

**Secondary (reported, decides nothing)**: each of usb10y, usb30y, usb02y, usb05y alone on lines 1-4, with **Holm** over the
four on the one-sided p of the B month-sum t (normal approximation); de10yb and uk10yb on lines 1-4 without Holm; futures cost
for usb10y / usb30y (net R and month-sum t, A and B). Also reported: gross R, trade-level t, stops hit, win rate, by year, and
the paper's regression (OLS of r2 on r1 in %, OLS and White t), per market and window.

**Verdict**: **PASS** if the primary passes; **FAIL** if it does not; **NOT MEASURABLE** if the pooled primary has fewer than
1,000 trades in B or fewer than 500 in A (then "(inconclusive: …)" names why).

## Not done (said now)

No other half hour as the predictor (the paper's penultimate half hour too), no release-day split, no volatility or volume
split, no size or exit variant, no other market, no combination with any council system. Any such test needs its own
pre-registration.
