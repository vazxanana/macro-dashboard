# Council edge: gold replica, trend, trendline and engulf on OANDA gold 2020–26, three pre-registered changes, and the paper-record breakdown (9 Nov 2026)

**Verdict: FAIL. None of the three pre-registered changes passes; keep the live rules.** The time exit at the deadline
candle's open changes nothing measurable (−0.001R a position over 719 positions, t −0.46). The 0.10R cost gate removes gold
positions that were winners on average (+0.42R, t 1.35), so it would cost money on the gold systems. The walk-forward session
gate switches off only 20 positions in six years, and they were flat (+0.06R). The one strong cost effect is in the
retired / shadow **engine** setups, not the main systems: there, trades whose costs exceed 0.10R lose (forward −0.33R a trade,
t −2.6; 150-day replay −0.33R, t −17); that is a post-hoc lead for the shadow book, not a rule.

Pre-registration: `preregistration.md` (commit 304abfa0, before any variant ran). Harnesses: the council's own replays
(`research/edge/replica-oos/replay.mjs`, `research/edge/gold-systems-oos/replay.mjs`, live blocks copied from
`council/trader.mjs`, stops with `council/fills.mjs`), run by `run.mjs` with one patched line for the variant. Scoring:
`analyze.mjs` → `result.json`. Tests: `tests/council-edge.test.mjs`.

## 1. The paper records (breakdown.mjs, council-data of 9 Nov 01:30 UTC)

Net of costs. 95% intervals. Full tables by system, market, session, hold time and exit: `breakdown.md`.

| Book | n | win % | net R a trade (95% CI) | t | total | max DD | flag |
|---|---|---|---|---|---|---|---|
| Live (trades.json, not shadow), 1–9 Nov | 36 | 17% | −0.58 (−0.95 to −0.20) | −3.1 | −20.8 | −22.2 | **negative** |
| … of which legacy engine (retired 4 Nov) | 34 | 15% | −0.64 (−1.01 to −0.27) | −3.5 | −21.8 | −22.2 | **negative** |
| … of which main systems (replica) | 2 | 50% | +0.47 | – | +0.95 | – | too few |
| Shadow (engine setups the live rules block) | 521 | 34% | −0.02 (−0.21 to +0.16) | −0.2 | −12.0 | −93.8 | |
| Research paper (replica rule on 10 markets, NQ, cycle) | 355 | 30% | −0.25 (−0.39 to −0.11) | −3.5 | −88.8 | −100.5 | **negative** |
| System replays, 2023–Oct 2026 (replay-2w.json, context) | 930 | 42% | +0.51 (+0.34 to +0.67) | +6.1 | +471 | −18.9 | |

- **The live forward record cannot judge any main system yet.** Of the live systems only the replica has closed live trades
  (2). The −21R live loss is the legacy engine before its retirement on 4 Nov (scalp −0.76R, rscalp −1.24R, rintra −0.87R a
  trade, each statistically negative).
- **Statistically negative slices** (95% interval below 0, n ≥ 5): live — scalp, rscalp, rintra, gold, BTC, Asia, London,
  buys; shadow — SOL, buys; research paper — the replica rule off gold (−0.25R; gold itself −0.03R, n 40), SOL, EUR/USD,
  Asia, late session, buys. About 100 slices were tested on 8 days of one market week: the buy / market rows mostly record that
  week's direction (crypto fell), not a rule.
- **Cost is the engine's problem.** Shadow trades with a Trader-stamped `costR` above 0.10 lose −0.29R a trade net (n 316,
  t −2.3); those at or below 0.10 make +0.39R (n 205, t 3.1). Gross the expensive half is flat (−0.03R).
- **Short trades lose.** Trades closed within an hour lose −0.46R (shadow) and −0.75R (research paper) a trade: these are the
  stops of small-stop entries (descriptive; not flagged as a rule candidate).

## 2. Baseline: the live gold rules, 2020-01-01 to 2026-11-06 (positions, net R)

x1 = $0.60 a unit round trip (spread 0.30 + 0.15 slippage each way, `council/fills.mjs`), x2 = $1.20.

| System | n | R a position x1 (t) | total x1 | max DD x1 | R a position x2 (t) | half A 2020–May 23 | half B Jun 23–26 | median stop |
|---|---|---|---|---|---|---|---|---|
| Gold replica (`replica`) | 327 | +0.36 (1.93) | +116.5 | −45.4 | +0.25 (1.38) | **−0.13** (n 131) | +0.68 (n 196) | $8.68 |
| Gold trend (`gtrend`) | 50 | +1.23 (2.10) | +61.6 | −3.9 | +1.21 (2.07) | +0.59 | +1.99 | $44.8 |
| Gold trend fast (`gtrend5`) | 79 | +1.06 (2.47) | +83.5 | −4.0 | +1.04 (2.43) | +0.56 | +1.57 | $50.3 |
| Gold daily engulf (`geg`) | 150 | +0.31 (2.13) | +46.4 | −6.5 | +0.26 (1.79) | +0.25 | +0.37 | $20.5 |
| Gold H4 trendline (`gtl`) | 242 | +0.20 (2.54) | +49.4 | −13.3 | +0.18 (2.18) | +0.02 | +0.39 | $23.9 |
| Replica signals one by one (no portfolio rules) | 435 | +0.08 (0.54) | +32.7 | −103.5 | −0.04 (−0.31) | −0.43 | +0.47 | $8.62 |

Replica net R by year (x1): 2020 +12.4 · 2021 no trade (volatility gate shut) · 2022 −16.2 · 2023 −12.6 · 2024 +43.9 · 2025
+48.4 · 2026 +40.6. The position counts per year equal `replica-oos` exactly (52/0/50/36/45/71/74 there, the first 2020
position differing by the start date), which calibrates the harness. The replica is the most cost-sensitive system (median stop
$8.68, so x1 costs ~0.07R a unit plus the add) and does not keep t ≥ 2 at x2; it lost money in 2022–23. The trend legs barely
notice costs.

## 3. H1 — time exit at the deadline candle's open (`holdOpen`): FAIL, no measurable difference

| | positions paired | with a time exit | variant − live, R a position (t) | total | half A | half B |
|---|---|---|---|---|---|---|
| x1, pooled | 719 | 196 | −0.001 (−0.46) | −0.72 | −0.003 | +0.001 |
| x2, pooled | 719 | 196 | −0.001 (−0.50) | −0.78 | −0.003 | +0.001 |
| replica | 327 | 44 | −0.002 (−0.40) | −0.55 | | |
| geg (240 h) | 150 | 26 | −0.001 (−0.68) | −0.19 | | |
| gtl (96 h) | 242 | 126 | +0.000 (0.03) | +0.02 | | |
| replica signals one by one | 435 | 57 | +0.002 (0.71) | +0.86 | | |

Every live position was taken by both runs (0 unmatched). On the M5 candles the council manages on, the one extra candle the
live rule holds is worth less than a thousandth of R a position. **Answer to the open question: it does not matter; keep the
live rule** (close at the close of the first candle at or after the deadline), which matches how the Trader and the gold
fidelity replay already behave.

## 4. H2 — skip positions whose round-trip cost exceeds 0.10R (`cost10`): FAIL, it removes winners

| | removed n | removed R a position (t) | kept R a position | all R a position | half A total all → kept | half B total all → kept |
|---|---|---|---|---|---|---|
| x1 | 132 | **+0.42 (1.35)** | +0.42 | +0.42 | +42.5 → +27.8 | +315.0 → +274.9 |
| x2 | 132 | +0.23 (0.75) | +0.39 | +0.36 | +14.4 → +15.8 | +292.4 → +261.1 |

Removed by system: replica 107 (+0.42R a position at x1), geg 22 (+0.49R), gtl 3 (−0.39R); the trend legs never have a stop
under $6. On the replica signals one by one, the 140 removed made +0.07R (kept +0.08R). Diagnostics (cannot pass): a 0.05R
gate removes 273 positions at +0.33R; 0.15R removes 65 at +0.23R; 0.20R removes 30 at −0.15R (t −0.30). On gold the tight-stop
replica entries are its higher-R trades, and the R they win is big enough to pay a 0.07–0.10R cost.

**Forward diagnostic (pre-registered, not part of the bar)**, the engine's paper trades of 1–9 Nov (live + shadow) split at the
Trader's own `costR`: ≤ 0.10 → n 227, **+0.33R** a trade net (t 2.8); > 0.10 → n 330, **−0.33R** (t −2.6), gross −0.06R.
**Post-hoc check** on the council's 150-day engine replay (council-data `research/backtest-150d.json`, Jun–Nov 2026, round trip
= 2 × its spread column): ≤ 0.10 → n 9,480, −0.09R net (t −6.0); > 0.10 → n 10,077, −0.33R net (t −17.3), gross −0.06R. Both
halves agree (first half −0.04 vs −0.31; second −0.13 vs −0.33). So on the engine a cost gate removes about half the trades and
two thirds of the loss, but what is left still loses: it is a way to lose less on paper, not an edge.

## 5. H3 — walk-forward session gate (`wfSession`): FAIL, nothing to switch off

| | positions 2021–26 | dropped | dropped R a position (t) | half A total all → gated | half B total all → gated |
|---|---|---|---|---|---|
| x1 | 609 | 20 | +0.06 (0.12) | −13.0 → −9.1 | +194.5 → +189.4 |
| x2 | 609 | 20 | −0.09 (−0.19) | −33.4 → −27.0 | +175.3 → +170.8 |

The gate fired five times in 24 quarters: replica Asia in 2023-Q1, Q2, Q4 and 2024-Q2, trendline Asia in 2022-Q1. The
positions it dropped were flat, it helps the weak half and hurts the strong half. No session of a main gold system has a
persistent loss that a disciplined, look-ahead-free rule can find; the Coach's session flips on the engine (`analysis/latest.md`
"Coach rule changes": 4 rules flipped 3+ times in a week) are reacting to noise, as research/edge/coach-learning found.

## Limitations

- M5 management (no M1), entries at the M5 close after the decision, as in the two harnesses' own documented departures.
- H2 and H3 remove positions from the live-rule list without re-running the portfolio rules (3 open, day stop, equity size);
  the replica's signals one by one are reported to show the effect without that state.
- The forward books are 8 days of one market week; every forward number above is a lead, not evidence of an edge.
- The cost model is the council's ($0.30 spread + slippage); the broker's actual XAUUSD spread is in ctrader/symbols.json.
- Systems not covered: Mosha BO, gold momentum pullback (`gmp`, 8 h time exit), NQ open run, crypto trend (no 2020→now
  harness in the repo with the live management); ICT is a separate desk and was not touched.

## Reproduce

```
node research/edge/replica-oos/fetch.mjs <candles>                     # OANDA XAU/USD M5/H1/H4/D1 via meridianx.dev/md/bars
CANDLES=<candles> OUT_DIR=<runs> node research/edge/council-edge/run.mjs   # 4 harness runs, about 1 minute each
node research/edge/council-edge/analyze.mjs <runs> <council-data>         # result.json
node research/edge/council-edge/breakdown.mjs <council-data> --md breakdown.md
```
