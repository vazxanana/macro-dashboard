# Pre-registration: gold and the US dollar moving the same way on one day (14 Nov 2026)

Written and pushed alone, before any figure of this study was computed.

## Question

Gold usually moves against the US dollar on the same day. On a day when gold and the dollar BOTH rise strongly (gold strong
in spite of the dollar), does gold keep rising over the next 1 to 3 days? On a day when both fall strongly, does gold keep
falling? An unusual-relative-strength (continuation) signal.

**Scope.** A stand-alone rule on gold. It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily
engulf; docs/owner-decisions.md item 44), reads none of its positions, and nothing here is compared with or applied to that
book. Paper research only: no live rule, size, filter, stop, config, cost constant or council member changes, whatever the
verdict.

## What is already known (dedupe, read before this was written)

- `gold-dollar-lead` (branch, FAIL 0 of 3): the dollar index's big days / weeks with gold LAGGING its co-move (residual from a
  rolling beta), traded for gold to catch up. Its daily T3 (|dollar z| > 1 and gold's residual on the "lagged" side, 1 day,
  gold against the dollar) lost out of sample (−0.069R, month t −3.51), read there as "gold that lagged kept lagging". It did
  not test the days on which gold and the dollar both move the same way as a CONTINUATION signal; this study does. Because
  that result was read before this registration, this study's rules were fixed by the request (thresholds, holds, stop) and
  are not tuned to it; the overlap is named in the result.
- `gold-silver-divergence` (gold vs silver, H1), `gold-haven-shock` (equity shock days), `pre-fomc-gold-usd` (the 24 h before
  FOMC), `macro-gold` (20-day broad-dollar fall, lagged): none tests same-day gold / dollar co-movement days as a signal.

## Data (named before any result)

- OANDA mid complete UTC daily candles from council-data `research/daily/<key>.json` at commit `8ddb14b5` (read with
  `git show`, no network): `xau`, `eurusd`, `gbpusd`, `usdjpy`, `usdcad`, `usdchf`. Weekend candles folded into Monday with
  `council/fills.mjs` `foldWeekend`.
- Dollar index: the council's own ICE DXY build of `council/macro.mjs` `dxySeries`:
  50.14348112 x EURUSD^-0.576 x USDJPY^0.136 x GBPUSD^-0.119 x USDCAD^0.091 x (11.2 / EURUSD)^0.042 x USDCHF^0.036, on the
  folded daily closes, a value only on a UTC day with all five pairs. Rising = stronger dollar.
- Market set: gold only (the trade), the dollar index only (the signal). No other market.

## Signal

- Daily close-to-close returns of gold `g` and of the dollar index `d`, on UTC days where both exist; a gap of more than 5
  calendar days between two common days restarts the history.
- `sdG`, `sdD` = sample standard deviation of the 20 previous daily returns of each (the signal day itself excluded).
- Up day: `g > +0.5 sdG` AND `d > +0.5 sdD`. Down day: `g < −0.5 sdG` AND `d < −0.5 sdD`.

## Tests

| Test | Signal | Side | Hold |
|---|---|---|---|
| T1 (primary) | up day (both rise) | buy gold | 3 gold candles |
| T2 | down day (both fall) | sell gold | 3 gold candles |
| T3 | up day (both rise) | buy gold | 1 gold candle |

## Trade

- Entry at the open of gold's first daily candle after the signal day; exit at the close of the hold's last candle.
- Stop 1.5 x ATR(14) of gold's 14 candles before the entry, on the losing side (1R). Every trade has a stop. A candle that
  opens through the stop fills at its open; a candle that touches it fills at the stop.
- One position at a time per test (a signal while a trade of that test is open is skipped).
- Costs: $0.60 a round trip (spread and slippage), plus financing on buys: `council/fills.mjs` `nights(entry, exit)` x
  `FIN.xau.long` (0.000148 of price a rollover, the demo broker's long swap of 11 Nov 2026, today's rate for every year) x
  entry price / risk. Sells pay and are credited nothing. 2x costs = both doubled.

## Windows

- In sample: signal days 2008-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.

## Statistics and pass bar

- t on calendar-month sums of net R (every month of the window counts, an empty one as 0). One-sided p from the normal
  approximation of the out-of-sample month t; Holm over T1-T3.
- Placebo: 40 seeds (1-40). Each seed draws, among the out-of-sample eligible days (every day with a signal row), as many days
  as the test had signal days, with the test's side, and runs the identical trade (one at a time). The real out-of-sample
  month t is compared with the 40 placebo month t.
- Baseline (reported, not in the bar): the same trade, same hold, on EVERY eligible day (a buy every day; for T2 also a sell
  every day), no one-at-a-time rule, mean net R.
- A test PASSES only if all hold: out-of-sample net R a trade > 0; out-of-sample month t >= 2 and Holm p < 0.05; in-sample net R
  a trade > 0 (positive in both windows); out-of-sample net R > 0 at 2x costs; the real out-of-sample month t above the
  placebo month t in at least 38 of 40 seeds; out-of-sample n >= 30.
- Verdict: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. A pass would be one paper hypothesis, never a
  rule of the live book (item 44), and would need a forward record before anything else.

## Not tested

Other thresholds, look-backs, holds or stops; a residual / beta form (that is `gold-dollar-lead`); single pairs; intraday
timing; other metals.
