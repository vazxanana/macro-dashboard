# Pre-registration: Turnaround Tuesday on the years neither study used (14 Nov 2026)

Written and pushed alone, before any return of this study is computed. Before writing it, only the FIRST candle date the
candle proxy serves for each market was read (one request per market, no prices used), plus the first dates of council-data
`research/daily/_index.json`. Research only: no rule, size, filter, stop, config or council member changes, and no proposal
follows whatever the verdict. Not an ICT study.

## Why
`turnaround-tuesday` (branch `turnaround-tuesday`, PR #857) passed one cell of four: NAS100, the week's first session down more
than 1 % close to close (R2) → buy that close, sell the next session's close, stop 2 x ATR(20): 2016-now +0.098R a trade net,
t 2.33, n 81. `turnaround-replicate` (#862) ran the frozen rule on six other index CFDs (US30, US2000, DE40, EU50, UK100,
JP225) over the SAME calendar years (2008-now, decisive 2016-now) and failed its bar (pool +0.052R, month-sum t 1.69).
`multiple-testing-update` lists the hypothesis as having **no replication on years the original never used** (its "all cells"
Fisher p 0.0039 counts the same years again). This study is that replication: the frozen rule on the same eight index CFDs over
the years BEFORE both studies' windows.

## The rule, frozen
- `frozen.mjs` = `research/edge/turnaround-tuesday/run.mjs` of branch `turnaround-tuesday`, byte for byte, the file #862 froze
  under the same name: sha256 `74527d362f9d65c996cdd4df25abadbbc6b723b9aa49141d6a29c88b19693871` (pinned in the test, never
  edited).
- `replicate.mjs` = `research/edge/turnaround-replicate/run.mjs` of branch `turnaround-replicate` (commit c3586b7aa), byte for
  byte, sha256 `61cb6424546a299e3fd8f626c72a1f2cc0ec1f57a422bc438e2a9d4c263d4b18` (pinned): its local calendars, closes,
  `buildDaysAt`, pooling and month-sum t. Never edited.
- Rule R2, stop 2 x ATR(20), entry at the local close of the week's first trading day, exit at the next trading day's close,
  costs and financing as frozen (SPX500 0.04 %, NAS100 0.05 %, the six others as #862's `MARKETS`).

## Gate (before any early-year figure is read)
Run #862's `study()` from `replicate.mjs` on this study's candles cut to start 1 Oct 2007 (#862's fetch start) and its
`rates.json`: it must reproduce #862's published pool exactly (2016-now n 411, net +0.052R a trade, month-sum t 1.69, trade
t 2.63) and each market's 2016-now n and net R. Also reported: #857's NAS100 R2 cell (n 81, +0.098R, t 2.33) through the frozen
`study()`. A gate miss stops the study (NOT MEASURABLE: gate).

## The replication window, and the floor (fixed now)
- **Data**: OANDA mid H1 via `/md/bars` (`fetch.mjs`, kept out of git). The proxy serves no index candle before **21-24 March
  2003** (SPX500, NAS100, US30, US2000, UK100: first candle 21 Mar 2003; DE40 24 Mar 2003; JP225 13 Mar 2003; **EU50 2 January
  2004**). The council-data daily cache starts on the same dates (14-25 Mar 2003; EU50 22 Sep 2003): no other source is used.
- Both studies' windows start with entries in January 2008 (their candles from 1 Oct 2007 serve only the ATR warm-up), so the
  years never used are entries **from the first possible entry to 31 Dec 2007**. The first possible entry needs 20 completed
  local days with closes before it (frozen `atrAt`), so it falls about **22 April 2003** on the US markets and later elsewhere.
- **JP225**: #862 found no Tokyo-hours candles on OANDA before mid-2010, so it has no close on any early day: excluded here.
- **Floor**: the brief sets "fewer than about 5 years available → NOT MEASURABLE". Measured as the span from the earliest
  first possible entry of any market to 31 Dec 2007: about **4.7 years** (22 Apr 2003 → 31 Dec 2007; 4.0 years on EU50). That is
  under 5 years. **Pre-registered decision: the study stops as NOT MEASURABLE**; no trade of the rule on 2003-2007 is computed
  and no return of those years is read. `run.mjs` only (a) runs the gate and (b) measures, per market and year 2003-2007, the
  local trading days, the days with a close candle and the first possible entry, to state the span exactly (counts of candles,
  never prices or returns). If that measured span were 5.0 years or more (it cannot be, given the first candle dates above),
  the tests below would apply instead.

## Tests that would have applied with 5 years or more (stated for the record, not run)
- Primary: the equal-risk pooled book of the markets with closes, frozen rule and costs: net R a trade > 0, calendar-month-sum
  t >= 2, still positive at 2x cost, and positive at the demo broker's measured index cost (`cost-floor-map`'s reading of
  council-data `ctrader/symbols.json`). Secondary: per market with Holm, 0 / base / 2x cost, worst drawdown. Placebo: 40 seeded
  runs on random weekdays, same holding and exits. Fisher (as `multiple-testing-update` defines it, -2 sum ln p, one-sided
  p = 1 - Phi(t)): the original's p 0.0099 with this study's pooled p (calendar-disjoint); #862 added only as the upper bound.

## Verdict wording
REPLICATES / DOES NOT REPLICATE / NOT MEASURABLE (with "(inconclusive: …)"). Expected under this pre-registration: **NOT
MEASURABLE (inconclusive: about 4.7 years of candles before 2008, under the 5-year floor)**. The hypothesis then keeps no
replication on years the original never used, and the multiple-testing ledger's reading stands unchanged.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/turnaround-early-years.test.mjs` (offline), rebuilt `out/`.
