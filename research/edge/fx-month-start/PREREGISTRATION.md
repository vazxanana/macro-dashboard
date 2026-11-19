# Pre-registration: the US dollar on the first trading days of a month (14 Nov 2026)

Written and pushed before any number of this study is computed (no candle of this study has been read). Research only, paper
only: no rule, size, filter, stop, config, council member or mirror setting changes, whatever the verdict. Not an ICT study.

## Why
`fx-month-end` (13 Nov 2026, FAIL) tested the month-end rebalancing flow into the London 4 pm fix on the last business day,
10:00 to 16:00 London. Its counterpart is the start of the month: new-month portfolio inflows (pension and fund contributions,
coupon and dividend reinvestment, the completed rebalancing) said to move the US dollar on the first trading days of a new
month. Checked before writing: no study on `main` or on any `origin/fx-*` branch tests it. `fx-month-end` trades only the last
business day intraday; `turn-of-month` (13 Nov, FAIL) is US equity indices, not currencies; `fx-december-usd` tests the first
days of January only (one month a year); `fx-weekday` is the day of the week; `fx-us-holiday` the day around US holidays.
Harness, basket, costs, financing and statistics are those of `fx-us-holiday` (branch `fx-us-holiday`, PR #975), read with
`git show` and copied, nothing imported across branches; `rates.json` is copied unchanged from that branch.

## Data, and which close is used
- OANDA mid **daily** candles of `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf`, and `spx500` (reported split only), from
  council-data `research/daily/<key>.json`, read with `git show origin/council-data:…` (`node run.mjs fetch <dir>`, files kept
  out of git, no network).
- **The close is the UTC daily close, not 17:00 New York.** These candles are complete UTC days closing at 00:00 UTC (19:00
  New York, 20:00 in New York winter). No intraday forex history for all seven pairs since 2005 is on file, and the study uses
  no network, so the UTC close is used and said so.
- Saturday / Sunday candles are folded into the next Monday with `foldWeekend` (`council/fills.mjs`, imported, not edited).
- A **basket day** is a UTC weekday date on which all seven folded pairs have a candle. Candles the broker prints on a
  holiday (for example 1 January) stay in the file as candles and count as basket days; nothing is dropped by hand.

## The event (one per calendar month)
- **E** = the last basket day of month M; **D1**, **D2** = the first and second basket days of month M+1.
- The event is traded only when, in every pair's folded file, D1 is the candle right after E and D2 the one right after D1
  (no candle of another date between), and every pair has an ATR(20) at E. Events that fail this are skipped and listed.
- Windows by the date of D1. **In sample: January 2005 to December 2014** (the NZD / JPY rate table starts 31 December 2004).
  **Out of sample: January 2015 to the last event whose D2 candle is on file.**

## The trade (primary)
- **Hold**: enter at the close of E, exit at the close of D2. Two candles held.
- **The basket**, seven legs equal-weighted, positive = US dollar up: short EUR/USD, GBP/USD, AUD/USD, NZD/USD; long USD/JPY,
  USD/CAD, USD/CHF ("long USD"). "Short USD" holds the opposite of each.
- **Stop (absolute rule 1)**: each leg has a stop 1.5 x ATR(20) from its entry, ATR = simple mean of the true range of the 20
  folded candles ending at E. Checked on D1, then D2: an open at or past the stop fills at the open, otherwise a high / low at
  or past it fills at the stop; a stopped leg is out. **1R** of a leg = 1.5 x ATR.
- **Costs** (base), one raw-spread round trip per leg as a share of the entry price: a 0.3 pip spread (0.01 for JPY, 0.0001
  otherwise) plus the demo account's forex commission, round trip 0.0045 % of notional (`ctrader/symbols.json` `commissionRT`
  0.000045). The demo is a raw-spread account whose measured median quote spread between rollovers is 0 on the majors
  (CLAUDE.md "Forex spreads", 12 Nov 2026): the 0.3 pip is the conservative side, as in `fx-weekday` and `fx-us-holiday`.
  Checks: cost 0 (no spread, no commission; financing kept), base, 2x (spread, commission and the rate markup doubled).
- **Financing**, per held candle one rollover, three when the candle's UTC weekday is Wednesday: EUR, GBP, AUD, CAD, CHF legs
  from the demo broker's swaps in council-data `ctrader/symbols.json` (frozen into `swaps.json` at fetch time, type 0 = pips a
  lot a night, today's swap for every year); NZD and JPY from the `fx-carry` rate table (`rates.json`, approximate, its stated
  caveats kept), rate held minus rate sold less a 1 % a year markup, / 365 a night. A stopped leg pays only the candles it held.
- **Leg results**: gross % = side x (exit - entry) / entry; net % = gross - cost + financing; R = % x entry / 1R. **Basket** %
  and R = the mean of the seven legs.

## Direction: learned in sample, applied out of sample
- **s** = the sign of the in-sample mean GROSS long-USD basket % of the events (+ = long USD, - = short USD; exactly 0 = long
  USD). The same s is traded in both windows. **The direction is learned in sample and only applied out of sample**: the
  out-of-sample window plays no part in choosing it, and a positive in-sample net mean is partly built in by that choice.

## Tests (one observation = one month's basket)
- **T1, out of sample**: net basket R on side s, base cost: mean > 0 with t >= 2 on BOTH (a) the event t (one-sample t over
  events) and (b) the calendar-month-sums t (sum of the net R of the events in each calendar month; with one event a month it
  equals the event t, computed and shown anyway).
- **T2, in sample**: mean net basket R on side s (base cost) > 0.
- **T3, 2x cost**: out-of-sample mean net basket R on side s at 2x cost > 0.
- **T4, placebo**: 40 seeds (1 to 40, a fixed generator). For each seed and each calendar month that has a traded event (both
  windows), draw one **mid-month** window uniformly from that month's basket days E' with calendar day 8 to 19 whose next two
  basket days are in the same month and contiguous in every pair's file (as for the event). Each window is traded exactly
  like the rule (entry at E' close, exit at the second basket day's close, the same stop, costs and financing). The seed learns
  its own side the same way (sign of its in-sample mean gross long-USD basket %) and its out-of-sample mean net R (base cost)
  on that side is recorded. The rule passes when its out-of-sample mean net R is above the seed's in at least **38 of the 40
  seeds** (95 %).
- **Verdict PASS** when T1 to T4 all hold; else **FAIL**. A FAIL is a result.

## Reported only, not judged
- **Day 1 alone**: entry at E close, exit at D1 close, its own side learned in sample the same way; the same statistics.
- **Previous month's US equity return**: the sign of the SPX500 (OANDA CFD, UTC daily) return over month M, from the close of
  the last spx500 candle dated in month M-1 to the close of the last spx500 candle dated on or before E. The events split into
  "US equities up in M" and "down in M"; each group learns its own side in sample and is reported out of sample (n, net R, t).
  The rebalancing story says a month of US equity gains is followed by dollar selling into the turn; the split shows whether
  the data lean that way, and is never part of the verdict.
- Per leg out-of-sample gross % long USD, per year net R, Welch t of the event gross basket % against the placebo pool's
  windows, legs stopped, cost 0.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict line first, reason inside it), `tests/fx-month-start.test.mjs` (offline). A
proposal (a paper shadow, never a live change) only if the verdict is PASS.
