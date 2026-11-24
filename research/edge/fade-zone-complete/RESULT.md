# The zone fade with cost, hour and level filters, after costs (result)

**Verdict: FAIL. K8 (H1 hour + cost) picked on 2005-14 (+0.197R a trade after costs, n 668, month t 3.11); 2015-26 +0.026R (n 554, t 0.39), eight new markets +0.180R (n 726, t 2.79).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The structure-break fade (`grid7-wide-fade`, its own code) closed at the nearest H1 / H4 key level in front and stopped past
the nearest level behind (`fade-zone-targets`), on M15 or H1 breaks, with three fixed filters: **hour** (break candle starts
20-23 UTC, fill not in 21:00-22:59 UTC), **level** (a level behind the fill was used as the stop), **cost** (round trip at
most 5 % of the risk). Eight candidates; the one with the best month t AFTER costs on 2005-14 (positive, t >= 2, n >= 300) is
confirmed once after costs on 2015-26 and on eight markets this rule was never run on.
Costs: measured for xau, eurusd, gbpusd, usdjpy, audusd; **ASSUMED, not measured** for every other market.

## Gate and cut test

- K1 2005-14 = fade-zone-targets: n 171,523, +0.107 (wanted n 171,523, +0.107): equal.
- K1 2015-26 = fade-zone-targets: n 201,769, +0.071 (wanted n 201,769, +0.071): equal.
- Cut test: 6 cuts on xau, eurusd: 153,546 trades with their filters and levels known by the cut dates, 0 missing or extra when the candles are cut there.
- Trades whose exit was still open when the data ends (closed at the last close): 1.

## Every candidate

R a trade after costs (month-sum t); before costs and at 2 x costs beside. "Measured" = the five markets with measured costs, 2015-26.

| Key | Candidate | 2005-14 n | net (t) | gross | 2015-26 n | net (t) | gross | 2x cost | eight markets n | net (t) | gross | measured 15-26 net (t) | eligible |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| K1 | M15 no filter | 171,523 | -0.110 (-15.37) | +0.107 | 201,769 | -0.178 (-34.93) | +0.071 | -0.427 | 288,544 | -0.207 (-44.79) | +0.053 | -0.168 (-28.48) | no |
| K2 | M15 hour | 14,389 | +0.017 (0.97) | +0.242 | 15,341 | -0.110 (-6.13) | +0.145 | -0.366 | 20,259 | -0.099 (-6.32) | +0.154 | -0.116 (-5.68) | no |
| K3 | M15 hour + level | 9,127 | +0.026 (1.25) | +0.264 | 9,320 | -0.122 (-5.18) | +0.158 | -0.402 | 13,376 | -0.111 (-5.58) | +0.168 | -0.116 (-4.06) | no |
| K4 | M15 cost | 18,097 | +0.012 (1.03) | +0.049 | 10,212 | -0.007 (-0.42) | +0.031 | -0.045 | 18,070 | -0.035 (-2.72) | +0.000 | -0.002 (-0.12) | no |
| K5 | M15 hour + cost | 909 | +0.061 (1.28) | +0.099 | 403 | +0.122 (1.23) | +0.159 | +0.084 | 993 | -0.102 (-2.02) | -0.067 | +0.161 (1.55) | no |
| K6 | M15 hour + level + cost | 659 | +0.053 (1.03) | +0.091 | 277 | +0.213 (1.68) | +0.251 | +0.175 | 670 | -0.117 (-2.28) | -0.082 | +0.244 (1.74) | no |
| K7 | H1 cost | 11,774 | +0.025 (1.89) | +0.058 | 9,121 | -0.026 (-1.65) | +0.009 | -0.062 | 12,602 | -0.015 (-1.09) | +0.018 | -0.041 (-2.12) | no |
| K8 | H1 hour + cost | 668 | +0.197 (3.11) | +0.229 | 554 | +0.026 (0.39) | +0.060 | -0.008 | 726 | +0.180 (2.79) | +0.213 | +0.007 (0.09) | yes |

## Median and wins

| Key | 2015-26 median net | wins | trades a year (ten markets) | eight markets median net | wins |
|---|---:|---:|---:|---:|---:|
| K1 | -1.108 | 32.5% | 17,051 | -1.111 | 32.2% |
| K2 | -1.118 | 36.1% | 1,296 | -1.109 | 35.9% |
| K3 | -1.121 | 34.6% | 788 | -1.114 | 34.5% |
| K4 | -1.030 | 36.5% | 863 | -1.027 | 35.1% |
| K5 | -1.027 | 38.7% | 34 | -1.026 | 32.8% |
| K6 | -1.026 | 40.8% | 23 | -1.026 | 32.5% |
| K7 | -1.027 | 36.0% | 771 | -1.023 | 36.2% |
| K8 | -1.025 | 37.0% | 47 | -1.018 | 41.6% |

## Per market, K8 after costs

| Market | n 05-14 | net 05-14 | n 15-26 | net 15-26 |
|---|---:|---:|---:|---:|
| xau | 20 | -0.010 | 56 | +0.055 |
| xag* | 0 | n/a | 8 | -0.361 |
| eurusd | 102 | +0.415 | 67 | -0.008 |
| gbpusd | 96 | +0.066 | 68 | +0.018 |
| usdjpy | 51 | +0.205 | 98 | -0.020 |
| audusd | 107 | -0.036 | 65 | +0.010 |
| nzdusd* | 79 | +0.144 | 51 | +0.111 |
| usdcad* | 42 | -0.027 | 43 | +0.242 |
| usdchf* | 55 | +0.309 | 26 | -0.024 |
| eurjpy* | 116 | +0.424 | 72 | -0.012 |
| nas100* | 1 | +1.957 | 90 | +0.011 |
| spx500* | 2 | -1.029 | 56 | +0.023 |
| de40* | 22 | +0.333 | 34 | +0.096 |
| gbpjpy* | 81 | +0.390 | 75 | -0.040 |
| audjpy* | 68 | +0.157 | 44 | +0.090 |
| cadjpy* | 80 | +0.518 | 41 | +0.248 |
| eurgbp* | 13 | -0.212 | 17 | +0.203 |
| euraud* | 55 | -0.074 | 47 | +0.559 |

\* cost ASSUMED.

## Markets

| Market | candles from | signals | trades | cost |
|---|---|---:|---:|---|
| xau | 2006-03-19 | 44,349 | 44,163 | 0.3 |
| xag | 2006-03-19 | 44,574 | 32,019 | 0.03 (assumed) |
| eurusd | 2004-01-01 | 49,724 | 49,633 | 0.00006 |
| gbpusd | 2004-01-01 | 49,435 | 49,311 | 0.00008 |
| usdjpy | 2004-01-01 | 48,700 | 48,585 | 0.008 |
| audusd | 2004-01-01 | 50,388 | 50,292 | 0.00006 |
| nzdusd | 2004-01-01 | 49,832 | 49,771 | 0.00007 (assumed) |
| usdcad | 2004-01-01 | 50,174 | 50,049 | 0.00007 (assumed) |
| usdchf | 2004-01-01 | 49,243 | 49,124 | 0.00007 (assumed) |
| eurjpy | 2004-01-01 | 48,668 | 48,591 | 0.01 (assumed) |
| nas100 | 2004-01-02 | 49,526 | 44,683 | 1 (assumed) |
| spx500 | 2004-01-02 | 48,826 | 46,126 | 0.4 (assumed) |
| de40 | 2004-01-02 | 33,652 | 32,634 | 1.5 (assumed) |
| gbpjpy | 2004-01-01 | 47,967 | 47,893 | 0.014 (assumed) |
| audjpy | 2004-05-31 | 48,332 | 48,291 | 0.01 (assumed) |
| cadjpy | 2004-05-31 | 48,919 | 48,874 | 0.01 (assumed) |
| eurgbp | 2004-01-01 | 47,759 | 47,656 | 0.00009 (assumed) |
| euraud | 2004-05-31 | 48,336 | 48,308 | 0.00013 (assumed) |

## What it means

K8 (H1 hour + cost) was the one candidate positive after costs on 2005-14 (+0.197R a trade, n 668, month t 3.11).
It did not hold on the ten markets in 2015-26 (+0.026R, n 554, t 0.39; on the five markets with measured costs +0.007R, t 0.09)
and held on the eight new markets (+0.180R, n 726, t 2.79, all with ASSUMED costs). Both were required, so it fails.

What this says: the H1 fade at 20-23 UTC with a stop wide enough that the round trip is a small share of it is the one
combination that pays after costs in some sets, but it is about 50 trades a year over ten markets, and on the markets whose
costs are measured the second decade is flat. The eight-market figure rests on assumed spreads at the hours when real spreads
are widest. Not an edge. The open question it leaves, if anyone wants it, is a forward paper record of this one fixed rule
and a check of 20-23 UTC spreads at the broker's own ticks; no further variant on these years or markets.
