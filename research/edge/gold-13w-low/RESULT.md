# Gold after a weekly close at a 13-week low: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying 4 weeks after a 13-week closing low made +0.043R a trade net 2017-26 (n 25, month t 0.2); fading a 13-week high -0.333R (n 62, t -2.65).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (3fce40edc) before any week was simulated. Data: council-data `research/daily/xau.json` at `f6288251e`, OANDA mid daily candles, weekend stubs folded into Monday; 1077 complete weeks from 2006-03-20 to 2026-11-02. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = the stop distance; monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades | Won | Stopped | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Long 4 weeks after a 13-week closing low (primary) | IS 2008-01 to 2016-12 | 37 | 54% | 27% | +0.043 | −0.033 | −0.011 (−0.23) | +0.30 | −1.21 | −6.21 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 25 | 48% | 28% | +0.147 | +0.043 | +0.009 (+0.20) | +0.69 | +1.07 | −4.39 | −0.013 (−0.30) | 0.421 | 1.000 | no |
| T2 Long 1 week after a 13-week closing low | IS 2008-01 to 2016-12 | 64 | 48% | 17% | +0.042 | +0.001 | +0.001 (+0.01) | +0.44 | +0.06 | −4.98 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 41 | 49% | 20% | −0.061 | −0.110 | −0.038 (−1.04) | −0.60 | −4.52 | −5.76 | −0.055 (−1.45) | 0.851 | 1.000 | no |
| T3 Short 4 weeks after a 13-week closing high | IS 2008-01 to 2016-12 | 46 | 37% | 46% | −0.132 | −0.143 | −0.061 (−0.89) | −0.83 | −6.56 | −11.50 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 62 | 29% | 50% | −0.324 | −0.333 | −0.175 (−2.65) | −2.59 | −20.63 | −24.10 | −0.180 (−2.72) | 0.996 | 1.000 | no |
| Long every fourth week, 4-week hold (comparison, not a test) | IS | 117 | 49% | 30% | +0.105 | +0.021 | +0.023 (+0.23) | +1.13 | +2.47 | −13.26 | | | | |
|  | OOS | 129 | 54% | 19% | +0.250 | +0.145 | +0.159 (+1.69) | +2.87 | +18.73 | −6.23 | | | | |

Pass bar (pre-registered, each test on its own, Holm over three): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo's 95th percentile.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | yes | no | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | yes | no |
| x2Positive | no | no | no |
| abovePlacebo95 | no | no | no |

## Placebo (40 seeds: each real trade's signal week replaced by a random week whose trade, same side, hold and stop rule, exits in the same window; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −0.25 | +0.96 | +1.97 | +2.10 | +0.20 | 8 of 40 |
| T2 | −1.10 | +0.23 | +1.80 | +2.51 | −1.04 | 3 of 40 |
| T3 | −3.06 | −1.61 | −0.58 | +0.06 | −2.65 | 8 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2008 | 5 | +0.69 | 7 | +1.97 | 5 | −2.40 |
| 2009 | 1 | +1.07 | 1 | +1.16 | 8 | −3.62 |
| 2010 | 1 | +0.53 | 2 | +0.16 | 8 | −3.49 |
| 2011 | 1 | +0.78 | 3 | +0.10 | 8 | −1.53 |
| 2012 | 3 | +0.48 | 5 | +1.08 | 4 | +1.20 |
| 2013 | 10 | −2.22 | 15 | −0.10 | 1 | +0.92 |
| 2014 | 6 | −2.09 | 8 | −0.83 | 3 | +0.85 |
| 2015 | 5 | −0.53 | 12 | −3.04 | 3 | +3.52 |
| 2016 | 5 | +0.07 | 11 | −0.45 | 6 | −2.01 |
| 2017 | 2 | +1.18 | 3 | +0.86 | 4 | +2.70 |
| 2018 | 6 | −1.86 | 10 | −3.36 | 4 | −1.29 |
| 2019 | 2 | −0.23 | 2 | +0.62 | 7 | −4.44 |
| 2020 | 2 | +1.97 | 2 | +1.93 | 11 | −4.13 |
| 2021 | 4 | −1.79 | 6 | −2.29 | 3 | +1.97 |
| 2022 | 4 | −0.65 | 6 | −1.17 | 3 | −0.87 |
| 2023 | 3 | +3.60 | 6 | +1.10 | 6 | −0.84 |
| 2024 | 0 | 0 | 0 | 0 | 9 | −4.58 |
| 2025 | 0 | 0 | 0 | 0 | 11 | −7.90 |
| 2026 | 2 | −1.15 | 6 | −2.21 | 4 | −1.24 |

## Reading

- **Buying a 13-week closing low (T1) does not beat buying at random.** Out of sample it made +0.043R a trade net (n 25, month t 0.20; +0.147R gross); financing on a four-week hold takes 0.093R of it and spread and slippage 0.011R. In sample −0.033R (n 37, t −0.23). At 2x costs it loses. The same number of long four-week holds started in random weeks gave a median t of 0.96: the real t sits below 32 of 40 seeds, so the 13-week low picked WORSE entries than chance.
- **Gold's drift is the whole story.** Long every fourth week (same hold, stop and costs) made +0.145R a trade net out of sample (n 129, month t 1.69, +18.73R) against T1's +1.07R. Only 25 low events fell in 2017-26, a rising market: few chances, and those few did not bounce more than any other week.
- **The one-week bounce (T2) is negative out of sample**: −0.110R a trade net (n 41, t −1.04), flat in sample (+0.001R, n 64).
- **Fading a 13-week high (T3) lost**: −0.333R a trade out of sample (n 62, t −2.65), −0.143R in sample (n 46, t −0.89). Random four-week shorts lost too (placebo median t −1.61), so most of it is shorting a rising market; the real t sits below 32 of 40 seeds. A long-after-a-13-week-high rule was not pre-registered and is not tested here (seen after the result: not evidence; `gold-record-high` tested the 52-week version and failed).
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.
