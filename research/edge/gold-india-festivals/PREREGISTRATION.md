# Pre-registration: spot gold into and after the Indian gold-buying festivals (14 Nov 2026)

Written and pushed alone (with its fixed date table `dates.mjs`), before any candle of this study is read. Research only, paper
only: no rule, size, filter, stop, config, council member or mirror setting changes.

**Not a gold-book test (owner item 44).** A NEW standalone calendar study of one industry claim about Indian physical demand. It
is not a gate, exit, entry or size for Gold trend, Gold trend fast, Gold daily engulf, the Mosha cycle or any other gold system,
and nothing here will be proposed as one.

## The claim
Jewellers and gold-demand commentary describe Dhanteras (two days before Diwali) and Akshaya Tritiya as the peak days of Indian
gold buying. Read on spot gold (XAU/USD): (a) gold drifts up in the two weeks into each festival, as dealers and buyers stock
up; (b) it softens in the days after, when that demand is spent.

## Dedupe (done before writing this)
`git grep -iE 'diwali|dhanteras|akshaya'` on main, `untested-backlog`, `gold-china-holidays`, `gold-month-of-year`,
`gold-pre-holiday`, `claude/seasonality`, `gold-comex-calendar`, `gold-turn-of-month` (research/ folders): no match. The
nearest studies are `gold-china-holidays` (Shanghai closures; FAIL, T1 OOS t +1.38), `gold-month-of-year` (#907, calendar months;
FAIL) and `seasonality` (#540, clock and calendar windows; FAIL). None tests an Indian festival date. This study reuses the
gold-china-holidays design (trade, cost, placebo) so the two can be read side by side.

## Dates: `dates.mjs` (fixed now, never looked up at run time)
The Gregorian date of each festival 2007-2026 as Drik Panchang lists it for New Delhi, cross-checked against press reports of
the day; the source is written on each row. Decided before any price was read:
- **Dhanteras**: all 20 years 2007-2026 kept.
- **Akshaya Tritiya**: **2007 excluded** (no source verified on 14 Nov 2026) and **2008 excluded** (observed on two days, 7-8 May,
  per Business Standard): 18 years 2009-2026 kept.
- A festival on a Saturday or Sunday keeps its date; the trading-day rules below place it.
Note: the date pages themselves could not be opened from the build sandbox; the dates come from web-search summaries that quote
those pages and press reports. A wrong date by one day moves a window by at most one trading day.

## Data
- council-data `research/daily/xau.json` (OANDA mid, complete UTC days, `cols [t,o,h,l,c,v]`), copied with `git show`, kept out
  of git; Saturday / Sunday candles folded into the next weekday (`council/fills.mjs` `foldWeekend`, read only). Trading days =
  the folded weekday candles.
- OANDA mid H1 XAU/USD candles (`[t,o,h,l,c]`, from March 2006; cache outside git, fetched earlier this session through the
  candle proxy) only to check stops inside a holding.
- Only XAU/USD is judged (market set fixed now).

## Windows (festival date D)
- P = the last trading day with UTC date strictly before D ("the trading day before the festival").
- F = the last trading day with UTC date on or before D ("the festival day"; for a weekend festival this is the Friday before, = P).
- **T1 (Dhanteras run-up)**: long from the close of the trading day 10 trading days before P to the close of P (10 trading days held).
- **T2 (Akshaya Tritiya run-up)**: the same for Akshaya Tritiya.
- **T3 (post-festival softening)**: SHORT from the close of F to the close of the 5th trading day after F; Dhanteras and Akshaya
  Tritiya pooled (two events a year).
- An event the candles do not cover (start or end missing, or 2026's Dhanteras post window if the file ends before it) is left out
  and named.

## The trade and costs
- **Every trade has a stop**: 2 x ATR(20) of the folded daily candles (true range; candles up to and including the entry day only),
  below a long's entry / above a short's. Checked on each H1 candle from the entry close to the exit close: an H1 candle that opens
  through the stop fills at its open (gap), one whose low (long) / high (short) touches it fills at the stop.
- R = (exit - entry) / r0 for a long, (entry - exit) / r0 for a short; net R = that minus cost / r0 minus financing in R.
- Cost: $0.60 an ounce round trip (spot gold $0.30 spread + half a spread of slippage on each of two market orders, as
  gold-china-holidays). 2x cost = $1.20.
- Financing on buys only: `council/fills.mjs` `financing()` with `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026; Wednesday counts three), nights from the entry close to the exit; today's rate charged in every year,
  as the repo's other gold studies. Shorts: nothing charged or credited (`FIN.xau.short` = 0).

## Statistics
- In sample 2007-2016 (Dhanteras 10, Akshaya 8 events), out of sample 2017-2026 (10 and 10; T3 pooled about 20 a window).
- t = one-sample t of the mean net R over events. Every event falls in its own calendar month (Dhanteras in Oct/Nov, Akshaya
  Tritiya in Apr/May), so the t on calendar-month sums equals the per-event t.
- Holm over the three out-of-sample tests (two-sided p from the t distribution).
- **Placebo** (per test): 40 seeds (seeded PRNG); each seed draws, for every out-of-sample event, one random entry day in the same
  calendar year whose holding (same length, same side) overlaps no festival window of that test, trades it by the same rule, and
  takes the mean net R. The real out-of-sample mean is compared with the 40.
- Comparison (reported): every same-length LONG holding (10 trading days for T1 / T2, 5 for T3) of the same years outside the
  festival windows, its mean net R, and the Welch t of the festival windows against it (T3 read against the short of the same
  holdings).

## Pass bar (each test on its own; the study PASSES if any test passes)
A test passes only if all hold: (1) out-of-sample net t >= 2 and its Holm-adjusted p < 0.05; (2) in-sample net mean of the same
sign; (3) out-of-sample net mean still positive at 2x cost; (4) the out-of-sample mean above at least 38 of the 40 placebo seeds.

**Power, said plainly**: about 10 events a window per festival. A t of 2 on 10 events needs a mean of about 0.67 standard deviations
of the event R; a modest real effect would fail here. A FAIL means "not shown", not "shown absent". Whatever the verdict, nothing
live changes; a pass would be a hypothesis for the owner, never a gate on a gold-book system.
