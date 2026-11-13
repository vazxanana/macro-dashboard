# Result: crypto short-term reversal after a sharp three-day drop (13 Nov 2026)

**Verdict: FAIL, 0 of 4 tests pass.** Buying BTC, ETH, SOL or XRP at the next open after a three-day return below −2 x its
trailing 90-day standard deviation, with a 2.5 x ATR14 stop, out at the close of day 3 (or day 7), lost money after costs and
financing in 2022-26 in three of the four tests (main rule −0.095R a trade, n 109, month-sum t −1.66) and lost before costs
too (−0.081R). The one positive test, the day-7 exit above the 200-day average (+0.122R, n 23, t 0.70), lost in 2018-21
(−0.114R) and sits under its placebo's 95th percentile (+0.377R). The drop days did worse than random entry days in every
test. Not an edge; no proposal; nothing live changed. Rules, windows and pass bar: `PREREGISTRATION.md` (committed before this run).

## Decisive window: entries 2022-01-01 to 2026-10-31 (58 calendar months; four coins pooled; Holm over four)

| Test | n | Net R a trade | Gross R a trade | Month-sum t | p (one-sided) | Holm p | Win % | Stops (gaps) | Cost R | Financing R | Placebo mean / p95 | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| day3 | 109 | −0.095 | −0.081 | −1.661 | 0.952 | 1.000 | 48.6 | 21 (0) | 0.004 | 0.010 | +0.003 / +0.084 | no |
| day3-sma200 | 25 | −0.031 | −0.016 | −0.268 | 0.606 | 1.000 | 56.0 | 3 (0) | 0.004 | 0.011 | −0.009 / +0.161 | no |
| day7 | 106 | −0.124 | −0.099 | −1.729 | 0.958 | 1.000 | 46.2 | 28 (0) | 0.004 | 0.021 | +0.047 / +0.157 | no |
| day7-sma200 | 23 | +0.122 | +0.150 | +0.696 | 0.243 | 0.973 | 52.2 | 3 (0) | 0.004 | 0.024 | +0.060 / +0.377 | no |

Which checks failed: net R > 0 in day3, day3-sma200 and day7; t >= 2, Holm p <= 0.05, the 2018-21 sign and the placebo in all four.

## Replication window: entries 2018-01-01 to 2021-12-31 (48 calendar months)

| Test | n | Net R a trade | Month-sum t | Same sign as required (> 0) |
|---|---|---|---|---|
| day3 | 58 | −0.047 | −0.808 | no |
| day3-sma200 | 25 | −0.056 | −0.646 | no |
| day7 | 54 | −0.132 | −1.533 | no |
| day7-sma200 | 24 | −0.114 | −1.004 | no |

## Per coin (n, net R a trade, month-sum t)

| Test | Coin | Decisive n | Decisive net R | Decisive t | Replication n | Replication net R | Replication t |
|---|---|---|---|---|---|---|---|
| day3 | BTC | 31 | −0.070 | −0.886 | 22 | +0.001 | +0.012 |
| day3 | ETH | 32 | −0.088 | −1.621 | 17 | −0.142 | −1.674 |
| day3 | SOL | 23 | −0.150 | −1.650 | 1 | −0.290 | −1.000 |
| day3 | XRP | 23 | −0.084 | −0.903 | 18 | −0.002 | −0.036 |
| day3-sma200 | BTC | 8 | +0.021 | +0.117 | 10 | +0.137 | +1.037 |
| day3-sma200 | ETH | 8 | +0.027 | +0.265 | 8 | −0.274 | −1.715 |
| day3-sma200 | SOL | 5 | −0.093 | −0.401 | 1 | −0.290 | −1.000 |
| day3-sma200 | XRP | 4 | −0.174 | −0.668 | 6 | −0.050 | −0.633 |
| day7 | BTC | 30 | −0.112 | −0.919 | 20 | −0.124 | −0.794 |
| day7 | ETH | 31 | −0.087 | −1.165 | 16 | −0.167 | −1.688 |
| day7 | SOL | 22 | −0.222 | −2.027 | 1 | −0.387 | −1.000 |
| day7 | XRP | 23 | −0.095 | −0.944 | 17 | −0.093 | −1.243 |
| day7-sma200 | BTC | 7 | +0.138 | +0.348 | 10 | +0.041 | +0.282 |
| day7-sma200 | ETH | 7 | +0.161 | +1.033 | 7 | −0.262 | −1.524 |
| day7-sma200 | SOL | 5 | +0.058 | +0.204 | 1 | −0.387 | −1.000 |
| day7-sma200 | XRP | 4 | +0.104 | +0.282 | 6 | −0.152 | −1.410 |

SOL's replication has one trade (its candles start 11 Aug 2020 and the 90-day spread needs 93 days); its t there is not
meaningful. Every per-coin figure is under 25 trades in the filtered tests.

## Placebo (40 seeds, random entry days, same count per coin)

Random entry days in the decisive window, the same stop, exit and costs: pooled mean net R a trade across seeds +0.003 (day3),
−0.009 (day3-sma200), +0.047 (day7), +0.060 (day7-sma200). The real signal beat the seeds' average only in day7-sma200 and
none reached the 95th percentile. Crypto's drift makes a random long slightly positive over seven days; the drop signal did
not add to it.

## Reading

- The loss is not the cost: costs and financing took 0.014R-0.028R a trade; the trades lost before costs in three tests.
  A 2.5 x ATR14 stop after a crash is wide (median risk 18.6 % of the entry price, day3 exit, all 168 trades on file), so costs in R
  are small and few trades reach the stop in three or seven days.
- No gap through a stop in any test (daily crypto candles open at the previous close).
- The day7-sma200 figure is 23 trades with t 0.70 and the opposite sign in 2018-21: noise.

## Data, costs, what was fixed

- Data: council-data `research/candles/crypto1d` Binance spot UTC daily candles (BTC, ETH 2017-08-17, XRP 2018-05-04, SOL
  2020-08-11; all to 2026-10-31), no missing day. Exchange APIs are not reachable from the build sandbox.
- Costs: `CFD_CRYPTO` 0.04 % of the entry price, half a spread (0.01 % of price) on the entry and on the exit, financing 15 % a
  year on the long (the demo broker's BTCUSD, ETHUSD, SOLUSD `swap.long` −15, type 1, Friday x3, `ctrader/symbols.json` of
  13 Nov 2026; XRPUSD is not listed at the broker, the same rate was charged), nights at 17:00 New York on all seven days.
- Choices fixed in the pre-registration beyond the brief: the 90-day spread uses the 90 three-day returns BEFORE the signal
  day; "day 3" = the close of the third candle counting the entry day; one trade at a time per coin; an intraday stop pays
  that day's night; t on every calendar month of the window, months with no trade counted 0; the placebo draws without
  replacement from the days a signal could have come on.

To repeat: `git fetch origin council-data`, then `node research/edge/crypto-reversal/run.mjs` (or `CR_DATA=<dir>` holding the
four `<COIN>USDT_1d.json.gz` files). Tests: `tests/crypto-reversal.test.mjs`.
