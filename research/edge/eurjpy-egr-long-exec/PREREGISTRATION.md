# Pre-registration: eurjpy-egr-long-exec (28 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed. Written and pushed alone, **before any broker
tick of these orders is read**. Owner (28 Nov 2026), after the second EUR/JPY lead was shown: "Keep going".

## Why

On 28 Nov 2026 the auto-researcher (version `auto-3`, engulf rules only, 2021 to now; 683 million tries, 1.55 million check looks,
2,974 results) had two leads, both EUR/JPY. The sell (`eurjpy-egr-exec`) passed at the broker's ticks. This is the other one:
**`eurjpy|egr12|long|against|2|0.5`**: the first return to a standing H1 engulf zone up to 12 candles old that closes back out on
the zone's side, buys only, only when the close is at or below its 200-candle average (against the trend), any hour, the H1 ATR
in the top 70 % of its last 500 readings, stop 2 x ATR(14), target 0.5R, out after 240 H1 candles, one position at a time, the
engine's skip when the cost exceeds half the stop. Worker file: check 2024 on +0.167R a trade (n 146, month t 5.00), Holm under
0.0001, before the engine's 0.01 yen cost only.

Doubts written down before this run: it is one of the best of about 1.55 million looks on these same years; a 0.5R target with a
2 ATR stop wins often and small, so a few full stops decide it, and a slightly worse fill moves the mean a lot in R terms only
when the stop is small (here it is large, about 52 pips, so the spread should matter little); it buys a falling EUR/JPY, so it
may be a mean-reversion effect of one stretch of yen history. The question here is narrow: do the broker's own bid and ask, its
commission and the swap on a EUR/JPY long leave the mid-candle result standing. A PASS only makes it a candidate for a forward
paper record, never an edge.

## The rule (unchanged)

The exact genome, `orders.mjs` (`G`), with the engine's own `sig` and `sma`. Gate, on the candle cache (OANDA mid, to
2026-11-23) before any tick: the same code over 2024 on gives 143 orders and +0.1602R, equal to the engine's own `simulate`
(n 143, +0.1602R). Window = the broker's tick history: entries from 2023-12-01 to 2026-11-20. Counted before any tick was read,
on mid candles: **147 orders**, mid mean +0.138R after the engine's cost, per-trade sd 0.64R, 114 targets, 33 stops, 0 time
exits, median stop 0.519 yen, median hold 4 hours (90th percentile 16).

## The measurement (the `eurjpy-egr-exec` method, unchanged but for the side)

Pass 1 (marks): the quote at the entry moment (looked for up to 60 s before it) and at the deadline (up to 3,600 s before it). A
buy fills at the ask: A. No entry quote = entry unresolved (left out, counted). Pass 2 (fills), only after A is known: stop
X = A - D (D = the mid risk), target T = A + 0.5 x D; first bid crossing each level, windows of at most 1,800 s over the 5-minute
candles that come within N of a level (N = 2 x W, 10 x W inside 20:55-23:04 UTC; W = 0.01 yen). A stop books at the tick's bid (a
gap fills worse), a target at T, neither by the deadline = time exit at the deadline bid. Exit unresolved = left out, counted.

R on ticks = (exit - A) / D. After costs = minus 0.000045 x A / D (the demo's EUR/JPY commission, a round trip) plus the swap
credit: `council/fills.mjs` `nights(entry, exit)` x 0.298 pips (0.00298 yen) a unit, the demo's EUR/JPY long swap on 28 Nov 2026
(`swap.long` +0.298, Wednesday three) / D. Reported beside: the same with no swap credit (a broker may change it).

## Test and verdict (one test)

R a trade after costs (with the swap credit), all resolved orders, t of calendar-month sums:

- **PASS**: mean > 0, month t >= 2, at least 100 resolved orders, and the mean with NO swap credit also > 0; exit-unresolved at
  most 10 % of the entry-resolved.
- **INCONCLUSIVE**: exit-unresolved over 10 %. **TOO FEW**: under 100 resolved. **FAIL** otherwise.

Power, said now: 147 orders over 36 months, per-trade sd near 0.64R: month t 2 needs roughly +0.11R a trade; the mid figure is
+0.138R, so a tick cost of about 0.03R a trade is enough to fail it. Reported beside, none a verdict: before costs, tick minus mid
per order, the entry spread in R, the swap in R, each year, the exit mix, open inside the 21:00-22:59 UTC rollover or not.

One run. No variant of the rule, stop, target, hours, swap or allowances on these years after the result. Deliverables: `run.mjs`,
the query files, `RESULT.md`, `result.json`, `tests/eurjpy-egr-long-exec.test.mjs`.
