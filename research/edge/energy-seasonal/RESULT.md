# Energy seasonal windows: result

**Verdict: FAIL, 0 of 4 tests pass.** No calendar window here is an edge. The crude "driving season" (WTI, Brent) and
the natural gas "spring weakness" short made money on average in both windows, but none comes near the bar: the best
one-sided p is 0.088 before the correction and 0.345 after Holm over the four tests. The natural gas "winter build" long
is flat in 2016-26 and negative in 2008-15. Nothing live changed and no stream is proposed.

**Read this first: n is about 10 a test.** One trade a year gives 11 decisive years and 8 replication years. With so few
trades only a very large, very steady effect could pass; a FAIL here does not show the seasonals are absent, only that this
sample cannot tell them from noise.

Pre-registration: `PREREGISTRATION.md` (pushed before any trade was computed). Code: `run.mjs`. Numbers: `result.json`.
Data: council-data `research/daily/wtico.json`, `bco.json`, `natgas.json` (OANDA mid daily, last candle 6 Nov 2026,
weekend stubs folded with `council/fills.mjs` `foldWeekend`); 2Y yield FRED `DGS2` weekly from council-data
`macro/cache.json`. No network.

## Results (net R a trade = after the spread and financing; t over years; one trade a year)

| test | window | years | net R a trade | t | positive years | before financing | gross | stopped |
|---|---|---|---|---|---|---|---|---|
| T1 WTI long 15 Feb - 30 Apr | 2016-26 | 11 | +0.959 | 1.37 | 7 of 11 | +1.035 | +1.041 | 4 |
| T1 | 2008-15 | 8 | +0.928 | 1.50 | 5 of 8 | +0.994 | +0.999 | 2 |
| T2 Brent long 15 Feb - 30 Apr | 2016-26 | 11 | +1.080 | 1.46 | 7 of 11 | +1.167 | +1.173 | 4 |
| T2 | 2008-15 | 8 | +0.677 | 1.12 | 5 of 8 | +0.745 | +0.750 | 3 |
| T3 natural gas long 1 Sep - 31 Oct | 2016-26 | 11 | +0.108 | 0.27 | 5 of 11 | +0.163 | +0.180 | 5 |
| T3 | 2008-15 | 8 | -0.131 | -0.23 | 2 of 8 | -0.094 | -0.081 | 5 |
| T4 natural gas short 1 Feb - 31 Mar | 2016-26 | 11 | +0.413 | 1.47 | 7 of 11 | +0.420 | +0.430 | 2 |
| T4 | 2008-15 | 8 | +0.212 | 0.64 | 6 of 8 | +0.229 | +0.238 | 2 |

## The pass bar, test by test

| test | mean > 0 | one-sided p | Holm p < 0.05 | 7+ of 11 positive | 2008-15 same sign | beats placebo p95 | pass |
|---|---|---|---|---|---|---|---|
| T1 | yes | 0.1003 | no (0.3446) | yes (7) | yes | no (+0.959 vs +1.388) | no |
| T2 | yes | 0.0875 | no (0.3446) | yes (7) | yes | no (+1.080 vs +1.218) | no |
| T3 | yes | 0.3963 | no (0.3963) | no (5) | no | no (+0.108 vs +0.741) | no |
| T4 | yes | 0.0862 | no (0.3446) | yes (7) | yes | yes (+0.413 vs +0.218) | no |

## Placebo (40 seeds a test: a window of the same length starting on a random day of the year, same side and costs)

| test | placebo median | placebo 95th percentile | placebo max | the test's rank (seeds below it, of 40) | distinct start days |
|---|---|---|---|---|---|
| T1 | +0.013 | +1.388 | +1.602 | 33 | 38 |
| T2 | -0.107 | +1.218 | +1.284 | 37 | 37 |
| T3 | +0.299 | +0.741 | +0.985 | 13 | 35 |
| T4 | -0.358 | +0.218 | +0.300 | 40 | 36 |

The crude windows sit in the top fifth of random windows but under the 95th percentile; the natural gas short beats all 40,
yet its own t is 1.47 on 11 years and fails Holm. The pre-registered generator (mulberry32 with seed 1000 x test + seed,
first draw) gave a few repeated start days (35-38 distinct of 40); kept as registered.

## What carries the averages

- **Crude rests on one year.** The 2026 window (WTI 63.05 to 107.94, Brent likewise) is +6.9R on WTI and +7.4R on Brent;
  without it WTI's decisive mean is about +0.37R a trade. Four of 11 decisive years were stopped (2017, 2020, 2023,
  2025), each at about -1.05R.
- **Natural gas spring short**: the steadiest of the four (two stops in 11 years, worst -1.02R), but the edge over a
  random short window is not separable from noise at n = 11. Its shorts paid no financing in 2023-26 (2Y above 2.5 %).
- **Natural gas winter build**: five stops in 11 decisive years and in 8 replication years; 2026 exited at a gap through
  the stop (-1.22R net).

## Assumptions said plainly

- **Spread** (round trip, price units): WTI 0.03, Brent 0.03, natural gas 0.005. The demo broker's `ctrader/symbols.json`
  lists no energy symbol, so no broker figure was available to check them. At 3 x ATR stops the spread is under 0.02R a
  trade; it does not decide anything.
- **Financing**: longs pay 2Y + 2.5 % a year, shorts max(0, 2.5 % - 2Y), per `nights` rollover (Wednesday three), the
  index CFDs' convention. Commodity CFDs are often priced off the futures curve, with the carry in the price; under that
  convention read the "before financing" column. It changes no test's outcome (best t before financing 1.56, T2).
- **Contract switches**: OANDA's energy CFD prices follow a futures contract; any step at a switch is in the candles and in
  the result. No roll credit or charge is applied. Not checked against the broker.
- **Trading days**: a weekday candle with volume at least 25 % of the median of the 20 before it. Reported only (post hoc):
  with every weekday counted instead, only the 2020 crude windows move (entry 18 Feb instead of Presidents' Day 17 Feb) and
  every mean, t and count is the same. One natural gas entry (2012) moved from 4 to 6 Sep because late-August 2012
  volumes were thin; registered rule, kept.
- Stops fill at the stop, or at the open when a candle opens through it; no slippage beyond the spread.

## What this means

No seasonal energy stream is proposed. The crude and natural gas spring windows are "positive, not apart from luck" on
11 years; a re-test needs more years than exist (the next ones arrive one a year), so this question is closed for now.
Not tested: futures-curve (calendar spread) versions, weather or storage conditions, any other window.
