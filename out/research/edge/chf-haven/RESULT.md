**Verdict: FAIL, 0 of 3 tests.** short USD/CHF −0.046R a trade net on 2016-26 (n 74, t −0.48, month t −0.52, fails: net R not above 0, negative before 2016, t under 2, month t under 2, Holm p over 0.05, placebo not beaten); short EUR/CHF −0.114R a trade net on 2016-26 (n 74, t −1.54, month t −1.46, fails: net R not above 0, negative before 2016, t under 2, month t under 2, Holm p over 0.05, placebo not beaten); short AUD/CHF −0.080R a trade net on 2016-26 (n 75, t −0.74, month t −0.70, fails: net R not above 0, negative before 2016, t under 2, month t under 2, Holm p over 0.05, placebo not beaten). The franc does not keep appreciating, in a tradeable way, over the five trading days after a sharp S&P 500 fall. Not an edge; no proposal, nothing live changed.

# The Swiss franc after a sharp S&P 500 fall (14 Nov 2026)

Paper research only. Rules fixed in `PREREGISTRATION.md` before any price was read. Claim tested: Ranaldo and Söderlind (2010, Review of Finance, "Safe haven currencies"): the franc appreciates when US stocks fall sharply. Question: is there a tradeable LAG over the following days, after costs?

## What was tested

- OANDA mid UTC daily candles from council-data `research/daily/` (spx500, usdchf, eurchf, audchf; commit `dd2246a1d`), weekends folded into Monday (`council/fills.mjs` `foldWeekend`). S&P 500 2003-03-24 to 2026-11-06.
- Signal: the S&P 500's UTC daily close-to-close return below −2 × the standard deviation of the 60 returns before it: 226 signal days (99 from 2016) of 6063 eligible days.
- Trade: short the pair (long the franc) at the next UTC daily open (00:00 UTC; after a Friday signal the Sunday reopen), stop 2 × ATR(20) of the pair's daily candles (a gap through it fills at the open), out at the close of the fifth trading day; one position per pair at a time.
- Costs: 0.3 pip spread + 0.15 pip slippage on entry and exit + 22.5 USD per million a side commission, plus overnight financing per rollover (`nights`): usdchf measured swap.short −1.314 pips a rollover, eurchf assumed 4.0 % a year, audchf assumed 5.5 % a year. Today's rates charged for every year.

## Results

| Test | window | n | gross R | net R a trade | t | month t | Holm p | net, 2x costs | net, no financing | cost R | hit | stopped |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 short USD/CHF | 2016-26 (decisive) | 74 | +0.032 | −0.046 | −0.48 | −0.52 | 1.000 | −0.124 | +0.023 | +0.078 | 47.3 % | 21.6 % |
| T1 short USD/CHF | 2003-15 (replication) | 96 | −0.127 | −0.181 | −2.51 | | | −0.235 | −0.133 | +0.054 | 40.6 % | 17.7 % |
| T2 short EUR/CHF | 2016-26 (decisive) | 74 | −0.025 | −0.114 | −1.54 | −1.46 | 1.000 | −0.204 | −0.036 | +0.089 | 45.9 % | 17.6 % |
| T2 short EUR/CHF | 2003-15 (replication) | 97 | −0.086 | −0.222 | −2.73 | | | −0.358 | −0.101 | +0.136 | 30.9 % | 21.6 % |
| T3 short AUD/CHF | 2016-26 (decisive) | 75 | −0.012 | −0.080 | −0.74 | −0.70 | 1.000 | −0.148 | −0.020 | +0.068 | 34.7 % | 17.3 % |
| T3 short AUD/CHF | 2004-15 (replication) | 91 | −0.072 | −0.126 | −1.56 | | | −0.180 | −0.077 | +0.054 | 41.8 % | 25.3 % |

## The bar, check by check

| Test | net > 0 (2016-26) | net > 0 (before 2016) | t ≥ 2 | month t ≥ 2 | Holm p < 0.05 | n ≥ 30 | placebo beaten (of 40, need 38) | pass |
|---|---|---|---|---|---|---|---|---|
| T1 short USD/CHF | no | no | no (−0.48) | no (−0.52) | no (1.000) | yes | 11 | no |
| T2 short EUR/CHF | no | no | no (−1.54) | no (−1.46) | no (1.000) | yes | 4 | no |
| T3 short AUD/CHF | no | no | no (−0.74) | no (−0.70) | no (1.000) | yes | 13 | no |

## Placebo (40 seeds, the same number of entry days per year drawn at random)

- short USD/CHF: placebo decisive means −0.183 to +0.122R, 95th percentile +0.075R; real −0.046R beats 11 of 40.
- short EUR/CHF: placebo decisive means −0.197 to +0.110R, 95th percentile +0.047R; real −0.114R beats 4 of 40.
- short AUD/CHF: placebo decisive means −0.239 to +0.137R, 95th percentile +0.076R; real −0.080R beats 13 of 40.

## Descriptive (not part of the bar)

- **usdchf**: signals ignored while a trade was open: 56. By year (net R a trade, n): 2003 +0.31 (2), 2004 −0.55 (5), 2005 +0.08 (7), 2006 −0.12 (6), 2007 −0.07 (13), 2008 −0.31 (11), 2009 +0.67 (4), 2010 −0.05 (8), 2011 +0.14 (10), 2012 −0.32 (10), 2013 −0.53 (6), 2014 −0.58 (9), 2015 −0.58 (5), 2016 −0.48 (4), 2017 −0.07 (5), 2018 −0.17 (8), 2019 −0.48 (5), 2020 +0.08 (10), 2021 −0.25 (8), 2022 −0.09 (10), 2023 −0.46 (4), 2024 +0.19 (8), 2025 +0.55 (7), 2026 +0.23 (5).
  SNB floor removal (15 Jan 2015): no trade spans it.
- **eurchf**: signals ignored while a trade was open: 55. By year (net R a trade, n): 2003 −0.27 (2), 2004 −0.41 (5), 2005 +0.15 (7), 2006 −0.54 (6), 2007 −0.30 (13), 2008 +0.04 (11), 2009 −0.23 (4), 2010 +0.19 (9), 2011 −0.19 (10), 2012 −0.51 (10), 2013 −0.45 (6), 2014 −0.27 (9), 2015 −0.43 (5), 2016 −0.53 (4), 2017 −0.33 (5), 2018 −0.14 (8), 2019 +0.07 (5), 2020 −0.07 (9), 2021 −0.12 (8), 2022 +0.09 (10), 2023 −0.40 (4), 2024 +0.03 (8), 2025 −0.20 (8), 2026 −0.03 (5).
  SNB floor removal (15 Jan 2015): no trade spans it.
- **audchf**: signals ignored while a trade was open: 54. By year (net R a trade, n): 2004 −0.68 (2), 2005 +0.19 (7), 2006 −0.10 (6), 2007 −0.12 (13), 2008 −0.35 (11), 2009 −0.60 (4), 2010 +0.08 (8), 2011 +0.11 (10), 2012 −0.28 (10), 2013 −0.02 (6), 2014 −0.29 (9), 2015 +0.13 (5), 2016 −0.48 (4), 2017 −0.20 (5), 2018 −0.02 (8), 2019 −0.38 (5), 2020 +0.29 (10), 2021 −0.09 (7), 2022 +0.08 (10), 2023 −0.82 (4), 2024 −0.06 (8), 2025 −0.04 (9), 2026 −0.00 (5).
  SNB floor removal (15 Jan 2015): no trade spans it.

## What it means and does not mean

- Measured: a mechanical, daily-candle trade, long the franc for five trading days after a 2-sd S&P 500 fall, net of a raw-spread cost model and overnight financing. It does not test the same-day association the paper reports (that move happens before the next open and cannot be traded here), nor intraday entries, other horizons, or other haven pairs.
- Financing is today's (measured on USD/CHF, assumed on EUR/CHF and AUD/CHF) for every year; the "no financing" column shows the result without it. When Swiss rates were negative (2015-22) a franc long paid more than charged here.
- A FAIL is not evidence that the franc is no haven; it says the lag after the signal is not worth trading on these rules. Anything else (another threshold, holding period, a fade) would need its own pre-registration on other data.

## Related

`research/edge/risk-spill-jpy` (the yen after a strong S&P cash session, FAIL) and `research/edge/gold-haven-shock` (gold after equity shock days, FAIL), on other branches; neither covers the franc, and no code was shared.

To repeat: `node research/edge/chf-haven/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `node research/edge/chf-haven/run.mjs full <dir>`. Tests: `tests/chf-haven.test.mjs`.
