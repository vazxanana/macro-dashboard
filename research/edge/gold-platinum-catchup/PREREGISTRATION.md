# Pre-registration: buy gold when platinum's own short trend is up and gold's is down (14 Nov 2026)

Written and pushed alone, before any outcome of this study is computed. Only the number of signal days and of
one-at-a-time entries per window was counted beforehand (to meet the 100-event floor); no return, R or win rate was looked at.

Paper research only: a **stand-alone rule on spot gold**. It is not a gate, entry, exit or size of the live gold book, it never
reads that book's 2006-17 positions, and nothing here is compared with or applied to that book (owner decision 44). No live
rule, size, filter, stop, config, cost constant or council member changes. Platinum and silver are read, never traded.

## Why

The metals share drivers (dollar, real rates, risk appetite). The idea: when platinum is trending up on its own short trend while
gold sits below its own, gold is the laggard and catches up. Earlier studies checked other links and failed: the gold / platinum
ratio extreme (`gold-platinum-ratio`, z of the ratio, both sides), metals confirming a gold breakout (`gold-metals-confirm`), the
copper / gold ratio for indices (`copper-gold`). None tested platinum's (or silver's) OWN trend state against gold's own as a
long-only catch-up entry. Longs only: earlier studies found gold shorts lose and long gains track gold's drift, so the rule is
judged against the same-side long on every day of the same year and against a placebo that keeps gold's own state.

## Data (fixed now)

- OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `xpt.json`, `xag.json` at commit `cb50bb73`, weekend
  candles folded into the next weekday with `council/fills.mjs` `foldWeekend`. Days are matched by their UTC day stamp; a day
  counts only when gold and the metal(s) of the test all have a candle that day.
- Market set: gold is traded; platinum (`xpt`) and silver (`xag`) are read only. Nothing else.

## The rule

- SMA20(x) = mean of the last 20 daily closes of market x up to and including day d (its own candles, no look-ahead).
- Signal day d (T1, primary): platinum close(d) > SMA20(platinum, d) AND gold close(d) < SMA20(gold, d).
- Signal day d (T2): (platinum close > its SMA20 OR silver close > its SMA20) AND gold close < its SMA20.
- Trade: buy gold at the next gold daily open after d; stop = entry − 2 x ATR(20) (true range of the 20 gold candles before the
  entry candle), fixed; an open through the stop fills at that open; out at the close of the 5th candle (entry candle = 1).
  One position at a time per test: a signal while a trade is open is skipped.
- Costs: $0.60 a round trip ($0.30 spread + $0.15 slippage on each of two market orders, as the earlier gold studies) plus
  financing on every buy: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD
  swap.long of 11 Nov 2026, `council/fills.mjs`) x entry price / risk. Today's rate for every year.

Counted beforehand (signal days / one-at-a-time entries): T1 in sample 290 / 101, out of sample 312 / 114; T2 347 / 129 and
374 / 135.

## Windows

In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.

## Statistics

- Per test and window: n, win %, gross and net R a trade, net at 2x costs, total net R, and t on calendar-month sums of net R
  (every month of the window counted, empty months 0; a trade belongs to its exit month).
- **Baseline (same side, same year)**: for every calendar year, the mean net R of the same 5-candle long (same stop, costs)
  entered after EVERY eligible day of that year (overlap allowed: it is the unconditional long). Excess of a trade = its net R
  minus its signal year's baseline; reported as mean excess and its month-sum t.
- **Placebo (40 seeds, seeded generator, seeds 1-40)**: for each seed, the same number of signal days per calendar year as the
  real OOS signals, drawn at random among that year's days on which gold closed BELOW its SMA20 (the platinum / silver condition
  removed; gold's own state, the year's drift and volatility kept), run through the same one-at-a-time simulation. The real OOS
  month-sum t must beat at least 38 of the 40.
- Holm over the two tests on the one-sided OOS p of the net month-sum t (normal approximation).

## Pass bar (all must hold, for T1, the primary)

1. OOS net month-sum t >= 2 and Holm p < 0.05.
2. In-sample net R a trade > 0.
3. OOS net R a trade at 2x costs > 0.
4. OOS mean excess over the same-year baseline > 0.
5. Placebo beaten >= 38 of 40.
6. OOS n >= 30.

PASS = T1 passes. PARTIAL = only T2 passes. FAIL otherwise. Whatever the result, nothing live changes and the result is not an
edge without the owner's own pre-registered forward test.

## Not done, on purpose

No other moving-average length, hold, stop or market is tried; no short side; no re-run with other parameters after seeing a
result.
