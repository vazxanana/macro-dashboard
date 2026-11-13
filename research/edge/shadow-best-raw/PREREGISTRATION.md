# The shadow cut on the measured raw-spread costs: pre-registration

Written and committed on 13 Nov 2026, alone, before any trade of this study was re-costed or any per-cell figure under the
new costs was computed. Paper research only: no live rule, size, filter, council member, page, config, `council/shadow-cut.mjs`
or mirror setting is changed by this study, whatever it finds (absolute rule 3). A kept stream becomes at most a **proposal**
in `research/proposals/` for the owner to decide.

## Why

On 12 Nov 2026 `research/edge/shadow-best` found 0 of 32 engine shadow streams (scalp, intraday, rscalp, rintra x gold, five
forex majors, four coins) worth keeping, net of `council/fills.mjs` `tradeCost` as it stood then (the 1-pip default spread on
forex, $0.30 on gold, plus half a spread of slippage per market order), and the owner cut them (`config.shadowCut`). The same
day the forex cost model was found to overstate the demo's costs (CLAUDE.md section "Forex spreads: a raw-spread account,
measured"): the demo is a raw-spread account whose majors are quoted bid = ask most of the day and charged a commission of
22.5 USD per million a side; `costModel` now uses the median quoted spread plus the commission. **The question: was the cut
decided on wrong costs?** Would any of the 32 cells pass the same rule on the measured costs?

What I already know, said plainly.
- shadow-best's RESULT.md prints every cell's GROSS R a trade (before any cost). A cost is never negative, so a cell whose
  gross R a trade is 0 or below in either window cannot pass rule 1 or 2 on any cost model. Reading that table: no gold or
  forex cell is above 0 gross in both windows (the nearest: gold rintra -0.011 IS / +0.074 OOS, AUD/USD rintra +0.011 IS /
  -0.073 OOS, GBP/USD rscalp -0.000 IS / +0.015 OOS). Two coin cells are above 0 gross in both windows (ETH intraday,
  XRP rintra), but the coins' cost does not change here. **So I expect 0 of 32 again.** The study is run anyway, as fixed
  below, so the answer rests on the full rule (n, monthly t, Holm, placebo) and not on my reading of a rounded table.
- What it can show beyond the verdict: how far each cell moves toward zero when forex costs about a third as much.

## The trades (unchanged)

Exactly shadow-best's trades: `research/edge/shadow-scalp-filters/run.mjs market <key>` run unchanged through
`research/edge/shadow-best/run.mjs market` (neither file is edited; both are imported or run as they are), same candles from
council-data `research/candles/` by `git show origin/council-data:…` (no network, kept outside git), same Coach stop settings,
same windows, every READY signal, live exit `R_none`. The gross R of every trade is the replay's; only the cost changes.

## The ONE change: the cost of each trade

Each closed trade is re-costed with `council/fills.mjs` `tradeCost(t, M, mm)`, imported unchanged, on the trade's own entry,
initial risk `r0`, entry mode (market / limit), exit kind (target / other), side and times (for gold financing), with `mm` from
`council/fills.mjs` `costModel` (no mirror fills) on the broker file rebuilt from `tests/fixtures/ctrader/symbols-raw-12nov.json`
the way `tests/forex-spread.test.mjs` rebuilds it (`council/ctrader-symbols.mjs` `spreadFields` over every read of 8-12 Nov,
`commissionRT` from the symbol's commission record):

- **Forex** (EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF): spread = the median quoted spread outside the rollover hours
  (`spreadTypical.median`, 0 on all five), commission = `commissionRT` (0.000045 of the price a round trip), slippage = half
  the DEFAULT spread (0.5 pip) on a market entry and on an exit that is not the target, as `tradeCost` does for a 0 quote.
- **Gold**: spread = the measured median ($0.06), commission 0.000024 of the price a round trip, slippage half the measured
  spread on market legs, overnight financing on buys as before (`FIN`, unchanged).
- **Crypto**: unchanged (the CFD round trip of `costOf`, no broker record in the fixture): the default `tradeCost`, as in
  shadow-best.
- Net R = gross R - costR (size 1).

## Sensitivity (reported, also judged)

The same rule on **2x the measured cost** (net = gross - 2 x costR). Reported as a second verdict; a cell that passes at 1x
but not at 2x is said to be cost-fragile. Gross figures (0 x cost) are reported, never judged.

## Cells, windows, rule and placebo (shadow-best's, unchanged)

- **32 cells**: xau, eurusd, gbpusd, audusd, usdcad, usdchf x scalp, intraday, rscalp, rintra (24), and btc, eth, sol, xrp x
  intraday, rintra (8). Every one counts in the correction.
- **In sample** 2020-01-01 to 2023-12-31 (coins from 2022-03-01); **out of sample** 2024-01-01 to 2026-10-31 (34 months).
- A cell is KEPT only if all hold: (1) IS net R a trade > 0; (2) OOS net R a trade > 0; (3) OOS n ≥ 100; (4) OOS t ≥ 2 on the
  cell's net R summed by calendar month over the 34 OOS months (an empty month counts 0); (5) Holm-adjusted one-sided p ≤ 0.05
  (Student t, 33 degrees of freedom) over all 32 cells. shadow-best's functions (`cellTable`, `applyRule`, `placebo`) are
  imported and applied to the re-costed rows.
- **Placebo**: shadow-best's 40 random partitions (same hash, same sizes), on the re-costed rows, at 1x and 2x.

## What the answer means

- **No cell passes at 1x**: the cut was not decided on wrong costs: with the measured raw-spread costs no engine shadow stream
  is worth keeping either. No proposal is written.
- **A cell passes at 1x**: it is written as a proposal, `research/proposals/2026-11-13-shadow-raw.md` (keep that stream as a
  shadow, i.e. add it to `config.shadowCut.keep`), with its n, R and t, the 2x result and the placebo count beside it. The
  owner decides; nothing in config, `council/trader.mjs` or `council/shadow-cut.mjs` changes in this branch.

## Files

`PREREGISTRATION.md` (this file, committed alone first), then `run.mjs` (`fetch <dir>` and `market <key> <candleDir> <outDir>`
hand over to shadow-best; `report <outDir>` re-costs the raw rows and writes `result.json`), `RESULT.md`, `result.json`,
`tests/shadow-best-raw.test.mjs`.
