# Pre-registration: spot gold while the US 30-year bond sits at an extreme of its 52-week range (14 Nov 2026)

Written and pushed alone, before any gold return on an event day was computed. A stand-alone cross-asset study: it is not a
gate, exit, entry or size change of the live gold book, it reads none of the book's positions and none of the book's 2006-17
records (docs/owner-decisions.md item 44). Paper only; nothing live changes.

## Hypothesis

The US 30-year Treasury bond is the longest-duration haven and the market's purest read of long real-rate expectations.
When it trades at an extreme of its own year (near its 52-week low = long yields near a one-year high; near its 52-week high
= long yields near a one-year low), the rates market is at a stretched point. Two stories are told about gold there: at a
bond low, gold has been pressed by high yields and is "cheap" against rates (a rebound buy); at a bond high, falling long
yields lower gold's carrying cost and support it (a trend buy). Tested: **a one-day gold buy taken on a day the 30-year bond
closes in the bottom (T1) or top (T2) tenth of its 52-week closing range earns more than the same one-day gold buy on the
other days of the same year.**

Nearest tested topics, and why this is not one of them: `gold-bond-lead` (a 10-year up WEEK that gold lagged: a weekly move,
not a range position); `gold-bond-vol-spike` (10-year volatility jumps); `gold-yield-shock` (a 10-year shock DAY);
`gold-liquidation-day` (gold, S&P 500 and the 10-year falling together); `gold-curve-slope`, `gold-rate-spread` (yield gaps,
not one bond's range position); `index-52w-high`, `high52-*` (a market's own 52-week high, not a bond read for gold). None
reads where the 30-year bond sits in its 52-week range.

Fresh entries into a zone were counted first (bottom tenth, a 10-day gap: 10 in sample, 16 out of sample; the top tenth: 25 /
7): far under 100 a window, because the bond trended for years on end. So the event is every DAY in the zone, each a one-day
trade (non-overlapping by construction), and the controls below take care of the clustering and of gold's drift.

## Data and market set (fixed now)

- Gold: council-data `research/daily/xau.json` (OANDA mid spot XAU/USD, UTC daily candles), the only traded market.
- Signal: council-data `research/daily/usb30y.json` (OANDA mid USB30Y_USD, the US 30-year Treasury bond CFD price, from
  March 2003; rising price = falling yields).
- Both read with `git show origin/council-data:…` (no network, no cache in git); weekends folded into Monday with
  `council/fills.mjs` `foldWeekend`; days joined by UTC date (a bond day with no gold candle is dropped).

## The event (fixed now; counted before this file, no gold figure looked at)

On the bond's folded daily closes, for day d: lo / hi = the lowest / highest close of the 253 closes from d-252 to d (d
included); pos = (close_d - lo) / (hi - lo). **T1 event: pos <= 0.10. T2 event: pos >= 0.90.** Only closes up to d are used.
Windows by event date: in sample 2007-01 to 2016-12, out of sample 2017-01 to 2026-10. Counted on the bond alone before this
file (q = 0.10 chosen from the counts to give at least 100 days in every window; q = 0.05 gave 85 / 248 and 267 / 85):

| Test | Zone | In sample days | Out of sample days |
|---|---|---|---|
| T1 (primary) | bond bottom tenth of its 52-week range | 160 | 439 |
| T2 | bond top tenth of its 52-week range | 450 | 154 |

## The trade

Long gold at its daily close of event day d; stop 2 x ATR(20) of gold's candles up to and including d (a gapped stop fills at
the open, `fills.mjs` `stopFill`); otherwise out at the next gold close (hold 1 day). R = move / risk. Costs: **$0.60 a round
trip** plus **nights x FIN.xau.long x entry** (FIN.xau.long = 0.000148 of price a rollover, the demo broker's XAUUSD long swap
of 11 Nov 2026, `council/fills.mjs`; `nights` there: Mon-Fri 22:00 UTC, Wednesday three). Longs only: shorts have lost in
every gold study of this series and are not tested.

**Baseline** (per test): the same one-day long, same stop rule, entered at the close of every gold day of the same calendar
year. Statistic per event: **excess = event net R - mean net R of that year's baseline**. Because the hold is one day, the
"total net over total days" measure equals the mean net R a trade, reported beside it.

## Statistics and pass bar (fixed now)

- t on calendar-month sums of the excess (events grouped by entry month), one-sided p for excess > 0; Holm over the two
  out-of-sample p values (T1, T2).
- Control / placebo (keeps gold's drift and volatility, removes the bond's information): 40 seeds (mulberry32, seed
  20261114 + s): each out-of-sample event day is replaced by a random gold day of the same calendar year (with replacement,
  any day), same trade; a seed's statistic = mean excess. Beaten = the real mean excess is above it.
- **PASS** (T1 decides the verdict; T2 reported with the same checks): out-of-sample mean excess > 0 with month t >= 2, Holm
  p < 0.05, in-sample mean excess > 0, out-of-sample net R a trade > 0 AND excess > 0 at 2x costs ($1.20, financing x2), and
  at least 38 of 40 placebo seeds beaten. Anything else is FAIL. Gross and net R, raw net-R month t, win rate and stops are
  reported.
- A pass would be a lead only (hundreds of tests in this repository), never an edge without a forward record; nothing would
  go live without the owner.

Files: `run.mjs`, `RESULT.md`, `result.json`, `tests/gold-bond-52w-extreme.test.mjs`. Branch `gold-bond-52w-extreme`, no pull
request.
