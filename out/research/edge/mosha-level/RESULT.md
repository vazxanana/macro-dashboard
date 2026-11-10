# Mosha level reversal: result (10 Nov 2026)

**Verdict: FAIL. The pre-registered rule lost −0.35R a trade after costs over 365 trades on spot gold, 2020 to October 2026 (t −3.10, win rate 14.5 %); in sample −0.50R (n 221), out of sample −0.12R (n 144). One trade in seven reaches the barrier; the rest are stopped. It is not an edge in this form.**

Paper research only. No live rule, size, filter or mirror setting was changed. The rule, the variants and the verdict were
fixed in `PREREGISTRATION.md` (commit 7709d602) before the test file was read.

## What was tested

The owner, 10 Nov 2026, with screenshots of a gold sell taken that morning (sell 4120.42, stop 4128.92, target 4072.84,
target reached, about 5.6R): "This is how I was expecting Mosha to work."

My reading of that trade as one mechanical rule (sells; buys are the mirror image):

1. Price taps a live H4 swing high (within 0.05 %).
2. On M5, a candle closes below the last three-candle swing low made before the tap (the external BO sell).
3. The next M5 swing low after that is broken by a close (the entry BO). Zone: that low up to the high of the break candle
   and the three candles before it.
4. Sell limit at the broken low, stop $0.30 above the zone, valid 24 hours.
5. Target: the top of the nearest live H4 bullish engulf zone below (the barrier), at least 2R away. Out after 72 hours.
6. One order or position at a time. Cost $0.30 a round trip.

**The detector finds the owner's own trade.** On the council's OANDA candles of 9-10 Nov 2026 the rule places a sell at
4121.65, stop 4128.28, target 4073.45 (7.3R), placed 02:35 UTC, filled about 05:40 UTC, target reached. The owner's levels were
4120.42 / 4128.92 / 4072.84. So the rule is this trade; the test asks what happens when it is taken every time.

## Result (net of cost, orders placed 2020-01-01 to 2026-10-31)

| | Trades | Win rate | R a trade | Total R | t | Profit factor | Max drawdown |
|---|---|---|---|---|---|---|---|
| **Whole window** | 365 | 14.5 % | **−0.353** | −128.7 | −3.10 | 0.63 | 140.5R |
| In sample (2020-23) | 221 | 12.2 % | −0.501 | −110.8 | −3.72 | 0.50 | 110.8R |
| Out of sample (2024 to Oct 2026) | 144 | 18.1 % | −0.124 | −17.9 | −0.62 | 0.86 | 45.3R |
| Before costs | 365 | 14.5 % | −0.234 | −85.6 | −2.07 | 0.73 | 100.2R |
| At twice the cost | 365 | 14.2 % | −0.471 | −171.9 | −4.12 | 0.56 | 180.8R |
| Sells | 179 | 11.2 % | −0.607 | −108.7 | −5.13 | 0.39 | 121.4R |
| Buys | 186 | 17.7 % | −0.107 | −20.0 | −0.56 | 0.88 | 36.5R |

By year:

| Year | Trades | Win rate | R a trade | Total R |
|---|---|---|---|---|
| 2020 | 58 | 10.3 % | −0.35 | −20.1 |
| 2021 | 56 | 12.5 % | −0.54 | −30.5 |
| 2022 | 49 | 10.2 % | −0.69 | −33.8 |
| 2023 | 58 | 15.5 % | −0.46 | −26.5 |
| 2024 | 61 | 18.0 % | −0.28 | −17.3 |
| 2025 | 44 | 20.5 % | +0.09 | +4.0 |
| 2026 (to October) | 39 | 15.4 % | −0.12 | −4.6 |

The pre-registered tests: out-of-sample n ≥ 30 passes (144). Every other test fails: mean net R is negative in sample and
out of sample, one of three out-of-sample years is positive, t is −3.10, and the result is worse at twice the cost.

## Why it loses

- **The stop is tiny and usually hit.** 312 of 365 trades end at the stop, 45 at the target, 8 on time. The median stop
  distance is $2.77 and 55 % of trades have a stop under $3. A winner pays 4.2R on average and a loser costs 1.13R, so the rule
  needs a win rate of about 21 % to break even. It gets 14.5 %.
- **It is not only the cost.** Before costs it still loses −0.23R a trade (t −2.07).
- **Sells lose most** (−0.61R): gold rose from about $1,500 to above $4,000 in this window, and a sell from an H4 high
  fought that. Buys from an H4 low lose less (−0.11R, t −0.56) but do not win either.
- **The owner's own trade shows the margin.** After the fill the price reached 4128.0; the owner's stop was 4128.92 and
  the rule's 4128.28. It survived by under a dollar and then paid 5.6R. The test says most trades like it do not survive.

## Funnel (2018 to October 2026, warm-up years included)

2,924 H4 levels → 3,507 taps → 1,556 external BOs → 1,143 entry BOs → 492 orders. Not placed: 382 with a barrier under 2R
away, 110 with no live barrier, 74 with a stop under $1, 85 while another order or position was open. In the test window:
382 orders, 365 filled, 16 missed (the target traded before the fill), 1 expired.

## Variants (reported only; each changes one thing)

| Variant | Trades | Win rate | R a trade | t | In sample | Out of sample | p (Holm) |
|---|---|---|---|---|---|---|---|
| P: the pre-registered rule | 365 | 14.5 % | −0.353 | −3.10 | −0.501 | −0.124 | 1.00 |
| W: wide stop (the whole origin) | 323 | 16.1 % | −0.327 | −3.01 | −0.475 | −0.097 | 1.00 |
| T3: fixed 3R target, no barrier | 542 | 22.7 % | −0.213 | −2.97 | −0.280 | −0.105 | 1.00 |
| F: order on the first (external) break | 461 | 17.1 % | −0.181 | −1.52 | −0.347 | +0.087 | 1.00 |

None is positive over the window. F is slightly positive out of sample (+0.09R, n 176, t 0.41), which is noise at that size
and follows a clearly negative in-sample half.

## What this does and does not say

- It says: taking **every** H4-level tap with an M5 break, a zone-edge limit and a barrier target, by fixed rules, loses.
- It does not say the owner's trading of this pattern loses. The owner chooses which taps to take. Whatever makes that
  choice (the level's quality, the session, the news, how price arrived) is not in this rule, and that is where an edge
  would have to be.
- The rule is my reading of one example. The choices the owner may want to correct: which H4 levels count (here: every
  3-a-side swing of the last 30 days, both sides); what counts as the low before the tap (here: a three-candle swing);
  where the stop goes (here: $0.30 past the break candle's base); what the barrier is (here: the nearest H4 engulf zone).
  A corrected reading is a new pre-registration, not an edit of this one.
- Data: HistData spot gold M1 (clock per `council/histdata.mjs`), fills on M1 at the limit price, stop first when a candle
  holds both. The broker's spread at the fill is not modelled beyond the $0.30 cost; with $2-3 stops a wider spread makes
  the result worse, not better.

## Reproduce

```sh
git archive origin/council-data research/candles/xau-histdata | tar -x -C /tmp/c
GOLD_DIR=/tmp/c/research/candles/xau-histdata node research/edge/mosha-level/run.mjs run     # writes result.json
node research/edge/mosha-level/run.mjs example                                               # the owner's trade on OANDA candles
```
