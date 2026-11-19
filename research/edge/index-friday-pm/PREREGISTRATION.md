# US index CFDs into the Friday close: pre-registration

Written and committed **before** any quantity of this study was computed (14 Nov 2026). The calendar, the rule, the stop, the
costs, the windows, the statistics, the placebo and the pass bar are fixed here; nothing in them changes after the results are
seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved (nothing under
`ict/` is read or written; ICT is a separate edge). A pass would be a hypothesis for a forward paper shadow that the owner
decides on, never a live rule.

## The question

Do US stock indices fall in the last part of Friday's cash session, as traders flatten before the weekend? Tested as one
primary trade: **every Friday that is a full NYSE session, short the US500 CFD (OANDA `spx500`) from 14:00 to 15:55 New York
time**, net of a CFD trader's costs.

## Was it already tested here?

No. `research/edge/last-hour` (branch `last-hour`, FAIL) traded 15:00-16:00 on big-move days only, both ways, and its
pre-registration says it did NOT split by day of the week. `research/edge/index-midday-turn` (11:30-14:00) and
`research/edge/intraday-momentum` (15:30-16:00, follow the morning) have no weekday rule. `research/edge/timing` split the
council's own Meridian setups by "Friday after 12:00 NY" as a filter on those setups, not a directional index trade.
`index-weekend-gap` studies the Friday close to Monday open gap, not the Friday afternoon. No figure of any of them is used here.

## What is already known (seen before this was written)

- OANDA mid M5 candles of SPX500, NAS100 and US30 from 1 Oct 2007 to 13 Nov 2026 were already fetched in this session for
  other studies; for this study only their first / last candle times and counts were looked at. US2000 M5 candles are being
  fetched with `fetch.mjs`; only one first request (first candle time) was looked at.
- No 14:00-15:55 return of any day, Friday or not, has been computed for this study.

## Data

OANDA mid M5 candles of `spx500`, `nas100`, `us30`, `us2000` through the site's keyless candle proxy (`/md/bars`), 1 Oct 2007 to
13 Nov 2026, complete candles only: `node --use-env-proxy research/edge/index-friday-pm/fetch.mjs <dir>` (files
`<market>-5m.json.gz`, rows `[t, o, h, l, c]`; the format of the earlier index studies, so their caches are reused). Files stay
out of git.

A price "at" a New York clock time = the close of the M5 candle that ENDS at that time (it starts 5 minutes earlier); if that
candle is missing, the close of the last candle ending in the 10 minutes before; none → the day is skipped and counted. New
York times are converted to UTC with the zone rules of that date (`council/events.mjs` `zonedToUtc`; DST-correct).

## Calendar (stated, written in `run.mjs`, not read from any file; the rules of `index-midday-turn` / `pre-holiday`)

NYSE trading days = weekdays that are not a full closure. Full closures: New Year's Day (Sunday → Monday; Saturday → no
closure), Martin Luther King Day (3rd Monday of January), Presidents' Day (3rd Monday of February), Good Friday, Memorial Day
(last Monday of May), Juneteenth (19 June from 2022; Saturday → Friday, Sunday → Monday), Independence Day (4 July; Saturday →
Friday, Sunday → Monday), Labor Day (1st Monday of September), Thanksgiving (4th Thursday of November), Christmas (25 December;
Saturday → Friday, Sunday → Monday); and the special closures 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025. Half days (13:00 close):
3 July when it is a trading day and 4 July falls Tuesday to Friday; the day after Thanksgiving; 24 December when it is a trading
day. **Eligible days = full trading days**; every half day and every closure is skipped by rule (a half-day session ends before
14:00, so the window does not exist). No fetched calendar.

## The rule (primary: SPX500, Fridays)

- **Entry**: short at P(14:00) New York on every eligible Friday.
- **Exit**: P(15:55) New York (the close of the M5 candle ending at 15:55), before the closing auction minute.
- **Stop (every trade has one)**: entry + 1.5 × S, where S = the mean of the absolute 14:00-15:55 point move
  |P(15:55) − P(14:00)| over the **20 previous eligible Fridays**
  of that market that have both prices (strictly before the trade date). Fewer than 20 → no trade (warm-up). Checked on the M5
  candles that START at 14:00, 14:05 … 15:50: a candle that opens at or above the stop exits at its open (a gap), otherwise a
  high at or above the stop exits at the stop. Never moved. No target.
- **R** = (entry − exit) / (1.5 × S). **Costs**: 0.04 % of notional round trip (the index CFD cost of `index-midday-turn`),
  cost R = 0.0004 × entry / (1.5 × S); **net R** = R − cost R. Reported at cost 0 (gross), base (0.04 %) and 2x (0.08 %). No
  financing: the trade opens and closes inside the cash session.

## Reported only (decide nothing)

- The same Friday short on `nas100`, `us30`, `us2000` (each with its own 20-Friday stop).
- **Control**: the same 14:00-15:55 short on Monday-Thursday eligible days of each market, the stop from the mean absolute
  move of the 20 previous eligible Monday-Thursday days; and each weekday Monday to Thursday alone (stop from its own 20
  previous same-weekday days).
- Net R by year; the share of trades stopped.

## Windows

The data runs 1 Oct 2007 to 13 Nov 2026; its calendar midpoint is 23 Apr 2017. **In sample: from the first tradeable Friday
(after the 20-Friday warm-up) to 2017-04-22. Out of sample: 2017-04-23 to 2026-11-13.** By New York trading date. The same split
for every market.

## Statistics

- t on **calendar-month sums**: net R summed per calendar month (months with at least one trade), t = mean / (sd / √months).
- **Placebo, 40 seeds** (mulberry32, seeds 1-40), SPX500, out of sample: per seed, draw as many days as the primary has OOS
  trades, without replacement, from the OOS eligible Monday-Thursday days that have both prices and a full 20-day control-stop
  history; on each, the same 14:00-15:55 short with the control stop (1.5 × the 20-previous-Monday-Thursday mean move), the same
  gap / stop rules and the same 0.04 % cost. Seed statistic: mean net R a trade. The primary "beats" a seed when its OOS mean
  net R is higher.

## Pass bar (primary only; one test, so no multiple-test correction)

1. OOS month-sum t ≥ 2, net of the base cost (0.04 %);
2. IS mean net R a trade > 0 (base cost);
3. OOS mean net R a trade > 0 at 2x cost (0.08 %);
4. the OOS mean net R beats at least 38 of the 40 placebo seeds (≥ 95 %).

**Verdict PASS** only if all four hold; otherwise **FAIL**. The other markets, the controls, gross figures and the by-year
table decide nothing.

## Not done (said now)

No other window of the day (13:00, 15:00, 15:30 starts), no long side, no target, no filter (trend, VIX, month end, option
expiry, pre-holiday Friday), no futures or cash index data. Any of those after seeing the result would be post hoc and would
need its own pre-registration on other data.
