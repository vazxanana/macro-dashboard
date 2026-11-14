# ECB and BoJ decision days: follow the first hour: pre-registration

Written and committed **before** any trade of this rule was computed and before the clock check below was run (14 Nov
2026). The event list (`dates.json`), the decision minute, the rule, the costs, the windows, the placebo and the pass bar are
fixed here; nothing in them changes after the results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved. This is a NEW
stand-alone event rule on two forex pairs; it reads no trade, gate or exit of the gold book (owner decision item 44 is
untouched). A pass would be a hypothesis for a forward paper shadow that the owner decides on, never a live rule.

## The question

The literature on FOMC days finds that the dollar keeps drifting, for hours after the statement, in the direction of its
first reaction. Do the two other big scheduled decisions the council's calendar carries, the ECB (EUR/USD) and the Bank of
Japan (USD/JPY), do the same: is the direction of the first 60 minutes after the decision followed by more of the same until
the end of that trading day, net of a raw-spread forex account's costs?

## What is already known (seen before this was written)

- `fomc-follow`, `cpi-follow`, `nfp-follow`, `pre-fomc-drift` (branches of 13 Nov 2026): US releases only (the FOMC study on
  NAS100 / SPX500 / gold); none reads EUR/USD or USD/JPY on an ECB or BoJ day. Their results were not used to choose
  anything here: the rule below is the one in the request, written before this study existed.
- `gotobi`, `gotobi-replicate`, `risk-spill-jpy`: USD/JPY in the Tokyo morning and after US equity days, not on BoJ days.
- `event-reaction` (main): gold and the dollar index after CPI / NFP / FOMC only.
- No figure of this rule has been computed or looked at. The M5 candle files were opened only to read their first and last
  candle and the hours they cover (to know what must still be fetched).

## Events (`dates.json`)

Scheduled ECB monetary-policy decision days (EUR/USD) and scheduled BoJ Monetary Policy Meeting final days (USD/JPY), 2010
to now. From August 2025 the dates are `council/events.mjs`'s (checked there against the official pages); before that they
are **written from memory** of the published calendars because the sandbox cannot reach ecb.europa.eu or boj.or.jp. The
file names where to check and lists the dates I am unsure of. Unscheduled or emergency announcements are never events. A
wrong ECB date gives a trade on an ordinary day (it dilutes the test); a wrong BoJ date usually gives no trade (no release
bar). `RESULT.md` reports how many dates the clock check could not confirm.

## Data

OANDA mid M5 candles (`eurusd`, `usdjpy`) through the site's candle proxy (`fetch.mjs`, `node --use-env-proxy`), the
whole day, November 2009 to the last candle on file, kept outside git. A candle is used only once it has closed. Times are
UTC; Frankfurt local time is converted per date with `council/events.mjs` `zonedToUtc` (daylight time included).

## Decision minute D

- **ECB.** The request said 13:15 CET/CEST; that is not the ECB's minute (it was 13:45 Frankfurt for most of the sample and
  14:15 Frankfurt later; the date of the change is not known from memory). So the minute is set per date by a
  **direction-free clock check** that reads only the two candidate candles: D = 13:45 Frankfurt if the M5 candle starting
  then has a larger range (high − low) than the M5 candle starting at 14:15 Frankfurt, else 14:15 Frankfurt. Both candles
  end before any entry. The check is run on every ECB date and on every placebo day the same way, and its choice per year is
  reported. A date whose chosen candle's range is under 2x the median range of that candle's clock minute on the 20 previous
  weekdays is counted as "not confirmed" (reported, still traded).
- **BoJ.** No fixed minute. Baseline: the median range of all M5 candles starting in the same UTC clock hour (03:00 or
  04:00) on the 20 previous weekdays that have candles in that hour, BoJ dates left out. D = the start of the first M5
  candle starting at 03:00 UTC or later whose range is above 2x that baseline; if none starts before 05:00 UTC, no trade.
  The search reads candles up to that candle only. Fewer than 20 baseline days in the 45 calendar days before: no trade.

## The rule

- `ref` = the close of the M5 candle ending at D (the price the decision hit); `c60` = the close of the M5 candle ending at
  D + 60 min. Direction d = sign(c60 − ref); d = 0 or either candle missing → no trade.
- **Entry** at c60 in direction d (a market order).
- **Stop** = entry − d x ATR, ATR = the simple mean of the true range of the last 14 one-hour candles (UTC hours, built from
  the M5 candles, only hours with candles) that ENDED at or before D. Fewer than 14 such hours in the 7 calendar days
  before D: no trade. Every trade has this stop; there is no target, no break-even and no trail.
- **Management** on the M5 candles after the entry: a candle that opens beyond the stop exits at its open; else the stop
  when the candle's range reaches it. Otherwise out at the close of the last candle ending at or before the exit time
  (time exit). **T1 (ECB, EUR/USD)**: exit 21:00 UTC. **T2 (BoJ, USD/JPY)**: exit 15:00 UTC. Neither holds over the 17:00
  New York rollover, so no financing is charged.
- R = d x (exit − entry) / ATR.

## Costs (the raw-spread forex model, CLAUDE.md "Forex spreads")

Per round trip, in price: spread 0.3 pip + half a spread of slippage on each of the two market orders (0.3 pip) +
commission 22.5 USD per million USD of notional a side (45 a million round trip = 0.0045 % of the price for both pairs,
since EUR/USD's notional in USD is units x price and USD/JPY's is units). Pip: EUR/USD 0.0001, USD/JPY 0.01. Net R = R −
cost / ATR. Every result is also shown at 2x these costs.

## Windows

- **Decisive**: 2018-01-01 → the last candle on file. This is where the rule is judged.
- **Replication**: 2010-01-01 → 2017-12-31 (sign check only).

## Statistics and the pass bar

Per test, in a window: n, mean net R a trade, and the **month-sum t**: every calendar month of the window gets the sum of the
net R of its trades (a month without a trade counts 0), t = mean / (sd / √months). One-sided p from the normal
approximation. Holm over the two tests T1, T2 at 0.05.

A test **passes** only if all hold:
1. n ≥ 40 trades in the decisive window;
2. mean net R a trade > 0 and month-sum t ≥ 2;
3. Holm-adjusted p < 0.05;
4. mean net R a trade > 0 in 2010-17;
5. placebo: the same rule (clock check or release-bar search, ATR, exit) on non-event weekdays at the same clock times,
   40 seeds. For each event one weekday drawn at random within ±182 days of it, inside the decisive window, not within 3
   days of any decision of that bank (scheduled or not); a draw that gives no trade is redrawn, up to 50 tries. The event
   mean must be above the 95th percentile of the 40 seed means.

**Verdict: PASS** if T1 or T2 passes, else **FAIL**. The **pooled test** (T1 and T2 trades together, month sums of both)
is reported with bars 1, 2, 4 and 5 (no Holm, it is not a third chance); it cannot make the verdict PASS on its own.
Reported whatever the verdict: by year, gross R, exits, the clock check's choices, the results at 2x costs.

## What follows

- PASS: a proposal in `research/proposals/` for a forward paper shadow of the passing test only; nothing live changes.
- FAIL: no proposal, nothing live changes; the figures are the record. Any other version (another first window, exit time,
  stop, pair, filter on the size of the first move) needs its own pre-registration on data not used here.
