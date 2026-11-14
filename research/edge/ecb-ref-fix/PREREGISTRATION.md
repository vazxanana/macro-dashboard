# The ECB euro reference rate: does the half hour into the 14:10 CET concertation reverse after it? (pre-registration)

Written and pushed on 14 Nov 2026, before any trade of this rule was computed. Paper research only: no live rule, size,
filter, stop, cost model, config or mirror setting is changed by this study, whatever it finds. Forex only; ICT and the gold
book are not involved (owner decision item 44 untouched). Nothing below may change after the first result; anything found later
is reported as found later and never folded into the verdict.

## The idea

The ECB sets its daily euro foreign exchange reference rates from a concertation between central banks at about **14:10 CET**
(the rates are published later the same afternoon). Companies, funds and custodians that value or rebalance against the ECB
rate are said to trade into that moment, as fixing flows do into the London 16:00 WM/Reuters fix. If so, EUR/USD would move in
one direction into 14:10 CET and partly reverse after it. This study asks once whether fading the half hour into the
concertation, right after it, makes money on OANDA mid prices, as a plain clock trade that always carries a stop, after the
raw-spread forex costs (CLAUDE.md "Forex spreads: a raw-spread account, measured"), out of sample.

## Template, and how this study differs

The method is copied from `research/edge/wmr-fix-reversal` (branch `wmr-fix-reversal`, not on main; its verdict FAIL: a small
reversal of about +0.04R a trade before costs, against a raw-spread round trip of about 0.12R). Its `run.mjs` and `fetch.mjs`
were copied into this folder with `git show` and edited here; nothing is imported across branches. I have read that study's
result. The differences, all fixed by this study's brief before any trade of this rule was computed:

| | wmr-fix-reversal | this study (ecb-ref-fix) |
|---|---|---|
| Moment | 16:00 London (WM/Reuters fix) | 14:10-14:15 CET (ECB concertation) |
| Clock | London (UTC / BST) | Central European (CET = UTC+1, CEST = UTC+2) |
| Move | 60 min, 15:00-15:59 London | 30 min, 13:45-14:14 CET |
| Entry | 16:00 London | 14:15 CET |
| Exits | +60 min, +30 min | 15:00 CET (+45 min), 14:45 CET (+30 min) |
| Markets | six USD pairs | EUR/USD; replication on EUR/GBP, EUR/JPY, EUR/CHF |
| Holm bar | adjusted one-sided p ≤ 0.0228 | adjusted one-sided p < 0.05 |
| Placebo | 17 London hours | 15 CET hours (below) |

The move window is shorter, so `1R` (the median of that window's move) is smaller and the same pip cost is a larger share of
R than at the London fix: that is known before the run and is part of what is tested. Other forex clock studies of 13-14 Nov
on branches (`ecb-boj-days`: ECB decision days, a 60-minute follow at 14:45-15:45 CET; `london-fix`, `fx-home-hours`,
`gotobi*`, `fx-month-end`, `fx-london-orb`) trade other moments or other days; their results do not set anything here.

## Known overlaps (said before the run, not used to filter)

- **ECB monetary-policy decision days**: the decision is published at 13:45 CET (14:15 CET from 2022 on), inside or right at
  the edge of this study's move window, on about eight days a year. The rule trades those days like any other. Reported, not
  judged: the decisive result without them, using the ECB decision dates of `research/edge/ecb-boj-days/dates.json` (branch
  `ecb-boj-days`), copied into this folder as `ecb-days.json` with that file's provenance note (2010 to July 2025 written from
  memory of the ECB calendar, not checked against it; August 2025 on from `council/events.mjs`).
- **US releases at 08:30 New York** (payrolls, CPI, claims, retail sales and others) fall at 14:30 CET, inside the holding
  period, on most weeks of the year, and at 13:30 CET (before the move window) in the weeks the US is on daylight time and
  Europe is not. The rule does not skip them (no release calendar for 2010-26 is in the repository). Reported, not judged: the
  decisive result without those mismatch weeks.
- **EUR/CHF** was held at the SNB's 1.20 floor from September 2011 to 15 January 2015 (replication window): its moves were tiny,
  so its `1R` was tiny and costs large in R, and the floor's removal gapped through every stop. Kept as is.
- The ECB publishes no rates on TARGET2 closing days; no holiday calendar is used here (a day with missing candles has no
  move and no trade; a quiet holiday with candles is traded).

## Data

- OANDA mid M5 candles through the site's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, pages of 4,999 candles, paced;
  `fetch.mjs`), keys `eurusd`, `eurgbp`, `eurjpy`, `eurchf`, from 1 Nov 2009 (two months of warm-up) to 14 Nov 2026 00:00 UTC.
  Files kept out of git. A copy already fetched through the same proxy by another study of the week may seed a file (only the
  missing span is fetched; the candles are the proxy's either way). Candles are stamped at their opening second in UTC.
  No HistData file is read; `council/histdata.mjs` (main) gives `euSummer` for the clock below.
- **Decisive window: trades entered 1 Jan 2016 to 13 Nov 2026. Replication window: 1 Jan 2010 to 31 Dec 2015.** A trade
  belongs to the window of its entry time. Nothing is tuned on either.
- Bar size: **M5** for every price, entry, stop check and exit.

## Clock

All rule times are **CET / CEST** (Frankfurt): UTC+1 in winter, UTC+2 from 01:00 UTC on the last Sunday of March to 01:00
UTC on the last Sunday of October (`council/histdata.mjs` `euSummer`, exactly those instants). So 14:15 CET is 13:15 UTC in
winter and 12:15 UTC in summer. A **day** is a weekday (Monday to Friday) by the Frankfurt date.

## The rule (fixed)

For each market and day:

1. **The move into the concertation**: `M = close of the M5 candle opening at 14:10 CET − open of the M5 candle opening at
   13:45 CET` (13:45-14:14, six candles). Both candles must exist, else the day has no M.
2. **The reference**: `ref` = the median of `|M|` over the 20 most recent EARLIER weekdays of that market that have an M
   (strictly before the day: no look-ahead). Those 20 days must all lie within the 42 calendar days before the day, else no
   trade. With an even count the median is the mean of the 10th and 11th sorted values.
3. **Event**: `|M| > 0.5 × ref` and `ref > 0`.
4. **Entry**: a market order AGAINST M (M > 0: sell; M < 0: buy) at the **open of the M5 candle opening at 14:15 CET**. No
   candle there: no trade ("no data").
5. **Stop** (every trade has one, on the losing side): `1 × ref` beyond the entry (sell: entry + ref; buy: entry − ref).
   `R` is measured in units of `ref`.
6. **Management on M5 candles from the entry candle on** (its own high / low count). A candle that opens at or beyond the stop
   exits at its open (gap); a candle that touches the stop exits at the stop. The stop never moves; no target, no break-even.
7. **Time exit**: at the close of the last M5 candle that opens before the exit time. That candle must open at or after the
   exit time minus 15 minutes, else no trade ("no data").
8. `R = (exit − entry) / ref` for a buy, `(entry − exit) / ref` for a sell.

## The tests

| Test | Stream | Exit |
|---|---|---|
| T1 | EUR/USD | 15:00 CET (close of the 14:55 candle) |
| T2 | EUR/USD | 14:45 CET (close of the 14:40 candle) |
| T3 | EUR/GBP + EUR/JPY + EUR/CHF pooled (replication markets) | 15:00 CET |

The pooled stream is every trade of the three crosses together (one a market a day at most), each at 1R.

## Costs (the raw-spread forex model, in R)

- Spread **0.3 pip** a round trip (pip 0.0001; 0.01 for EUR/JPY), plus half a spread of slippage on each of the two market
  orders (entry, and every exit, stop or time) = 0.3 pip; plus commission **22.5 USD per million USD of notional a side**,
  45 USD a million a round trip. For a EUR/XXX unit (1 euro, worth EURUSD dollars) the round-trip commission in the quote
  currency is `45e-6 × EURUSD × USDXXX = 45e-6 × entry`, so `45e-6 × entry` in price units for all four markets.
- **Financing**: none (every position is opened and closed between 14:15 and 15:00 CET).
- `net R = R − (0.6 pip + 45e-6 × entry) / ref`. Also reported at **twice** every cost (`net2`).

## Statistics

- Per test and window: n, gross R a trade, cost in R a trade, net R a trade, total net R, win rate, exits by kind, and
  **t = the t-statistic of calendar-month sums of net R** (months with at least one trade; mean / sd × √months); also the
  same t on gross R.
- **Holm** over T1-T3 on the decisive window: one-sided p of each net t (normal approximation), Holm-adjusted.
- **Placebo, 40 seeds**: the same rule at random other hours. For each seed, each market and each weekday, one CET hour `H` is
  drawn uniformly from {2, 3, …, 12, 18, 19, 20, 21} (15 hours: never touching 13:45-15:00 CET, never the 16:00 London fix at
  about 17:00 CET, never the 17:00 New York rollover, never the Sunday reopen). The rule is applied unchanged with the move
  from (H−1):45 to the close of the H:10 candle, the reference from the same window's moves on the 20 earlier days that have
  one, entry at H:15, exit at H+1:00 (T1, T3) or H:45 (T2). Seed s uses a fixed generator (mulberry32, seed
  `s × 1000 + market index`). Reported: each test's decisive net R a trade against the 40 seeds (how many it beats; their 5th
  / 50th / 95th percentile).
- **2x cost**: decisive net R a trade with every cost doubled.
- Also reported, not judged: each cross alone under T3, every year, summer against winter, the two splits of "Known
  overlaps".

## The pass bar (fixed)

A test **passes** when all three hold:

1. net R a trade > 0 in the decisive window AND in the replication window;
2. decisive net month-sum t > 0 with a Holm-adjusted one-sided p < 0.05;
3. decisive n ≥ 100.

A passing test is called **robust** only if also its decisive net R a trade at 2x cost is > 0 and it beats at least 38 of
the 40 placebo seeds; otherwise "PASS, not robust".

**Verdict**: PASS if at least one test passes (named, robust or not); FAIL if none does. A test with net R > 0 and t ≥ 2
(before Holm) in the decisive window that fails another condition is named as a near miss, never as a pass.

## What a result would and would not mean

A PASS is a forward-test candidate for the owner, never a live rule: absolute rule 3 holds and nothing here changes the
council, the mirror or any cost. A FAIL says this mechanical fade at 14:15 CET does not pay after the raw-spread costs on
OANDA mid prices; it says nothing about trading inside the five minutes of the concertation itself, which M5 candles cannot
resolve.
