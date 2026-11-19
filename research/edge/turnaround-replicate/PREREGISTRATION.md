# Pre-registration: the NAS100 "Turnaround Tuesday" cell, replicated on six markets it never saw (13 Nov 2026)

Written and pushed before any candle of this study is read and before any number is computed. Research only: no rule, size,
filter, stop or council member changes, and no proposal follows whatever the verdict. Not an ICT study.

## Why
The `turnaround-tuesday` study (branch `turnaround-tuesday`, PR #857, not on `main`) found one passing cell of four: NAS100,
after the week's first session closes more than 1 % below the previous close (16:00 New York), buy that close and sell the next
session's close, stop 2 x ATR(20) daily, spread + one night of financing: 2016-now +0.098R a trade, t 2.33, n 81, Holm p 0.039;
2008-15 +0.103R, t 2.12. About forty studies were run that day, so one cell passing is what chance alone gives. This study asks
whether the SAME frozen rule makes money on six index markets the study never looked at. It is the only test of that cell; its
result decides nothing live.

## The rule, frozen
- `frozen.mjs` in this folder is `research/edge/turnaround-tuesday/run.mjs` of the branch `turnaround-tuesday` (commit
  568a1c94b), **copied byte for byte**, sha256 `74527d362f9d65c996cdd4df25abadbbc6b723b9aa49141d6a29c88b19693871` (pinned by
  the test). Nothing in it is edited. This study uses its functions as they are: `tradingDays`, `buildDays`, `weekPairs`,
  `weekOf`, `dayChg`, `ruleOn` (with `RULES.r2.drop` = -1 %), `trade` (entry at the close, stop `entry - 2 x ATR(20)` checked on
  every H1 candle after the entry candle up to the exit candle, a gap below the stop fills at the open, exit at the next
  trading day's close, R net of cost and financing), `atrAt`, `stats`, `holm`, `rng`, `nights`, `rateOf`.
- The one adaptation, needed because the frozen `buildDays` is tied to the New York close: `run.mjs` holds `buildDaysAt(bars,
  days, closeOf)`, the text of the frozen `buildDays` with its single call `closeCandle(d)` replaced by `closeOf(d)` (the test
  checks the two texts differ by that call only). For US30 and US2000 the frozen `buildDays` itself is used.
- **The rule (R2)**: the first local trading day of each calendar week (M; Tuesday when Monday is a local holiday, and so on;
  `weekPairs`) closes more than 1 % below the previous local trading day's close → buy M's close, sell the next local trading
  day's close (T; the trade is skipped in a week with one trading day, as frozen). Long only. Every trade has a stop.

## Markets, sessions and closes (fixed now)
OANDA mid H1 candles through the site's keyless candle proxy (`/md/bars`, `fetch.mjs`, kept out of git), October 2007 to
12 November 2026, complete candles only. A candle is keyed by its start; "the candle ending at X" starts one hour before X.

| Market (proxy key, instrument) | Local calendar | Cash close | H1 candle used as the close | Round-trip cost | Financing rate |
|---|---|---|---|---|---|
| Dow 30 (`us30`, US30_USD) | NYSE (the frozen `tradingDays`) | 16:00 New York (13:00 half days) | ends 16:00 NY (13:00), frozen `closeCandle` | 0.04 % | US 2-year (DGS2, `rates.json`, the frozen file) + 2.5 % |
| Russell 2000 (`us2000`, US2000_USD) | NYSE | 16:00 New York | ends 16:00 NY | 0.08 % | DGS2 + 2.5 % |
| Germany 40 (`de40`, DE30_EUR) | Xetra (below) | 17:30 Frankfurt | **ends 17:00 Frankfurt** | 0.04 % | euro rate + 2.5 % |
| Euro Stoxx 50 (`eu50`, EU50_EUR) | Xetra / Eurex (below) | 17:30 Frankfurt | **ends 17:00 Frankfurt** | 0.06 % | euro rate + 2.5 % |
| UK 100 (`uk100`, UK100_GBP) | London Stock Exchange (below) | 16:30 London (12:30 half days) | **ends 16:00 London** (12:00 on a half day) | 0.05 % | Bank of England rate + 2.5 % |
| Japan 225 (`jp225`, JP225_USD) | Tokyo Stock Exchange (below) | 15:00 Tokyo | **ends 15:00 Tokyo** (05:00-06:00 UTC candle) | 0.06 % | Bank of Japan rate + 2.5 % |

- The close used is the last H1 candle that ENDS at or before the cash close, so no price after the cash close is used. Local
  daylight saving is read with `Intl` for Europe/Berlin and Europe/London (Tokyo has none). The Tokyo Stock Exchange closed at
  15:00 until 1 Nov 2024 and at 15:30 from 5 Nov 2024; the candle ending 15:00 is used throughout (at or before both).
- A day without that candle has no close (frozen behaviour: the trade that needs it is skipped and counted).
- Costs are the stated round trip as a share of the entry price (as the frozen study stated 0.04 % / 0.05 % for SPX500 / NAS100).
- Financing: one charge per calendar night (frozen `trade`, which floors a negative rate at 0) at (the rate on the entry date +
  2.5 %) / 365. The local rates are stated as one figure per calendar year (`RATES` in `run.mjs`, the year's approximate mean
  policy rate: ECB deposit facility, Bank of England Bank Rate, Bank of Japan policy rate), because the daily series cannot be
  reached from the build sandbox; one night at 2.5-8 % a year is under 0.03 % of price, about 0.01R, so a rate error of a
  point moves a trade by under 0.002R.

## Local calendars (fixed now; weekdays not listed are trading days)
- **Xetra / Eurex (DE40, EU50)**: 1 Jan, Good Friday, Easter Monday, 1 May, 24 Dec, 25 Dec, 26 Dec, 31 Dec. Whit Monday,
  German Unity Day and other regional days are counted as trading days in every year (the CFD quotes on them; a day the cash
  market was in fact shut can only move M or T by a day).
- **London Stock Exchange (UK100)**: New Year's Day (Monday 2nd or 3rd when it falls on a weekend), Good Friday, Easter
  Monday, the early May bank holiday (first Monday of May; 8 May in 2020), the spring bank holiday (last Monday of May; 4 and
  5 Jun 2012, 2 and 3 Jun 2022), the summer bank holiday (last Monday of August), Christmas Day and Boxing Day (moved to the
  next weekdays when on a weekend), and the one-off days 29 Apr 2011, 19 Sep 2022, 8 May 2023. Half days (close 12:30):
  24 Dec and 31 Dec when they are weekdays.
- **Tokyo Stock Exchange (JP225)**: 1, 2, 3 Jan and 31 Dec; Japan's national holidays: 1 Jan, Coming of Age Day (second
  Monday of January), 11 Feb, the Emperor's Birthday (23 Dec to 2018, 23 Feb from 2020), the vernal equinox (day =
  floor(20.8431 + 0.242194 (y - 1980) - floor((y - 1980) / 4)) March), 29 Apr, 3, 4, 5 May, Marine Day (third Monday of July;
  23 Jul 2020, 22 Jul 2021), Mountain Day (11 Aug from 2016; 10 Aug 2020, 8 Aug 2021), Respect for the Aged Day (third Monday
  of September), the autumnal equinox (day = floor(23.2488 + 0.242194 (y - 1980) - floor((y - 1980) / 4)) September), Sports
  Day (second Monday of October; 24 Jul 2020, 23 Jul 2021), 3 Nov, 23 Nov, and 1 May and 22 Oct 2019; a holiday on a Sunday
  moves to the next day that is not a holiday; a weekday between two holidays is a holiday. No half days.
- **US30, US2000**: the frozen NYSE calendar (`dayKind`, `tradingDays`), unchanged.

## Windows
- **2016-01-01 to now (entry date): decisive.** 2008-2015: reported only.

## The one test (pooled)
Equal risk: every trade is 1R, whatever the market. On the decisive window:
- **P1, pooled net return**: all six markets' trades together; mean net R a trade > 0 AND the t of the **calendar-month sums**
  >= 2. The months are every calendar month from January 2016 to the last month with data (November 2026), a month with no
  trade counting 0; a trade belongs to the month of its entry date; t = mean / (sd / sqrt(months)).
- **P2, breadth**: at least 4 of the 6 markets have a mean net R a trade > 0.
- **P3, placebo of random down days**: 40 seeds (1 to 40). For each seed, each market and each calendar year, draw (uniform,
  with replacement, `rng(seed)`, markets in the table's order) as many days as that market traded that year, from the local
  trading days D down more than 1 % close to close that are not an M of the rule and have a next trading day; each is traded
  exactly like the rule (buy close(D), sell the next trading day's close, the same stop, costs and financing; the frozen
  placebo's sampler). P3 holds when the pool's mean net R is above the seed's pooled mean in at least 38 of the 40 seeds.
- **Verdict PASS** when P1, P2 and P3 all hold; otherwise **FAIL**. A FAIL is a result.
- **Supports the NAS100 cell** only on a PASS. On a FAIL the NAS100 result stays one cell of four on one market, unreplicated.

Reported, not judged: each market's n, net and gross R a trade, trade t, win rate, stops and skipped trades in both windows;
the pool's 2008-15 figures; the pooled trade t; per-market placebo counts; by year.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first, and whether it supports the NAS100 cell), `tests/turnaround-replicate.test.mjs`.
No proposal of its own, either way.
