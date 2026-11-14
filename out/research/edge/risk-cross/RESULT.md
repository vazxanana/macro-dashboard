# Result: AUD/JPY and NZD/JPY held only while the S&P 500 is in a calm uptrend (14 Nov 2026)

**Verdict: FAIL, 0 of 3.** Holding AUD/JPY (T1) or NZD/JPY (T2) long while the S&P 500 is above its 200-day average and calm
lost money a position after costs in both windows, and so did the trend-only version (T3) once a financing charge is counted.
No test is positive on the decisive column, no monthly t comes near 2, and every test is below the median of its own
random placebo. Not an edge; nothing live changed.

Pre-registered in `PREREGISTRATION.md` (pushed before any trade was computed). OANDA mid daily candles from council-data
`research/daily` (branch at a70613a7c, last candle 6 Nov 2026), weekend stubs folded. Entry and exit at the next daily open,
stop 3 × ATR(20) under the entry (gap fills at the open), costs 0.3 pip spread + 0.5 pip slippage a side + 22.5 USD per
million a side.

**Financing.** council-data `ctrader/symbols.json` lists no AUDJPY or NZDJPY swap (it holds XAUUSD, five USD majors, crypto
and indices), so no broker figure exists. Both columns are shown: zero carry, and a flat charge of 0.004 % of the entry
price a night (Wednesday three). These longs historically EARNED carry, so the charge is the costlier assumption; **the
verdict is decided on the charged column**, as pre-registered. The verdict is the same on the zero-carry column: no test
reaches t 1 there either.

| Test, window | n | Time in market | Gross R a position | Net R, zero carry | Net R, charged | Total, charged | Monthly t, charged | Sharpe, charged | Monthly t, zero carry | Sharpe, zero carry |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 2016-now | 52 | 37.0 % | −0.107 | −0.114 | −0.154 | −7.98R | −1.30 (131 months) | −0.35 | −0.96 | −0.26 |
| T2 2016-now | 52 | 42.4 % | −0.050 | −0.058 | −0.102 | −5.33R | −0.94 (131 months) | −0.22 | −0.52 | −0.13 |
| T3 2016-now | 30 | 47.6 % | +0.019 | +0.013 | −0.053 | −1.59R | −0.24 (131 months) | −0.07 | +0.05 | +0.02 |
| T1 2008-15 | 31 | 34.0 % | −0.152 | −0.158 | −0.195 | −6.04R | −1.39 (96 months) | −0.35 | −1.14 | −0.29 |
| T2 2008-15 | 31 | 43.2 % | −0.045 | −0.051 | −0.091 | −2.82R | −0.61 (96 months) | −0.16 | −0.34 | −0.09 |
| T3 2008-15 | 22 | 54.0 % | +0.081 | +0.076 | −0.010 | −0.22R | −0.05 (97 months) | −0.01 | +0.35 | +0.07 |

Placebo (40 seeds, 2016-now, charged column): random on / off periods with the same number of positions and exactly the same
days in market (shuffled held lengths, random gaps), each with the same stop, costs and charge.

| Test | Real net R a position | Placebo median | Placebo 95th percentile | Days in market, placebo = real | Holm p | Verdict |
|---|---|---|---|---|---|---|
| T1 | −0.154 | −0.001 | +0.137 | 1047 = 1047 | 1 | FAIL |
| T2 | −0.102 | −0.018 | +0.140 | 1198 = 1198 | 1 | FAIL |
| T3 | −0.053 | −0.026 | +0.196 | 1346 = 1346 | 1 | FAIL |

- **The calm filter makes it worse, not better.** Adding "20-day volatility under its 1-year median" to the trend filter
  (T1 against T3, same AUD/JPY) cut the time in market from 48 % to 37 % and turned gross +0.019R into −0.107R a position:
  it switches the position off and on more often (52 positions against 30), and the shorter holds lose before any cost.
  On 2016-now T1 sits below its random placebo's median.
- **The 2008 crash.** The replication window holds the 2008 crash, the exact event the idea claims to avoid. It did step
  aside: one position in 2008 (20-21 May, −0.11R), then flat until June 2009 on all three tests. But avoiding the crash did
  not make the rest of 2008-15 pay: T1 −0.195R and T2 −0.091R a position net. Note that the stop rule alone (3 × ATR) would
  also have capped a held crash at about −1R.
- **Gap stops**: the January 2019 yen flash move filled two stops below their level (−1.25R and −1.11R gross).
- Trend only (T3) is roughly break-even before financing (+0.013R and +0.076R a position with zero carry, t 0.05 and 0.35):
  no evidence either way, and it is the general trend filter, not the risk-on idea.

What it means: on 2008-2026 OANDA data, conditioning a yen-cross long on the S&P 500's trend and calm does not earn after
costs. The published carry-crash story may hold for carry earned over the holding period (a real broker would credit swap,
which this study could not read), but the price path alone, net of trading costs, gives no edge. It is not a council rule and
no proposal is written.

To repeat: `node research/edge/risk-cross/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/risk-cross/run.mjs full <dir>`. Tests: `tests/risk-cross.test.mjs`.
