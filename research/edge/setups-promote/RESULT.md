# Which engine setups are worth promoting from shadow to live?

## Clock re-run (9 Nov 2026)

The HistData M1 files were read with a fixed +5 h ("EST without DST"). They are UTC−5, UTC−4 while Europe is on summer time, and New York time in 2018 (`council/histdata.mjs`; release spikes and Sunday opens), so every European summer was an hour late. `run.mjs` (54 market-year chunks) and `analyze.mjs` were re-run (result.json and analysis.txt are
the re-run; the prose below is the original run). **The verdict stands: promote none.** The one formal PASS is still gold M30→M1
in the London session and still weak: IS +0.032R (n 289, t 0.26) → +0.131R (n 299, t 1.04); OOS +0.222R (n 128, t 1.05) →
+0.249R (n 126, t 1.12), an OOS t near 1 after 392 variants. No other cell passes (the "session = overlap" cells still lose).

**Verdict: no engine setup has a robust edge on 2018–2026. Promote none to live.** A formal PASS (gold M30→M1, London session only) is weak and is explained below. Keep everything in shadow.

## What was tested

- **Engine.** The live code: `council/engine.mjs` (`buildSetup`, `buildRetrace`, and `msAnalyze` through a speed copy that gives the same output), plus `choch.mjs` and `clean.mjs`. `fastms.mjs` reads `msAnalyze` from engine.mjs and swaps only the O(L²) search for a running max. `check.mjs` compared the two on 2,610 real windows across every timeframe, and 0 differed. The replay loop copies `council/backtest.mjs`:
  - every 5 minutes, the last 720 closed candles of each timeframe plus the forming one
  - READY signals with a fresh CF (within 12 candles)
  - a resting order at the entry, or a market fill when price is already through it; unfilled orders expire on the `trader.mjs` WAIT times
  - the trade is managed on M1 to the stop or the first target, with no break-even (live `be` is null)
- **Data.** HistData M1 from 2018-07 to 2026-10 for XAU/USD, EUR/USD, GBP/USD, AUD/USD, USD/CAD and USD/CHF (EST is converted to UTC). D1 candles roll at 22:00 UTC. The D1 label is the engine's trend on the closed daily candles before the day, as `backtest.mjs` `odTrend` computes it.
- **Live settings.** buf 0.15, minRisk 1.1, global reward:risk ≥ 1.2.
- **Costs.** One spread per round trip in R, as `backtest.mjs` `spreadOf` does: 1 pip on forex and 0.30 on gold. Gross and net figures are both shown.
- **Walk-forward split.** In-sample (IS) is 2018-07 to 2023-12; out-of-sample (OOS) is 2024-01 to 2026-10.
  - Baseline = the current `config.filters` of each setup (council-data config.json, 7 Nov).
  - Candidate = the single condition with the best IS t-stat that keeps at least 20% of IS trades.
  - Conditions searched: D1, H4, higher-TF align, structure, CF type, M15/M5 CHoCH, M15 CHoCH, side, session (only one or skip one), market (only one or skip one), reward:risk ≥ x or ≤ x, and fill type.
- **Variants tried.** 49 conditions × 8 setups = **392**. At that many tries, an OOS t-stat near 1 is what chance produces.
- **Scope.** Each setup is judged alone. MAX_OPEN, duplicate, dollar-cap and re-entry rules are not applied. For gold M30→M1, the 5,925 of 8,016 signals that duplicate a Scalp entry are removed, as `trader.mjs` does.
- **Volume.** 108k closed trades in total.

## Baseline vs best IS condition (net R per trade)

| setup | baseline (current filters) IS | baseline OOS | best IS condition | its IS | its OOS | OOS yrs + | verdict |
|---|---|---|---|---|---|---|---|
| rscalp (M15→M1 retrace) | n2624 −0.225 | n1364 −0.198 | session = overlap | −0.134 | n1231 −0.186 | 0/3 | FAIL |
| intraday (H1→M5) | n3526 −0.075 | n1666 −0.016 | rr ≥ 2.5 | −0.132 | n1206 −0.044 | 1/3 | FAIL |
| rintra (H1→M5 retrace) | n1713 −0.082 | n864 −0.079 | session = overlap | +0.032 | n274 −0.051 | 2/3 | FAIL |
| swing (H4→H1) | n477 −0.034 | n202 **+0.104** | side = buy | −0.029 | n282 +0.055 | 1/3 | FAIL |
| position (D1→H1) | off | off | (no setup filter: n1262 −0.156) | — | n552 −0.185 | 0/3 | FAIL |
| m30m1 (gold M30→M1) | n714 −0.144 (D1 with) | n398 **+0.216** | session = london | +0.032 | n128 **+0.222** | 2/3 | PASS, weak |
| rswing (H4→H1 retrace) | n194 −0.116 | n74 +0.021 | side = sell | +0.044 | n52 −0.023 | 1/3 | FAIL |
| scalp (reference) | n8943 −0.190 | n4527 −0.228 | session = overlap | −0.130 | n5033 −0.135 | 0/3 | FAIL |

Max drawdown, losing streaks and per-year figures are in `result.json` and `analysis.txt`.

**Costs decide most setups.** Gross OOS expectancy is about zero or negative for every setup except gold M30→M1. Mean spread cost per trade is 0.17R on rscalp, 0.14R on scalp, 0.11R on rintra and M30→M1, and 0.07R on intraday. The M1/M5-entry setups have stops too tight for a 1-pip spread.

**Gold is the only market that looks good, and only in 2024–26.** Gold-only results with no setup filter:

| gold setup | IS | OOS |
|---|---|---|
| rintra | +0.041 (n278) | +0.119 (n197) |
| swing | −0.129 | +0.271 (n55) |
| position | −0.193 | +0.435 (n82) |

All three were flat or losing in 2018–2023. The OOS gains come from gold's one-way rise in 2024–26, which is regime risk, not a setup edge.

## The owner's research-150d rule set: does it hold out-of-sample?

| rule | kept trades IS / OOS | dropped trades IS / OOS | holds? |
|---|---|---|---|
| Position off | — | −0.156 / −0.185 | **Yes.** Position loses in both periods; leave it off. |
| Swing only against D1 | −0.034 / +0.104 | −0.126 / −0.136 | **Yes, relative to the dropped trades** (better in both periods). The kept set is still negative IS; OOS +21R over 202 trades, positive 2024 and 2026, negative 2025. |
| Intraday reward:risk ≤ 10 | −0.150 / −0.087 | +0.208 / +0.198 (n213 / 113) | **No.** The trades it drops are the best ones, though few and not significant (t 0.7 / 0.5). |
| Scalp skips AUD/USD | −0.192 / −0.170 | −0.213 / −0.226 | **Yes, weakly.** AUD/USD is worst in both periods, but every pair loses. |
| Retrace M15→M1 only at reward:risk ≥ 3 | −0.220 / −0.234 | −0.166 / −0.175 | **No.** rr ≥ 3 is worse in both periods. |
| Retrace H1→M5 skips USD/CHF | −0.075 / −0.126 | −0.176 / −0.257 | **Yes.** USD/CHF is worst in both periods; the rest still lose. |
| Dollar cap 2 | — | — | Not testable per setup (it is a portfolio rule). |

Four of the six testable rules point the right way out-of-sample. None of them turns a losing setup into a winning one. The 150-day replay's "break-even" did not survive 8 years.

## Gold M30→M1: against D1 (owner) or with D1 (Coach)?

These are the 2,091 gold M30→M1 trades that are not Scalp duplicates, net of the 0.30 spread.

| D1 | IS 2018–23 | OOS 2024–26 | all 2018–26 | gross IS / OOS |
|---|---|---|---|---|
| **with** (Coach, live now) | n714 **−0.144** (−103R, t −2.3) | n398 **+0.216** (+86R, t +2.2) | n1112 −0.015 (−17R) | −0.014 / +0.281 |
| **against** (owner's original) | n642 **−0.011** (−7R) | n337 **+0.014** (+5R) | n979 −0.002 (−2R) | +0.122 / +0.076 |

Net R by year:

| D1 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|
| with | +10 | −11 | −46 | −41 | −24 | +9 | −6 | +32 | +60 |
| against | −6 | −12 | +13 | −26 | +25 | 0 | −20 | +2 | +23 |

- **OOS (2024–26): with D1 wins clearly**, +0.216 vs +0.014 a trade.
- **IS (2018–23): against D1 wins**, −0.011 vs −0.144, and "with" lost 4 straight years (2019–2022).
- **Over the full 8 years, neither is positive net** (−0.015 and −0.002).
- "With" wins OOS almost entirely on buys: OOS with + buy n358 +0.204, while gold rose without a break.
- The owner's 150-day figures for "against" (+0.13R and +0.20R a trade) do not reproduce on multi-year data.
- The 26-trade swings the Coach reacted to (against −0.62R over 8; blocked +1.36R over 19) are noise next to these samples.

**Answer for the owner.** Out-of-sample, the Coach's "with D1" wins, but only because gold trended up in 2024–26. It lost every year from 2019 to 2022. The choice between with and against is a bet on whether gold keeps trending, not a proven edge. Neither version should trade live. If it stays in shadow, "with" fits the current regime and "against" is the steadier choice across regimes (smaller drawdown IS: −44R vs −161R).

## The one formal PASS: gold M30→M1, London session only

| | IS (n289) | OOS (n128) |
|---|---|---|
| net R per trade | +0.032 (t 0.26) | +0.222 (t 1.05) |
| total R | | +28.5R |
| max drawdown | | −10.4R |

- OOS years: 2024 −6.0R, 2025 +14.5R, 2026 +20.0R. All years: 2018 +6.1, 2019 −3.7, 2020 −0.7, 2021 −12.8, 2022 +2.6, 2023 +17.8.
- It meets the PREAMBLE bar: OOS n ≥ 100, exp > 0, beats raw (+0.123) and current (+0.216) OOS, and 2 of 3 OOS years positive.
- **Why it is weak:**
  - The IS edge is zero (t 0.26).
  - The OOS t is about 1 after 392 variants.
  - It lives on the same 2025–26 gold trend.
  - It is the least convincing kind of pass.
- `proposal.md` records it as instructed, with a recommendation to keep it in shadow rather than promote it.

## Caveats

- HistData quotes are not the live Kraken/OANDA feed. The spread is a flat 1 pip on forex and 0.30 on gold, with no extra slippage.
- Trades still open 14 days after a yearly chunk ends are dropped (a few Position and Swing trades).
- Each setup is judged alone. The portfolio limits (2 per market, dollar cap 2, duplicate and re-entry rules) would change totals but not the sign.

## Files

| file | contents |
|---|---|
| `replay.mjs` | the multi-year replay |
| `run.mjs` | runs the replay in yearly chunks |
| `fastms.mjs` | speed copy of `msAnalyze` |
| `check.mjs` | identity check of the speed copy |
| `analyze.mjs` | walk-forward analysis; writes `result.json` |
| `analysis.txt` | full console output of `analyze.mjs` |
| `extra.mjs`, `extra.txt` | descriptive cuts (D1 × side, gross, gold-only) |

Reproduce:

```
git archive origin/council-data research/candles/{EURUSD,GBPUSD,AUDUSD,USDCAD,USDCHF,xau-histdata} | tar -x -C <dir>
node run.mjs <dir>/research/candles <out> 4
node analyze.mjs <out> .
```

About 1.5 CPU-hours.
