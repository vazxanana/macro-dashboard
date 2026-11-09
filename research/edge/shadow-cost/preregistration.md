# Shadow streams at realistic costs, pre-registration (9 Nov 2026)

Proposal 3 of `research/proposals/2026-11-09-council-edge.md`, widened by the owner: compare **every** paper shadow stream with
realistic execution costs and keep only those whose cost is at most 0.10R a trade. Paper research only: no live rule,
`config.json`, `council/trader.mjs`, tracker, alert or mirror setting changes; the owner decides.

This file and `costmodel.mjs` were written before `run.mjs` computed any out-of-sample (OOS) statistic of any stream with the cost
model below. What had been seen before: the input data's shape, the demo mirror's fill log (an input to the cost model), the ICT
replay's gross totals per variant (printed in `ict/replay.json` itself), and the engine shadow book's gross and modelled-net figures
already published by `research/edge/shadow-audit` and `research/edge/council-edge`. So the engine streams' forward record is not
blind; the realistic re-costing and every stream's verdict are new. The owner asked for one commit, so this file lands in the same
commit as the result; the order is stated here instead of being shown by git.

## Streams (one row each)

| stream | what it is | backtest in the repo (per trade) | live paper |
|---|---|---|---|
| `nq-trend` | NQ New York open run, trend-on only (`nq-regime-shadow`, \|TS\| >= 0.295) | `research/edge/regime-switch/inputs.json` 1,869 study trades 2004–Nov 2026, gated with `council/regime.mjs` | research.json `nq-nyflipt-*` (since 8 Nov) |
| `lit` | LIT paper shadow on gold (pre-registered primary: M15 FBOS → M5 RBOS wick, limit at the OB open, 0.08% cap) | `research/edge/lit/result.json` XAUUSD `std:wick-open` trades 2008–Oct 2026 | trades.json `k 'lit'` (since 8 Nov) |
| `ict-nofri`, `ict-h1opp`, `ict-strail`, `ict-silver` | ICT A-rule shadow variants (no Friday, H1 opposite, structure trail, spot silver) | council-data `ict/replay.json` `shadowByVariant`, Aug 2025–Nov 2026 | `ict/shadow.json` `.variants` (since 7 Nov) |
| `ict-dip` | ICT NQ/ES dip-buy shadow | `ict/replay.json` `shadow`, Aug 2025–Nov 2026 | `ict/shadow.json` (since 7 Nov) |
| `eng-scalp`, `eng-rscalp`, `eng-intraday`, `eng-rintra`, `eng-swing`, `eng-rswing`, `eng-position`, `eng-m30m1` | council engine setups the live rules block (the shadow book) | council-data `research/backtest-150d.json` (the engine's own 150-day replay, Jun–Nov 2026; m30m1 has none) | trades.json `shadow: true`, by `k` (since 1 Nov), status `duplicate` / `void` dropped |

The ICT A-setups (live desk rule) are reported as a reference row only; they are not a shadow stream and get no verdict.

## In-sample and out-of-sample

- **Streams with a backtest that starts before 2020** (`nq-trend`, `lit`): IS = backtest trades entered before 2020-01-01;
  **OOS = backtest trades entered 2020-01-01 or later, pooled with the live paper trades.**
- **Streams whose backtest starts after 2020** (ICT variants and dip, engine setups): the backtest covers the window the rule was
  designed or tuned on (the ICT desk on 2023–26 data, the engine and its Coach on the 2026 replay), so **the backtest is the IS
  sample and the OOS sample is the live paper record only.**
- OOS halves: the OOS trades in entry-time order, split at the middle trade.

## Realistic cost per trade (`costmodel.mjs`)

Round trip in price = spread + commission + entry slippage (market entries only) + exit slippage (every exit except a resting
target). Cost in R = that ÷ the trade's initial risk (entry to first stop), times the trade's size where the record carries one.

- **Spread.** Forex and gold: the costs study's raw-account typical spreads and its session multiplier on the New York hour of
  entry (`research/edge/costs/costs.mjs` `LEVEL.raw`, `sessMult`). Spot silver: $0.025 with the gold session shape (assumption, no
  broker quote). Crypto: the demo broker's own quoted spread as a fraction of price (council-data `ctrader/symbols.json`; XRP has no
  broker symbol and takes the mean fraction of BTC, ETH and SOL). CME futures (ICT desk, NQ open run): one tick.
- **Commission.** The demo broker's rate from `ctrader/symbols.json` (`commission.preciseRate` ÷ 1e8 USD per million notional, a
  side, charged twice): forex 45e-6 × price, gold 24e-6 × price (silver as gold), crypto and index CFDs 0. CME micros: $1.24 round
  trip (`research/edge/costs` `futCost`).
- **Slippage.** Market entry: `LEVEL.slipM` (forex, gold), $0.005 silver, half a broker spread crypto, one tick futures. Exit on a
  stop / trail / break-even: `LEVEL.slipS`, $0.01, half a spread, one tick; on a time or market exit: the market-entry figure.
  **Measured from the demo mirror where it can be:** fills in `ctrader/mirror*.json` with `lagSec` ≤ 300 (a same-time copy; the late
  catch-up copies measure drift, not execution) and a market entry; the adverse fill − council entry beyond half a spread, in units of
  the default market slippage, averaged per asset group. A group with **≥ 5** such fills (one per `positionId`) uses
  max(default, measured); with fewer, the default stays and the measurement is reported. The ICT account's fills are on index CFDs
  against futures signals (no `slipR`), so they cannot be used.
- **Sensitivity:** every net figure is also computed at 2× the cost ("x2").

## Hypotheses and bars (fixed here)

For each stream:

- **Cost screen (proposal 3, stream level):** the mean realistic cost a trade over all of the stream's trades (backtest + live;
  cost depends on stops and markets, not on outcomes) is **≤ 0.10R**.
- **PASS:** cost screen passed, **and** on the OOS sample: n ≥ 30, net expectancy > 0 with **t ≥ 2.0**, net > 0 in **both** OOS
  halves, net expectancy > 0 at **x2**; and, where the live paper record has n ≥ 10, its net t is above −2.0.
- **FAIL:** the cost screen fails, **or** the OOS sample has n ≥ 30 and net expectancy ≤ 0.
- **INCONCLUSIVE:** anything else (fewer than 30 OOS trades, or positive but short of the PASS bar).
- **"Survives proposal 3"** (reported for the owner, not a verdict): cost ≤ 0.10R and net OOS expectancy > 0 as point estimates,
  whatever the t; with no OOS trade a stream cannot survive.

Secondary, per trade (proposal 3 as written for the engine): the same stream keeping only the trades whose own realistic cost is
≤ 0.10R ("gated"), judged on the same PASS / FAIL / INCONCLUSIVE bar except the stream-level cost screen (it holds by construction).

Also reported, not part of any bar: IS statistics, cost at x1 split into spread / commission / slippage, median cost, win rate,
total, max drawdown of the net OOS curve, the live record alone, and the cost the council's own `council/fills.mjs` model charges.

## Multiple comparisons

15 streams + 15 gated rows. With no edge anywhere, roughly one row in forty clears t ≥ 2 by chance at each of the two steps; the
both-halves and x2 requirements are the guard, and a PASS remains a proposal.
