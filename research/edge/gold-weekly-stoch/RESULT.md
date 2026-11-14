# Weekly stochastic extremes on spot gold, both sides: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: fading weekly %K extremes made -0.268R a trade net 2017-26 (n 99, month t -2.53); following them +0.092R (n 98, t 0.75).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (36cc15050) before any trade was simulated. Data: council-data `research/daily/xau.json` at `f6288251e`, OANDA mid daily candles, weekend stubs folded into Monday; 1077 complete weeks from 2006-03-20 to 2026-11-02. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = 2 x ATR(20), three weeks held, one position at a time; monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades | Longs | Won | Stopped | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Fade %K < 20 / > 80 (primary) | IS 2007-01 to 2016-12 | 94 | 35 | 38% | 56% | −0.151 | −0.191 | −0.149 (−1.64) | −1.30 | −17.94 | −19.64 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 99 | 33 | 33% | 52% | −0.224 | −0.268 | −0.225 (−2.53) | −2.08 | −26.54 | −38.16 | −0.262 (−2.97) | 0.994 | 1.000 | no |
| T2 Fade on the turn back through 20 / 80 | IS 2007-01 to 2016-12 | 63 | 26 | 46% | 30% | +0.076 | +0.027 | +0.014 (+0.20) | +0.58 | +1.67 | −6.01 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 66 | 26 | 47% | 30% | +0.018 | −0.041 | −0.023 (−0.35) | +0.15 | −2.70 | −10.45 | −0.056 (−0.88) | 0.637 | 1.000 | no |
| T3 Follow %K > 80 / < 20 | IS 2007-01 to 2016-12 | 95 | 59 | 43% | 45% | +0.107 | +0.041 | +0.032 (+0.32) | +0.83 | +3.85 | −9.55 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 98 | 66 | 43% | 41% | +0.174 | +0.092 | +0.077 (+0.75) | +1.38 | +9.03 | −6.96 | +0.008 (+0.09) | 0.227 | 0.680 | no |
| Always long, three weeks (comparison, not a test) | IS | 174 | 174 | 44% | 38% | +0.109 | +0.016 | +0.023 (+0.19) | +1.26 | +2.81 | −17.92 | | | | |
| | OOS | 171 | 171 | 46% | 32% | +0.268 | +0.158 | +0.230 (+1.65) | +2.74 | +27.09 | −9.94 | | | | |
| Always short, three weeks (comparison, not a test) | IS | 174 | 0 | 40% | 44% | −0.109 | −0.126 | −0.182 (−1.48) | −1.28 | −21.85 | −29.38 | | | | |
| | OOS | 171 | 0 | 34% | 49% | −0.231 | −0.245 | −0.354 (−3.15) | −2.98 | −41.82 | −47.29 | | | | |

Pass bar (pre-registered, each test on its own, Holm over three): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above at least 39 of the 40 placebo draws. PASS needs T1.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | no | no | yes |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | yes | yes |
| x2Positive | no | no | yes |
| abovePlacebo95 | no | no | no |

## Long and short legs apart (net R a trade, month t of the leg alone)

| Test | Window | Long n | Long gross R | Long net R | Long t | Long total | Short n | Short gross R | Short net R | Short t | Short total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS | 35 | −0.094 | −0.168 | −0.85 | −5.89 | 59 | −0.185 | −0.204 | −1.34 | −12.05 |
|  | OOS | 33 | +0.165 | +0.060 | +0.33 | +1.99 | 66 | −0.418 | −0.432 | −3.35 | −28.53 |
| T2 | IS | 26 | +0.168 | +0.072 | +0.36 | +1.87 | 37 | +0.012 | −0.005 | −0.03 | −0.20 |
|  | OOS | 26 | +0.530 | +0.399 | +1.72 | +10.38 | 40 | −0.315 | −0.327 | −2.49 | −13.08 |
| T3 | IS | 59 | +0.195 | +0.099 | +0.56 | +5.86 | 36 | −0.039 | −0.056 | −0.39 | −2.00 |
|  | OOS | 66 | +0.356 | +0.242 | +1.52 | +15.94 | 32 | −0.200 | −0.216 | −1.27 | −6.91 |

## Placebo (40 seeds: each test's own trades with their sides shuffled among them, same long / short share, same weeks, stops and costs; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −2.88 | −1.38 | −0.32 | −0.13 | −2.53 | 6 of 40 |
| T2 | −1.61 | −0.46 | +1.20 | +1.29 | −0.35 | 23 of 40 |
| T3 | −1.00 | +0.01 | +1.67 | +1.67 | +0.75 | 34 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2007 | 11 | −0.08 | 7 | −2.23 | 11 | −0.69 |
| 2008 | 10 | −4.98 | 8 | +2.35 | 10 | +0.54 |
| 2009 | 8 | −2.48 | 5 | +2.14 | 8 | +3.11 |
| 2010 | 10 | −1.40 | 7 | −3.33 | 10 | −1.16 |
| 2011 | 10 | −1.24 | 5 | +1.77 | 9 | +5.34 |
| 2012 | 8 | −0.36 | 5 | −2.44 | 8 | +1.42 |
| 2013 | 9 | −2.44 | 6 | +0.11 | 9 | −0.80 |
| 2014 | 7 | −3.19 | 6 | +1.15 | 8 | −1.86 |
| 2015 | 8 | −1.14 | 5 | +2.54 | 8 | −0.26 |
| 2016 | 13 | −0.61 | 9 | −0.38 | 14 | −1.79 |
| 2017 | 10 | +8.66 | 7 | +4.02 | 9 | −4.76 |
| 2018 | 11 | −4.66 | 7 | −1.43 | 11 | +1.56 |
| 2019 | 13 | −6.26 | 7 | −0.21 | 13 | +2.65 |
| 2020 | 12 | −6.81 | 10 | −1.21 | 12 | −0.83 |
| 2021 | 7 | −0.95 | 5 | +1.00 | 7 | −1.81 |
| 2022 | 10 | −2.46 | 6 | −0.54 | 10 | +2.61 |
| 2023 | 10 | +0.66 | 8 | −0.13 | 10 | −4.16 |
| 2024 | 8 | −5.65 | 4 | −1.41 | 8 | +3.61 |
| 2025 | 12 | −8.71 | 6 | −2.08 | 11 | +8.29 |
| 2026 | 6 | −0.35 | 6 | −0.70 | 7 | +1.87 |

## Reading

- **Fading the extremes (T1, primary) loses, in both windows.** Out of sample −0.268R a trade net (n 99, month t −2.53; −0.224R gross, gross t −2.08); in sample −0.191R (n 94, t −1.64). It is worse at 2x costs (−0.262R a month, t −2.97). The loss is the shorts: selling a %K over 80 lost −0.432R a trade out of sample (n 66, t −3.35), against −0.245R for selling every week (n 171); buying a %K under 20 made +0.060R (n 33, t 0.33) against +0.158R for buying every week. So on gold, an overbought week was followed by more strength than an ordinary week, and an oversold one by less.
- **The placebo says the same thing**: the real T1 t (−2.53) sits low in its shuffles (6 of 40 below it, p5 −2.88): with two shorts for every long, any shuffle of these weeks loses too, so most of T1's loss is being short in a rising market, and the side choice itself adds only a little more.
- **Following the extremes (T3) is the mirror and is positive but small**: +0.092R a trade net out of sample (n 98, month t 0.75, Holm p 0.68), +0.041R in sample (n 95, t 0.32), +0.008R a month at 2x costs; 34 of 40 shuffles below it (p95 1.67). Its long leg (+0.242R, n 66, t 1.52) beats always long (+0.158R) and its short leg (−0.216R, n 32) is a little better than always short (−0.245R); neither leg is apart from noise, and financing takes 0.067R a trade.
- **Fading on the turn (T2) is flat**: −0.041R out of sample (n 66, t −0.35), +0.027R in sample (n 63, t 0.20).
- Nothing proposed. The weekly stochastic gives no tradable signal on gold in either reading after costs; not a gate on the gold book; nothing live changed. A long-only "buy %K over 80" variant was not pre-registered and is not tested here (chosen after seeing the legs: not evidence).
