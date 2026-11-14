# Pre-registration: gold after the Chinese yuan weakens on its own (14 Nov 2026)

Written and pushed alone, before any figure of this study was computed.

## Question

China is the largest buyer of physical gold. Households and funds there are said to buy gold as a hedge when the yuan
weakens, and to sell or stop buying when it strengthens (the Shanghai premium widening in 2015-16 and 2023-24 is the usual
illustration). If that flow is large enough, a yuan move that is NOT explained by the broad US dollar (a yuan-specific move)
should be followed by gold moving the same way over the following weeks: gold up after the yuan weakens on its own, gold down
after it strengthens on its own. This is a cross-market reason, not a candle pattern, and it is both-sided by construction, so
it cannot pass by riding gold's rise alone.

**Scope.** A stand-alone rule on gold. It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily
engulf; docs/owner-decisions.md item 44), reads none of its positions, does not use the book's 2006-17 study window as a
window of its own (its windows are the ones below), and nothing here is compared with or applied to that book. Paper research
only: no live rule, size, filter, stop, config, cost constant or council member changes, whatever the verdict.

## What is already known (dedupe, read before this was written)

- `cnh-fix` (branch): USD/CNH in the quarter hour after the 01:15 UTC PBoC fix, intraday, traded on USD/CNH. Not gold, not days.
- `gold-china-holidays` (branch): gold around Chinese holiday calendars. A calendar, not the currency.
- `gold-dollar-lead`, `gold-dollar-divergence`, `gold-currency-breadth` (branches, all FAIL): the broad dollar index and gold
  in six currencies; none uses the yuan. `gold-commodity-fx-lead` (FAIL): AUD / NZD / CAD / ZAR, a dollar-neutral basket of
  commodity currencies. `macro-gold` (main): real yields. `gold-bond-lead`: Treasury prices. None reads USD/CNH.
- The untested backlog of 14 Nov (`research/proposals/2026-11-14-untested-backlog.md`) does not list it.

## Data (named before any result)

- OANDA mid complete UTC daily candles from council-data `research/daily/<key>.json` at commit `603d2d595` (read with
  `git show`, no network): `xau`, `usdcnh`, `eurusd`, `gbpusd`, `usdjpy`, `usdcad`, `usdchf`. Weekend candles folded into
  Monday with `council/fills.mjs` `foldWeekend`.
- Dollar index: the council's ICE DXY build (`council/macro.mjs` `dxySeries`) on the five pairs' folded daily closes, a value
  only on a UTC day with all five.
- Market set: gold only (the trade), USD/CNH and the dollar index only (the signal). No other market.
- USD/CNH on OANDA starts in February 2011, so with the warm-up below the first possible signal is in early 2012: the in-sample
  window is in effect 2012-2016, said here, not repaired.

## Signal (computed at each UTC day's close, from that day and earlier only)

- Common days: UTC days on which gold, USD/CNH and the dollar index all have a candle; a gap of more than 5 calendar days
  between two common days restarts the history.
- Daily log returns `c` (USD/CNH; rising = weaker yuan) and `d` (dollar index).
- `beta` = OLS slope of `c` on `d` over the 250 common-day returns BEFORE the signal day.
- Yuan-specific return `u = c - beta x d` for each of the last 20 returns (the signal day included), with that same beta;
  `S` = their sum; `sdU` = sample sd of `u` over the 250 returns before the signal day (same beta); `z = S / (sdU x sqrt(20))`.
- Yuan weak on its own: `z > +1.5`. Yuan strong on its own: `z < -1.5`.

## Tests (Holm over these three)

| Test | Signal | Side | Hold |
|---|---|---|---|
| T1 (primary, both-sided) | z > +1.5 buy gold; z < -1.5 sell gold | both | 20 gold candles |
| T2 | z > +1.5 only | buy gold | 20 gold candles |
| T3 | z > +1.5 buy gold; z < -1.5 sell gold | both | 5 gold candles |

## Trade

- Entry at the open of gold's first daily candle after the signal day; exit at the close of the hold's last candle.
- Stop 2 x ATR(20) of gold's 20 candles before the entry, on the losing side (1R). Every trade has a stop. A candle that opens
  through the stop fills at its open; a candle that touches it fills at the stop. The median stop distance is reported (the
  request asks for $10 or more).
- One position at a time per test (a signal while a trade of that test is open is skipped).
- Costs: $0.60 a round trip, plus financing on buys: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of
  price a rollover, the demo broker's long swap of 11 Nov 2026, today's rate for every year) x entry price / risk. Sells pay
  and are credited nothing. 2x costs = both doubled. The cost share (mean cost R / mean gross R) is reported.

## Windows

- In sample: signal days 2007-01-01 (in effect 2012) to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.

## Statistics and pass bar

- t on calendar-month sums of net R (every month of the window counts, an empty one as 0, booked on the exit month).
  One-sided p from the normal approximation of the out-of-sample month t; Holm over T1-T3.
- Placebo: 40 seeds (1-40). Each seed draws, among the out-of-sample eligible days (every day with a signal row), as many days
  as the test had signal days, gives them the test's real sides in date order, and runs the identical trade (one at a time).
  The real out-of-sample month t is compared with the 40 placebo month t.
- Baselines (reported, not in the bar): the same trade on EVERY eligible day, a buy every day and a sell every day, no
  one-at-a-time rule, mean net R; and T1's buys against the every-day buy, T1's sells against the every-day sell.
- A test PASSES only if all hold: out-of-sample net R a trade > 0; out-of-sample month t >= 2 and Holm p < 0.05; in-sample net
  R a trade > 0; out-of-sample net R > 0 at 2x costs; the real out-of-sample month t above the placebo month t in at least 38
  of 40 seeds; out-of-sample n >= 30.
- Verdict: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. A pass would be one paper hypothesis, never a
  rule of the live book (item 44), and would need a replication and a forward record before anything else.

## Not tested

Other thresholds, look-backs, holds or stops; the onshore yuan (CNY, not on file); the Shanghai premium itself (no data);
other metals; intraday timing.
