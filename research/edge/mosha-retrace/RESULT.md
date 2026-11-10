# Mosha retracement chain: result (10 Nov 2026)

**Verdict: FAIL on the pre-registered rule, and in substance break-even. The chain made +0.02R a trade after costs over 445 trades on spot gold, 2020 to October 2026 (t 0.17, win rate 18.0 %); in sample +0.07R (n 249), out of sample −0.03R (n 196). The owner's correction removes the loss of the first reading (−0.35R) but leaves no edge that can be told from zero.**

Paper research only. No live rule, size, filter or mirror setting was changed. The rule, the variants and the verdict were
fixed in `PREREGISTRATION.md` (commit 32dabfb0) before the test file was read for this rule.

## What was tested

The owner, 10 Nov 2026, after the first reading (`research/edge/mosha-level/`) failed: "This is high time frame aligned:
after a H4 we can look for H1 to know when the retracement or pullback starts, then we use M15 or M5 to trade that
retracement or pullback."

As one mechanical rule (written for a sell; buys are the mirror image):

1. **H4 BO buy**: an H4 close above the last H4 swing high.
2. **H1 BO sell**: the first H1 close below the last H1 swing low after that. The retracement has started.
3. **Entry**: sell limit at the broken H1 level. Zone top = the M5 candle that broke the level and the three M5 candles
   before it. Stop $0.30 above. Valid 24 hours.
4. **Target**: the top of the nearest live H4 bullish engulf zone below (the barrier), at least 2R away. Out after 72 hours.
5. One H1 signal per H4 BO, one order or position at a time, $0.30 cost, fills on M1.

**The chain reads the owner's own trade.** On the council's OANDA candles: H4 BO buy at 20:00 UTC on 9 Nov (close 4136.5
above 4134.1), H1 BO sell at 03:00 UTC on 10 Nov (close 4111.7 below 4121.6), M5 break candle 02:30, sell limit 4121.63,
stop 4128.28, target 4073.45 (7.3R), target reached. The owner's levels were 4120.42 / 4128.92 / 4072.84.

## Result (net of cost, orders placed 2020-01-01 to 2026-10-31)

| | Trades | Win rate | R a trade | Total R | t | Profit factor | Max drawdown |
|---|---|---|---|---|---|---|---|
| **Whole window** | 445 | 18.0 % | **+0.022** | +9.9 | 0.17 | 1.02 | 43.4R |
| In sample (2020-23) | 249 | 19.3 % | +0.066 | +16.3 | 0.36 | 1.07 | 43.4R |
| Out of sample (2024 to Oct 2026) | 196 | 16.3 % | −0.033 | −6.4 | −0.17 | 0.96 | 30.7R |
| Before costs | 445 | 18.0 % | +0.126 | +56.2 | 0.96 | 1.15 | 30.8R |
| At twice the cost | 445 | 18.0 % | −0.082 | −36.4 | −0.62 | 0.92 | 60.9R |
| Sells | 245 | 15.9 % | −0.019 | −4.7 | −0.10 | 0.98 | 47.8R |
| Buys | 200 | 20.5 % | +0.073 | +14.6 | 0.40 | 1.08 | 26.2R |

By year:

| Year | Trades | Win rate | R a trade | Total R |
|---|---|---|---|---|
| 2020 | 58 | 19.0 % | −0.26 | −14.9 |
| 2021 | 59 | 23.7 % | +0.43 | +25.5 |
| 2022 | 62 | 9.7 % | −0.29 | −18.0 |
| 2023 | 70 | 24.3 % | +0.34 | +23.7 |
| 2024 | 75 | 10.7 % | −0.39 | −29.5 |
| 2025 | 68 | 20.6 % | +0.32 | +22.0 |
| 2026 (to October) | 53 | 18.9 % | +0.02 | +1.2 |

The pre-registered tests: out-of-sample n ≥ 30 passes (196), in-sample mean above zero passes (+0.066), two of three
out-of-sample years positive passes. It fails on out-of-sample mean above zero (−0.033), t ≥ 2 (0.17) and twice the cost
(−0.082). By the rule fixed beforehand that is a FAIL; read plainly it is a coin flip around zero, alternating good and
bad years.

## What changed against the first reading

| | Trades | Win rate | R a trade | t | Before costs |
|---|---|---|---|---|---|
| First reading (H4 level tap, M5 breaks) | 365 | 14.5 % | −0.353 | −3.10 | −0.234 |
| The owner's chain (H4 BO, H1 BO against, M5 zone) | 445 | 18.0 % | +0.022 | 0.17 | +0.126 |

The chain is clearly the better description: the same entry and target mechanics lose a third of an R a trade without it
and nothing with it. But "does not lose" is not an edge. A winner pays 5.2R and a loser costs 1.11R, so break-even is a
win rate of 17.6 %; the rule gets 18.0 %. 364 of 445 trades end at the stop, 62 at the barrier, 19 on time. The median stop
is $3.21, so the $0.30 cost alone is about a tenth of an R on every trade: before costs the rule makes +0.13R (t 0.96),
after them +0.02R.

## Funnel (2018 to October 2026, warm-up years included)

1,038 H4 BOs and 7,669 H1 BOs → 986 signals (the first H1 BO against an H4 BO) → 647 orders. Not placed: 199 with the
barrier under 2R away, 67 with a stop under $1, 61 with no live barrier, 12 while another order or position was open. In
the test window: 523 orders, 445 filled, 49 missed (the barrier traded before the fill), 29 expired.

## Variants (reported only; each changes one thing)

| Variant | Trades | Win rate | R a trade | t | In sample | Out of sample | At 2x cost | p (Holm, 5 tests) |
|---|---|---|---|---|---|---|---|---|
| P: the pre-registered chain | 445 | 18.0 % | +0.022 | 0.17 | +0.066 | −0.033 | −0.082 | 1.00 |
| M15: the entry zone on M15 | 418 | 23.9 % | +0.099 | 0.81 | +0.078 | +0.126 | +0.020 | 1.00 |
| A: only with the weekly direction | 204 | 18.1 % | −0.106 | −0.62 | −0.168 | −0.012 | −0.212 | 1.00 |
| K: only at an H4 key level | 365 | 17.3 % | −0.041 | −0.30 | +0.012 | −0.112 | −0.148 | 1.00 |
| T3: fixed 3R target | 537 | 28.9 % | +0.003 | 0.05 | +0.004 | +0.002 | −0.092 | 1.00 |

- **M15 is the least bad**: +0.10R a trade, positive in sample and out of sample, a wider stop (median $4.38) that costs
  survive. It is still t 0.81 on one of nine tests run on this data today (Holm-adjusted p 1.00 over the five here and over
  all nine). It is a hypothesis, not a finding.
- **The weekly filter does not help** (−0.11R). Trading the retracement only when it agrees with the weekly direction keeps
  fewer than half the trades and they are worse.
- **The H4 key level does not help either** (−0.04R): requiring the tap of an H4 swing level before the H1 break, the
  thing the first reading was built on, removes 80 trades and the result is slightly worse.
- **A fixed 3R target** gives the same zero with more winners and smaller ones.

## What this does and does not say

- It says: taken on every H4 BO, mechanically, on M5, the retracement trade is break-even after costs on gold over seven
  years. It is not worth switching on as a system in this form.
- It does not say the owner's trades of this pattern are break-even. The owner chooses which chains to take and where the
  zone is. That choice is not in the rule.
- What the numbers point at, as hypotheses only: the entry on M15 rather than M5 (wider stop), and the buy side
  (+0.07R on M5, +0.22R on M15, over a window in which gold rose). Either needs its own pre-registration on data this
  study did not use to pick it. The council's HistData gold file starts in 2018; the live Mosha study has OANDA candles
  from 2006.
- Data and fills as in mosha-level: HistData spot gold M1, fills at the limit price, stop first when one candle holds both.

## Reproduce

```sh
git archive origin/council-data research/candles/xau-histdata | tar -x -C /tmp/c
GOLD_DIR=/tmp/c/research/candles/xau-histdata node research/edge/mosha-retrace/run.mjs run     # writes result.json
node research/edge/mosha-retrace/run.mjs example                                               # the owner's trade on OANDA candles
```
