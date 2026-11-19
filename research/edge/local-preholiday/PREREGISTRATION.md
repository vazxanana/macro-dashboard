# Pre-registration: the pre-holiday effect on non-US indices, each on its own exchange's holidays (14 Nov 2026)

Written and pushed ALONE, before any candle of this study is read for a return. The rule, the holiday calendars, the costs, the
windows, the statistics, the placebo and the pass bar are fixed here and do not change after the results are seen. Research
only: no rule, size, filter, stop, config or council member changes; nothing live changes. Not an ICT study.

## Why, and why it is not a duplicate
The published pre-holiday effect: index returns on the last trading day before an exchange holiday are several times an
ordinary day's (Ariel 1990, Journal of Finance; Lakonishok and Smidt 1988, Review of Financial Studies; Kim and Park 1994,
Journal of Financial and Quantitative Analysis, on the UK and Japan each on its own holidays). The papers were not opened from
this sandbox and none of their figures is relied on. Candidate 4 of `research/proposals/2026-11-14-untested-backlog.md` (branch
`untested-backlog`). Nearest tested: `pre-holiday` (branch `pre-holiday`, US indices on NYSE holidays: FAIL, +0.023R a holiday
net, t 1.02, 2016-now), `fx-us-holiday`, `fx-post-holiday-replicate`, `post-holiday-metals` (the dollar and metals around US
holidays: all FAIL). No study has read a market on its OWN non-US exchange holidays. The US version failed out of sample,
which lowers the prior; that is said here before the result.

## Data
council-data `research/daily/<key>.json` (git show `origin/council-data`, no network): OANDA mid **UTC daily** candles
`[t, o, h, l, c, v]`. Nine index CFDs, fixed now:

| key | instrument | exchange calendar used |
|---|---|---|
| de40 | DE30_EUR (DAX) | Xetra |
| eu50 | EU50_EUR (Euro Stoxx 50) | Eurex (= the Xetra list: its futures trade on Eurex) |
| fr40 | FR40_EUR (CAC 40) | Euronext |
| nl25 | NL25_EUR (AEX) | Euronext |
| uk100 | UK100_GBP (FTSE 100) | LSE (England and Wales bank holidays) |
| ch20 | CH20_CHF (SMI) | SIX Swiss Exchange |
| jp225 | JP225_USD (Nikkei 225) | JPX (Tokyo) |
| au200 | AU200_AUD (ASX 200) | ASX |
| hk33 | HK33_HKD (Hang Seng) | HKEX, without its lunar-calendar holidays |

Left out, fixed now: es35 (starts December 2016: no in-sample years), sg30 / cn50 / in50 (calendars mostly lunar or
state-announced, not computable from rules here), the US indices (the `pre-holiday` study).

**Which "day" is measured.** A day's close = the close of that UTC daily candle (00:00 UTC). For the European markets the
whole cash session sits inside the UTC day. For Tokyo, Sydney and Hong Kong the cash session sits at the START of the UTC
day (00:00-08:00 UTC), so the UTC close of day d is the next morning in Asia and the measured day also holds the overnight
futures trading of d's evening (European and US hours). This is the only close the daily file has; it is a tradable close
on the CFD. Said as a limit, not fixed.

**The holiday is taken from the calendar, never from the candles.** The CFDs often trade through a local holiday (a thin or
flat candle). A local trading day = a weekday (Monday to Friday) that is not a full-day closure of that market's exchange in
`holidays.mjs`. Candles dated on a holiday or a weekend are not trading days; they are used only for the stop check and the
true range (below).

## Holiday calendars (`holidays.mjs`; full-day closures on weekdays; each rule named in a comment)
- **Easter** by the anonymous Gregorian algorithm (Meeus / Jones / Butcher), tested against known dates.
- **Xetra / Eurex**: 1 Jan, Good Friday, Easter Monday, 1 May, 24 Dec, 25 Dec, 26 Dec, 31 Dec. No weekend substitutes.
  Not modelled: closures of the early 2000s that later ended (e.g. Whit Monday or 3 October in some years).
- **Euronext** (Paris, Amsterdam): 1 Jan, Good Friday, Easter Monday, 1 May, 25 Dec, 26 Dec. Euronext trades 24 and 31 Dec
  (early close), so those are trading days here. No weekend substitutes.
- **LSE**: New Year's Day (Saturday or Sunday -> the next Monday), Good Friday, Easter Monday, the early May bank holiday
  (first Monday of May; 8 May in 1995 and 2020), the spring bank holiday (last Monday of May; 4 June 2002, 4 June 2012, 2 June
  2022), the summer bank holiday (last Monday of August), Christmas and Boxing Day with their substitutes (25 Dec on Saturday ->
  27 and 28 Dec; on Sunday -> 26 and 27 Dec; 26 Dec on Saturday -> 28 Dec), and the one-off holidays announced in advance:
  3 June 2002, 29 April 2011, 5 June 2012, 3 June 2022, 19 September 2022, 8 May 2023.
- **SIX**: 1 Jan, 2 Jan, Good Friday, Easter Monday, Ascension Day (Easter + 39), Whit Monday (Easter + 50), 1 May, 1 Aug,
  24 Dec, 25 Dec, 26 Dec, 31 Dec.
- **JPX**: 1, 2, 3 Jan and 31 Dec (exchange closures); the national holidays by the Public Holiday Law with its changes by
  year: Coming of Age Day, National Foundation Day, the Emperor's Birthday (23 Dec to 2018, none in 2019, 23 Feb from 2020),
  the vernal and autumnal equinoxes (the standard formula for 1980-2099, `floor(20.8431 + 0.242194 (Y-1980) - floor((Y-1980)/4))`
  and `23.2488` for autumn), 29 Apr, 3, 4 and 5 May, Marine Day, Mountain Day (from 2016), Respect for the Aged Day, Sports Day,
  3 Nov, 23 Nov, the 2020 and 2021 Olympic moves, the 2019 accession days (30 Apr, 1 and 2 May, 22 Oct); the substitute holiday
  (a holiday on a Sunday -> the next day that is not a holiday) and the citizens' holiday (a weekday between two holidays).
- **ASX**: New Year's Day (weekend -> Monday), Australia Day 26 Jan (weekend -> Monday), Good Friday, Easter Monday, Anzac Day
  25 Apr (no substitute), the King's / Queen's Birthday (second Monday of June), Christmas and Boxing Day with the LSE
  substitutes.
- **HKEX, partial**: New Year's Day, Good Friday, Easter Monday, Labour Day 1 May, HKSAR Establishment Day 1 Jul, National Day
  1 Oct, Christmas Day and the first weekday after it, each moved to the next day when on a Sunday (no substitute for a
  Saturday). **Dropped**: Lunar New Year, Ching Ming, Buddha's Birthday, Tuen Ng, the day after Mid-Autumn, Chung Yeung (lunar
  or solar-term dates not computed here) and typhoon / black-rain closures. A dropped holiday's day is treated as an ordinary
  trading day and its pre-day as an ordinary day: a known contamination of hk33's ordinary-day sample, said now.
- Unscheduled closures elsewhere are not modelled.

## The rule (one market, one holiday)
- **H** = a full-day closure on a weekday. **P** = the last local trading day before H. Two holidays with the same P (Good
  Friday and Easter Monday; 25 and 26 Dec) give one P.
- Entry: long at the close of the local trading day before P. Exit: at the close of P. One local trading day held.
- **Stop** at entry - 2 x ATR(20). ATR(20) = the simple mean of the true ranges of the 20 local trading days ending with the
  entry day (all closed at the entry). A local trading day's high / low = over every candle after the previous local trading
  day's candle up to its own; true range against the previous local trading day's close. Stop check on every candle after the
  entry candle up to the exit candle: an open at or below the stop fills at the open, else a low at or below fills at the stop.
  Every trade has a stop.
- **1R** = 2 x ATR. Gross R = (exit - entry) / 1R.
- **Costs**: a round trip of **0.04 % of the entry price** (the index-CFD figure the 14 Nov index studies used, e.g.
  `eu-gap-fade`, `us-asia-lead`; `council/fills.mjs` has no index default). **Financing**: **6 % a year** of the entry price /
  365 per calendar night from the entry date to the exit date (the assumed rate of `pre-fomc-drift`; one night for most trades,
  three over a weekend). No broker rate history is on file; the one rate is used for every year and market. Net R = gross R -
  (0.0004 + financing share) x entry / 1R. Also reported with both doubled ("2x costs").
- A trade whose entry or exit day has no candle, or with fewer than 20 clean days for the ATR, is skipped and counted.

## The comparison
For every local trading day d of a market (after its first 21), the same one-day trade (entry at the previous local trading
day's close, exit at d's close, the same stop, costs and financing) gives a net R. **Pre group** = d is a P. **Other group**
= every other local trading day. Per-market test = Welch t of pre minus other net R.

**Pooled (primary, equal weight)**: one observation per UTC date and group: the equal-weight mean net R of the markets for which
that date is a P (pre series), and of the markets for which it is an other day (other series). Pooled test = Welch t of the
pre series minus the other series. (De40, eu50, fr40 and nl25 share most holidays and move together: a date is one
observation, not four.)

## Windows
**In sample**: days up to 2016-12-31 (from each file's start, 2003-2008). **Out of sample (decisive)**: 2017-01-01 to the last
candle (6 Nov 2026).

## Tests
Ten one-sided tests on out of sample: nine markets and the pooled one. p = one-sided normal p of the Welch t; **Holm over the
ten**.

**Placebo**: 40 seeds (1 to 40, fixed). For each seed, market and calendar year, draw as many days from that year's other
days (uniform, without replacement) as the market had P days that year; pool them per date the same way; statistic = the
pooled out-of-sample mean net R of the drawn days. The rule's statistic = the pooled out-of-sample mean net R of the pre series.

**Verdict PASS** only when all hold: (1) pooled out-of-sample Welch t >= 2 with a Holm-adjusted one-sided p < 0.05;
(2) pooled in-sample difference (pre minus other) > 0; (3) pooled out-of-sample pre mean net R > 0 at 2x costs; (4) the rule's
statistic above the placebo's in at least 38 of 40 seeds. Otherwise FAIL. Per-market results are reported (n, mean gross and
net R, the pre trades' own t, Welch t, Holm p), never a claim by themselves unless their Holm p < 0.05. A FAIL is a result.

## After
`holidays.mjs`, `run.mjs`, `result.json`, `RESULT.md` (verdict first; the reason inside the bold verdict line),
`tests/local-preholiday.test.mjs` (offline: Easter, known holiday dates, the report against result.json). No proposal unless
PASS, and then only a paper shadow for the owner.
