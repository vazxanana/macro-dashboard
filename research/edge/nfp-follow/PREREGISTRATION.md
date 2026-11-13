# NFP follow or fade: pre-registration

Written and committed on 13 Nov 2026, before any candle of this study was read for an outcome and before `run.mjs`
existed. Paper research only: no live rule, size, filter, council member, page or mirror setting changes because of this
study, whatever it finds. A PASS leads at most to a proposal for a paper shadow; the owner decides.

## What this is, and what it is not (owner decision item 44)

Item 44 (12 Nov 2026) says no further gate, exit, entry or size is tested on the gold book's 2006-17 window. **This study
is not a test of the gold book** (Gold trend, Gold daily engulf) and adds nothing to it. It is a NEW stand-alone event
rule: one trade on the morning of the US Employment Situation release, decided on 2020 to now and replicated on 2010-19.
It reads none of the book's positions and uses none of its window as a decision window.

It also does not repeat `research/edge/event-reaction`: that study's one pre-registered test (does gold keep going from
T+5 to T+60 the way the DOLLAR's first 5-minute read pointed after CPI?) FAILED. This one is NFP only, reads the traded
market's OWN first 15 minutes, trades with a stop and a target, and is run on gold and on NAS100.

What I know before running it: nothing measured. I have not computed any post-release return of NFP days on either market.
I looked at one proxy answer (8 Jan 2010, 12:00-16:00 UTC, gold and NAS100) to check that M5 candles exist that far back;
no outcome was computed from it.

## Release dates (fixed here, written into run.mjs)

US Employment Situation, 08:30 New York time (America/New_York, daylight time handled by the time zone database).

- **2022-01 onward**: exactly the NFP dates of `council/events.mjs` (`HISTORY` 2022-01 to 2025-07 and `EVENTS` from
  2025-08; their sources are the BLS schedules, including the 2025 shutdown changes: Sep 2025 report on Thu 20 Nov,
  October 2025 cancelled, Nov 2025 on Tue 16 Dec, Jan 2026 on Wed 11 Feb). Releases up to the day of the run.
- **2010-01 to 2021-12**: the BLS rule. The reference week is the Sunday-to-Saturday week containing the 12th of the
  month; the release is the third Friday after that week ends. Exceptions, written as data in `run.mjs`:
  1. **January**: a computed date on 1, 2 or 3 January moves one week later (Jan 2010 -> 8th, Jan 2014 -> 10th,
     Jan 2015 -> 9th, Jan 2016 -> 8th, Jan 2020 -> 10th, Jan 2021 -> 8th).
  2. **Independence Day**: a computed Friday that is the federal holiday (4 July, or 3 July when the 4th is a Saturday)
     moves to the Thursday before (2015 -> Thu 2 Jul, 2020 -> Thu 2 Jul); a computed 4 July that is a Friday moves to
     Thursday 3 July (2014).
  3. **2013 shutdown**: the September 2013 report on Tue 22 Oct 2013 (computed 4 Oct), the October 2013 report on
     Fri 8 Nov 2013 (computed 1 Nov).
  The rule reproduces every 2022-26 date of events.mjs that falls under it (checked in the test). Any 2010-21 date I got
  wrong is a day without a release; the run REPORTS (never drops) every date whose 08:30 M5 gold candle range is under
  1.5x the median 08:30 range of the 8 nearest other Fridays ("date check").
- Good Friday releases (2010-04-02, 2012-04-06, 2015-04-03, 2021-04-02, 2026-04-03) stay in the list; a market with no
  candles that morning simply has no trade.

## Data

OANDA mid M5 candles for `xau` (XAU/USD) and `nas100` (NAS100_USD) through the keyless candle proxy
(`https://meridianx.dev/md/bars?sym=<key>&tf=5m&from=&to=`), one request per study day covering 10:00-16:30 UTC (06:00 to
11:00 New York in either season, with the ATR warm-up). Fetched once, cached gzip OUTSIDE git (`node --use-env-proxy run.mjs
fetch <dir>`). Study days = every NFP date above plus every other Friday from 2010-01-01 to the run date (the placebo pool).

## The rule (times New York; an M5 candle is named by its open)

1. **The first 15 minutes**: the candles 08:30, 08:35, 08:40. O = 08:30 open, C = 08:40 close, H / L = their high / low,
   range = H - L. Direction d = sign(C - O); d = 0 is no trade.
2. **Skip filter**: ATR20 = the mean true range of the 20 M5 candles before 08:30 (08:00-ish back to 06:50; the first
   one's true range uses the candle before it when present, else its own high - low). No trade when
   range < 0.5 x (3 x ATR20). Any of the three 15-minute candles, the 08:45 candle, or fewer than 20 warm-up candles
   missing: no trade (counted as "no data").
3. **Entry**: market at the 08:45 open (E). Rule **F** (follow) trades side s = d; rule **R** (fade) trades s = -d.
4. **Stop** beyond the range's extreme on the losing side: a buy's stop is L - buf, a sell's H + buf; buf = $0.30 gold,
   2.0 points NAS100. Risk r0 = s x (E - stop). No trade if r0 <= 0 or r0 < 0.25 x range (a stop that close is cost, not
   risk).
5. **Target** E + s x 1.5 x r0.
6. **Management** on the M5 candles from 08:45 to 10:55: a candle that opens through the stop exits at its open; a stop
   touched exits at the stop; a target touched exits at the target; stop first when one candle holds both. **Time exit at
   11:00** = the close of the last candle before 11:00. Every trade has a stop (absolute rule 1).
7. **R**: gross = s x (exit - E) / r0; net = gross - cost / r0, cost = $0.30 gold (no overnight: out by 11:00), 2.0 points
   NAS100 (a round trip). Also reported at twice the cost.

## Windows

- **Decisive**: 2020-01-01 to the run date (absolute rule 4).
- **Replication**: 2010-01-01 to 2019-12-31. Nothing is tuned on either; every constant is in this file.

## Tests and the pass bar

Four tests: rules F and R on xau and nas100. For each, on the decisive window: n, mean net R a trade, t = mean / (sd / sqrt n)
on trades (one trade a month, so trades do not overlap), one-sided p from the normal, Holm over the 4 tests.

A test **passes** only when ALL hold:
1. decisive n >= 60;
2. decisive mean net R > 0 and t >= 2;
3. Holm-adjusted p < 0.05;
4. replication (2010-19) mean net R > 0 (same sign);
5. **placebo**: the same rule on the other Fridays at 08:30 New York (not an NFP date). 40 seeds (mulberry32, seeds 1-40):
   each draws, without replacement, as many other Fridays of the decisive window as the decisive window has NFP dates, runs
   the identical rule and records its mean net R over the trades it makes. The NFP mean must beat at least 38 of the 40.

**Verdict**: PASS if at least one test passes (it is named), else FAIL. A PASS is evidence for a paper shadow proposal only,
written to `research/proposals/`; never a live change. A FAIL is reported as it is. Also reported, never judged: gross R,
2x cost, by year, exit mix, the date check, and the placebo's all-other-Fridays mean.
