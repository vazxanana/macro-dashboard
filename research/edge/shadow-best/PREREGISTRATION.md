# Which engine shadow streams are worth keeping: pre-registration

Written and committed on 12 Nov 2026, alone, before any trade of this study was simulated or any per-stream figure was
computed. Paper research only: no live rule, size, filter, council member, page, config or mirror setting is changed by
this study, whatever it finds (absolute rule 3). A kept stream becomes at most a **proposal** in `research/proposals/`
for the owner to decide.

## Why

The owner said "filter the best shadows". The shadow book's engine setups (`scalp`, `intraday`, `rscalp`, `rintra`) were
replayed in `research/edge/shadow-scalp-filters/` (12 Nov 2026): 107,735 closed trades, about −0.22R a trade after costs
on 2020-26 in both windows. That study reported totals by setup and by market only, never by (setup, market) stream, and
its per-trade output was not kept. The question here: **which (setup, market) streams, if any, are worth keeping?**

What I already know, said plainly.
- From `shadow-scalp-filters` RESULT.md: every setup is negative in both windows (OOS scalp −0.266, intraday −0.112,
  rscalp −0.257, rintra −0.130R a trade) and every market is negative out of sample (gold −0.129, forex −0.22 to −0.27,
  coins −0.06 to −0.16). Before costs the family is about −0.04R. So I expect few or no streams to pass. I have not seen
  any (setup, market) figure: the earlier result.json holds per-setup and per-market splits only inside each filter, and
  no per-trade file exists.
- Picking the best cells of a losing family after the fact is how luck looks like an edge. This study fixes the rule
  first, corrects for the number of cells, and runs a placebo of the same rule on random cells of the same sizes.

## Not the gold book, not ICT

Item 44 (12 Nov 2026): no gate, exit, entry or size test on the gold book's 2006-17 window. This study does not touch Gold
trend or Gold daily engulf, reads nothing before July 2019, and gold appears only as one market of the four engine
setups. ICT is not part of it.

## The trades (the replay is the earlier study's, unchanged)

- **The replay**: `research/edge/shadow-scalp-filters/run.mjs` `market <key>`, run unchanged (its files are not edited):
  the `council/backtest.mjs` loop on the four setups with the engine, cleaner, `replayBar`, `tradeCost` and the HistData
  clock imported unchanged; live exit (engine target T1, no break-even, `R_none`); Coach stop settings `buf` 0.15,
  `minRisk` 1.1 (council-data `config.json` of 12 Nov); every READY signal, no minimum reward:risk, market, session or
  trend filter. Candles from council-data `research/candles/` by `git show origin/council-data:…` (no network), kept
  outside git.
- **Per-trade output** (new in this study, `run.mjs`): one row per closed trade: setup, market, signal time (`opened`),
  R gross (`R`, per unit) and R net (`R − costR`). Costs = `council/fills.mjs` `tradeCost` exactly as the earlier study
  stamped them (one spread round trip, the CFD crypto round trip, half a spread of slippage on market entries and on exits
  that are not the target, overnight financing on gold buys).
- **A trade belongs to its stream** = (setup `k`, market) and **to the month of its signal** (`opened`, UTC).

## The cells (32, all tested)

- Gold and the five forex markets (HistData M1, trades 1 Jan 2020 to 31 Oct 2026), all four setups:
  `xau`, `eurusd`, `gbpusd`, `audusd`, `usdcad`, `usdchf` × `scalp`, `intraday`, `rscalp`, `rintra` = 24 cells.
- The four coins (Binance 5-minute candles, trades 1 Mar 2022 to 31 Oct 2026), the M5-entry setups only (no coin M1
  history in the repository, as in the earlier study): `btc`, `eth`, `sol`, `xrp` × `intraday`, `rintra` = 8 cells.
- **32 cells**, not 40. Every one of them counts in the correction, whatever its n.

## Windows

- **In sample (IS)**: trades opened 2020-01-01 to 2023-12-31 (coins 2022-03-01 to 2023-12-31).
- **Out of sample (OOS)**: trades opened 2024-01-01 to 2026-10-31 (34 calendar months).
- Nothing is fitted: the windows, cells and thresholds are fixed here.

## The selection rule (a cell is KEPT only if all hold)

1. IS net R a trade > 0 (1x costs).
2. OOS net R a trade > 0 (1x costs).
3. OOS n ≥ 100 closed trades.
4. OOS t ≥ 2, where t = mean / (sd / √34) of the cell's **net R summed by calendar month** over the 34 OOS months (a month
   with no trade counts as 0).
5. Holm-adjusted one-sided p ≤ 0.05: p = P(T ≥ t) for Student t with 33 degrees of freedom, Holm over **all 32 cells**.

Reported for every cell: IS and OOS n, net R a trade, gross R a trade (before costs), total net R, the monthly t (both
windows), the OOS p and Holm p, and which rule failed. Gross figures are reported, never judged.

## Placebo (how many keeps luck gives)

40 random partitions, `j` = 1 … 40. In partition `j` every trade gets a fixed hash `u_j` (FNV-1a of
`j|market|setup|opened|side|row index`); within each window separately the trades are sorted by `u_j` and dealt, in
cell order, into 32 pseudo-cells with exactly the real cells' IS and OOS sizes. Each trade keeps its own net R and signal
month. The same five rules (Holm over the 32 pseudo-cells of that partition) are applied. Reported: the total number of
pseudo-keeps over the 40 partitions, the number of partitions with at least one keep, and the largest pseudo-cell OOS t.
The pool loses about 0.22R a trade, so I expect about zero pseudo-keeps; the placebo says how often the rule lets a cell
of pure chance through at these sizes, not that the real cells are random.

## What the answer means

- **A cell passes**: that (setup, market) stream made money after costs in both windows with an OOS monthly t ≥ 2 that
  survives the 32-cell correction. It is written as a proposal (keep that shadow stream, drop the rest from the shadow
  book) for the owner; it does not make the stream live and it is not called an edge beyond its n and t. The number of
  placebo keeps is put beside it.
- **No cell passes**: the answer is **no engine shadow stream is worth keeping**. No proposal for a stream is written.
- Whatever the result, nothing live changes in this branch.

## Files

`PREREGISTRATION.md` (this file, committed alone first), then `run.mjs` (`fetch <dir>`: candles from council-data with
git; `market <key> <candleDir> <outDir>`: runs the earlier study's replay unchanged into `<outDir>/raw/` and writes the
per-trade file `<outDir>/<key>.trades.json`; `report <outDir>`: the cell table, the rule, the placebo → `result.json`),
`RESULT.md`, `result.json`, `tests/shadow-best.test.mjs`. Candles and trade rows stay out of git.
