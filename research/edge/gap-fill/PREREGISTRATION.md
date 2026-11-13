# Fading the opening gap on NAS100 and SPX500: pre-registration

Written and committed **before** any trade or fill rate was computed (13 Nov 2026). The candles are the same OANDA mid M5
files the `orb-nas100` study downloaded the same day; for this study only their first and last time stamps were read before
this file was committed. The rule, the calendar, the costs, the windows, the placebo and the pass bar are fixed here and do
not change after the results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved and nothing
under `ict/` is read or changed. A pass leads at most to a proposal for a forward paper shadow that the owner decides on;
it is never a live rule.

## The claim being tested

A widely taught day-trading idea: the gap between the previous regular session's 16:00 New York close and the 09:30 open
"tends to fill" during the session, so a trader fades it. Tested here as one mechanical rule with a 1R stop, on the two US
index CFDs the desk can read, net of costs.

This is not the council's NQ New York open run (`nq-open`) nor the opening range breakout (`orb-nas100`): different rules,
never mixed into their records.

## Data

OANDA mid M5 candles of NAS100 and SPX500 through the site's keyless proxy (`/md/bars`), 1 Dec 2015 to 13 Nov 2026,
complete candles only, rows `[t, o, h, l, c]`, UTC buckets: `node --use-env-proxy research/edge/gap-fill/fetch.mjs <dir>`
(the same files and format as `orb-nas100`; an existing file is not fetched again). Files stay out of git.

## Calendar (the same as `orb-nas100`)

- **New York time, DST-correct**: UTC−4 from the second Sunday of March 02:00 to the first Sunday of November 02:00, else
  UTC−5. The 09:30 candle is the M5 candle starting 13:30 UTC in summer time, 14:30 UTC in winter.
- **NYSE full holidays**: New Year's Day (Sunday → Monday; not observed when on a Saturday), Martin Luther King Jr. Day,
  Washington's Birthday, Good Friday, Memorial Day, Juneteenth (from 2022), Independence Day, Labor Day, Thanksgiving,
  Christmas (Saturday → Friday, Sunday → Monday), and the special closures of 5 Dec 2018 and 9 Jan 2025.
- **NYSE early closes (13:00)**: 3 July when Monday to Thursday, the Friday after Thanksgiving, 24 December when Monday to
  Thursday.
- A **session** is a weekday that is not a full holiday. A **trading day** for this study is a session that is not an early
  close AND whose previous session is not an early close either (so the previous close is a real 16:00 close). The others
  are skipped and counted.

## The rule (at most one trade per day per market)

1. **Previous close** P = the close of the last M5 candle starting before 16:00 New York (normally 15:55) of the previous
   session. **Open** O = the open of the M5 candle starting 09:30 New York today. Either candle missing → no trade
   (counted "missing"). Only candles at or before today's 09:30 open are read for the gap: no look-ahead.
2. **Gap** g = O − P; gap size = |g| / P. Trade only when **0.15 % ≤ |g| / P ≤ 1.0 %** (both ends included).
3. **Side**: against the gap. Gap up → **sell**; gap down → **buy**.
4. **Entry** = the open of the M5 candle starting 09:35 New York (missing → no trade, counted). **Target** = P (gap filled).
   Distance d = |entry − P|. When the entry is already at or beyond P on the target side (the gap filled before 09:35,
   d ≤ 0) → no trade (counted "filled before entry"). **Stop** = entry ∓ d (the same distance beyond the entry as the
   target: 1R).
5. Every candle from the 09:35 candle (included) to the last candle starting before 16:00 New York is checked in order: a
   candle that OPENS at or past the stop exits at its open; one that opens at or past the target exits at its open;
   otherwise a candle whose range reaches the stop exits at the stop, one that reaches the target exits at the target.
   **A candle that holds both the stop and the target exits at the stop** (worst case). Missing candles are not checked.
6. Not out by then: exit at the **close of the last candle starting before 16:00 New York** (15:55; if missing, the last
   candle before it).
7. **R** = signed move / d. **Costs** (round trip, the stated spreads of `orb-nas100` and `pre-fomc-drift`): NAS100
   **2 points**, SPX500 **1 point**; net R = R − cost / d. No financing (closed before the 17:00 rollover).

Every trade has a stop (absolute rule 1). Fixed 1R a trade.

**Pre-stated variant ("against")**: the same rule, only on days whose gap is against the previous session's direction.
Previous session direction = sign of (P − the open of the previous session's 09:30 candle); gap against = sign(g) opposite
to it. A previous session whose 09:30 candle is missing, or with P equal to that open, gives no variant trade. So there are
**four tests**: 2 markets × 2 rules (all qualifying gaps; gaps against the prior day).

## Windows

- **A, 2016-01-01 to 2020-12-31**: replication; must be positive (net R a trade > 0) for a pass.
- **B, 2021-01-01 to the last candle on file**: **decides**.

## Statistics

- Per window and test: n, win rate, net and gross R a trade, cost in R, total, stops / targets / time exits, max drawdown
  (closed, in R), by year.
- **t on calendar-month sums** of net R (months with at least one trade); one-sided p from the normal approximation.
- **Holm** over the four tests (window B p), family 0.05.
- **Placebo** (window B, per test): 40 seeds (1 … 40, the seeded generator of `orb-nas100`); on every day that test traded,
  the side is drawn at random (½ / ½) with the same entry and the same distance d: the target d on the drawn side, the stop
  d on the other, same candles, stop-first, time exit and costs. Statistic: net R a trade; its 95th percentile by linear
  interpolation over the 40 sorted values.
- **Fill rate, descriptive only (no test)**: for every trading day with both P and O, by gap-size bucket (0-0.15 %,
  0.15-0.3 %, 0.3-0.5 %, 0.5-1.0 %, over 1.0 %) and window: the share of days on which price traded back to P at any time
  from the 09:30 candle to the last candle before 16:00.

## Pass bar (per test)

A test passes when ALL hold: window B net R a trade > 0; window B t on calendar-month sums ≥ 2; window B Holm-adjusted
p ≤ 0.05; window B n ≥ 150; window A net R a trade > 0; window B net R a trade above the placebo's 95th percentile.
**Verdict PASS** when at least one of the four tests passes, else **FAIL**. A pass leads at most to a proposal for a paper
shadow; never to a live change.

## Not done, on purpose

No other gap band, no partial-fill target, no other stop, no time-of-day exit other than 15:55, no volume, news or weekday
filter, no other market. Any of these needs its own pre-registration.
