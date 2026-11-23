# Box zone: result (22 Nov 2026)

Pre-registered in PREREGISTRATION.md (committed before the run). OANDA mid Daily + H4, trades entered 2010-2019, five markets.

**Verdict: FAIL, 1 of 4 checks.** The rule is about zero before costs and a little below after them.

| | Trades | Won | R a trade after costs | Month-sum t |
|---|---|---|---|---|
| Pool | 1,071 | 73 % | -0.002 | -0.09 |
| 2010-2014 | 522 | 74 % | +0.006 | 0.18 |
| 2015-2019 | 549 | 72 % | -0.009 | -0.28 |
| Twice the costs | 1,071 | | -0.015 | -0.66 |
| Before costs | 1,071 | | +0.011 | 0.47 |

By market (after costs): EUR/USD +0.019 (n 196), GBP/USD +0.034 (n 214), gold +0.022 (n 209), AUD/USD -0.037 (n 248),
USD/JPY -0.041 (n 204); only the 3-of-5 check passes, every t is under 1.2 in size.

Why: the target (the other side of the test H4 box) is close: median 0.35R. The rule wins 73 % of trades and loses about that
in the 27 % that are stopped. Reported, not judged: trades whose target is 1R or more away, n 123, +0.009R a trade.

The 2020-2026 look that came before (716 trades, +0.03R, t 0.76) was in sample and is not evidence; together the two say the
written rule has no edge. It does not judge the owner's own reading of which zones and boxes to take (his marked trade of
24 Aug 2026 is one example, picked). Nothing live changed. To repeat: `node run.mjs fetch <dir>` (candles outside git), then
`node run.mjs run <dir>`. Test: `tests/box-zone.test.mjs`.

## Correction (23 Nov 2026, review)

The first run joined a zone with the next Daily box from the first box's own known time, although the join is known only when
that next box closes out: trades in that gap were kept when the boxes did not join and dropped when they did (look-ahead by
selection, 147 of 1,029 trades). Now the first box stands alone until the join is known and the joined zone starts then. The
table above is the corrected run (was 1,029 trades, -0.007R, month t -0.29). The verdict does not change: FAIL, 1 of 4.
