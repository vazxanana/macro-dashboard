# Pre-registration: gold after the US dollar index's biggest move in a month (14 Nov 2026)

Written and pushed alone, before any return of this study was computed. Only the number of signal days per window was
counted (below), to check the study can reach the required sample; no gold return, trade or R was looked at.

## Question

On a day when the US dollar index moves more (up or down) than on any of the 21 trading days before it, gold usually moves
the other way the same day. Over the next days, does gold keep going against the dollar's shock, or give it back? The rule
under test: after a dollar shock day, trade gold AGAINST the dollar's move (buy gold after a dollar up shock, sell gold after
a dollar down shock), on the view that the dollar's one-month record move partly reverses and gold, which absorbed it, is
pushed the opposite way. The continuation (gold with the dollar's move) is the third test.

**Scope.** A stand-alone rule on gold. It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily
engulf; docs/owner-decisions.md item 44), reads none of its positions (the 2006-17 positions are not used), and nothing here
is compared with or applied to that book. Paper research only: no live rule, size, filter, stop, config, cost constant or
council member changes, whatever the verdict.

## What is already known (dedupe, read before this was written)

- `gold-dollar-lead` (branch, FAIL 0 of 3): weekly and daily dollar z-scores beyond 1 with gold LAGGING its rolling-beta
  co-move, traded for gold to catch up (T1 OOS +0.174R, n 30, month t 1.12). A residual / lag signal; this study uses the
  dollar's own one-month record move, whatever gold did, and a 5-day hold.
- `gold-dollar-divergence` (branch, FAIL 0 of 3): gold and the dollar BOTH beyond 0.5 sd the same way. Different event.
- `gold-shock-revert` (gold's own extreme day), `gold-haven-shock` (equity shock days), `gold-yield-shock`,
  `gold-em-fx-stress`, `gold-yen-surge`, `gold-eurchf-stress`: other markets' or gold's own shocks; none uses the broad
  dollar index's record move. Those results were read; this study's thresholds (21 days = one trading month, the request's
  "biggest move of the month"), hold and stop were fixed by the request and the common brief, not tuned to them.

## Data (named before any result)

- OANDA mid complete UTC daily candles, council-data `research/daily/<key>.json` at commit `aa68d9ce` (read with `git show`,
  no network): `xau`, `eurusd`, `gbpusd`, `usdjpy`, `usdcad`, `usdchf`. Weekend candles folded into Monday with
  `council/fills.mjs` `foldWeekend`.
- Dollar index: the council's ICE DXY build of `council/macro.mjs` `dxySeries`: 50.14348112 x EURUSD^-0.576 x
  USDJPY^0.136 x GBPUSD^-0.119 x USDCAD^0.091 x (11.2 / EURUSD)^0.042 x USDCHF^0.036, on the folded closes, a value only on a
  UTC day with all five pairs and a gold candle.
- Market set: gold only (the trade), the dollar index only (the signal). No other market.

## Signal

- Close-to-close returns `d` of the dollar index on the common days; a gap of more than 5 calendar days restarts the history.
- Shock day: `|d|` strictly larger than `|d|` of every one of the 21 returns before it (the day itself excluded; only earlier
  data). Up shock if `d > 0`, down shock if `d < 0`. The signal is known at the day's close.
- Counted before registration (signal days by window, nothing else): in sample 2007-16, 123 shock days (63 up, 60 down) of
  2,601; out of sample 2017-01 to 2026-10, 125 (55 up, 70 down) of 2,552. All three tests use every shock day (both sides
  pooled), so each window holds at least 100 events. The single-side splits (55-70) are reported only, not tested.

## Tests (at most 3, Holm over all three)

| Test | Side | Hold |
|---|---|---|
| T1 (primary) | gold against the dollar's move (buy after an up shock, sell after a down shock) | 5 gold candles |
| T2 | gold against the dollar's move | 1 gold candle |
| T3 | gold with the dollar's move (continuation: sell after an up shock, buy after a down shock) | 5 gold candles |

## Trade

- Entry at the open of gold's first daily candle after the signal day; exit at the close of the hold's last candle.
- Stop 2 x ATR(20) of gold's 20 candles before the entry, on the losing side (1R). Every trade has a stop. A candle that
  opens through the stop fills at its open; a candle that touches it fills at the stop.
- One position at a time per test (a signal while a trade of that test is open is skipped).
- Costs: $0.60 a round trip, plus on buys `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a
  rollover, the demo broker's long swap of 11 Nov 2026, today's rate for every year) x entry / risk. Sells pay and are
  credited nothing. 2x costs = both doubled.

## Baseline

- For each side and calendar year: the same trade (same hold, stop and costs) entered after EVERY eligible day of that year
  (no one-at-a-time rule), mean net R. A trade's excess = its net R less the same-side baseline mean of its signal year.
  Reported per window as mean excess R and its month-sum t.

## Windows

- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.

## Statistics and pass bar

- t on calendar-month sums (every month of the window counts, an empty one as 0), by the exit month. One-sided p from the
  normal approximation of the out-of-sample net month t; Holm over T1-T3.
- Placebo: 40 seeds (1-40). Each seed draws, among the out-of-sample eligible days, as many days as the test has signal days,
  gives them the real signals' sides in date order, and runs the identical trade (one at a time). The real out-of-sample net
  month t is compared with the 40 placebo month t.
- A test PASSES only if all hold: out-of-sample net R a trade > 0; out-of-sample net month t >= 2 and Holm p < 0.05;
  in-sample net R a trade > 0; out-of-sample net R > 0 at 2x costs; out-of-sample mean excess over the same-year baseline > 0
  with excess month t >= 2; in-sample mean excess > 0; real month t above at least 38 of 40 placebos; out-of-sample n >= 30.
- Verdict: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. A pass would be one paper hypothesis, never a
  rule of the live book (item 44), and would need replication and a forward record before anything else.

## Not tested

Other look-backs (a week, a quarter), z-score thresholds, holds or stops; single pairs instead of the index; the single-side
splits as tests; intraday timing; other metals.
