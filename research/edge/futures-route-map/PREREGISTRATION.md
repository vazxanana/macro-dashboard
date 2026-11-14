# Futures route map: which cost-blocked tests of the 13-14 Nov studies would clear their own bar at exchange-futures cost (pre-registration)

Written and pushed **alone**, before `collect.mjs`, `run.mjs`, `collected.json`, `result.json` or any futures figure of this
study exists. Written 14 Nov 2026. **Accounting, not a test**: no market data is fetched, no rule is run or changed, no study's
own file is edited, and no row of it may be called an edge. Nothing live changes. **The council's demo accounts trade CFDs
only (absolute rule 2): no route, account or broker change is proposed, whatever comes out.**

## Why

Many studies of 13-14 Nov found an effect that is there before costs and is taken away by a CFD spread and overnight
financing. `cost-floor-map` (#948) ranked the 134 positive-gross decisive tests by the cost at which each loses t 2. Three
studies re-costed single effects at exchange-futures cost (`index-futures-cost` #900, `bond-month-end-futures` #943,
`bond-month-end-replicate`). The question here, asked once over all of them: of the tests blocked only by cost (and those
already at net t >= 2), which would clear their own pre-registered bar at the published exchange-futures cost of the
equivalent contract, and does any family of effects survive as a whole?

## 1. Which tests (fixed now)

Sources, read with `git show origin/<branch>:…` (no network): `cost-floor-map` `research/edge/cost-floor-map/result.json`
(`ranked`), each study's own `result.json` on its own branch, `index-futures-cost` (`rows.json.gz`, `result.json`),
`bond-month-end-futures`, `bond-month-end-replicate`, `multiple-testing-update` (`collected.json`, `result.json`).

- **The 43 tests** of cost-floor-map's ranked table with class `cost-blocked` (gross t >= 2, net t < 2: 31) or `net-t2` (net
  t >= 2 at the study's own cost: 12), as cost-floor-map lists them (study, test, decisive object, n, gross, net, t's, s).
- **One addition**, named by the brief: `bond-month-end-replicate`'s pre-registered primary pooled test (US 2-year, US
  5-year, Bund, Gilt, one equal-weight value a month, decisive 2016 to October 2026; its gross t 2.66 and CFD net t -0.81
  make it cost-blocked by the same definition). It is outside cost-floor-map's scope (#815-#943), so it is added by name.
- Nothing else. The 91 "unproven at any cost" rows (gross t under 2) cannot reach t 2 at any cost by the same constant-cost
  rule and are not re-costed. A study's own label for an instrument is read from its own result.json; where cost-floor-map's
  short instrument label disagrees with the study (for example `bond-lead-intraday`, which trades gold and USD/JPY), the
  study wins and the difference is listed.

## 2. The futures equivalent of each instrument (fixed now, before any figure)

| CFD / spot instrument | Futures route | Tick | Value | Fee + commission a side | Source |
|---|---|---|---|---|---|
| SPX500 / US500 | CME Micro E-mini S&P 500 **MES** | 0.25 pt | $5 a point | $0.62 | `index-futures-cost` (#900) fee table (its source: `research/edge/costs/RESULT.md`, "$1.24 round-trip commission and fees") |
| NAS100 | CME Micro E-mini Nasdaq-100 **MNQ** | 0.25 pt | $2 a point | $0.62 | #900 |
| US30 | CBOT Micro E-mini Dow **MYM** | 1 pt | $0.50 a point | $0.62 | #900 |
| US2000 | CME Micro E-mini Russell 2000 **M2K** | 0.1 pt | $5 a point | $0.62 | tick and value **assumed** (from memory, not opened); fee = #900's micro fee |
| DE40 | Eurex Mini-DAX **FDXM** | 1 pt | EUR 5 a point | EUR 1.00 | **assumed** |
| EU50 | Eurex Euro Stoxx 50 **FESX** | 1 pt | EUR 10 a point | EUR 1.00 | **assumed** |
| UK100 | ICE FTSE 100 **Z** | 0.5 pt | GBP 10 a point | GBP 1.00 | **assumed** |
| JP225 | OSE Nikkei 225 mini | 5 pt | JPY 100 a point | JPY 150 | **assumed** |
| Gold (XAU) | COMEX Micro Gold **MGC** (10 oz) | $0.10 an ounce | $10 a $1 move | $1.06 ($2.12 a round trip) | tick and value: `council/futures.mjs` on `main` (`pv: 10, tick: 0.1`); fee: `research/edge/gold-carry/RESULT.md` ($2.12 all-in a round trip, its own dated search sources) |
| US 2-year (USB02Y) | CBOT **ZT** ($200,000 face) | 1/8 of 1/32 pt = 0.00390625 | $2,000 a point | $1.85 | `bond-month-end-futures` (#943) fee lines ($1.00 fees + $0.85 commission a side); tick as `bond-month-end-replicate` (from memory, not opened) |
| US 5-year (USB05Y) | CBOT **ZF** ($100,000) | 1/4 of 1/32 = 0.0078125 | $1,000 | $1.85 | as above |
| US 10-year (USB10Y) | CBOT **ZN** ($100,000) | 1/2 of 1/32 = 0.015625 | $1,000 | $1.85 | #943 |
| US 30-year (USB30Y) | CBOT **ZB** ($100,000) | 1/32 = 0.03125 | $1,000 | $1.85 | #943 |
| Bund (DE10YB) | Eurex **FGBL** (EUR 100,000) | 0.01 | EUR 1,000 | EUR 1.85 | `bond-month-end-replicate` (tick from memory, not opened; fee #943's, assumed in EUR) |
| Gilt (UK10YB) | ICE **Long Gilt** (GBP 100,000) | 0.01 | GBP 1,000 | GBP 1.85 | as above, in GBP |
| EUR/USD | CME **6E** (EUR 125,000) | 0.00005 | $6.25 | $2.50 | tick and size from memory, not opened; **fee assumed** ($1.65 exchange, clearing and NFA + $0.85 commission) |
| GBP/USD | CME **6B** (GBP 62,500) | 0.0001 | $6.25 | $2.50 | as 6E |
| AUD/USD | CME **6A** (AUD 100,000) | 0.00005 | $5 | $2.50 | as 6E |
| NZD/USD | CME **6N** (NZD 100,000) | 0.00005 | $5 | $2.50 | as 6E |
| USD/CAD | CME **6C** (CAD 100,000, quoted USD per CAD) | 0.00005 | $5 | $2.50 | as 6E |
| USD/CHF | CME **6S** (CHF 125,000, quoted USD per CHF) | 0.00005 | $6.25 | $2.50 | as 6E |
| USD/JPY (every yen-pair test that trades USD/JPY) | CME **6J** (JPY 12,500,000, quoted USD per JPY) | 0.0000005 | $6.25 | $2.50 | as 6E. **6J, not MJY**: MJY (JPY 1,250,000, tick 0.000001) has twice the relative tick and did not exist before 2019 |
| USD/CNH | CME **USD/Offshore RMB (CNH)** (USD 100,000, quoted CNH per USD) | 0.0001 | CNH 10 | $2.50 (converted at the price) | from memory, not opened; a thinly traded contract (said with the figure) |
| BTC, ETH | CME **Micro Bitcoin MBT** (0.1 BTC, tick $5 a BTC), **Micro Ether MET** (0.1 ETH, tick $0.50 an ETH) | as named | | $3.35 | **assumed** (from memory, not opened) |
| Forex crosses (EUR/JPY, EUR/GBP, EUR/CHF, AUD/JPY, GBP/JPY, GBP/AUD, EUR/AUD, CAD/JPY, NZD/JPY, AUD/NZD, AUD/CAD, …) | **no route** | | | | the brief's rule: no liquid listed future can be relied on; a one-tick-a-side assumption on a thin cross contract is not credible. Two legs through the dollar futures would double the cost and is not done |

**Cost a round trip on futures (one rule for every route):** one tick of slippage **a side** (2 ticks a round trip, also on a
limit or target exit: kept simple and conservative), plus the fee and commission a side, twice. **No financing** (a future's
carry is in its price; the stated weakness: for indices the carry is (r - q), for crypto the basis can be several % a year,
for bonds coupon minus repo; none is charged, as the brief fixes). **No roll charge** (holds are hours to two weeks; a roll
inside a hold is said where the study's hold could cross one, not charged). As a fraction of price, with Q the future's own
price, tau its tick in price units, M its size in its quoted unit:

  F = 2 x (tau + fee / (point value)) / Q   (an index, gold or bond: point value in currency a point)
  F = 2 x (tau + fee / M) / Q                (a currency future quoted in USD per unit of the currency: 6E, 6B, 6A, 6N, 6C, 6S, 6J;
                                              for a pair quoted the other way round (USD/JPY, USD/CAD, USD/CHF) Q = 1 / price,
                                              and the fraction of price is the same)
  F = 2 x (tau + fee x P / 100,000) / P      (USD/CNH, quoted CNH per USD)

This departs from #943 on purpose: #943 charged one tick a ROUND TRIP on Treasuries (half a tick a side from mid prices); the
brief fixes one tick a SIDE for every route. #943's own published figure is shown beside the re-cost and both are named.
#900's micro index figures included a carry line (r - q); here it is left out (no financing), and #900's own figure is shown
beside.

**Reference price (where a figure is needed as a fraction of price and the study stores no per-trade price):** the median
daily close of the instrument over the test's decisive window, from council-data `research/daily/<key>.json` at commit
`808e419b20a014f0cf0b28041a036fdb1c766e58` (read with `git show`, no network). The CFD side's round trip C (the study's own
transaction cost: spread, slippage, commission; never financing) is turned into a fraction of price at the same reference
price, so F / C does not depend on the level.

## 3. Re-costing (fixed now)

Entries and exits do not depend on the cost (as `weekend-reopen-cost` showed): the gross of every trade is the study's own.

**(A) Per trade**, where the study stores a trade list with entry and stop (or #900's rows): futures cost of a trade = F(entry)
x entry / |entry - stop| in R (or F x 100 in % of price), futures net = the trade's own gross minus it; the t is computed in
the study's own form (trade t, month-sum t over months with a trade, or over every calendar month of the window, whichever
the study judged on). **Gate:** the same code on the same list must reproduce the study's published decisive n, mean gross,
mean CFD net and net t (to the published decimals, t within 0.02). A list that fails its gate falls back to (B), and says so.
Tests: index-overnight T1, T2 and index-ibs T2 (#900's rows: ticks and commission only, no carry), bond-month-end USB10Y,
bond-month-end-replicate pool, cb-days-other pooled, pre-fomc-drift SPX500, turnaround-tuesday NAS100 r1 / r2 and
turnaround-replicate pooled (their tuples store gross %, net % and net R a trade, from which the stop as a fraction of price is
net % / net R; the futures cost uses the reference price of the window: labelled).

**(B) Constant cost (cost-floor-map's approximation), labelled "approx" on every row.** The study's transaction cost a trade
in R (`trans`, never financing) is read from the study: a field the study names (spreadR, costR where it charged no financing,
costR beside a stored finR), or net minus net-at-twice-the-transaction-cost (net - net2) where that is how its 2 x row is
built, or cost charged when the study charged no financing. Futures cost a trade = trans x F / C, with F and C at the
reference price; for a test over several instruments, the mean of F / C over its instruments weighted by the per-instrument
n where the study stores it, else equal weights (said). Futures net = gross - futures cost (financing dropped). Futures t =
futures net / s, with s cost-floor-map's own scale for the row (mean per unit of t). In % units: futures cost = 100 x F at
the reference price (mean over instruments as above), futures net = gross % - that.
- A test whose transaction cost cannot be separated from its financing is "cannot be re-costed", with the reason, never
  estimated.

**(C) No route**: a test any of whose instruments has no route in section 2 (a cross, or a pooled test that includes one).
Not re-costed. Listed with the instrument that blocks it.

## 4. The bar

- **Step A (the cost-dependent core every study's bar shares):** decisive futures net > 0 AND decisive futures t >= 2 (the
  t in the study's own form, or the approximation).
- **Step B (the rest of the study's own pre-registered bar, condition by condition, only for tests that pass Step A):** each
  condition is read from the study's own result.json / RESULT.md; a condition that does not depend on cost (n, gross-only
  checks, a before-cost comparison) is carried over as published; a condition that depends on cost is re-costed by the same
  method: the replication window's net (its own gross minus its futures cost), Holm within the study (its tests' futures p
  where re-costed, the published p otherwise), a placebo threshold shifted by the change in cost a trade (the placebo trades
  pay the same constant cost; for #900's tests, #900's own re-costed placebo), and a 2 x cost row (gross minus twice the
  futures cost). A condition that cannot be computed from stored figures is "not computable", and a test with one is not
  counted as passing. For #900's tests (index-overnight, index-ibs) #900's own futures bar is used and its carry line said.
- **"Would pass at futures cost"** = Step A and every Step B condition met.

## 5. Multiple testing (the counting rule of `multiple-testing-update`, unchanged)

- Roles as `multiple-testing-update` assigned them: **family** (a new hypothesis), **replication** (#889, #862, #928, #938,
  #920, #924; and `bond-month-end-replicate`, its own words), **robustness** (#894, #912, #908, #915, #937). One-sided p = 1 -
  Phi(t) in the pre-registered direction, from the futures t.
- **Primary:** Holm at 0.05 and Benjamini-Hochberg (q 0.05 and 0.10) over the **re-costed family tests** (N_r = every family
  test that has a futures t; "no route" and "cannot" rows are out). The same counts at the CFD cost beside it.
- **Sensitivity (shown, not judged):** (i) the same over every re-costed test including replication and robustness rows;
  (ii) in the full family of `multiple-testing-update` (N = 333): each re-costed family test's p replaced by its futures p,
  every other test's p as stored, Holm and BH counts.
- **Families (fixed now):** index overnight (overnight-drift NAS100 / SPX500, index-overnight T1 / T2); index short-term
  reversal (index-ibs T2, rsi2-pullback SPX500 / US30, turnaround-tuesday NAS100 r1 / r2, turnaround-replicate pooled,
  vol-spike-rebound 5 / 10-day); index intraday breakout and momentum (orb-nas100 NAS100 / SPX500, index-midday-turn T2,
  nr7-breakout B); scheduled-event drift (pre-fomc-drift SPX500, cb-days-other pooled); FX fixes (wmr-fix-reversal T1 / T3,
  ecb-ref-fix T1 / T2, cnh-fix T2); gotobi (gotobi T1-T4, gotobi-replicate R2, gotobi-feed, gotobi-minute-histdata; R1 has no
  route); cross-asset lead and session drift (bond-lead-intraday T1-T3, gold-session-drift T2, eth-btc-ratio test 1); bond
  month-end (bond-month-end USB10Y, bond-month-end-replicate pool); weekend gap (fx-weekend-gap G, -replicate R1,
  -replicate2 S1 / S2: all no route); London opening range (fx-london-orb F1 / F2: no route).
- **Family as a whole:** the Stouffer z of its re-costed family-role tests' futures t's (sum / sqrt k; tests of one family
  share days and markets, so this is an upper bound on the evidence, said), one-sided p, Holm across the families that have
  at least one re-costed family test. A family "survives as a whole" when its Holm-adjusted Stouffer p < 0.05. Replication
  rows are shown beside, never added to the Stouffer sum.

## 6. Verdict wording (fixed)

**"ROUTE-SENSITIVE: n tests would pass at futures cost (Holm k)"** when n >= 1 (n = tests meeting Step A and B; k = family
tests surviving the primary Holm at futures cost), else **"NOT ROUTE-SENSITIVE"**. Either way RESULT.md says plainly: this
is accounting on the same history each rule was judged on; a route chosen after seeing the CFD loss is not evidence of an
edge; nothing here is called an edge; the demo accounts trade CFDs only and no route change is proposed.

## 7. Files

`PREREGISTRATION.md` (this, pushed alone first); `collect.mjs` (reads the branches with `git show`, writes `collected.json`:
every input this study uses, including the per-trade fields of section 3 A and the reference prices); `run.mjs` (offline,
reads only `collected.json`, writes `result.json` and `RESULT.md`); `tests/futures-route-map.test.mjs` (offline, node:test,
against the committed `collected.json`: the cost formula on hand-made contracts, the gates, the counting, RESULT.md against
result.json).
