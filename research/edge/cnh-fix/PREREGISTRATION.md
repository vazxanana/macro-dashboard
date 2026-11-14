# The PBoC USD/CNY fix at 01:15 UTC: does USD/CNH keep moving the way the first quarter hour after it took? (pre-registration)

Written and pushed on 14 Nov 2026, before any trade of this rule was computed. Paper research only: no live rule, size,
filter, stop, cost model, config or mirror setting is changed by this study, whatever it finds. Forex only; ICT and the gold
book are not involved (owner decision item 44 untouched). Nothing below may change after the first result; anything found later
is reported as found later and never folded into the verdict.

## The idea

The People's Bank of China publishes the USD/CNY central parity ("the fix") every mainland business day at **09:15 Beijing
time = 01:15 UTC** (China keeps no daylight saving, so the UTC time never moves). The offshore yuan, USD/CNH, trades freely in
Hong Kong and abroad and is said to react to the fix: when the fix is set surprisingly strong or weak against what the market
expected, CNH moves toward it in the minutes after, and the move is said to carry on for a while as banks and funds adjust.

**This study cannot read the fix level itself.** No series of the daily fixings (or of the market's expectation of them) is in
the repository or reachable from the build sandbox, so the "surprise" cannot be measured. The study tests only **price
behaviour around 01:15 UTC**: it uses USD/CNH's own move in the quarter hour 01:15-01:30 UTC as the stand-in for the reaction to
the fix, and asks once whether following it (or fading it) for the next two hours makes money after costs, out of sample, as
a plain clock trade that always carries a stop.

## Template, and how this study differs

The method is copied from `research/edge/ecb-ref-fix` (branch `ecb-ref-fix`, not on main), itself copied from
`research/edge/wmr-fix-reversal` (branch `wmr-fix-reversal`). Their `fetch.mjs` / `run.mjs` were copied into this folder with
`git show` and edited here; nothing is imported across branches. I have read both results: at the London 16:00 fix and at the
ECB concertation, prices reverse slightly before costs (gross month-sum t 2.5-3.1) and the raw-spread round trip is 2-3 times
the effect (both FAIL). The `gotobi*` branches found a Tokyo fix minute effect (09:55 JST = 00:55 UTC). Those results set
nothing here. Differences, all fixed by this study's brief before any trade was computed:

| | ecb-ref-fix | this study (cnh-fix) |
|---|---|---|
| Moment | 14:10 CET (ECB concertation) | 01:15 UTC (PBoC fix, 09:15 Beijing) |
| Clock | CET / CEST | UTC (no daylight saving anywhere in the rule) |
| Move | 30 min INTO the moment | 15 min AFTER the moment, 01:15-01:30 UTC |
| Direction | fade only | T1 follow, T2 fade, T3 follow on a proxy |
| Entry / exit | 14:15 CET / +30 or +45 min | 01:30 UTC / 03:30 UTC (2 hours) |
| Markets | EUR/USD; three EUR crosses | USD/CNH; AUD/USD as a China proxy |
| Costs | raw-spread majors | USD/CNH: an assumed spread (no broker quote, below); AUD/USD: raw-spread majors |
| Placebo | 15 other CET hours | 25 other quarter hours of the Asian session (below) |

T1 and T2 are opposite trades on the same days; they are not mirror images (each has its own stop), but at most one of them
can be positive before costs. Both are tested because the brief asks for both; Holm covers all three tests.

## Known overlaps (said before the run, not used to filter)

- **Mainland holidays** (Spring Festival, Golden Week, others): there is no fix on those days, but CNH trades. No holiday
  calendar is used: a day with candles is traded whether a fix was published or not. This dilutes any fix effect a little.
- **The August 2015 fix reform** (11 Aug 2015: the fix was tied to the previous close; the CNH market then became much more
  active). It falls in the replication window. Not used as a split for the verdict; reported, not judged, as before / after.
- **Releases inside the holding period**: China's monthly data (01:30 or 02:00 UTC), Australian data (00:30 or 01:30 UTC),
  RBA decisions at 14:30 Sydney (03:30 UTC in the Australian summer, right at the exit; 04:30 UTC otherwise), Japanese
  data at 23:50 UTC (before the move).
  None is skipped (no release calendar for 2011-26 is in the repository).
- **The Tokyo fix** at 00:55 UTC (gotobi studies) sits 20 minutes before the move window; not used.
- **Thin early candles**: OANDA's USD/CNH M5 history starts in mid-2011 and its first years have sparse candles at 01:15 UTC
  (coverage in "Data"). A day without the needed candles has no move and no trade.

## Data

- OANDA mid M5 candles through the site's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, pages of 4,999 candles, paced;
  `fetch.mjs`), keys `usdcnh` and `audusd`, from 1 Jan 2010 to 14 Nov 2026 00:00 UTC. Files kept out of git. AUD/USD is
  seeded from a copy fetched through the same proxy by another study of the week (only a missing span is fetched; the candles
  are the proxy's either way). Candles are stamped at their opening second in UTC. No HistData file is read.
- **How far USD/CNH M5 reaches** (read from the fetched file before any trade was computed): the first USD/CNH M5 candle on the proxy is 5 Feb 2011 (1,016,021
  candles to 13 Nov 2026; nothing in 2010). Weekdays that have both candles of the 01:15-01:30 UTC move: 2011 48 of 260, 2012 75 of
  261, 2013 217 of 261, 2014 221 of 261, 2015 258 of 261, then 258-260 a year from 2016 to 2026 (226 of 227 in 2026 so far). The
  2011-12 candles are sparse, so the 20-day reference (20 earlier days within 42 calendar days) is rarely available before 2013.
- **Decisive window: trades entered 1 Jan 2018 to 13 Nov 2026. Replication window: every earlier entry the data allows
  (from the first USD/CNH day with a 20-day reference, to 31 Dec 2017).** With data from 2011 and dense candles
  from 2013, the replication holds roughly five usable years (2013-17): more than the 2 years the brief names as the floor
  for a meaningful replication, but thinner than the decisive window; the result states its n and span. A trade belongs to the window of
  its entry time. Nothing is tuned on either.
- Bar size: **M5** for every price, entry, stop check and exit.

## Clock

All rule times are **UTC**. A **day** is a weekday (Monday to Friday) by the UTC date of 01:15 UTC (= the Beijing date of the
fix). A placebo start before 00:00 UTC belongs to the next day (the evening before it).

## The rule (fixed)

For each day:

1. **The move after the fix**: `M = close of the USD/CNH M5 candle opening at 01:25 UTC − open of the USD/CNH M5 candle opening
   at 01:15 UTC` (01:15-01:29, three candles). Both candles must exist, else the day has no M.
2. **The reference**: `ref` = the median of `|M|` over the 20 most recent EARLIER weekdays that have an M (strictly before the
   day: no look-ahead). Those 20 days must all lie within the 42 calendar days before the day, else no trade. With an even
   count the median is the mean of the 10th and 11th sorted values.
3. **Event**: `|M| > 0.5 × ref` and `ref > 0`.
4. **Entry**: a market order at the **open of the M5 candle opening at 01:30 UTC**. No candle there: no trade ("no data").
   - **T1 (follow)**: USD/CNH WITH M (M > 0: buy USD/CNH; M < 0: sell).
   - **T2 (fade)**: USD/CNH AGAINST M (M > 0: sell; M < 0: buy).
   - **T3 (China proxy, follow, sign mirrored)**: AUD/USD, long AUD when CNH strengthens: M < 0 (USD/CNH falls) → buy
     AUD/USD; M > 0 → sell AUD/USD. The event is USD/CNH's (steps 1-3); AUD/USD needs its own `refA` (step 2 on AUD/USD's
     own 01:15-01:30 UTC move, same rule) and its own entry candle.
5. **Stop** (every trade has one, on the losing side): `1 × ref` beyond the entry (`refA` for T3). `R` is measured in units of
   that reference.
6. **Management on M5 candles from the entry candle on** (its own high / low count). A candle that opens at or beyond the stop
   exits at its open (gap); a candle that touches the stop exits at the stop. The stop never moves; no target, no break-even.
7. **Time exit**: at the close of the last M5 candle that opens before **03:30 UTC** (the 03:25 candle). That candle must open
   at or after 03:15 UTC, else no trade ("no data").
8. `R = (exit − entry) / ref` for a buy, `(entry − exit) / ref` for a sell.

## Costs (in R)

- **USD/CNH: an assumed spread, because the demo broker's symbol file has no USDCNH.** council-data `ctrader/symbols.json`
  (read 14 Nov 2026 with `git show origin/council-data:ctrader/symbols.json`) lists XAUUSD, EURUSD, GBPUSD, AUDUSD, USDCAD,
  USDCHF, three coins and four indices: no USDCNH. Fixed here, before the run: **spread 3.0 pips** a round trip (pip 0.0001;
  about 0.4 bp of a 7.1 price; offshore yuan quotes are several times wider than the raw majors' 0-0.3 pip, especially in
  the Asian morning), plus half a spread of slippage on each of the two market orders = **3.0 pips**, plus commission
  **22.5 USD per million USD of notional a side** (the raw-spread account's forex rate, `commissionType` 1), 45 USD a million
  a round trip; a USD/CNH unit is 1 USD, whose commission in CNH is `45e-6 × entry`. `cost = 6.0 pips + 45e-6 × entry`
  (about 9.2 pips at 7.1).
- **AUD/USD: the raw-spread model of CLAUDE.md "Forex spreads"** as the template studies used it: spread **0.3 pip**, slippage
  0.3 pip (half a spread on each of two market orders), commission `45e-6 × entry` (an AUD unit is worth `entry` USD).
  `cost = 0.6 pip + 45e-6 × entry`.
- **Financing**: none (every position is opened and closed between 01:30 and 03:30 UTC, never over the rollover).
- `net R = R − cost / ref`. Also reported at **twice** every cost (`net2`).
- Said before the run: `1R` here is the median 15-minute move, so a cost of about 9 pips is a large share of `R` on USD/CNH.
  That is part of what is tested, not a reason to change the rule.

## Statistics

- Per test and window: n, gross R a trade, cost in R a trade, net R a trade, total gross and net R, win rate, exits by kind,
  and **t = the t-statistic of calendar-month sums of net R** (months with at least one trade; mean / sd × √months); also
  the same t on gross R.
- **Holm** over T1-T3 on the decisive window: one-sided p of each net t (normal approximation), Holm-adjusted.
- **Placebo, 40 seeds**: the same rule at random other quarter hours of the Asian session. For each seed, each test and each
  day, one start `S` is drawn uniformly from the 25 quarter hours **23:00, 23:15, …, 05:45 UTC except 01:00, 01:15, 01:30**
  (23:00-23:45 = the evening before the day; never the 17:00 New York rollover; the three starts left out are the ones whose
  15-minute move or entry touches 01:15-01:30). The rule is applied unchanged with the move from S to the close of the
  S+10 min candle, the reference from the same quarter hour's moves on the 20 earlier days that have one, entry at S+15 min,
  exit at the close of the last candle before S+2 h 15 min (that candle opening within 15 minutes of it). T3's placebo uses
  USD/CNH's move at S for the event and AUD/USD's own reference at S. Seed s uses a fixed generator (mulberry32, seed
  `s × 1000 + test index`). Reported: each test's decisive net R a trade against the 40 seeds (how many it beats; their 5th /
  50th / 95th percentile).
- **2x cost**: decisive net R a trade with every cost doubled.
- Also reported, not judged: every year, before / after 11 Aug 2015 inside the replication window, and the share of days with
  an event.

## The pass bar (fixed)

A test **passes** when all three hold:

1. net R a trade > 0 in the decisive window AND in the replication window;
2. decisive net month-sum t > 0 with a Holm-adjusted one-sided p < 0.05;
3. decisive n ≥ 200.

A passing test is called **robust** only if also its decisive net R a trade at 2x cost is > 0 and it beats at least 38 of
the 40 placebo seeds; otherwise "PASS, not robust". If the replication window holds fewer than 2 years of trades, the
verdict says the replication is weak.

**Verdict**: PASS if at least one test passes (named, robust or not); FAIL if none does. A test with net R > 0 and t ≥ 2
(before Holm) in the decisive window that fails another condition is named as a near miss, never as a pass.

## What a result would and would not mean

A PASS is a forward-test candidate for the owner, never a live rule: absolute rule 3 holds, nothing here changes the council,
the mirror or any cost, and the cost of USD/CNH would first have to be measured at a broker. A FAIL says this mechanical
follow / fade of the first quarter hour after 01:15 UTC does not pay after the assumed costs on OANDA mid prices; it says
nothing about trading the fix's surprise (which this study cannot read) or about the first five minutes after 01:15.
