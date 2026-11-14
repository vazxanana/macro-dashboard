# Gold LBMA auctions: the run into the PM auction and the fade after it

Pre-registered in PREREGISTRATION.md (pushed before any result). Spot gold, OANDA mid M5 2015-12-01 to 2026-11-13, London time with BST, net of the measured gold cost model.

**Verdict: FAIL: T1 FAIL (out of sample −0.020R a trade net, n 1472, month t -2.36; in sample −0.051R, n 1259); T2 FAIL (out of sample −0.163R a trade net, n 1472, month t -2.81; in sample −0.122R, n 1259).** Nothing here is an edge; nothing live changed.

## The two tests (PM auction, 15:00 London)

| Test / window | n | gross R | cost R ($) | net R | net R at 2x cost | month t (net) | months | median stop | stopped |
|---|---|---|---|---|---|---|---|---|---|
| T1 in sample 2016-20 | 1259 | −0.006 | 0.044 ($0.17) | −0.051 | −0.095 | -4.86 | 60 | $3.88 | 3% |
| T1 out of sample 2021-now | 1472 | +0.003 | 0.023 ($0.20) | −0.020 | −0.043 | -2.36 | 71 | $8.77 | 3% |
| T2 in sample 2016-20 | 1259 | +0.068 | 0.190 ($0.17) | −0.122 | −0.312 | -1.92 | 60 | $1.13 | 66% |
| T2 out of sample 2021-now | 1472 | −0.019 | 0.143 ($0.20) | −0.163 | −0.305 | -2.81 | 71 | $2.03 | 72% |

- T1: Run-in through the PM auction (sign of 13:30 -> 14:55, in 14:55, out 15:05, stop 3 x ATR(14) M5).
- T2: Fade after the PM auction (against 13:30 -> 15:00, in at the 15:00 candle close, stop its extreme + $0.30, out 16:30).

Pass checks (all must hold):

- T1: net > 0 both windows no; out-of-sample month t >= 2 no; net > 0 at 2x cost both windows no; Holm (p 0.990863, adjusted 1) no.
- T2: net > 0 both windows no; out-of-sample month t >= 2 no; net > 0 at 2x cost both windows no; Holm (p 0.997523, adjusted 1) no.

Costs: spread $0.07 (median quote) + commission 0.000024 x price + half a spread of slippage on each market order = $0.14 + 0.000024 x price a round trip (the "cost R ($)" column is the mean per trade).

Days (PM): 2731 traded, 89 bank holidays, 12 on 24 / 31 December, 4 with a gap; M = 0 on 0 (T1) / 0 (T2).

## Reported only

### The AM auction (10:30 London), same designs shifted by -4 h 30 min

| Test / window | n | gross R | cost R ($) | net R | net R at 2x cost | month t (net) | months | median stop | stopped |
|---|---|---|---|---|---|---|---|---|---|
| AM T1 in sample | 1265 | +0.001 | 0.084 ($0.17) | −0.083 | −0.167 | -7.45 | 60 | $2.08 | 2% |
| AM T1 out of sample | 1479 | −0.002 | 0.045 ($0.20) | −0.048 | −0.093 | -4.59 | 71 | $4.34 | 1% |
| AM T2 in sample | 1265 | −0.040 | 0.271 ($0.17) | −0.310 | −0.581 | -5.79 | 60 | $0.70 | 65% |
| AM T2 out of sample | 1478 | +0.049 | 0.220 ($0.20) | −0.171 | −0.391 | -2.16 | 71 | $1.09 | 73% |

### PM tests by year (net R a trade, n)

| Year | T1 n | T1 net R | T2 n | T2 net R |
|---|---|---|---|---|
| 2016 | 253 | −0.014 | 253 | −0.190 |
| 2017 | 252 | −0.070 | 252 | −0.300 |
| 2018 | 251 | −0.086 | 251 | −0.103 |
| 2019 | 251 | −0.072 | 251 | −0.008 |
| 2020 | 252 | −0.012 | 252 | −0.007 |
| 2021 | 248 | −0.023 | 248 | −0.110 |
| 2022 | 249 | −0.048 | 249 | −0.175 |
| 2023 | 251 | −0.009 | 251 | +0.114 |
| 2024 | 252 | −0.061 | 252 | −0.329 |
| 2025 | 251 | +0.018 | 251 | −0.152 |
| 2026 | 221 | +0.007 | 221 | −0.344 |

### PM tests by London weekday (all years)

| Day | T1 n | T1 net R | T2 n | T2 net R |
|---|---|---|---|---|
| Mon | 510 | −0.056 | 510 | −0.173 |
| Tue | 556 | −0.018 | 556 | +0.002 |
| Wed | 560 | −0.049 | 560 | −0.186 |
| Thu | 557 | −0.029 | 557 | −0.295 |
| Fri | 548 | −0.019 | 548 | −0.067 |

### Placebo: 40 seeded anchors outside 13:00-16:30 London, same designs (out of sample, net R a trade)

- T1: the auction's −0.020R is above 40 of 40 placebo runs (placebo median −0.046R); 0 placebo runs reach month t >= 2.
- T2: the auction's −0.163R is above 32 of 40 placebo runs (placebo median −0.218R); 0 placebo runs reach month t >= 2.

Context only, not part of the verdict.

## Reading

- **Before costs there is nothing to trade.** T1 (riding the 13:30-14:55 move through the auction) makes −0.006R a trade before costs in 2016-20 and +0.003R in 2021-now: the direction of the run-in says nothing about the auction minutes. Its 3 x ATR stop is hit on about 3 % of trades, so its R is mostly the ten-minute move divided by a wide stop, and the cost (0.02-0.04R) decides the sign.
- **The fade after the PM auction made +0.068R a trade before costs in 2016-20 (2018-20 positive every year) and −0.019R in 2021-now**: the reversal some published studies describe was there in the late 2010s and is not there since. Its stop ($0.30 past the auction candle, median $1.13 / $2.03) is tight, so the $0.17-0.20 cost is 0.14-0.19R a trade and the fade loses net in both windows (month t −1.92 and −2.81).
- The AM auction (10:30) is no better: the run-in is about zero before costs in both windows; the fade is −0.040R before costs in 2016-20 and +0.049R since (−0.310R and −0.171R after costs), the PM pattern the other way round in time.
- The placebo anchors outside 13:00-16:30 lose more a trade (median −0.046R for T1, −0.218R for T2), mainly because quieter hours give smaller stops and so more R of cost; the auction is better than most placebo runs only in losing less. No placebo run reaches month t 2.
- Departures from the pre-registration, none affecting a figure of the verdict: the candle file is one fetched through the same proxy on 13-14 Nov 2026 for another study (spot-checked candle for candle against a fresh proxy answer), cut to 1 Dec 2015 on; the placebo anchors are those of the parenthesis (03:00-11:30, 18:00-19:30), so an 11:30 anchor ends its window at the 13:00 open.
- So: no run into the gold PM auction and no fade after it, in the form tested, as with the forex 16:00 fix (`london-fix`). Not a council rule, no proposal. A wider stop or a size filter on the move were not tested and would need their own pre-registration on other data.

## To repeat

`node --use-env-proxy research/edge/gold-lbma-fix/run.mjs fetch <dir>` (candles outside git), then `node research/edge/gold-lbma-fix/run.mjs run <dir>`. Tests: `tests/gold-lbma-fix.test.mjs`.
