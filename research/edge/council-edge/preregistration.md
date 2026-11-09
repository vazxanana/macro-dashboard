# Council edge: three exit and filter changes for the gold systems, pre-registration (9 Nov 2026)

Written and committed **before** any variant below was run. The hypotheses, data window, costs and pass bars decide the
verdicts; nothing here changes after the results are seen. Anything computed later is labelled a post-hoc diagnostic in
`RESULT.md`. Paper research only: no live rule, `config.json` or `council/trader.mjs` line changes; the owner decides.

## Why these three

The performance breakdown (`breakdown.mjs`, run on council-data of 9 Nov 01:30 UTC, before this file) finds:

- The **live** forward book is 36 closed trades, 34 of them from the legacy engine retired on 4 Nov: −0.58R a trade net
  (95% CI −0.95 to −0.20), statistically negative. The main systems have 2 closed live trades, too few to judge.
- The **shadow** engine book (521 trades) is flat net of costs (−0.02R, CI −0.21 to +0.16); trades shorter than an hour lose
  −0.46R a trade (CI −0.69 to −0.24). Costs are a large share of the small-stop trades (rscalp on gold pays 0.44–0.54R a
  round trip).
- The **research paper** replica signals across all markets (338) lose −0.25R a trade (CI −0.40 to −0.10); Asia and the
  late session are the two statistically negative sessions there.

So the three changes tested are an exit-timing question the owner left open (time exit at the open or the close), a cost
gate (small-stop trades pay too much of their risk in costs), and a disciplined session gate (the Coach's session rules
move back and forth on small samples; does a walk-forward one help the main systems at all?).

## Data and harness (the council's own code)

- OANDA XAU/USD mid candles (the live Trader's gold feed) through `meridianx.dev/md/bars`, fetched with
  `research/edge/replica-oos/fetch.mjs`: M5, H1, H4, D1 from late 2016 (indicator warm-up only) to 2026-11-07.
- **Gold replica** (`replica`, live): `research/edge/replica-oos/replay.mjs`, the live rule copied out of `council/trader.mjs`
  at run time, config of 7 Nov (v5, D1 with, volatility gate, news veto, round-number stops, 3 open, −1.5R day stop, equity
  and MSNR sizing, break-even +2R, add +1.5R, trail after +4R, out after 48 h).
- **Gold trend / trend fast / H4 trendline / daily engulf** (`gtrend`, `gtrend5`, `gtl` 96 h, `geg` 240 h):
  `research/edge/gold-systems-oos/replay.mjs`, the live blocks line for line, config of 7 Nov.
- Both harnesses are run **unchanged except for the patches named below**, applied by `run.mjs` to a copy of each file at run
  time (each patch must match exactly once or the run stops), so the variant differs from live by those lines only.
- **Evaluation window: positions entered 2020-01-01 to 2026-11-06.** Candles before 2020 only warm up indicators and the
  harnesses' running state. Halves: **A** 2020-01-01 to 2023-05-31, **B** 2023-06-01 to 2026-11-06.

## Costs

- **x1** = the council's paper-fill model (`council/fills.mjs`): spread $0.30 a unit round trip plus half a spread of
  slippage on every market order = **$0.60 a unit round trip** on gold (charged on every unit, the add included).
- **x2** = $1.20 a unit round trip. Gross is reported too.

## H1. Time exit at the deadline candle's open (`holdOpen`)

- **Live:** a trade with `maxHold` is checked on the first M5 candle starting at or after `filled + maxHold` for stop, target
  and trail like any candle, and if none hits it closes at that candle's **close**.
- **Variant:** on that candle it closes at the candle's **open** before any other check (an open beyond the stop is that same
  open, as `stopFill` would give).
- Systems: replica (48 h; positions and its add), `gtl` (96 h), `geg` (240 h). `gtrend` / `gtrend5` have no time exit.
- **Pass bar:** per position, the paired difference variant − live in net R at x1, pooled over the three systems on
  2020–26, has mean > 0 and t ≥ 2.0, is > 0 in both halves, and no system loses more than 1R in total against live.
- **If it does not pass** and |t| < 2: "no measurable difference"; the live rule stays (it is internally consistent), and
  the result is reported as the answer to the open question.

## H2. Cost gate: skip a position whose round-trip cost exceeds 0.10R (`cost10`)

- **Rule:** a new position (first unit) is not taken when its x1 round-trip cost ($0.60) is more than **0.10** of its initial
  risk (entry − stop), i.e. when the stop is closer than $6.00. The threshold is fixed here; 0.05 / 0.15 / 0.20 are reported
  as diagnostics only and cannot pass.
- Systems: replica, `gtl`, `geg`, `gtrend`, `gtrend5`. Measured on the live-rule positions (the gate removes positions; the
  harness's running state is not re-run, which is stated as a limitation) and, for the replica, on its independent
  live-rule signals (`solo` filtered to volatility gate open, D1 with, no news veto).
- **Pass bar**, pooled over the systems on 2020–26, at **both** x1 and x2:
  1. the positions the gate removes have net mean < 0 with t ≤ −2.0, and
  2. total net R of the kept positions is higher than of all positions in **both** halves, and
  3. the kept positions' mean net R is higher than all positions' on at least 3 of the 5 systems that have ≥ 10 removed.
- Forward diagnostic (not part of the bar): the engine's forward paper trades (trades.json, live + shadow) split by the
  `costR` the Trader stamped, at ≤ 0.10 vs > 0.10.

## H3. Walk-forward session gate (`wfSession`)

- Sessions as the Trader names them (UTC entry hour): asia 00–07, london 07–12, overlap 12–16, newyork 16–21, late 21–24.
- **Rule:** at the start of every calendar quarter from 2021-Q1, for each system separately, look at its positions **entered
  from 2020-01-01 and closed before the quarter starts**, the last 24 months at most. A session is switched off for that
  quarter when it has **n ≥ 15, mean net R (x1) < 0 and t ≤ −1.0**. Positions entered in that quarter in a switched-off
  session are dropped. No other parameter; nothing is chosen with data after the quarter's start.
- Systems: replica, `gtl`, `geg` (the trend legs enter on the daily close, one session by construction, and are excluded).
- **Evaluation window for H3: positions entered 2021-01-01 to 2026-11-06** (2020 is history only); halves 2021-01 to
  2023-12 and 2024-01 to 2026-11.
- **Pass bar**, at **both** x1 and x2: the dropped positions have net mean < 0 with t ≤ −2.0 pooled, and the gated book's
  total net R is higher than the ungated book's in both halves, pooled over the three systems.

## Multiple comparisons

Three hypotheses, one fixed variant each. Under no true effect about one in seven runs of this plan would show a formal
pass somewhere by chance (rough); the x2 cost requirement and the both-halves requirement are the guard.

## What the result feeds

`RESULT.md` and the owner's proposal `research/proposals/2026-11-09-council-edge.md`. A pass is a proposal, never a live
change; the live rules stay until the owner says otherwise.
