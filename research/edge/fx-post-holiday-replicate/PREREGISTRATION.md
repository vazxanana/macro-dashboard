# Pre-registration: the US dollar on the day AFTER a US market holiday, replicated on other dollar pairs (14 Nov 2026)

Written and pushed alone, before any candle of this study is read (only `research/daily/_index.json`, which holds row counts and
dates, and `ctrader/symbols.json`, which holds no price history, were looked at). Research only, paper only: no rule, size,
filter, stop, config, council member or mirror setting changes. Not an ICT study (`ict/calendar.mjs` is only read for its
holiday dates, through the copied code below).

## Why, and what is replicated
`research/edge/fx-us-holiday/` (branch `fx-us-holiday`, PR #975, 14 Nov 2026, verdict FAIL on its own question) reported one
side observation, pre-registered there as "reported only, never judged": holding the dollar **long** against the seven majors
on the **first NYSE trading day after a US market holiday** made +0.089R a holiday out of sample 2015-26 (n 110, event t 2.65,
month-sum t 2.50) but −0.004R in sample 2005-14 (n 88, t −0.10). A window with no in-sample support, picked from a second look,
is not evidence. This study tests that one hypothesis, frozen as written here, on dollar pairs #975 never read. Nothing about
the hypothesis is chosen from these pairs: the side (long USD), the day, the hold, the stop and the statistics are fixed below.
The span 2005-now of these pairs has not been read by #975 or by any study on `main` (checked: no committed study reads
`usdmxn`, `usdzar`, `usdsek`, `usdnok`, `usdsgd` or `usdpln` from `research/daily/`).

## Markets: fixed before any return is read
council-data `research/daily/<key>.json` (OANDA mid daily candles, complete UTC days), `_index.json` status `ok` for all nine
candidates, last candle 2026-11-06. The list is fixed here, with the reason for each:

| Pair | First candle | In the judged basket | Why |
|---|---|---|---|
| USD/MXN | 2002-05-07 | **yes** | free float, liquid |
| USD/ZAR | 2002-05-08 | **yes** | free float, liquid |
| USD/SEK | 2004-06-01 | **yes** | free float |
| USD/NOK | 2003-09-02 | **yes** | free float |
| USD/SGD | 2002-05-08 | **yes** | managed float against a trade-weighted band, but moves freely inside it and has a full history |
| USD/PLN | 2004-06-01 | **yes** | free float |
| USD/HKD | 2004-01-19 | no, dropped | pegged inside 7.75-7.85: a dollar move cannot show; its ATR is a few pips, so 1R is spread-sized |
| USD/TRY | 2007-02-16 | no, **reported only** | extreme carry (policy rates up to 50 %), a currency that lost most of its value in crises (2018, 2021) with capital-flow measures; its drift and carry would dominate an equal-weight basket, and it starts in 2007. Reported per pair with its carry charged, never in the verdict |
| USD/CNH | 2011-02-07 | no, **reported only** | managed against a daily fixing, and starts 2011 (keeping it would cut six years off the span). Reported per pair, never in the verdict |

**The judged basket is six legs: USD/MXN, USD/ZAR, USD/SEK, USD/NOK, USD/SGD, USD/PLN**, equal weight, every leg long the US
dollar (long the pair, all quoted USD/xxx).

## Code shared with #975 (copied byte for byte, not edited)
`research/edge/fx-us-holiday/run.mjs`, `rates.json` and `swaps.json` from `origin/fx-us-holiday` are copied beside this file as
`fx-us-holiday-run.mjs`, `rates.json`, `swaps.json` (the copied script reads its two json files from its own folder; same
folder depth, so its `../../../council/fills.mjs` and `../../../ict/calendar.mjs` imports resolve to the same files). The test
pins the sha256 of each copy against the branch. From it this study imports, unchanged: the NYSE calendar (`dayKind`,
`isTradingDay`, `holidayEvents`: P = last NYSE trading day before a full holiday, **A = the first NYSE trading day after it**;
unscheduled closures are neither trading days nor holidays; an A shared by two holidays is traded once), `fold`
(`foldWeekend`, Saturday / Sunday folded into Monday), `atr`, `nightsOf` (three rollovers on a Wednesday UTC candle), the
statistics (`mean`, `tOne`, `monthSums`, `welch`, `rng`), and the USD policy-rate path (`rateAt('usd', …)` on `rates.json`).

## Data, and which close is used
- **The close is the UTC daily close (00:00 UTC = 19:00 New York, 20:00 in New York winter), not 17:00 New York**, as in #975:
  no intraday history of these pairs since 2005 is on file and the study uses no network.
- A **basket day** exists when all six pairs have a candle on that UTC date, all six share the same previous candle date, and
  every pair has an ATR(20). Nothing is dropped by hand.

## The trade (exactly #975's day-after hold)
- **Hold**: for each A, enter each leg at the close of the basket candle before A (the previous candle in the folded file; for a
  Monday holiday that is the holiday's own UTC candle, forex trades through US holidays), exit at the close of A's UTC candle.
  One candle held. Side: **long USD on every leg** (fixed, not learned).
- **Stop (absolute rule 1)**: 1.5 x ATR(20) below the entry, ATR = simple mean of the true range of the 20 folded candles ending
  at the entry candle. On the exit candle: an open at or below the stop fills at the open, otherwise a low at or below it fills
  at the stop. **1R** of a leg = 1.5 x ATR.
- **Costs (base)**, one round trip per leg as a share of the entry price. The demo broker (`ctrader/symbols.json`) does not
  quote these pairs, and no spread log of them is on file, so an **assumed conservative spread** is used, from the typical
  retail spreads brokers publish for these pairs (OANDA-style, written here from general knowledge, not measured, not fetched),
  set at or above the usual published typical figure: USD/MXN 0.05 %, USD/ZAR 0.10 %, USD/SEK 0.05 %, USD/NOK 0.05 %,
  USD/SGD 0.03 %, USD/PLN 0.06 %; reported only: USD/TRY 0.15 %, USD/CNH 0.04 %. Plus the demo's forex commission, round trip
  0.0045 % of notional (#975). Checks: cost 0 (no spread, no commission, financing kept), base, 2x (spread, commission and the
  financing markup doubled).
- **Financing**, #975's method for a pair the broker does not quote: per rollover `(rate USD − rate of the other currency −
  markup) / 100 / 365` of the entry, rollovers per `nightsOf` (one, three on a Wednesday candle), markup 1 % a year (2 % at 2x
  cost). A long-USD leg against a higher-yielding currency (MXN, ZAR, TRY, PLN for most years) therefore **pays** the carry.
  Holiday value-date days are not modelled (as #975).
- **Rate table** (`rates-exotic.json`, written with this file): the USD path is #975's `rates.json` decisions. The other
  currencies are **annual approximate policy rates, from memory, not fetched** (the central banks' hosts and FRED are refused
  by the build network), one figure per calendar year applied to every rollover of that year: Banxico overnight target (MXN),
  SARB repo (ZAR), Riksbank policy rate (SEK), Norges Bank policy rate (NOK), 3-month SIBOR / SORA as Singapore has no policy
  rate (SGD), NBP reference rate (PLN), CBRT one-week repo / average funding (TRY), PBoC one-year lending rate / LPR (CNH,
  whose offshore rate swings far from it at times). Each line names the source to check it against. An error of a point or two
  in one year moves a one-night carry by about 0.005 % of price, small next to the costs; for TRY it is larger and said so.
- **Leg results**: net % = (exit − entry) / entry − cost + financing; R = % x entry / 1R. **Basket** % and R = mean of the legs.

## Window
One window, all of it unread for these pairs: every A from **3 January 2005** to the last A whose exit candle is on file. Halves
by date: **2005-01-03 to 2015-12-31** and **2016-01-01 to the end**.

## Tests (one observation = one holiday's basket)
- **T1**: mean net basket R at base cost > 0 with **event t >= 2** (one-sample t, one observation per A) **and month-sum t >= 2**
  (sum of the net R of the events in each calendar month that has one; one-sample t over those months).
- **T2**: mean net basket R at 2x cost > 0.
- **T3, placebo**: 40 seeds (1 to 40, #975's generator). Ordinary days = basket days whose date is an NYSE trading day, not a P
  and not an A. For each seed and calendar year, draw as many ordinary days as the rule traded A days that year (uniform, with
  replacement), each traded exactly like the rule (long USD, the same stop, costs and financing). Passes when the rule's mean net
  R is above the seed's in at least 38 of 40 seeds (95 %).
- **T4**: mean net basket R at base cost > 0 in each half.
- **Verdict PASS** when T1 to T4 all hold; else **FAIL**. A FAIL means #975's side observation does not carry to other dollar
  pairs. A PASS would be a hypothesis supported on two sets of markets, still paper only; a proposal (a paper shadow, never a
  live change) would need the owner.

## Reported only, not judged
Per pair (the six, and USD/TRY and USD/CNH on their own spans): n, net R, t. Per holiday type, cost 0, leg stops, Welch t of the
gross basket % on A days against ordinary days, and the basket's gross / financing / cost split.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict line first), `tests/fx-post-holiday-replicate.test.mjs` (offline). To repeat:
`node research/edge/fx-post-holiday-replicate/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`… full <dir>`.
