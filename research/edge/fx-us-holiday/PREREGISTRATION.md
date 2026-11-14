# Pre-registration: the US dollar on the day before a US market holiday (14 Nov 2026)

Written and pushed before any number of this study is computed (no candle of this study has been read). Research only, paper
only: no rule, size, filter, stop, config, council member or mirror setting changes. Not an ICT study (nothing under `ict/`
is edited; `ict/calendar.mjs` is only read for its holiday dates).

## Why
The index pre-holiday study (branch `pre-holiday`, 13 Nov 2026, FAIL) asked whether US stocks rise before a US market
holiday. This study asks the currency question: with US desks thinning out before a US holiday, does the US dollar move in a
consistent direction on the last US trading day before it? Checked before writing: no study on `main` or on any `origin/fx-*`
branch tests the dollar around US holidays (`fx-home-hours` only skips those dates; `fx-month-end` lists UK holidays for its
calendar; `fx-weekday` is the day of the week). Conventions (basket, costs, financing, statistics) are those of `fx-weekday`
(branch `fx-weekday`), read with `git show` and copied, nothing imported across branches.

## Data, and which close is used
- OANDA mid **daily** candles of `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf` from council-data
  `research/daily/<key>.json`, read with `git show origin/council-data:…` (`node run.mjs fetch <dir>`, files kept out of git,
  no network).
- **The close is the UTC daily close, not 17:00 New York.** These candles are complete UTC days, closing at 00:00 UTC = 19:00
  New York (20:00 in New York winter), two or three hours after the 17:00 New York rollover. No intraday forex history on file
  covers 2005 onwards for all seven pairs (the HistData M1 files start in 2018 and miss pairs), and the study uses no network,
  so the UTC close is used and said so. The 2-3 evening hours in New York are the thinnest of the day.
- Saturday / Sunday candles are folded into the next Monday with `foldWeekend` (`council/fills.mjs`, imported, not edited).
- A **basket day** exists when all seven pairs have a candle on that UTC date, all seven share the same previous candle date,
  and every pair has an ATR(20) (below). Candles the broker prints on a holiday itself (for example 25 December or 1 January)
  stay in the file as candles; nothing is dropped by hand.

## The holiday calendar (derived from rules in code, no calendar fetched)
- **NYSE full holidays**, from `ict/calendar.mjs` `cmeYear` (read only), exactly as the `pre-holiday` study's `dayKind`:
  New Year's Day (Sunday -> Monday; a Saturday New Year is not observed on the Friday), Martin Luther King Day, Presidents'
  Day, Good Friday, Memorial Day, Juneteenth (from 2022), Independence Day, Labor Day, Thanksgiving Day, Christmas Day (each
  with its observed date). `council/datacheck.mjs` `usHolidays` is a CME-hours table (it marks most of these days "early"
  and carries Juneteenth before 2022), so it is not used.
- Unscheduled closures (29-30 October 2012, 5 December 2018, 9 January 2025) are not trading days and not holidays for the
  rule: nobody knew them a day ahead.
- **NYSE trading day** = a weekday that is neither a full holiday nor an unscheduled closure (half days are trading days).
- **P** (the pre-holiday day) = the last NYSE trading day before a holiday H (for a Monday holiday the Friday, for Good Friday
  the Thursday). **A** (the post-holiday day) = the first NYSE trading day after H. If two holidays ever shared a P (or an A),
  it is traded once.

## The trade (primary: P)
- **Hold**: enter at the close of the basket candle before P (the previous candle in the folded file), exit at the close of
  P's UTC candle. One day held. This is the stated "close two days before the holiday to the close the day before", read in
  NYSE trading days and on UTC closes.
- **The basket**, seven legs equal-weighted, positive = US dollar up: short EUR/USD, GBP/USD, AUD/USD, NZD/USD; long USD/JPY,
  USD/CAD, USD/CHF. A trade "long USD" holds those sides; "short USD" the opposite of each.
- **Stop (absolute rule 1)**: each leg has a stop 1.5 x ATR(20) from its entry, ATR = simple mean of the true range of the 20
  folded candles ending at the entry candle. On the exit candle: an open at or past the stop fills at the open, otherwise a
  high / low at or past it fills at the stop. **1R** of a leg = 1.5 x ATR.
- **Costs** (base), one raw-spread round trip per leg as a share of the entry price: a 0.3 pip spread (0.01 for JPY, 0.0001
  otherwise) plus the demo account's forex commission, round trip 0.0045 % of notional (`ctrader/symbols.json`
  `commissionRT` 0.000045). The demo is a raw-spread account whose measured median quote spread between rollovers is 0 on the
  majors (CLAUDE.md "Forex spreads", 12 Nov 2026): the 0.3 pip is the conservative side, as in `fx-weekday`. Checks: cost 0,
  base, 2x (spread, commission and the rate markup doubled).
- **Financing**, one rollover per held candle, three when the candle's UTC weekday is Wednesday (broker `rollover3Days` 3):
  EUR, GBP, AUD, CAD, CHF legs from the demo broker's swaps in council-data `ctrader/symbols.json` (frozen into `swaps.json`
  beside this file at fetch time; type 0 = pips a lot a night; today's swap is used for every year); NZD and JPY (not quoted
  there) from the `fx-carry` study's approximate policy-rate table (`rates.json`, copied beside this file from
  `origin/fx-weekday`, its stated approximations kept), rate held minus rate sold, less a 1 % a year markup, / 365 a night.
  The extra value-date days a broker may charge on the rollover before a US holiday are **not** modelled (said in the result).
- **Leg results**: gross % = side x (exit - entry) / entry; net % = gross - cost + financing; R = % x entry / 1R. **Basket**
  % and R = the mean of the seven legs.

## Direction: learned in sample, applied out of sample
- **s** = the sign of the in-sample mean GROSS long-USD basket % on P days (+ = trade long USD, - = short USD; exactly 0 =
  long USD). The same s is then traded in both windows. The out-of-sample window plays no part in choosing s.

## Windows (by the date of P)
- **In sample: 3 January 2005 to 31 December 2014** (the NZD / JPY rate table starts 31 December 2004, so 2004 has no
  financing for two legs).
- **Out of sample: 1 January 2015 to the last P whose exit candle is on file.**

## Tests (one observation = one holiday's basket)
- **T1, out of sample**: net basket R on side s, base cost: mean > 0 with t >= 2 on BOTH (a) the event-level one-sample t
  (one observation per holiday) and (b) the calendar-month-sums t (sum of the net R of the events in each calendar month that
  has one; one-sample t over those months).
- **T2, in sample**: mean net basket R on side s (base cost) > 0.
- **T3, 2x cost**: out-of-sample mean net basket R on side s at 2x cost > 0.
- **T4, placebo**: 40 seeds (1 to 40, a fixed generator). Ordinary days = out-of-sample basket days whose date is an NYSE
  trading day, not a P and not an A. For each seed and each calendar year, draw as many ordinary days as the rule traded P days
  that year (uniform over that year's ordinary days, with replacement); each is traded exactly like the rule (side s, entry at
  the previous candle's close, the same stop, costs and financing). The rule passes when its out-of-sample mean net R is above
  the seed's in at least 38 of the 40 seeds (95 %).
- **Verdict PASS** when T1 to T4 all hold; else **FAIL**. A FAIL is a result.

## Reported only, not judged
- **The day after (A)**: the same hold on A (entry at the close of the candle before A, exit at A's close), its own side
  s_A learned in sample the same way, the same statistics. Never part of the verdict.
- Per holiday type (n, mean net R) out of sample; Welch t of gross P-day basket % against ordinary days; per-leg means; cost
  0; stops hit.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict line first), `tests/fx-us-holiday.test.mjs` (offline). A proposal (a paper
shadow, never a live change) only if the verdict is PASS.
