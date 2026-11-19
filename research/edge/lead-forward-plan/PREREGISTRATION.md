# Pre-registration: what a forward paper record could show for each open lead, and how long it would take (14 Nov 2026)

**Kind: accounting / design study. No rule is tested, no rule is proposed, nothing live changes.** This file is committed
alone, before any figure of this study is computed. The verdict wording is fixed now: **"PLAN COMPUTED (no rule tested)"**.
Nothing in this study is, or will be called, an edge.

## Why

After about 140 studies, four leads are positive before costs but not proven after costs or not replicated:

| Lead | Studies (branches) | Where it stands |
|---|---|---|
| L1 gotobi fade (USD/JPY T2) | `gotobi` (#878), `gotobi-replicate` (#889), `gotobi-cost` | PASS on its own bar at an ASSUMED 1.3-pip cost; break-even 3.73 pips; the cost at 00:55 / 06:00 UTC was never measured |
| L2 forex Sunday-gap fade, rule G | `fx-weekend-gap` (#880), `fx-weekend-gap-replicate` (#928), `fx-weekend-gap-replicate2` (#938) | FAIL on Holm alone, then PARTLY twice; the reopen slippage (1 pip a side) is assumed |
| L3 bond month-end rise (10-year) | `bond-month-end` (#939), `bond-month-end-futures` (#943) | FAIL on CFD cost and at assumed futures cost (t 0.77 / 1.91) |
| L4 index overnight drift | `index-overnight`, `index-futures-cost` | gross month t 2.9-4.7 in two windows, negative after CFD spread and financing |

What decides each is the real cost at a specific minute, which history cannot supply. The only honest remaining test of
any of them is a forward paper record on the demo route. This study computes, for each lead, what such a record could
show and how long it would take, with the same arithmetic `research/proposals/2026-11-12-path-to-live.mjs` used for the
gold book. It does not start any record: a forward paper stream is a new rule and needs the owner (absolute rule 3).

## Inputs (fixed now)

Each lead's own decisive-window trade list, as its study stored it (read from the pinned commits below with `git show`;
`extract.mjs` writes `inputs.json`, which is committed so the rest is offline):

| Stream | Source (commit : path) | Window | Cost the study charged (= "1x") |
|---|---|---|---|
| **L1** USD/JPY T2 fade | `e07e5ca0` (gotobi-cost) : `research/edge/gotobi-cost/trades.json` `trades.usdjpy` | Tokyo days 2016-01-01 to the last stored day (2026-11-10) | the frozen `costPx`: 0.3 pip spread + 2 x 0.5 pip slippage + USD 22.5 per million a side, / the trade's stop D |
| L1b gotobi crosses pooled (GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY) | same file, the four crosses | 2010-01-01 to the last stored day | same formula |
| **L2** rule G, six majors (#880) | `4c198377` (fx-weekend-gap) : `research/edge/fx-weekend-gap/result.json` `trades.G` | weeks with Friday 2020-01-01 to 2026-11-12 | the base cost (gross R minus the stored base net R): quoted spread + 1 pip slippage a side + commission |
| L2b rule G, six new pairs (#938 S2) | `b70fc26f` (fx-weekend-gap-replicate2) : `.../result.json` `trades.S2` | weeks with Friday 2016-01-01 to 2026-11-06 | same |
| **L3** bond month-end, USB10Y CFD (#939 T1) | `10805734` (bond-month-end) : `research/edge/bond-month-end/result.json` `markets.usb10y.trades` | entries 2016-01 to 2026-10 | CFD spread + 3 % a year financing (gross minus stored net) |
| L3b the same trades at assumed ZN futures cost (#943) | the same trades; cost 0.0193 pt / (entry − stop), from `1e589f01` (bond-month-end-futures) `costModel` / `markets.usb10y.roundTripPts` | same | the futures round trip (no financing) |
| **L4** NAS100 overnight (index-overnight T2) | `96d99f7f` (index-futures-cost) : `research/edge/index-futures-cost/rows.json.gz` `overnight.tests.T2.rows` | dates 2016-01-01 to 2026-10-31 | CFD spread + financing (gross minus stored CFD net) |
| L4b US500 overnight (T1) | same file, `T1` | same | same |

Gates (each must reproduce, or the stream is reported as not reproduced and not used): L1 n 771, net +0.148R, month t
2.74; L1b n 4784, +0.099R, 2.75; L2 n 243, +0.194R, month t 2.14; L2b n 481, +0.153R, 3.19; L3 n 130, gross +0.107R, net
+0.036R, trade t 0.77; L3b net +0.088R, t 1.91; L4 n 2721, gross +0.026R, net −0.006R, month t −0.84; L4b n 2721, +0.023R,
−0.022R, −2.86 (each study's own t definition; tolerance 0.002R and 0.02 in t).

## Method (fixed now)

1. **Per trade**: gross R and charged cost c (in R) as above. **Cost grid** m = 0.5, 1, 1.5, 2: net = gross − m x c. The
   whole charged cost scales (spread, slippage, commission and, where charged, financing), because which part is wrong is
   the open question.
2. **Per stream and cost level**: n, trades a year (n / months of the window x 12), mean and sd of net R a trade, total.
3. **Months**: every calendar month from the window's first to its last month is a block, holding that month's trades in
   order (a month with no trade is an empty block, as a weekday with no position is a zero day in the path-to-live
   method). Months are keyed as each study keyed them (L1 Tokyo day, L2 Friday, L3 entry day, L4 the entry time's UTC date).
4. **Months to t 2**: with μ and σ the mean and sample sd of the monthly sums over ALL calendar months of the window,
   months = (2σ / μ)², only when μ > 0 (else "never: expected t is not positive"). Also from trades: n = (2 sd / mean)²
   trades, divided by trades a month. In the "no edge" and "losing" worlds the expected t is never positive: "never".
5. **Worlds** (as path-to-live, adapted to cost levels): *as measured* = the stream at that cost level; *no edge* = every
   trade's net minus that level's mean (mean 0); *losing* = every trade's net minus (that level's mean + |the 1x mean|),
   so the mean is minus the measured 1x magnitude. (For the gold book, whose mean is positive, these are path-to-live's
   1x and 2x shifts.)
6. **Bootstrap**: path-to-live's month-block bootstrap unchanged, **imported** from
   `research/proposals/2026-11-12-path-to-live.mjs` (sha256 `4d4d54fc8c4916b8c1802411822985b669405ca2aded83ef7b572eb2cf957665`
   on main today): `mulberry32`, `quant`, and `simulate` (20,000 draws, seed 12, months drawn with replacement, cumulative
   R and worst closed drawdown from the path's own high, the record starting at 0). This study adds the monthly-sum t of
   each path, computed in a copy of `simulate`'s loop that consumes the same random numbers; a test checks the copy's
   totals and drawdowns equal the imported `simulate`'s exactly.
7. **Horizons** 6, 12, 24, 36, 60 months; **protocol length 24 months**.
8. **Stop lines** (fixed from the *as measured* world at each cost level): the total under its 5th percentile at the 6,
   12 and 24-month checks, or a closed drawdown over the 95th percentile of the 24-month worst drawdown at any time.
9. **Probabilities**, per world: P(stopped within 24 months by any line) (in *as measured* = a false stop; in *no edge* and
   *losing* = a correct stop); P(monthly-sum t ≥ 2 at each horizon) (in *as measured* = power; in *no edge* = a false
   pass); P(total < 0) and the 5 / 50 / 95 % bands of the total at each horizon.
10. **Demo route**: `git show origin/council-data:ctrader/symbols.json`, symbols only (names, schedule, measured spread
    summary; never an account number or token), against what each lead's forward record needs: L1 a yen pair (USD/JPY)
    with reads at 00:55 and 06:00 UTC; L2 the six majors (two are yen pairs) with fills in the first five minutes after
    the Sunday 17:00 New York reopen; L3 a 10-year Treasury CFD; L4 NAS100 / US500 held from the 16:00 New York close to the
    next open, with the swap charged.

## Outputs

`result.json` (every figure), `RESULT.md` (one page: the table per lead, the demo-route gaps, what a record would need),
`tests/lead-forward-plan.test.mjs` (offline, on the committed `inputs.json`: the gates, the imported-simulate parity, one
stream rebuilt in full against `result.json`, the wording). RESULT.md must say plainly: this is not a proposal to trade
anything; any forward paper stream needs the owner's approval as a new rule (absolute rule 3); no lead is an edge.
Suggestions go in RESULT.md only (no owner-decisions item).

## What would make the plan useless (stated now)

If at the 1x cost a stream needs more than 60 months for an expected t of 2, its forward record cannot settle it inside
five years; RESULT.md says so for that stream. If a stream is not positive at 1x, its plan at 1x is "never" and only the
cheaper grid levels are read, as what the cost would HAVE to be.
