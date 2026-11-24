# H1 dominant zone inside the range at the extreme of the last H4 break (result)

**Verdict: FAIL. Best cell (IN, against the H4 break) made −0.034R a trade after costs in 2015-26 (n 17,428, month t −2.04).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone before the run). Research only: nothing live changed, no rule is proposed.

## What was run

The H1 dominant-zone limit of `dom-zone-holdout` (limit at the zone's near edge from the first touch, stop past the far side by half the round trip + 0.25 x ATR(14) of H1, a 2R target, two days at most) on xau, eurusd, gbpusd, usdjpy, audusd, OANDA mid 5-minute candles, discovery 2005-2014 and confirmation 2015 to October 2026, costs = `combo-grid-3` `COSTS` as cost / risk. Each order is classed at its arming by the box of the last H4 structure break: the range from the extreme of that move to the H1 swing level its first H1 counter-break closed through, current until the next H4 break closes or an H1 candle closes beyond the extreme. 8,213 boxes; 15 % of the orders overlap one in 2005-14 and 15 % in 2015-26.

## The three cells (2R target, five markets pooled)

| Set | n 2005-14 | R before costs | R after | month t before / after | n 2015-26 | R before costs | R after | month t before / after | winners | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| IN (zone overlaps the box) | 21,946 | +0.064 | −0.025 | 5.13 / −1.99 | 27,122 | +0.058 | −0.043 | 5.17 / −3.71 | 36 % | 0.101 |
| IN, with the H4 break | 7,620 | +0.054 | −0.039 | 2.59 / −1.89 | 9,694 | +0.047 | −0.060 | 2.09 / −2.71 | 35 % | 0.107 |
| IN, against the H4 break | 14,326 | +0.069 | −0.018 | 3.88 / −1.00 | 17,428 | +0.064 | −0.034 | 4.00 / −2.04 | 36 % | 0.098 |
| OUT (no box or no overlap) | 123,985 | +0.066 | −0.028 | 12.98 / −4.89 | 155,685 | +0.049 | −0.055 | 10.43 / −10.93 | 35 % | 0.104 |
| ALL orders | 145,931 | +0.066 | −0.028 | 14.19 / −5.27 | 182,807 | +0.051 | −0.053 | 11.87 / −11.72 | 35 % | 0.104 |

| Cell | 300 trades in both windows | after costs > 0 with month t >= 2 in both | Holm p (confirmation) | Pass |
|---|---|---|---:|---|
| IN (zone overlaps the box) | yes | no | 1.000 | no |
| IN, with the H4 break | yes | no | 1.000 | no |
| IN, against the H4 break | yes | no | 1.000 | no |

## Against the orders outside a box (after costs, reported only)

| Cell | 2005-14: difference (Welch t) | 2015-26: difference (Welch t) |
|---|---:|---:|
| IN (zone overlaps the box) minus OUT | +0.003R (0.25) | +0.012R (1.23) |
| IN, with the H4 break minus OUT | −0.011R (−0.64) | −0.005R (−0.33) |
| IN, against the H4 break minus OUT | +0.010R (0.75) | +0.021R (1.83) |

## By market (R after costs, n; 2005-14 | 2015-26)

| Market | IN | IN with | IN against | ALL |
|---|---|---|---|---|
| xau | −0.145 (3,517) \| −0.058 (4,940) | −0.187 (1,148) \| −0.128 (1,809) | −0.125 (2,369) \| −0.018 (3,131) | −0.137 (24,794) \| −0.087 (34,114) |
| eurusd | −0.009 (4,584) \| −0.029 (5,708) | +0.002 (1,615) \| −0.063 (2,067) | −0.015 (2,969) \| −0.009 (3,641) | −0.002 (29,884) \| −0.046 (37,143) |
| gbpusd | −0.004 (4,440) \| −0.011 (5,179) | +0.017 (1,558) \| −0.070 (1,755) | −0.015 (2,882) \| +0.019 (3,424) | −0.002 (30,279) \| −0.045 (36,878) |
| usdjpy | −0.011 (4,356) \| −0.018 (5,105) | −0.032 (1,529) \| −0.017 (1,861) | +0.001 (2,827) \| −0.019 (3,244) | −0.024 (29,820) \| −0.032 (37,060) |
| audusd | +0.012 (5,049) \| −0.091 (6,190) | −0.034 (1,770) \| −0.029 (2,202) | +0.038 (3,279) \| −0.126 (3,988) | +0.008 (31,154) \| −0.058 (37,612) |

## The same sets with the order's trailing exit (context only, not a cell)

| Set | n 2005-14 | R before costs | R after | month t before / after | n 2015-26 | R before costs | R after | month t before / after | winners | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| IN (zone overlaps the box) | 21,946 | +0.055 | −0.034 | 5.25 / −3.21 | 27,122 | +0.062 | −0.039 | 6.16 / −3.73 | 50 % | 0.101 |
| IN, with the H4 break | 7,620 | +0.072 | −0.021 | 3.72 / −1.08 | 9,694 | +0.051 | −0.055 | 2.75 / −2.95 | 51 % | 0.107 |
| IN, against the H4 break | 14,326 | +0.045 | −0.042 | 3.45 / −3.05 | 17,428 | +0.068 | −0.030 | 4.78 / −2.05 | 50 % | 0.098 |
| OUT (no box or no overlap) | 123,985 | +0.071 | −0.022 | 16.41 / −4.39 | 155,685 | +0.053 | −0.051 | 13.24 / −11.71 | 50 % | 0.104 |
| ALL orders | 145,931 | +0.069 | −0.024 | 18.24 / −5.36 | 182,807 | +0.055 | −0.049 | 15.04 / −12.33 | 50 % | 0.104 |

## Checks

- Cut check: on 25 cuts (five dates x 5 markets) 644 boxes known before the cut were compared between the cut series and the full one: 0 differ.
- ALL orders are `dom-zone-holdout`'s own order list (the same code path; a seeded-candle test compares it with `dom-vb-side`'s copy trade for trade).

## Reading

Where the H1 dominant zone sits against the box of the last H4 break does not turn the order into a rule that pays after costs: no cell is above zero after costs in both windows. The differences against the orders outside a box are a few hundredths of an R. This is one mechanical reading of the box (3-a-side swings, the first counter-break only); it says nothing about a box chosen by eye. Nothing live changed.

To repeat: `node --max-old-space-size=3500 research/edge/dom-h4-vr-overlap/run.mjs run` with `EDGE_DATA` pointing at the candle cache. Test: `tests/dom-h4-vr-overlap.test.mjs`.
