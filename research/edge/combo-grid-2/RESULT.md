# Combination grid 2: 11 filters, the body engulf, 18 markets, 2020 to now

**Verdict: PASS before costs on the pre-registered bar, 1 rule of 2,968,203 cells (FAIL after costs, 0 confirmed). The one rule makes +0.024R a trade before costs and about -0.11R after them; it is a near-zero tilt, not something to trade.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, with its two amendments: 18 markets, and the owner's "forget the costs": the
same bar judged before costs, the after-cost result kept beside it). Research only: nothing live changed.

## What was run

5 chains x 9 key zones x 2 visit rules x 11 filters x 47 trigger / entry / stop variants x 7 exits = 325,710 rules, each on the
18 markets pooled and on each market alone: 2,968,203 rule-and-market cells with at least 100 trades in 2020-23.
11,514,477 signals and 137,314,548 simulated trades on OANDA mid 5-minute candles, 1 Jan 2020 to 23 Nov 2026;
113,039 simulated fills inside the data-quality audit's bad intervals were dropped. Discovery 2020-23 (n >= 100,
mean > 0, month t >= 2); confirmation 2024-now (n >= 50, mean > 0, month t >= 2 after Holm over every discovery winner).

## Result

| | Before costs | After costs |
|---|---:|---:|
| Cells tested (n >= 100 in 2020-23) | 2,968,203 | 2,968,203 |
| Positive in 2020-23 with month t >= 2 | 62,513 | 11,124 |
| Of those, also positive with month t >= 2 in 2024-now | 1,773 | 131 |
| Expected by chance (one-sided rate of t >= 2 with no edge) | about 1,424 | about 253 |
| Confirmed after Holm | **1** | **0** |
| Placebo, after costs only (side flipped, rules with a trigger): 2020-23 / 2024-now / confirmed | | 12,048 / 176 / 0 |

Before costs the grid sits at chance: 2.1 % of cells passed discovery (about 2.3 % with no edge) and 1,773 held out of sample
against about 1,424 by chance, a small excess spread over many near-identical variants. After costs it is below chance, as the
first grid was: the real rules passed less often than the placebo (11,124 against 12,048; 131 against 176 held). The placebo
was kept on the after-cost basis only: its month sums carry no before-cost copy, so it cannot be compared with the
before-cost counts. Before costs, "positive at twice the cost" is an empty check.

### The one rule confirmed before costs

H1 key zone, M15 timing: a dominant-pair (DOM) zone on H1, its first or second visit, no filter and no trigger, a limit at the
zone's near edge with the stop past the zone, a trailing exit; all 18 markets pooled. 2020-23: n 178,094, +0.016R
a trade, month t 3.79; 2024-now: n 129,855, +0.024R, month t 5.8, Holm p 0.0489 (just under 0.05).
Out of sample it is positive before costs on 18 of 18 markets (month t over 2 on AUD/USD, USD/CAD, EUR/AUD only), and
after costs it loses on every one (-0.05R to -0.22R a trade). Three cautions: it is one of ~62,000 discovery winners and its
Holm margin is thin; it has no trigger, so it has no valid placebo; and +0.024R a trade is far smaller than any market's
round trip in R at these stop sizes. A hypothesis for data neither grid read (2005-2019), never an edge.

## Average R a trade by piece (every rule, trade-weighted, 18 markets pooled)

### By filter
| Filter | Before costs, 2020-23 / 2024-now | After costs, 2020-23 / 2024-now |
|---|---|---|
| none | -0.006 / -0.008 | -0.116 / -0.119 |
| structure of the zone timeframe | -0.007 / -0.009 | -0.115 / -0.118 |
| structure one timeframe up | -0.008 / -0.013 | -0.117 / -0.122 |
| direction call (MSNR) | -0.009 / -0.008 | -0.118 / -0.117 |
| last Daily engulf | -0.011 / -0.002 | -0.120 / -0.111 |
| weekly side | -0.001 / -0.016 | -0.111 / -0.125 |
| Daily ER20 >= 0.2 | -0.005 / -0.010 | -0.113 / -0.120 |
| Daily ER20 >= 0.35 | -0.003 / -0.019 | -0.111 / -0.129 |
| weekly side and ER20 >= 0.2 | -0.000 / -0.010 | -0.107 / -0.118 |
| London 07-12 UTC | +0.005 / +0.002 | -0.101 / -0.109 |
| New York 12-17 UTC | -0.006 / -0.011 | -0.096 / -0.103 |

### By key zone
| Zone | Before costs, 2020-23 / 2024-now | After costs, 2020-23 / 2024-now |
|---|---|---|
| engulf (3 candles) | -0.010 / -0.009 | -0.115 / -0.114 |
| engulf (next candle) | -0.005 / -0.011 | -0.111 / -0.117 |
| failed engulf (EF) | -0.008 / -0.014 | -0.109 / -0.116 |
| dominant pair (DOM) | -0.003 / -0.005 | -0.116 / -0.118 |
| A / V level | +0.004 / -0.011 | -0.123 / -0.138 |
| BO origin barrier | -0.009 / -0.007 | -0.096 / -0.096 |
| QM | -0.025 / -0.005 | -0.121 / -0.102 |
| box | -0.015 / -0.009 | -0.101 / -0.096 |
| body engulf | -0.009 / -0.012 | -0.116 / -0.123 |

### By chain
| Chain | Before costs, 2020-23 / 2024-now | After costs, 2020-23 / 2024-now |
|---|---|---|
| 1d>4h | -0.001 / -0.017 | -0.032 / -0.046 |
| 4h>1h | +0.008 / -0.005 | -0.053 / -0.066 |
| 4h>15m | +0.003 / -0.004 | -0.084 / -0.092 |
| 1h>15m | -0.006 / -0.008 | -0.108 / -0.112 |
| 1h>5m | -0.011 / -0.013 | -0.143 / -0.146 |

### By market
| Market | Before costs, 2020-23 / 2024-now | After costs, 2020-23 / 2024-now |
|---|---|---|
| xau | -0.001 / +0.037 | -0.126 / -0.035 |
| eurusd | -0.010 / -0.034 | -0.101 / -0.138 |
| gbpusd | -0.029 / -0.027 | -0.116 / -0.134 |
| usdjpy | +0.045 / +0.006 | -0.060 / -0.078 |
| audusd | -0.030 / -0.045 | -0.123 / -0.160 |
| nzdusd | -0.046 / -0.041 | -0.154 / -0.176 |
| usdcad | -0.047 / +0.028 | -0.138 / -0.088 |
| usdchf | -0.003 / -0.020 | -0.116 / -0.144 |
| eurjpy | +0.028 / +0.000 | -0.080 / -0.095 |
| xag | -0.040 / -0.016 | -0.289 / -0.192 |
| gbpjpy | +0.018 / -0.014 | -0.090 / -0.117 |
| eurgbp | -0.020 / -0.042 | -0.168 / -0.237 |
| audjpy | +0.029 / +0.007 | -0.086 / -0.107 |
| cadjpy | +0.031 / -0.001 | -0.091 / -0.124 |
| euraud | -0.014 / -0.015 | -0.120 / -0.137 |
| nas100 | +0.003 / -0.004 | -0.055 / -0.047 |
| spx500 | -0.005 / -0.021 | -0.089 / -0.098 |
| de40 | -0.009 / +0.037 | -0.084 / -0.027 |

Before costs almost every piece is within 0.02R of zero; costs take 0.03R (D1>H4) to 0.13R (H1>M5) a trade, more the lower the
chain, because lower chains have smaller stops. No filter moves the average: the London session is the least bad before
costs (+0.005 / +0.002), the weekly-side and ER filters are no better than none. Gold, USD/CAD and DE40 were positive before
costs in 2024-now (+0.03 to +0.04R) but not in 2020-23; the yen pairs the other way round (positive in 2020-23, about zero since).

## Best families, in plain words

Before costs (top of the 1,773 that held, by out-of-sample t):

| Scope | Chain, zone | Filter | Trigger, entry | Exit | 2020-23 n / R / t | 2024-now n / R / t | Holm p |
|---|---|---|---|---|---|---|---|
| pool | 1h>15m dom | none | none zedge | trail | 178094 / +0.016 / 3.79 | 129855 / +0.024 / 5.8 | 0.0489 |
| eurgbp | 1h>15m av | none | none zhalf | 3R | 1631 / +0.098 / 2.54 | 599 / +0.288 / 5.33 | 0.201 |
| eurgbp | 1h>15m av | none | none zedge | 1R | 5779 / +0.044 / 2.69 | 3215 / +0.133 / 5.1 | 0.4 |
| de40 | 1h>15m egn | none | ef mkt/trig | 3R | 2043 / +0.095 / 2.56 | 1448 / +0.257 / 4.97 | 0.586 |
| eurgbp | 1h>5m av | none | none zedge | 1R | 6112 / +0.053 / 3.22 | 3395 / +0.128 / 4.94 | 0.635 |
| eurgbp | 1h>15m av | none | none zhalf | 3R | 2611 / +0.086 / 2.33 | 942 / +0.307 / 4.86 | 0.812 |
| de40 | 1h>15m egn | none | ef mkt/trig | 3R | 1249 / +0.157 / 3.51 | 890 / +0.300 / 4.86 | 0.813 |
| pool | 1h>5m dom | none | none zedge | trail | 188582 / +0.013 / 3.49 | 137325 / +0.022 / 4.7 | 1 |

- The DOM-zone limit with a trailing exit on H1 (M15 or M5 timing), all markets pooled: the confirmed rule and its M5 twin.
- EUR/GBP at H1 A / V levels with a limit at the level and a short fixed target: 92 of the top 200 before-cost cells. EUR/GBP's
  assumed cost (0.9 pip) is larger than these gains in R; after costs it is the worst market (-0.24R).
- DE40 H1 next-candle engulf zones with an M15 failed engulf, entered at market.

After costs (top of the 131 that held):

| Scope | Chain, zone | Filter | Trigger, entry | Exit | 2020-23 n / R / t | 2024-now n / R / t | Holm p |
|---|---|---|---|---|---|---|---|
| de40 | 1h>15m ef | struct | bo edge/zone | 3R | 1344 / +0.136 / 2.08 | 922 / +0.203 / 3.37 | 1 |
| de40 | 1h>15m ef | struct | bo edge/zone | 4R | 1344 / +0.162 / 2.28 | 922 / +0.233 / 3.3 | 1 |
| de40 | 1h>15m ef | structUp | vrcf mkt/zone | 1R | 272 / +0.156 / 2.21 | 174 / +0.255 / 3.27 | 1 |
| de40 | 1h>15m ef | d1eg | bo mkt/zone | trail | 1150 / +0.135 / 2.11 | 810 / +0.204 / 3.24 | 1 |
| eurusd | 4h>1h ef | london | ef edge/zone | 1R | 214 / +0.161 / 2.03 | 112 / +0.309 / 3.15 | 1 |
| usdjpy | 4h>15m ef | weekly | bo edge/zone | 1R | 185 / +0.206 / 2.37 | 103 / +0.205 / 3.09 | 1 |
| usdjpy | 4h>15m dom | none | ef mkt/zone | 2R | 686 / +0.106 / 2.3 | 500 / +0.190 / 3.01 | 1 |
| de40 | 1h>15m ef | struct | bo edge/zone | 6R | 1344 / +0.169 / 2.04 | 922 / +0.233 / 2.92 | 1 |

- DE40, H1 failed-engulf (EF) zones with an M15 break: many entry / stop / exit variants of one rule, Holm p 1.
- USD/JPY H4 DOM zones with an M15 EF trigger: the same family the first grid found, again Holm p 1.
Variants of one rule are not independent tries; none is called an edge.

## Notes

- Markets: 18, each with its own data-quality exclusions (`research/edge/data-quality/quality.json`); costs as the
  pre-registration and its amendment (some assumed, not measured).
- Month sums use the month of the fill; each signal is its own trade, so trade counts overstate the independent evidence.
- These years are now read by both grids: anything here needs data neither read before it is more than a hypothesis.

To repeat: `node research/edge/_lib/fetch-cache.mjs <m> 5m 2019` and `... 1d 2018` for the 18 markets, then
`node research/edge/combo-grid-2/run.mjs market <m> <dir>` for each (about 6 minutes, 1 GB), then `run.mjs report <dir>`
(after costs) and `run.mjs gross <dir>` (before costs).
