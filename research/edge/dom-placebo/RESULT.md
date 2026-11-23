# Is it the dominant zone, or any candle body? (result)

**Verdict: FAIL. DOM +0.055R a trade before costs (n 151,045, month t 14.23), but a random earlier same-colour body makes +0.080R (n 101,439; Welch t -4.29).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, pushed alone first). Pooled xau, eurusd, gbpusd, usdjpy and audusd,
trades 2010-2019, OANDA mid 5-minute candles, grid 3's signals, limit and `multi()` exits unchanged, the `dom-zone-holdout`
trade for every stream. Judged before costs (the owner's basis); after costs beside. Research only: nothing live changed.

## Tests (trail exit, before costs, Holm over three)

| Test | Result | Holm p | Pass |
|---|---|---:|---|
| T1 DOM minus C1 (random same-colour body among the 24 before) | -0.0248R a trade, Welch t -4.29 (month t of the per-month difference -3.82) | 1 | no |
| T2 DOM minus C2 (every candle's body) | +0.0113R a trade, Welch t 2.87 (month t 3.03) | 0.0042 | yes |
| T3 DOM alone | +0.0548R a trade, n 151,045, month t 14.23 | <0.001 | yes |

The pre-registered bar needs all three; T1 fails the wrong way: the DOM does WORSE than a random same-colour body of the last
day. After costs every stream loses: DOM -0.052R (t -12.05), C1 -0.041R (t -6.86), C2 -0.071R (t -18.49).

## Pooled streams, before costs (after costs in brackets)

| Stream | n | Trail exit | 2R exit |
|---|---:|---:|---:|
| DOM | 151,045 | +0.055 (t 14.23) [-0.052] | +0.049 (t 10.30) [-0.058] |
| C1 random same-colour body, seed 1 | 101,439 | +0.080 (t 14.35) [-0.041] | +0.075 (t 11.02) [-0.046] |
| C2 any candle body | 546,113 | +0.043 (t 14.78) [-0.071] | +0.039 (t 13.42) [-0.076] |

2R exit: DOM minus C1 -0.026R (t -4.24), DOM minus C2 +0.010R (t 2.33). C1 seeds 2-5: +0.072 to +0.083R; DOM minus C1
-0.017 to -0.029R (Welch t -2.92 to -5.01): no seed reverses it.

## Halves (trail, before costs)

| | DOM | C1 | C2 | DOM - C1 (t) | DOM - C2 (t) |
|---|---:|---:|---:|---:|---:|
| 2010-14 | +0.060 (n 75,351) | +0.084 | +0.046 | -0.024 (-2.95) | +0.014 (2.50) |
| 2015-19 | +0.050 (n 75,694) | +0.075 | +0.041 | -0.025 (-3.12) | +0.009 (1.56) |

## Per market (trail, before costs; after costs for the DOM in brackets)

| Market | DOM | C1 | C2 | DOM - C1 (t) | DOM - C2 (t) |
|---|---:|---:|---:|---:|---:|
| Gold | +0.030 (n 27,965) [-0.153] | +0.046 | +0.036 | -0.017 (-1.34) | -0.006 (-0.70) |
| EUR/USD | +0.061 (n 30,514) [-0.018] | +0.079 | +0.037 | -0.017 (-1.35) | +0.024 (2.73) |
| GBP/USD | +0.057 (n 30,197) [-0.026] | +0.079 | +0.038 | -0.022 (-1.70) | +0.019 (2.08) |
| USD/JPY | +0.066 (n 30,335) [-0.048] | +0.083 | +0.055 | -0.017 (-1.33) | +0.011 (1.23) |
| AUD/USD | +0.058 (n 32,034) [-0.024] | +0.106 | +0.051 | -0.048 (-3.68) | +0.007 (0.81) |

## Reading

The before-cost tilt is real on these untouched-by-the-grids years (positive in every market and both halves), but it is a
property of a limit at a recent H1 body with this stop, not of the dominant pair: every candle body gives +0.043R, a random
earlier body of the same colour gives more than the DOM's own first candle. The DOM is a little better than an arbitrary
candle (T2) and worse than a deeper, older body (T1). Not tested here, a possible cause: limit fills at the zone edge on mid
candles with no spread. No variant of the DOM rule follows from this; nothing live changed. Caveats: trades overlap in time and
across streams, so per-trade Welch t is generous (the month-sum t of the difference is given beside); C1 and C2 share zones
with the DOM stream on some candles.

To repeat: fill the cache (`_lib/fetch-cache.mjs <m> 5m 2009 2019`), then `run.mjs market <m> <dir>` for the five markets
(about 20 minutes each, side by side) and `run.mjs report <dir>`.
