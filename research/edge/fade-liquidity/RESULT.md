# Fades inside an H1 dominant zone, and liquidity sweeps as a filter (result, 25 Nov 2026)

**Verdict: FAIL. No tag passed every check; the best month t in 2015-26 is big + hi24 at −0.196R after costs (n 13090, t -9.08, Holm p 1).**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, committed alone first). Gate reproduced (47354 / 0.307R and 54443 / 0.193R); cut test passed. Nothing live changed.

| Desk | Tag | 2005-14 n | After costs | 2015-26 n | Before costs | After costs (month t) | Untagged after costs | Welch t | After 2x costs | Holm p | Test |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Big-candle fade | dom | 21471 | −0.066R | 26017 | +0.186R | −0.263R (-16.54) | −0.231R | -1.72 | −0.712R | 1 | no |
| Big-candle fade | pdl | 13440 | −0.043R | 15312 | +0.195R | −0.196R (-10.28) | −0.266R | 3.31 | −0.588R | 1 | no |
| Big-candle fade | hi24 | 11567 | −0.068R | 13090 | +0.180R | −0.196R (-9.08) | −0.262R | 3.02 | −0.571R | 1 | no |
| Big-candle fade | asia | 12021 | −0.132R | 14348 | +0.175R | −0.205R (-9.87) | −0.286R | 3.25 | −0.585R | 1 | no |
| Break fade | dom | 78385 | −0.097R | 98217 | +0.042R | −0.119R (-21.88) | −0.117R | -0.31 | −0.280R | 1 | no |
| Break fade | pdl | 43179 | −0.079R | 51387 | +0.036R | −0.106R (-13.34) | −0.122R | 2.23 | −0.248R | 1 | no |
| Break fade | hi24 | 38918 | −0.082R | 45914 | +0.048R | −0.090R (-10.72) | −0.127R | 4.76 | −0.227R | 1 | no |
| Break fade | asia | 42376 | −0.124R | 48846 | +0.011R | −0.121R (-14.44) | −0.138R | 1.77 | −0.253R | 1 | no |

## Inside an H1 DOM zone, by the zone's side (2015-26, after costs)

| Desk | All trades | In a zone the trade is WITH | In a zone the trade is AGAINST |
|---|---|---|---|
| big | 54443 / −0.246R | 22506 / −0.244R (t -14.3) | 3511 / −0.384R (t -10.95) |
| brk | 201772 / −0.118R | 92099 / −0.113R (t -19.96) | 6118 / −0.214R (t -11.06) |

Costs: the shared table (assumed, not measured, on five of the ten markets). 2015-26 had been read by many studies of the Big-candle fade before this one.
