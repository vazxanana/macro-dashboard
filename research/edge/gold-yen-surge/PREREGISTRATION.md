# Pre-registration: gold after a yen surge day (14 Nov 2026)

Written and pushed alone, before any figure of this study was computed.

## Question

A day on which the Japanese yen jumps against the US dollar (USD/JPY falls far more than usual) is the classic sign of a
carry unwind and a flight to safety. Does gold keep rising over the next 1 to 3 days after such a day? And after the
opposite day (USD/JPY jumps: yen sold, risk on), does gold fall? The gold terminal's driver stack has a "Yen carry-unwind
risk" row that deliberately casts no vote (`dir: null`); this study asks whether the day itself carries a tradeable
direction for gold. It changes nothing on that row, whatever the verdict.

**Scope.** A stand-alone rule on gold. It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily
engulf; docs/owner-decisions.md item 44), reads none of its positions or its 2006-17 records, and nothing here is compared
with or applied to that book. Paper research only: no live rule, size, filter, stop, config, cost constant or council
member changes, whatever the verdict.

## What is already known (dedupe, read before this was written)

- `risk-spill-jpy` (branch, FAIL 0 of 2): trades USD/JPY and AUD/JPY after a strong S&P 500 session. The yen is the TRADE
  there, not the signal, and gold is not traded.
- `chf-haven`, `gold-haven-shock` (equity shock days, gold no better than on ordinary days), `gold-dollar-lead`,
  `gold-dollar-divergence` (dollar index signals), `gold-commodity-fx-lead` (commodity currencies): none uses a yen move as
  the signal for a gold trade. The dollar studies' index holds USD/JPY at a weight of 0.136 only.
- No line of the research topic list and no study in `research/edge/` names the yen as a signal for gold.

## Data (named before any result)

- OANDA mid complete UTC daily candles from council-data `research/daily/<key>.json` at commit `e3dbfa18e` (read with
  `git show`, no network): `xau` (the trade) and `usdjpy` (the signal). Weekend candles folded into Monday with
  `council/fills.mjs` `foldWeekend`.
- Market set: gold only (the trade), USD/JPY only (the signal). No other market.

## Signal

- Daily close-to-close returns `y` of USD/JPY on its folded candles; a gap of more than 5 calendar days between two candles
  restarts the history.
- `sd` = sample standard deviation of the 20 previous daily returns (the signal day itself excluded); `z = y / sd`.
- Yen surge day: `z < −1.5` (USD/JPY falls). Yen slump day: `z > +1.5` (USD/JPY rises).
- The signal day's USD/JPY close is at or before the end of its UTC day (Friday: the 21-22:00 UTC weekly close); the trade
  enters at gold's next daily open, after it. No later data is read.

## Tests

| Test | Signal | Side | Hold |
|---|---|---|---|
| T1 (primary) | yen surge day | buy gold | 3 gold candles |
| T2 | yen slump day | sell gold | 3 gold candles |
| T3 | yen surge day | buy gold | 1 gold candle |

## Trade

- Entry at the open of gold's first daily candle whose UTC day is after the signal day; exit at the close of the hold's last
  candle.
- Stop 1.5 x ATR(14) of gold's 14 candles before the entry, on the losing side (1R). Every trade has a stop. A candle that
  opens through the stop fills at its open; a candle that touches it fills at the stop.
- One position at a time per test (a signal while a trade of that test is open is skipped).
- Costs: $0.60 a round trip (spread and slippage), plus financing on buys: `council/fills.mjs` `nights(entry, exit)` x
  `FIN.xau.long` (0.000148 of price a rollover, the demo broker's long swap of 11 Nov 2026, today's rate charged for every
  year) x entry price / risk. Sells pay and are credited nothing. 2x costs = both doubled.

## Windows

- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.

## Statistics and pass bar

- t on calendar-month sums of net R by exit month (every month of the window counts, an empty one as 0). One-sided p from
  the normal approximation of the out-of-sample month t; Holm over T1-T3.
- Placebo: 40 seeds (1-40). Each seed draws, among the out-of-sample eligible days (every day with a signal row), as many
  days as the test had signal days, with the test's side, and runs the identical trade (one at a time). The real
  out-of-sample month t is compared with the 40 placebo month t.
- Baseline (reported, not in the bar): the same trade, same hold, on EVERY eligible day (a buy every day; for T2 also a sell
  every day), no one-at-a-time rule, mean net R.
- A test PASSES only if all hold: out-of-sample net R a trade > 0; out-of-sample month t >= 2 and Holm p < 0.05; in-sample net
  R a trade > 0 (same sign in both windows); out-of-sample net R > 0 at 2x costs; the real out-of-sample month t above the
  placebo month t in at least 38 of 40 seeds; out-of-sample n >= 30.
- Verdict: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. A pass would be one paper hypothesis, never a
  rule of the live book (item 44), and would need a forward record before anything else.

## Not tested

Other thresholds, look-backs, holds or stops; other yen crosses (AUD/JPY, EUR/JPY); intraday timing of the yen move; gold
priced in yen; other metals.
