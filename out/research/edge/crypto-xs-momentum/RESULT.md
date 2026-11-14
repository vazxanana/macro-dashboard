# Cross-sectional momentum among coins (3-week look-back, weekly, top third / bottom third): result

**Verdict: FAIL, 1 of 4 conditions met: out of sample +0.0113R a week net (217 weeks, month-sum t +0.55), −0.0201R at 2x cost, above only 28 of 40 random rankings; in sample +0.0362R.**

Paper research only. No live rule, size, filter, council member or page was changed; ICT and the gold book are not touched. Rule,
universe, k, costs, windows and the one judged test were fixed in `PREREGISTRATION.md` (pushed alone before any return was read).

**Related, checked first.** `crypto-weekly-mom` (each coin against its own one-week past), `crypto-trend-v2` / `crypto-trend-decay`
(breakouts per coin), `crypto-reversal`, `crypto-weekend`, `crypto-weekend-reversal`, `eth-btc-ratio`: none ranks coins against each
other, so this cross-sectional version (Liu, Tsyvinski & Wu 2022, "Common risk factors in cryptocurrency") was new here.

## What was tested

Ten coins (`btc eth bnb ltc ada xrp trx link doge sol`, Binance spot daily candles from council-data `research/candles/crypto1d`,
to 2026-10-31). Every Monday 00:00 UTC, the coins with 60+ candles and a close on the Sunday and 21 days before are ranked by their
3-week return; with N ≥ 6 ranked, long the top k = floor(N / 3) and short the bottom k at Monday's open; 1R = stop = 2 × ATR(20)
of the daily candles through Sunday (every leg has its stop; none gapped beyond it); out at Sunday's close. Week R = the mean of
the 2k legs' net R. Costs: `CFD_CRYPTO` 0.04 % round trip a leg a week, and financing at the demo broker's crypto swap (longs
15 % a year; shorts BTC 7.5 %, ETH 10 %, SOL 15 %; the seven coins the broker does not offer 15 % both sides, assumed), shorts paying.

Traded weeks: 433, 2018-07-09 to 2026-10-19 (coins ranked: 6 in 5 weeks, 7 in 31, 8 in 25, 9 in 57, 10 in 315). In sample = the
first 216 weeks (2018-07-09 to 2022-08-22), out of sample = the last 217 (2022-08-29 to 2026-10-19). Every leg had all seven
candles on file.

## The judged test

| Window | Weeks | Months | Gross R a week | Net R a week | Net at 2x | Month-sum t (net) | Sharpe (net) | Total net R | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|---|
| In sample 2018-07 to 2022-08 | 216 | 50 | +0.0557 | +0.0362 | +0.0167 | +1.75 | +0.82 | +7.82 | −1.61 |
| Out of sample 2022-08 to 2026-10 | 217 | 51 | +0.0427 | +0.0113 | −0.0201 | +0.55 | +0.26 | +2.45 | −3.52 |

1. Out-of-sample month-sum t ≥ 2 net: **no** (+0.55; the gross figure, before any cost, is +2.06).
2. In-sample net positive: **yes** (+0.0362R a week, t +1.75).
3. Out of sample positive at 2 × cost: **no** (−0.0201R a week).
4. Placebo (40 random rankings a week, same stops, sizes and costs, out of sample): the real +0.0113R beats **28 of 40**
   (p50 +0.0049R, p95 +0.0289R, best +0.0434R): **no**.

## Per leg

| Window | Legs (long / short) | Gross R a leg | Round trip R | Financing R | Net R a leg | Net at 2x | t on legs | Won | Stopped |
|---|---|---|---|---|---|---|---|---|---|
| In sample | 1174 (587 / 587) | +0.0531 | 0.0029 | 0.0165 | +0.0337 | +0.0142 | +1.23 | 48.0 % | 273 |
| Out of sample | 1302 (651 / 651) | +0.0427 | 0.0046 | 0.0268 | +0.0113 | −0.0201 | +0.44 | 46.8 % | 310 |

Financing is most of the cost: at 15 % a year a week's hold is about 0.29 % of the price, against a stop 2 × ATR(20) away, and it
grew out of sample because the stop distance (daily ranges) was smaller relative to price. The spread between winners and losers is there before costs (+0.043R
a leg out of sample) but does not survive the carry of a CFD.

Long legs and short legs apart (net, mean R a week of that side's legs): in sample longs +0.0948, shorts −0.0223; out of sample
longs +0.0597, shorts −0.0372. The book's profit came from the long side, which in a rising coin market is mostly the market
itself; the short side (the losers, which the factor needs) lost in both windows. Context, not judged: an equal-weight spot buy and
hold of the same coins made +1.949 % a week in sample (Sharpe 1.12) and +0.855 % out of sample (Sharpe 0.76).

## Reported only

| Look-back | In sample net R a week (t) | Out of sample net R a week (t) |
|---|---|---|
| 1 week | +0.0534 (+1.77) | +0.0037 (+0.18) |
| 3 weeks (judged) | +0.0362 (+1.75) | +0.0113 (+0.55) |
| 4 weeks | +0.0244 (+1.09) | +0.0009 (+0.04) |

| Year | Weeks | Gross R (sum of week R) | Net R |
|---|---|---|---|
| 2018 | 26 | +1.60 | +1.10 |
| 2019 | 52 | +2.84 | +1.75 |
| 2020 | 52 | +5.52 | +4.38 |
| 2021 | 52 | +0.77 | −0.01 |
| 2022 | 52 | +2.27 | +1.09 |
| 2023 | 52 | +4.51 | +2.75 |
| 2024 | 53 | +2.05 | +0.57 |
| 2025 | 52 | +1.40 | −0.02 |
| 2026 | 42 | +0.33 | −1.35 |

| Coin | In sample legs long / short | Net R | Out of sample legs long / short | Net R |
|---|---|---|---|---|
| btc | 89 / 52 | +26.22 | 71 / 24 | +9.09 |
| eth | 64 / 47 | +10.88 | 60 / 58 | +10.75 |
| bnb | 78 / 49 | −2.56 | 76 / 65 | −1.02 |
| ltc | 45 / 56 | −7.69 | 52 / 66 | −15.53 |
| ada | 64 / 84 | −3.47 | 53 / 94 | −2.82 |
| xrp | 49 / 78 | +5.53 | 57 / 72 | −3.70 |
| trx | 58 / 71 | −9.27 | 91 / 56 | +2.42 |
| link | 59 / 64 | +13.44 | 62 / 58 | +8.82 |
| doge | 42 / 53 | −5.15 | 50 / 92 | −5.48 |
| sol | 39 / 33 | +11.60 | 79 / 66 | +12.18 |

## What it means

Not an edge. A cross-sectional spread exists before costs in both halves, but net of the council's CFD costs it is +0.011R a week
out of sample with t 0.55, it is negative at twice the cost, and random rankings of the same coins do as well 12 times in 40. With
ten survivor coins (chosen in 2026, the dead coins of 2018-22 absent) a third is two or three coins, so the test is coarse; the
published factor used hundreds. Nothing here proposes a shadow or a rule. A FAIL is not evidence that the reverse works.

To repeat: `node research/edge/crypto-xs-momentum/run.mjs` (reads council-data with `git show`, no network; writes `result.json`).
