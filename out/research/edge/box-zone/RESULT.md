# Box zone: result (22 Nov 2026)

Pre-registered in PREREGISTRATION.md (committed before the run). OANDA mid Daily + H4, trades entered 2010-2019, five markets.

**Verdict: FAIL, 1 of 4 checks.** The rule is about zero before costs and a little below after them.

| | Trades | Won | R a trade after costs | Month-sum t |
|---|---|---|---|---|
| Pool | 1,029 | 72 % | -0.007 | -0.29 |
| 2010-2014 | 501 | 73 % | +0.007 | 0.23 |
| 2015-2019 | 528 | 71 % | -0.020 | -0.59 |
| Twice the costs | 1,029 | | -0.019 | -0.84 |
| Before costs | 1,029 | | +0.006 | 0.27 |

By market (after costs): EUR/USD +0.005 (n 189), GBP/USD +0.029 (n 206), gold +0.026 (n 196), AUD/USD -0.032 (n 239),
USD/JPY -0.056 (n 199); only the 3-of-5 check passes, every t is under 1.2 in size.

Why: the target (the other side of the test H4 box) is close: median 0.35R. The rule wins 72 % of trades and loses about that
in the 28 % that are stopped. Reported, not judged: trades whose target is 1R or more away, n 120, -0.001R a trade.

The 2020-2026 look that came before (716 trades, +0.03R, t 0.76) was in sample and is not evidence; together the two say the
written rule has no edge. It does not judge the owner's own reading of which zones and boxes to take (his marked trade of
24 Aug 2026 is one example, picked). Nothing live changed. To repeat: `node run.mjs fetch <dir>` (candles outside git), then
`node run.mjs run <dir>`. Test: `tests/box-zone.test.mjs`.
