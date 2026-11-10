# Robustness audit: how much of the claimed edge is real?

## Clock re-run (9 Nov 2026)

The HistData M1 files were read as New York time. They are UTC−5, UTC−4 while Europe is on summer time, and New York time in 2018 (`council/histdata.mjs`), so the ~4 weeks a year when the US and Europe are on different clocks (2019 on) were an hour off. Not re-run in the 9 Nov clock pass. The HistData rebuilds (ICT A-setups, gold systems, 2018-26) were an hour off in ~8% of days
(the US/EU mismatch weeks from 2019). gold-systems, which read the same files the same New York way, moved by
hundredths of an R when re-run on the corrected clock, so the "fragile / not robust" readings here are not expected to move.
`lib.mjs` now uses the shared clock.

Paper research only. No live rule, config or trader/tracker code was changed.
Question: for every LIVE rule in `council-data config.json` (history entries by `user`, `coach-backtest`, `coach-stats`) and for the ICT desk, does the evidence hold up when you recompute it? Every rule got:
- an out-of-sample (OOS) split,
- results by year,
- costs,
- a random-entry benchmark,
- a sign flip,
- a ±20% change to its parameters,
- a multiple-testing (deflated Sharpe) adjustment.

## Short answer

**Most of the live edge comes from gold's 2023–26 bull market and from exits that let winners run. The entry signals add little.**

- **Gold trend and daily engulf.** These long-only legs do no better than random long entries with the same stop and exit. The breakout or engulf signal adds no measurable edge.
- **NQ open run and gold H4 trendline.** These beat random clearly from 2024 on. Before 2023 they were about zero, so the edge belongs to the recent regime.
- **Mosha BO.** It does not survive an independent rebuild.
- **The live Scalp rule.** It is negative on the council's own 150-day replays.
- **Coach-stats session and D1 toggles.** These rest on 5–30 trades, and several were switched on and off two to four times in three days.

| Rule (live) | Claimed | Recomputed: IS ≤2023 / OOS 2024+ (R/trade, net) | Random entry, same geometry (mean, 5–95%) | Sign flip | ±20% params | DSR (N=100) | Verdict |
|---|---|---|---|---|---|---|---|
| Gold trend N20 (+add) | +0.31 / +1.07 / +2.42 a trade (19-22 / 23-24 / 25-26) | +1.22 (n25) / +2.34 (n15, t1.7) | random long **+1.06** (0.20 to 1.91) | −0.31 | stable | 0.52 (OOS 0.08) | **Fragile.** The exit and gold's drift make the profit; the 20-day breakout is not better than random. |
| Gold trend fast N5 (+add) | positive every year 2019-26 | +0.68 (n51) / +1.91 (n23) | random long **+1.03** (0.49 to 1.59) | −0.24 | stable | 0.61 (OOS 0.16) | **Fragile.** Same as N20: no better than random long. |
| Gold daily engulf | +0.33 / +0.68 (23-24 / 25-26), every year + | +0.10 (n144) / +0.40 (n73, t1.9) | random long pullback limits **+0.17** (0.04 to 0.32) | −0.12 | stable; the 20-day average gate adds nothing (without it +0.20) | 0.18 | **Not supported** as a signal. It is a long-gold pullback. |
| Gold H4 trendline | +0.44 / +0.67 (23-24 / 25-26), every year + | **−0.01 (n197)** / +0.43 (n105, t3.1); 2021 −7R, 2022 −7R | +0.05 (−0.02 to 0.15) | −0.04 | pivot width 4: +0.05 overall; the H4 direction gate adds nothing (without it +0.12) | 0.28 (OOS 0.73) | **Fragile.** Recent regime only; it fails 2019-22. |
| NQ New York open run (+runner) | 2023-26 +0.28, t3.3; 2018-22 +0.02 | +0.04 (n505) / +0.39 (n220, t3.6); 2019-22 +0.00 | −0.02 (−0.10 to 0.08) | −0.08 (OOS −0.18) | stable (+0.11 to +0.17) | 0.53 (OOS 0.87) | **Fragile / regime.** This is the strongest OOS result in the book. Zero before 2023, and the log says the 10-minute-late feed cannot capture it live. |
| Crypto trend v3 (+add) | 2022-26 +0.30 a trade (v1); council coins +0.75 | +3.70 (n83) / +1.04 (n42, t1.4); **2025 −4.4R, 2026 −1.8R** (3 of 4 coins negative in 25-26; ETH +0.08) | random long +0.49 (0.10 to 0.99) | −0.11 | k and lookback ±20% all similar | 0.98 overall, **OOS 0.03** | **Fragile.** 2019-21 made the record; it is flat or negative since 2025. |
| Gold momentum pullback (TEST, shadow) | +0.105 / +0.171 at 0.15 cost | −0.02 (n720) / +0.20 (n283, t2.6); 2018-19 −29R; 0.30 cost: −0.06 / +0.18 | −0.03 (−0.07 to 0.03) | −0.11 | top 0.96: +0.01 | 0.06 (OOS 0.51) | **Fragile / regime.** It loses 2018-22. |
| Mosha BO (weekly, slow, add/run) | weekly agrees +0.37 / +0.35 (19-22 / 23-26) | +0.08 (n97) / **−0.14 (n50)**; 2025-26 −0.41 | M15-BO entries thinned to the same count −0.11 (−0.26 to 0.07) | −0.07 | every variant ±0.1 around 0 | 0.006 | **Not supported.** Rebuilt independently, the weekly filter *hurts* (without it +0.12). |
| Gold replica (gate, D1, 4R, BE, add, run, size tilt) | +109.6R / +155.5R (23-24 / 25-26) | Not rebuilt (600 lines). Its own 2023+ records: +0.88 (n212, t3.8). Plain 4R/BE exit: +0.47; flipped −0.21 | same side, ±10 days, same r0: +0.07 (−0.15 to 0.32) | −0.21 | n/a | 0.94 (records only) | **Fragile.** Entries beat random within the gated regime, but there is no untouched sample. Ungated it lost every year 2019-25 (−312R). The gate, D1 rule, 4R exit, BE, add, run and tilt were all picked on 2023-26 (8 history entries in 3 days). |
| Scalp against D1, not Asia/overlap, not AUD/USD (live 7 Nov) | +0.329 over 500 (30 d), both halves | 30-day file: +0.16 (n221, t0.95); **all of it from 1-7 Nov (+32.9R/53); Oct +2.6R/168**. 150-day files: **−0.011 (n915) / −0.027 (n937)**, both halves negative. Log 6 Nov, gold 2023-26 on the same engine: −0.09 to −0.23 a year | – | "with D1" −0.26 (t−6.8) | – | – | **Not supported.** "Against" only loses less than "with". |
| ICT A-setups NQ (tracker code, HistData 2018-26) | desk replay A +0.35/t (Aug 25-Nov 26) | +0.07 (n286) / +0.29 (n120, t1.8), net 1 pt | −0.09 (−0.23 to 0.03) | −0.11 | piv 4: +0.05; others +0.10 to +0.13 | 0.18 | **Fragile.** Positive since 2020, but t < 2 and it is sensitive to pivot width. |
| ICT A-setups GC (gold buys, stop 0.3-0.75 daily ATR) | +56.7 / +36.0 / +32.8R (19-22 / 23-24 / 25-26) | +0.20 (n362) / +0.22 (n167), net 0.30 | random long +0.07 (−0.03 to 0.22) | −0.17 | stable +0.20 to +0.21 | 0.67 | **Fragile.** It is above the random-long mean, but the rule was chosen on 2019-26 (no untouched data). In the desk replay since Aug 2025 GC A-setups made +0.04/t (n63). |
| Coach-stats toggles (session / D1 / min-stop, 30 entries) | e.g. "−1.00R over 9 trades" | t-stats −2.3 to +4.6 on n = 5–31. The m30m1 D1 rule flipped 4×, rscalp Asia 3×, scalp overlap 3× in 3 days | – | – | – | – | **Not supported** (noise chasing). |

Notes on the table:
- IS / OOS follows the preamble split. The council chose most gold rules on 2023+ ("judge on 2023 onwards"), so for those rules **2019-22 is the only untouched sample**. Columns `w1922 / w2324 / w2526` are in `result.json`.
- DSR is the probability that the true per-trade Sharpe is above the best you would expect from N independent tries of a zero-edge rule. Values for N = 1 / 100 / 424 are in `result.json`.

## How it was done

### Re-implementation
**`systems.mjs`** rebuilds each system from `council/trader.mjs` line for line:
- gold trend 616-648, daily engulf 678-704, H4 trendline 651-677 with `msnrDirection` copied verbatim,
- NQ `nqOpenSweep` 1628-1644 plus nyflip 1700-1726,
- crypto trend v3 549-612, momentum pullback 705-735,
- Mosha BO 736-786, with `msAnalyze` imported from `council/engine.mjs` and run causally on a rolling 720-bar window at every M15/H1/H4 close.

trader.mjs is a script, not a module, so the rules are copied, not imported.

Data:
- HistData 1m spot gold and Nasdaq-100 cash, 2018 – Oct 2026. Labels are New York time with DST.
- Daily candles start at 17:00 New York.
- Binance daily candles for crypto.

Costs:
- gold 0.30 a round trip (0.15 for the momentum scalp, as claimed, plus a 0.30 check),
- NQ 1 point,
- crypto 0.8%,
- ICT: 1 point (NQ) or 0.30 (gold) taken off the tracker's gross R.

My numbers differ from the council's by implementation details: fill at the next open, daily alignment, the 1m stop-before-target rule. The signs and the IS/OOS shape match the council's own log wherever it reported them. The exception is Mosha, where my weekly filter result has the opposite sign.

### ICT
**`claims.mjs ict`** imports `signals()`, `isASetup()` and `sizeOf()` from `ict/tracker.mjs` and `simulate()` from `ict/replay.mjs`. It runs them unchanged on 8 years of H1 built from HistData (the halt hour is dropped, as in the tracker).

### Replica and Scalp
- **Replica** is audited from its replay records (`research/replay-2w.json`, 212 trades).
- **Scalp** is audited from the council's own replays (`backtest.json`, `research/backtest-150d.json`, `research/backtest-150d-clean.json`).
- A local 8-year engine replay (`make_bt_local.mjs`: `council/backtest.mjs` with only the data layer swapped to HistData, plus the `run_bt.mjs` launcher) works: a one-week test produced 31 trades. Shared-machine memory and CPU limits killed the full-year runs, so the long-history Scalp numbers come from the council's own 6 Nov offline run in `research/log.md`. **They were not recomputed here.**

### Random benchmarks (same exit, same exposure)
- **Daily gold legs:** same number of entries on random days, long, same ATR stop and the same ratchet or trail. Per-window versions are in `out/gtrend.json` (`randomLongWin`).
- **Engulf:** random days, with entry distance and stop distance (in ATR) drawn from the live trades.
- **Trendline:** random H4 bars, stop under the low of the last 6–36 bars.
- **NQ:** random minute from the live entry-minute distribution, random side, live stop-size distribution, same runner, out at 11:00.
- **Momentum pullback:** random 07-17 UTC H1 bars, random side, same pullback entry machinery.
- **Mosha:** every M15 BO pullback (no chain, no filters), thinned at random to the live count.
- **Replica and ICT:** each real trade moved ±10 days at the same clock time, same side and stop. This holds the regime fixed.

### Multiple testing
`out/count.json` gives the size of the search behind today's rules:
- `research/log.md`: 111 sections and 424 lines that report an R result.
- An explicit ~11,000-setting grid per pair, on 9 pairs.
- 21 `research/backtest-150d-*` replays.
- 76 config-history changes: 36 by the owner, 30 coach-stats, 5 coach-backtest.

DSR is reported for N = 1, 100 (a conservative count of distinct rule families) and 424. At N = 100 a per-trade Sharpe needs roughly t > 2.5 just to beat the expected best of the null, and about 4.2 for 95% confidence. **No live rule clears 95% at N = 100 on its full history.** Best on OOS alone: NQ open run 0.87 and H4 trendline 0.73.

### Variants tried in this audit
About 130 runs:
- live, flip and no-filter variants,
- 4–8 ±20% points per system,
- 1–7 random benchmarks per system,
- 3 Scalp files × 7 slices.

None was used to select a rule, and **no candidate is proposed**, so there is no `proposal.md`.

## What this means for the owner (no changes made)

1. **The council's gold book is mostly one bet: long gold, with trailing exits.** Gold trend, trend fast and the daily engulf do not beat random long entries with the same exits. Expect them to give back if the gold trend turns. Size them as one position, not three independent edges.
2. **The out-of-sample tests that would count are 2019-22 for the gold legs and 2018-22 for NQ.** The H4 trendline, the momentum pullback and the NQ open run are all about zero there. They are recent-regime effects, so watch for decay.
3. **Mosha BO and the live Scalp rule have no supporting evidence** once rebuilt or replayed over a longer window.
4. **The "both halves of 30 days" test the coach uses is too weak.** The +0.33R Scalp claim comes from one week. Coach-stats changes on n < 30 are noise and flip back and forth. A minimum of n ≥ 100 plus a longer-window replay would stop the churn.
5. **ICT.** NQ A-setups are positive after 2020 but not significant (t 1.8). The GC rule was fitted on all the data available.

Files:
- `systems.mjs`, `claims.mjs`, `lib.mjs`, `report.mjs`, `make_bt_local.mjs`, `run_bt.mjs`
- `out/*.json` (trade lists and full stats)
- `result.json`

Re-run with `ROB_DATA=<dir with git archive of council-data research/candles/..., research/*.json, ict/replay.json> node systems.mjs && node claims.mjs && node report.mjs`.
