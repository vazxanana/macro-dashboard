# Pre-registration: the US dollar on the day AFTER a US market holiday, read on dollar-priced metals (14 Nov 2026)

Written and pushed alone, before any candle of this study is read (only `research/daily/_index.json`, which holds row counts and
dates, was looked at). Research only, paper only: no rule, size, filter, stop, config, council member or mirror setting changes.

**Not a gold-book test.** This is a standalone calendar study of one dollar hypothesis read on metals. It is not a gate, exit,
entry or size for Gold trend, Gold trend fast, Gold daily engulf or any other gold system, and nothing here will be proposed as
one (owner item 44 stands: no new gate / exit / entry / size test on the gold book's systems over 2006-17). Not an ICT study
(`ict/calendar.mjs` is only read for its holiday dates, through the copied code below).

## Why, and what is checked
- `research/edge/fx-us-holiday/` (branch `fx-us-holiday`, PR #975) reported one side observation, "reported only, never judged":
  long the US dollar against the seven majors on the **first NYSE trading day after a US market holiday** made +0.089R a holiday
  out of sample 2015-26 (n 110, event t 2.65) but −0.004R in sample 2005-14 (n 88, t −0.10).
- `research/edge/fx-post-holiday-replicate/` (branch `fx-post-holiday-replicate`, PR #980) tested it frozen on six exotic dollar
  pairs: gross +0.075R a holiday (Welch t 2.72 against ordinary days) but **+0.026R net (t 1.00) after assumed spreads, first half
  negative: FAIL**.
- Here: the same frozen day-after rule, a second out-of-sample check, on **dollar-priced metals neither study read**. A dollar
  rise means metals priced in dollars fall, so the side is **SHORT XAU/USD and XAG/USD** (fixed by the hypothesis, not learned).
- Checked that this was not run before: no study on `main` or on the branches `pre-holiday`, `fx-us-holiday`,
  `fx-post-holiday-replicate`, `drd-metals-book`, `metals-intraday-momentum`, `metals-rsi2` tests the day after a US holiday on a
  metal (`pre-holiday` is the day BEFORE, on US indices; `seasonality` uses holidays only to define trading days; `gold-weekend`
  is the weekend fold).

## Markets: fixed before any return is read
council-data `research/daily/<key>.json` (OANDA mid daily candles, complete UTC days), `_index.json` status `ok` for all four,
last candle 2026-11-06.

| Market | First candle | In the judged basket | Cost a round trip (base) |
|---|---|---|---|
| XAU/USD | 2006-03-20 | **yes**, short | $0.30 an ounce (the repo's gold studies, `gold-systems`, `supported-book`) |
| XAG/USD | 2006-03-20 | **yes**, short | $0.03 an ounce (`gold-drd-silver`) |
| XPT/USD | 2005-01-04 | no, **reported only** | assumed 0.30 % of price (no spread of it on file, written from general knowledge of retail quotes, not measured) |
| XPD/USD | 2005-01-04 | no, **reported only** | assumed 0.50 % of price (same) |

**The judged basket is two legs, SHORT XAU/USD and SHORT XAG/USD, equal weight in R.** The window asked for was 2005-now; gold
and silver daily candles start 2006-03-20, so the basket starts at the first day both have an ATR(20) (about April 2006). XPT and
XPD are reported alone on their own candles from 2005, never in the verdict.

## Code shared with #975 / #980 (copied byte for byte, not edited)
`research/edge/fx-us-holiday/run.mjs` and `rates.json` from `origin/fx-us-holiday` are copied beside this file as
`fx-us-holiday-run.mjs` and `rates.json` (the same copy #980 made: sha256 `ab7fac36…786c9` for the script; the copied script
reads `rates.json` from its own folder at load; `swaps.json` is optional there and is not copied; same folder depth, so its
`../../../council/fills.mjs` and `../../../ict/calendar.mjs` imports resolve to the same files). The test pins both sha256 against
the branch. From it this study imports, unchanged: the NYSE calendar (`dayKind`, `isTradingDay`, `holidayEvents`: P = last NYSE
trading day before a full holiday, **A = the first NYSE trading day after it**; unscheduled closures are neither trading days nor
holidays; an A shared by two holidays is traded once), `fold` (`foldWeekend`: Saturday / Sunday folded into Monday), `atr`,
`ymdOf`, and the statistics (`mean`, `tOne`, `monthSums`, `welch`, `rng`). The basket-day rule, the placebo and the A-day map are
#980's (`basketDays`, `placebo`, `postDays`), re-written for two legs with the same logic.

## Data, and which close is used
- **The close is the UTC daily close (00:00 UTC = 19:00 New York, 20:00 in New York winter), not 17:00 New York**, as in #975 and
  #980: no intraday history of these metals since 2006 is used and the study uses no network.
- Spot metals stop on some US holidays (Good Friday, 25 December, 1 January) and trade thin on others. The rule is unchanged: the
  entry is the close of the folded candle before A, whatever day that is.
- A **basket day** exists when both legs have a candle on that UTC date, both share the same previous candle date, and each has an
  ATR(20). Nothing is dropped by hand.

## The trade (exactly #975's day-after hold, short metals)
- **Hold**: for each A, enter each leg SHORT at the close of the basket candle before A, exit at the close of A's UTC candle.
  One candle held.
- **Stop (absolute rule 1)**: 1.5 x ATR(20) ABOVE the entry, ATR as `atr` (simple mean of the true range of the 20 folded candles
  ending at the entry candle). On the exit candle: an open at or above the stop fills at the open, otherwise a high at or above it
  fills at the stop (#975's `legDay` with side −1). **1R** of a leg = 1.5 x ATR.
- **Costs**: gold $0.30 and silver $0.03 a round trip (as a share of the entry, divided by 1R in price for R). Checks: cost 0, base,
  2x (the round trip doubled).
- **Financing**: `council/fills.mjs` `financing` / `nights` / `FIN`. A **short is credited nothing** by the repo's rule (`FIN.xau.short`
  = 0: the broker credits a short, the paper model does not) and silver has no measured rate (no `FIN.xag`), so the same treatment
  gives 0 for silver. Financing is therefore 0 on every leg; it is computed through the function, not assumed, and reported.
- **Leg results**: net % = −(exit − entry) / entry − cost + financing; R = net % x entry / 1R. **Basket** % and R = mean of the
  two legs.

## Window
One window, unread for this hypothesis on these markets: every A from the first basket day (2006) to the last A whose exit candle
is on file. Halves by date: **to 2015-12-31** and **from 2016-01-01** (#980's split).

## Tests (one observation = one holiday's basket)
- **T1**: mean net basket R at base cost > 0 with **event t >= 2** (one-sample t, one observation per A) **and calendar-month-sum
  t >= 2** (sum of the net R of the events in each calendar month that has one; one-sample t over those months).
- **T2**: mean net basket R at 2x cost > 0.
- **T3, placebo**: 40 seeds (1 to 40, #975's generator). Ordinary days = basket days whose date is an NYSE trading day, not a P and
  not an A. For each seed and calendar year, draw as many ordinary days as the rule traded A days that year (uniform, with
  replacement), each traded exactly like the rule (short both metals, same stop and costs). Passes when the rule's mean net R is
  above the seed's in at least 38 of 40 seeds (95 %). (Gold and silver rose over 2006-26, so a short loses on an average day; the
  placebo is what separates the holiday from that drift.)
- **T4**: mean net basket R at base cost > 0 in each half.
- **Verdict PASS** when T1 to T4 all hold; else **FAIL**. A FAIL means #975's side observation does not carry to the metals. A
  PASS would be a hypothesis supported on a second set of markets, still paper only; any paper shadow would need the owner, and it
  could never be a gate on a gold-book system (item 44).

## Reported only, not judged
Per leg inside the basket; XAU, XAG, XPT, XPD each alone on their own candles (n, net R at cost 0 / base / 2x, t); per holiday
type; leg stops; Welch t of the gross basket % (short) on A days against ordinary days; the gross / financing / cost split.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict line first), `tests/post-holiday-metals.test.mjs` (offline). To repeat:
`node research/edge/post-holiday-metals/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`… full <dir>`.
