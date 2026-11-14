# Pre-registration: the bond month-end rule, frozen, on four other bond CFDs (14 Nov 2026)

Written and pushed **alone**, before any number of this study is computed. A replication of a frozen rule: no parameter, entry
day, hold, stop, cost or financing is changed. Research only: no rule, size, filter, stop, config, cost constant, council
member or mirror setting changes, whatever the outcome. Not an ICT study, not mixed with any council system.

## Why

`research/edge/bond-month-end` (branch `bond-month-end`, PR #939) bought the US 10-year (T1, `usb10y`) and 30-year (T2,
`usb30y`) Treasury CFDs at the close of the month's fourth-to-last US trading day (TD-4) and sold at the close of its last
(TD-1), stop 2 x ATR(20). FAIL, 0 of 2 (10-year +0.036R a trade net, t 0.77, n 130, 2016-26), but positive in both windows,
above the random-day placebo, and the 10-year's gross window (+0.107R, t 2.31) was the best of 18 three-day windows of the
month. `research/edge/bond-month-end-futures` (branch `bond-month-end-futures`, PR #943) re-costed the same trades at
Treasury futures cost: 10-year +0.088R, t 1.91, Holm 0.056, fails narrowly. The published mechanism (index extension: bond
index funds lengthen duration at month end) is not specific to the 10-year note. This study asks one question: does the
frozen rule hold on bond CFDs #939 did not judge?

## What was already seen (stated plainly, before anything is computed here)

#939 ran the same rule on these four markets as **cross-checks, reported and not judged**, and its RESULT.md prints them; they
were read before this pre-registration was written:
USB05Y 2016-26 net +0.035R (t 0.76), 2003-15 -0.005R; USB02Y -0.140R (t -2.68), -0.183R; DE10YB -0.004R (t -0.08), +0.045R;
UK10YB -0.017R (t -0.37), +0.044R (all at the CFD costs below, per trade). So the per-market rows of this study are not new
information, and the pooled test below is not a blind test: its likely sign can be guessed from those rows. This study's new
parts are the pre-registered pooled test as the judged question, the month-clustered pooling, the placebo on windows that are
not month end, the futures-cost rows, the local-holiday sensitivity and the Fisher combination. A reader should weigh it as a
formal replication of an already visible pattern, not as fresh out-of-sample evidence.

## The rule (frozen, never re-selected)

- `frozen.mjs` = #939's `research/edge/bond-month-end/run.mjs`, copied byte for byte from `origin/bond-month-end` (sha256
  `624ac805a9b361949906bf5e0c94e576433d2d019e2e3470f9b57f5d8f630144`, the same file #943 froze; pinned in the test). It is
  imported, never edited, and its `full` command is never run (it would write a result.json over this folder's).
- Its `MARKETS` table already lists the four markets (with their costs and calendars), so **no wrapper is needed to feed it
  other markets**: `runMarket(key, json)` is called for `usb02y`, `usb05y`, `de10yb`, `uk10yb`. The only code of this study
  around it: the pooling, the placebos below (the frozen draw rebuilt from its own exports, as #943 did, with an eligibility
  filter for the not-month-end placebo), the futures re-cost and the Fisher step. The frozen `runMarket` does not hand back its
  day table, so its preamble is rebuilt from the frozen exports (`calendar`, `isUsTradingDay`, `fromEnd`, `buildDays`,
  `windowTrades`) and checked against `runMarket`'s own trade rows (gate G3).
- Rule (frozen): long at the close of TD-4, exit at the close of TD-1; stop entry - 2 x ATR(20) on the trading-day bars, checked
  on every raw daily candle after the entry candle (an open at or below the stop fills at the open); one trade a month.

## Data

OANDA mid daily CFD candles from council-data `research/daily/<key>.json` at council-data commit
`f6288251e85eb98814514be7f32c667f4f0667e3` (the 7 Nov weekly cache #939 and #943 read; last candle 6 Nov 2026), read with
`git show`, no network, kept outside git. `_index.json` there lists all six bond keys with status ok:
`usb02y` (USB02Y_USD, from April 2003), `usb05y` (USB05Y_USD, April 2003), `de10yb` (DE10YB_EUR, March 2003), `uk10yb`
(UK10YB_GBP, June 2003); `usb10y` / `usb30y` for the gate.

## Gate (must hold, else the verdict is NOT MEASURABLE and nothing else is read)

- **G1**: `frozen.mjs` `runMarket` on `usb10y` and `usb30y` reproduces #939's published `result.json` `markets.usb10y` and
  `markets.usb30y` objects exactly (deep equality of every field), and `verdictOf` its `tests` block and verdict.
- **G2**: this study's placebo loop, run with the frozen net and no eligibility filter, reproduces #939's 40 placebo means on
  both markets.
- **G3**: the rebuilt day table gives, for each of the four markets, exactly the trade rows of `runMarket(key).trades`.
- Also recorded (not a gate, these were never #939's judged figures): the four markets' `runMarket` objects compared with
  #939's published cross-check objects.

## Trading days and month end

- US markets (`usb02y`, `usb05y`): the frozen US bond-market calendar (`usBondHolidays`: `council/datacheck.mjs` full holidays,
  its half days trading, Juneteenth from 2022, plus Columbus and Veterans Day and the NYSE special closures).
- `de10yb`, `uk10yb` (the frozen rule, used for every judged figure): **a trading day = a weekday with a candle in the file**;
  no local holiday calendar. The frozen code does this (`cal: 'file'`), so it is kept. Consequence, stated: if OANDA prints a
  candle on a Eurex or UK holiday, that day counts as a trading day and may shift TD-4 by a day in such a month; if it prints
  none, the day drops out, which is what a local calendar would do.
- **Local-holiday sensitivity (reported, NOT judged)**: the same rule on a local calendar, weekdays minus the exchange's full
  holidays (a trading day without its own candle has no close and a trade that needs it is skipped, as the frozen US rule does):
  - `de10yb` (Eurex fixed-income futures, from memory, not opened): 1 January, Good Friday, Easter Monday, 1 May, 24, 25, 26
    and 31 December.
  - `uk10yb` (ICE Futures Europe Long Gilt = English bank holidays, from memory, not opened): New Year's Day (observed),
    Good Friday, Easter Monday, early May (first Monday of May; 8 May in 2020), spring (last Monday of May; 4 June 2012,
    2 June 2022), summer (last Monday of August), Christmas and Boxing Day (observed), plus 29 April 2011, 5 June 2012,
    3 June 2022, 19 September 2022, 8 May 2023.
  Month end is counted on that calendar (TD-1 = the last trading day of the calendar month).

## Costs and financing (the frozen model, unchanged)

- Round trip as a share of the entry price, as fixed in #939's pre-registration (assumptions: no measured spread exists for
  these CFDs): usb02y 0.02 %, usb05y 0.03 %, de10yb 0.03 %, uk10yb 0.04 %.
- Financing: 3 % a year of the entry price on the long, per calendar night, always charged (#939's conservative assumption;
  source: none, a fixed figure; no broker financing rate history exists for these CFDs). Net R as the frozen `netOf`.

## Windows (frozen)

Decisive: trades entered January 2016 to the last complete month on file (October 2026). Replication: from the first month with
20 bars of history (2003) to December 2015.

## The primary test (one, pooled over the four markets)

Pooled series, fixed now: for each calendar month, the **equal-weight mean of the net R of the four markets' rule trades
entered that month** (markets without a trade that month are left out of that month's mean). One value a month, so the four
same-day trades are not counted as four independent observations. Pooled mean of a window = the mean of its monthly values;
t = the one-sample t of the monthly values.

**#939's bar, verbatim, applied to that series** (the pool passes when ALL hold):
1. mean net R > 0 in the decisive window AND in the replication window;
2. decisive one-sample t >= 2;
3. Holm at 5 % of the one-sided p of the decisive t (normal approximation, the frozen `pOneSided` / `holm`); with one primary
   test Holm is the p itself: adjusted p < 0.05;
4. random-day placebo, #939's design: 40 seeds (1 to 40); per market the frozen draw (per decisive year as many trades as the
   rule took, entry on a US / file trading day of that year drawn by the frozen `rng(seed)`, three-day hold, same stop, costs
   and financing); the pooled placebo mean of a seed = the mean of the four markets' seed means. The pool's decisive mean must
   be above the 95th percentile of the 40 pooled seed means.

**Verdict (fixed wording)**: **REPLICATES** when the pool passes all four; **DOES NOT REPLICATE** when it fails any;
**NOT MEASURABLE (inconclusive: <why>)** when the gate fails or a market's data cannot be read.

## Secondary (reported, NOT judged; no secondary can change the verdict)

- Per market: #939's per-trade bar (decisive and replication net, t, placebo), with Holm over the four markets' one-sided p.
- Each at 0 x, 1 x (base) and 2 x costs and financing; worst drawdown of cumulative net R (per market, per-trade order; pool,
  monthly series), decisive window.
- Per-trade pooled t (all trades of the four markets as one sample), beside the monthly t, to show the clustering effect.
- **Not-month-end placebo** (as asked): 40 seeds (1 to 40), the frozen draw restricted to entries whose three held days are none
  of the month's TD-3, TD-2, TD-1, i.e. entries at TD-k for k = 2 to 6 are not eligible (TD-1 entries, holding the next
  month's first three days, are eligible); per market and pooled as above. Reported against the pool's decisive mean.
- **At futures cost** (#943's method: futures net R = frozen gross R - round-trip futures points / the trade's own CFD stop
  distance, financing zero, one CFD point taken as one futures point), at 0 x, 1 x, 2 x:
  | CFD | Future | Tick (points of par) | Fees + commission a round trip | Round trip (points) |
  |---|---|---|---|---|
  | usb02y | ZT (CBOT 2-Year, $200,000 face, 1 pt = $2,000) | 1/8 of 1/32 = 0.00390625 | 2 x $1.85 = $3.70 = 0.00185 pt | 0.00575625 |
  | usb05y | ZF (CBOT 5-Year, $100,000, 1 pt = $1,000) | 1/4 of 1/32 = 0.0078125 | $3.70 = 0.0037 pt | 0.0115125 |
  | de10yb | FGBL (Eurex Euro-Bund, EUR 100,000, 1 pt = EUR 1,000) | 0.01 | EUR 3.70 = 0.0037 pt | 0.0137 |
  | uk10yb | Long Gilt (ICE, GBP 100,000, 1 pt = GBP 1,000) | 0.01 | GBP 3.70 = 0.0037 pt | 0.0137 |
  One tick of bid / ask is paid once a round trip (the candles are mid prices). The ticks are the exchanges' published minimum
  ticks, **from memory, not opened** (CME, Eurex and ICE hosts are not reachable from the build sandbox); the fees reuse #943's
  $1.00 + $0.85 a side, assumed equal in EUR and GBP for the European contracts (not measured). The CFD-point = futures-point
  mapping is the main weakness (OANDA's CFDs are quoted in points of par near the front futures' levels but are not proven to
  be the futures price; the Bund and Gilt CFDs may track the cash bond); the 2 x row covers a mapping error up to two.
- The local-holiday calendar row for `de10yb` / `uk10yb`.

## Fisher combination (as `multiple-testing-update` defines it)

Fisher's method, -2 sum ln p on 2k degrees of freedom, over: (a) #939's 10-year decisive cell, one-sided p of its decisive net
t (`pOneSided(0.77)`, the frozen function on the published t), and (b) this study's pooled decisive one-sided p. The
instruments are disjoint (none of the four markets is the 10-year note), but the **calendar days are the same** (2016-26 month
ends) and US yields move together, so the two p's are positively dependent: the Fisher p assumes independence and is therefore
**too small, an upper bound on the combined evidence**, never a confirmed figure. Compared with the family's Bonferroni line of
`multiple-testing-update` (0.05 / 333 = 1.50e-4). The 30-year cell is not combined (it was T2 of the same study; one cell per
original study, the cell the replication was motivated by). A combined p for a gross effect would not be a net edge.

## After

`run.mjs`, `result.json`, `RESULT.md` (verdict first; the gate; the tables; the placebos; Fisher; departures),
`tests/bond-month-end-replicate.test.mjs` (offline: the sha256 pin, the pooling and Fisher on hand-made numbers, the report
against result.json). No proposal is written whatever the verdict (a replication alone changes no live rule; absolute rule 3).
Never call anything an edge without n and t.
