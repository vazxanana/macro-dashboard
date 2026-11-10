# Mosha cycle, second half (the buy at the barrier): result (10 Nov 2026)

**Verdict: FAIL. The buy at the barrier lost −0.22R a trade after costs over 132 trades on spot gold, 2020 to October 2026 (t −0.99, win rate 14.4 %); in sample −0.12R (n 74), out of sample −0.35R (n 58). The whole cycle as the owner describes it (the retracement trade, then the buy at the barrier) comes to −0.03R a trade over 577 trades (t −0.29): no edge as fixed rules.**

Paper research only. No live rule, size, filter or mirror setting was changed. The rule, the variants and the verdict were
fixed in `PREREGISTRATION.md` (commit 6370bec3) before the test file was read for this rule.

## What was tested

The owner's answers of 10 Nov 2026 about the Mosha trade: the method is top-down order only (H4, then H1, then M15 or M5);
the entry is the zone of the break; and when the retracement reaches the H4 barrier: "Close, then buy with H4". That buy is
the main trade. `research/edge/mosha-retrace/` tested the first half (the retracement). This is the second half.

The rule (written for an H4 BO buy; the other side is the mirror image):

1. **H4 BO buy**, then the first **H1 BO sell** after it (the retracement), as in mosha-retrace.
2. **The barrier**: the nearest live H4 bullish engulf zone below the broken H1 level.
3. **The retracement reaches the barrier** (an M5 low at or below its top) before a newer H4 BO or an H4 close under it.
4. **H1 BO buy**: the first H1 close above the last H1 swing high after the tap, within 72 hours.
5. **Entry**: buy limit at the broken H1 level; zone bottom = the M5 candle that broke it and the three before; stop $0.30
   below. Valid 24 hours.
6. **Target**: the high the retracement came from, at least 2R away. Out after 72 hours. One at a time, $0.30 cost, fills on M1.

**The owner's cycle of 9-10 Nov on the council's candles:** H4 BO buy at 20:00 UTC on 9 Nov, H1 BO sell at 03:00 UTC on
10 Nov, barrier top 4073.45, tapped at 10:35 UTC on 10 Nov. When this was run the cycle was waiting for an H1 BO buy, so
there is no finished example trade of this half.

## Result (net of cost, orders placed 2020-01-01 to 2026-10-31)

| | Trades | Win rate | R a trade | Total R | t | Profit factor | Max drawdown |
|---|---|---|---|---|---|---|---|
| **Whole window** | 132 | 14.4 % | **−0.220** | −29.1 | −0.99 | 0.77 | 48.1R |
| In sample (2020-23) | 74 | 14.9 % | −0.119 | −8.8 | −0.36 | 0.88 | 27.8R |
| Out of sample (2024 to Oct 2026) | 58 | 13.8 % | −0.351 | −20.3 | −1.27 | 0.63 | 26.1R |
| Before costs | 132 | 14.4 % | −0.111 | −14.6 | −0.50 | 0.87 | 38.8R |
| At twice the cost | 132 | | −0.330 | | | | |
| H4 BO buy side (buys) | 73 | | −0.217 | | −0.74 | | |
| H4 BO sell side (sells) | 59 | | −0.224 | | −0.66 | | |

By year: 2020 +12.0R (18 trades), 2021 +0.1R (28), 2022 −8.2R (17), 2023 −12.7R (11, no winner), 2024 −10.4R (24),
2025 +4.6R (20), 2026 −14.5R (14, no winner).

The pre-registered tests: out-of-sample n ≥ 30 passes (58). Every other test fails. 113 of 132 trades end at the stop,
17 at the target, 2 on time. A winner pays 5.1R and a loser costs 1.12R, so break-even needs a win rate of 17.9 %; the rule
gets 14.4 %. With 132 trades the result cannot be told from zero (t −0.99), but nothing in it points up.

## The whole cycle (descriptive: both halves on one timeline, no test)

| | Trades | Win rate | R a trade | Total R | t | Max drawdown |
|---|---|---|---|---|---|---|
| First half: the retracement trade (mosha-retrace) | 445 | 18.0 % | +0.022 | +9.9 | 0.17 | 43.4R |
| Second half: the buy at the barrier | 132 | 14.4 % | −0.220 | −29.1 | −0.99 | 48.1R |
| **Both** | 577 | 17.2 % | −0.033 | −19.2 | −0.29 | 65.7R |
| Both, in sample | 323 | 18.3 % | +0.023 | +7.6 | 0.15 | 58.5R |
| Both, out of sample | 254 | 15.7 % | −0.105 | −26.8 | −0.66 | 42.5R |

## Funnel (2018 to October 2026, warm-up years included)

1,038 H4 BOs → 986 with an H1 retracement → 919 with a live barrier → 467 where the retracement reached it (about half)
→ 252 with an H1 BO back within 72 hours → 185 orders (54 with the target under 2R away, 13 with a stop under $1). In the
test window: 151 orders, 132 filled, 17 missed, 2 expired.

## Variants (reported only; each changes one thing)

| Variant | Trades | Win rate | R a trade | t | In sample | Out of sample | p (Holm, 4 tests) |
|---|---|---|---|---|---|---|---|
| P: the pre-registered rule | 132 | 14.4 % | −0.220 | −0.99 | −0.119 | −0.351 | 1.00 |
| Z: stop under the barrier | 31 | 19.4 % | −0.242 | −0.77 | −0.232 | −0.255 | 1.00 |
| M15: the entry zone on M15 | 112 | 17.0 % | −0.188 | −0.91 | −0.154 | −0.234 | 1.00 |
| T3: fixed 3R target | 138 | 20.3 % | −0.366 | −2.78 | −0.373 | −0.356 | 1.00 |

None is positive in either half. The wide stop under the barrier leaves 31 trades in seven years (the target is rarely 2R
away from a stop that wide). The M15 zone, the one hint of the first half, is negative here.

## What this does and does not say

- Three pre-registered studies on this day, thirteen tests, the owner's own trade found by each detector that could find
  it: no mechanical version of the cycle makes money on gold over 2020 to October 2026. The first half is break-even, the
  second half loses a little, the tap-of-a-level reading loses clearly.
- It does not say the owner's trading of the pattern loses. The owner picks the cycles, the zones and the moments. The
  rules here take every one.
- The remaining honest way to measure the method is the owner's own record: the trades actually taken, logged with entry,
  stop, target and result (ChronosTrade or the Academy keep that record).
- Data and fills as in mosha-level: HistData spot gold M1, fills at the limit price, stop first when one candle holds both.

## Reproduce

```sh
git archive origin/council-data research/candles/xau-histdata | tar -x -C /tmp/c
GOLD_DIR=/tmp/c/research/candles/xau-histdata node research/edge/mosha-cycle/run.mjs run     # writes result.json
node research/edge/mosha-cycle/run.mjs example                                               # the last days' cycles on OANDA candles
```
