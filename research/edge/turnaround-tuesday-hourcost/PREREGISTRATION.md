# Pre-registration: turnaround-tuesday-hourcost (23 Nov 2026)

Paper research only. **Cost accounting of one fixed rule; no rule is tested.** `turnaround-tuesday` (13 Nov 2026) passed on one
cell of four, narrowly: R2 on NAS100 (buy the New York close of a "Monday" down more than 1 %, sell the next trading day's
close), 2016 → Nov 2026 +0.098R a trade after costs and financing, t 2.33, n 81, Holm p 0.0392. Its round-trip cost was
**assumed**: 0.05 % of price on NAS100, 0.04 % on SPX500. The demo broker's own quoted spreads are now measured hour by hour
(tick probe). This study asks: **does the study's own pre-registered bar still pass when each trade is charged the demo's
measured spread at the UTC hour of its entry and of its exit?** It is accounting on years the study already read: a pass is
not new evidence of an edge, a fail would mean the result leaned on the assumed cost. Not a gate, entry, exit or size of any
live book; not ICT. Nothing live changes and no proposal is written by this study.

## What the author has seen before writing this

- `turnaround-tuesday`'s PREREGISTRATION, RESULT and result.json (every figure above, the four cells, the checks).
- `turnaround-tuesday-forward`'s first reading (1 trade, 16 Nov 2026, −0.135R at the assumed cost).
- The tick probe's hour profiles in council-data `research/probe/ticks-NAS100.json` and `ticks-US500.json` (run of
  2026-11-20T04:51Z, council-data commit 46e678088, the one `index-vol-breakout-hourcost` used): NAS100 median quoted spread
  0.8-0.9 points in every UTC hour (about 2.7-3.0 × 10⁻⁵ of price), US500 3.9-4.8 × 10⁻⁵; `ctrader/symbols.json`
  `commissionRT` 0 on NAS100 (US500 not on file there: taken as 0, as `index-vol-breakout-hourcost` did). No result of this
  study has been computed.

## Trades (unchanged)

Imported unchanged from `research/edge/turnaround-tuesday/run.mjs`: `tradingDays`, `weekPairs`, `buildDays`, `atrAt`,
`dayChg`, `ruleOn`, `trade`, `rateOf`, `stats`, `welch`, `pOneSided`, `holm`, `rng`, `verdictOf`, `MARKETS`, `RULES`, `SEEDS`,
`SPLIT`, `FIRST`. The study's `cellsFor` holds its cost as a constant; it is re-written here with one change only: the cost of
each trade (rule trades and placebo trades) comes from a function. Financing exactly as the study charged it (2-year yield
from its `rates.json` + 2.5 % a year, calendar nights). Data: the study's own `fetch.mjs` (OANDA mid H1 SPX500 and NAS100,
Oct 2007 → 13 Nov 2026, the site's candle proxy), kept out of git.

**Harness gate (before anything else is reported):** with the study's constant costs, the re-written `cellsFor` reproduces
`turnaround-tuesday/result.json` exactly: every cell's `is`, `oos`, `vsAllIS`, `vsAllOOS`, placebo seeds and the verdict. If
not, the study stops and says so.

## The measured cost

- **Hour of a price** = the UTC start hour of the H1 candle the price comes from: the entry (the 16:00 New York close
  candle: 20:00 UTC in winter, 19:00 in summer; 17:00 / 18:00 on a half day), a time exit the same, a stop exit the candle in
  which it was hit.
- **C1**: round trip = (0.5 × frac[h_entry] + 0.5 × frac[h_exit] + commissionRT) × entry price, frac = `hourProfile[h].frac`
  (median quoted spread as a share of the mid). **C2** (stress): `frac90`, plus on a stop exit 0.10 × the median high − low
  of the 12 H1 candles ending with the stop candle. Today's relative spreads are charged to every year.
- **Not measurable** (the study stops and says so): a probe file missing, or any hour a trade needs with fewer than 10 windows.
- "2x costs", where a check uses it: twice the C1 cost.

## Reading, fixed now

**PASS = the NAS100 R2 cell meets every check of the study's own `verdictOf` under C1** (C1 net R > 0, t ≥ 2 and Holm over the
four recosted cells < 0.05 on 2016 → now; C2 n ≥ 30; C3 2008-15 net > 0; C4 against all Tuesdays; C5 ≥ 38 of 40 placebo seeds,
placebo trades charged by the same route). The other three cells are recosted and reported (SPX500 at US500's profile).
Reported beside it, not judged: C2, the month-sum t of the OOS cell, the forward record's trades at measured cost (candles
after 12 Nov 2026 from the same proxy, the forward study's own frozen rate), and the break-even round trip. Limits: 60 weekdays
of one demo account, the spread of the first 2 minutes of an hour stands for that hour, OANDA mid candles, no slippage at C1.

## Deliverables

`research/edge/turnaround-tuesday-hourcost/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`,
`tests/turnaround-tuesday-hourcost.test.mjs` (offline).
