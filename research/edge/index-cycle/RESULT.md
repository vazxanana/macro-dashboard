# The owner's market cycle as an entry on US indices: result

**Verdict: FAIL, 0 of 2 exits pass.** Trading with the H4 move once the H1 pullback against it is over lost on NAS100, SPX500
and US30, in every window, with both exits: exit A (target the H4 move's extreme) -0.227R a trade net on 2016-26 (n 1,174,
monthly t -4.26) and -0.414R on 2010-15 (n 694); exit B (fixed 2R) -0.155R (n 2,907, monthly t -5.60) and -0.306R on 2010-15
(n 1,668). It is also WORSE than random entries in the same H4 direction with the same stop and exit: the placebo's mean is
-0.142R (A) and -0.106R (B), and 39 of the 40 placebo seeds did better than the rule in each exit. Waiting for "the pullback
finished" adds nothing on indices; it takes something away. Not an edge; no proposal; nothing live changed.

Pre-registered in `PREREGISTRATION.md` (committed and pushed before any trade was computed). Data: OANDA mid H1, October 2007 to
12 November 2026 23:00 UTC (113-114 thousand H1 candles a market), H4 built from it in UTC buckets. Costs: spread + 1 point of
slippage (NAS 4, SPX 2, US30 5 points a round trip) and financing on every 22:00 UTC held (long DGS2 + 2.5 %, short max(0,
2.5 % - DGS2)). Windows by exit time. `node research/edge/index-cycle/run.mjs <candle dir>` reproduces `result.json`.

## The pass bar, line by line (pooled over the three markets)

| Line | Exit A (H4 extreme, >= 1R) | Exit B (2R) |
|---|---|---|
| Decisive 2016-26: net R a trade > 0 | -0.227 (n 1174): no | -0.155 (n 2907): no |
| Monthly t >= 2 (131 months) | -4.26: no | -5.60: no |
| Holm p < 0.05 over 2 exits | 0.000 (met only because t is strongly NEGATIVE; the p is two-sided) | 0.000 (same) |
| Replication 2010-15 net R > 0 | -0.414 (n 694): no | -0.306 (n 1668): no |
| Above the placebo's 95th percentile | -0.227 vs -0.074: no | -0.155 vs -0.073: no |
| **Exit passes** | **no** | **no** |

## Results by window, exit and market (net R a trade after costs and financing; t on calendar-month sums)

| Exit | Market | 2016-26 n | net R | t | gross R | 2010-15 n | net R | t |
|---|---|---|---|---|---|---|---|---|
| A | NAS100 | 397 | -0.293 | -3.88 | -0.174 | 227 | -0.611 | -5.52 |
| A | SPX500 | 396 | -0.249 | -3.40 | -0.057 | 225 | -0.348 | -3.12 |
| A | US30 | 381 | -0.136 | -1.87 | -0.069 | 242 | -0.290 | -2.83 |
| A | pooled | 1174 | -0.227 | -4.26 | -0.100 | 694 | -0.414 | -5.29 |
| B | NAS100 | 984 | -0.137 | -3.63 | -0.041 | 567 | -0.433 | -8.11 |
| B | SPX500 | 969 | -0.227 | -5.51 | -0.064 | 541 | -0.353 | -6.41 |
| B | US30 | 954 | -0.102 | -2.43 | -0.038 | 560 | -0.133 | -2.44 |
| B | pooled | 2907 | -0.155 | -5.60 | -0.048 | 1668 | -0.306 | -7.60 |

Before any cost the rule is already below zero (gross -0.10R and -0.05R a trade on 2016-26). Costs and financing take another
0.13R (A) and 0.11R (B) a trade on 2016-26; more on 2010-15, when the indices were lower and a stop of the same number of
candles was fewer points (0.34R and 0.27R). At twice the costs: -0.354R (A) and -0.263R (B). Win rate 32 % (A) and 36 % (B).
By year (pooled, exit by year): exit A positive in one year of seventeen (2022, +0.07R); exit B in none.

## Placebo: the rule against simply trading with the H4 bias

Each real 2016-26 trade replaced by a random H1 entry on the same market, in the same direction as the H4 bias at that open,
with the same stop distance, the same target in R, the same 48-candle exit, fills, costs and financing; 40 seeds.

| Exit | Rule, net R a trade | Placebo mean | Placebo 95th percentile | Placebo best | Seeds better than the rule |
|---|---|---|---|---|---|
| A | -0.227 | -0.142 | -0.074 | -0.071 | 39 of 40 |
| B | -0.155 | -0.106 | -0.073 | -0.053 | 39 of 40 |

Entering at a random hour in the H4 direction loses less than entering on the H1 break back with the H4. The signal's entry
is late: it buys after an H1 high has been taken out (sells after a low), and on these markets that price tends to come back.

## Funnel (per market, 2007-26)

About 2,500 H4 BOs a market; about 1,950 complete the cycle (an H1 ChoCh, then an H1 BO back before a newer H4 BO). Exit A
drops about 1,240 a market because the H4 extreme is less than 1R from the entry (the break back is often near or past the
old extreme); exit B keeps every signal except those that come while the previous trade is open (about 200 a market). 8-14 a
market entered in the 17:00 New York hour were skipped; one signal (SPX500) had its entry gap past the stop and was not
traded. Full counts in `result.json` `funnels`.

## Reading and limits

- This is the rule as written: H4 swings 3 a side, H1 swings 1 a side, entry at the next H1 open, stop 0.1 x ATR(14) past the
  pullback's extreme. A pullback read by eye, a zone entry or a different swing size is not tested here, and per the
  pre-registration no parameter will be varied after this result.
- Together with mosha-retrace, mosha-cycle and the 13 Nov filter study on gold, this is the fourth mechanical reading of the
  cycle that fails, now on three more markets. The owner's own selection is still the untested part (owner decision 27).
- Exit times are booked at the close of the candle that held the stop or target (a little more financing than the exact
  minute); a stop and target in one candle is a stop.
