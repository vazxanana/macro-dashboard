# The shadow cut on the measured raw-spread costs: result

Pre-registration: `PREREGISTRATION.md` (committed alone first, 13 Nov 2026). Paper research only: nothing live changed; no proposal is written.

**Verdict: FAIL, 0 of 32 cells at the measured costs (0 of 32 at 2x): the cut was not decided on wrong costs**

At 2x the measured cost: FAIL, 0 of 32 cells.

Plainly: on the demo's measured costs (forex: the median quoted spread, 0, plus the 22.5 USD a million a side commission; gold: the $0.06 median spread plus its commission), none of the 32 engine shadow streams passes shadow-best's rule. Not one gold or forex cell is positive after costs in both windows; the out-of-sample t of every cell is under 1 (best: gold rintra, OOS +0.049R a trade on n 424, t 0.486, but -0.048R in sample on n 484; next gold intraday OOS -0.006R, t -0.07). The placebo (40 random partitions) gives 0 keeps (largest pseudo-cell OOS t 0.926). **The cut was not decided on wrong costs.**

Why the answer could not have been different: the gross R a trade (before any cost) is the ceiling for every cost model. Only 2 of 32 cells are above zero gross in both windows (intraday eth, rintra xrp), both coin cells, whose cost this study does not change, and both lose after the CFD round trip out of sample. No gold or forex cell is above zero gross in both windows, so no cost model, not even zero cost, makes one pass.

What the measured costs do change: the forex cost of a trade falls from 0.201R to 0.132R on average (about a third less, not two thirds: the half pip of slippage on each market leg is still charged at the default spread, as `tradeCost` does for a 0 quote, and it is now most of the forex cost; it is assumed, not measured), and gold's from 0.158R to 0.055R. Every forex and gold cell moves toward zero; none crosses it in both windows.

Check: the re-read trades reproduce shadow-best exactly (107735 trades; every cell's n, net and OOS t under the old costs equal its result.json; the replay's stamped cost equals `tradeCost` with no broker record to 0.0000503, its 4-decimal rounding). A fresh replay of every market was byte-identical to the files the report read.

## Every cell (net R a trade after the measured costs; t on calendar-month sums; old = shadow-best's costs; 2x = twice the measured cost)

| setup | market | IS n | IS net | IS gross | OOS n | OOS net | OOS gross | OOS t | OOS net, old | OOS net, 2x | kept |
|---|---|---|---|---|---|---|---|---|---|---|---|
| scalp | xau | 4191 | -0.126 | -0.058 | 3310 | -0.028 | +0.022 | -0.692 | -0.102 | -0.078 | no |
| intraday | xau | 901 | -0.042 | -0.003 | 725 | -0.006 | +0.024 | -0.07 | -0.032 | -0.035 | no |
| rscalp | xau | 2215 | -0.098 | -0.030 | 1832 | -0.162 | -0.110 | -5.099 | -0.249 | -0.213 | no |
| rintra | xau | 484 | -0.048 | -0.011 | 424 | +0.049 | +0.074 | 0.486 | +0.014 | +0.023 | no |
| scalp | eurusd | 5174 | -0.154 | -0.011 | 3499 | -0.212 | -0.052 | -5.61 | -0.285 | -0.371 | no |
| intraday | eurusd | 1193 | -0.209 | -0.147 | 757 | -0.128 | -0.057 | -1.529 | -0.166 | -0.198 | no |
| rscalp | eurusd | 2675 | -0.163 | -0.012 | 1797 | -0.209 | -0.049 | -6.301 | -0.286 | -0.370 | no |
| rintra | eurusd | 656 | -0.094 | -0.012 | 418 | -0.124 | -0.034 | -1.809 | -0.170 | -0.214 | no |
| scalp | gbpusd | 5131 | -0.158 | -0.034 | 3643 | -0.214 | -0.062 | -5.685 | -0.268 | -0.366 | no |
| intraday | gbpusd | 1252 | -0.122 | -0.074 | 837 | -0.107 | -0.046 | -1.578 | -0.132 | -0.168 | no |
| rscalp | gbpusd | 2855 | -0.140 | -0.000 | 1991 | -0.157 | +0.015 | -3.522 | -0.217 | -0.329 | no |
| rintra | gbpusd | 750 | -0.070 | -0.004 | 446 | -0.043 | +0.042 | -0.711 | -0.076 | -0.128 | no |
| scalp | audusd | 5900 | -0.213 | -0.091 | 4096 | -0.191 | -0.053 | -4.54 | -0.303 | -0.328 | no |
| intraday | audusd | 1308 | -0.144 | -0.095 | 850 | -0.048 | +0.013 | -0.691 | -0.108 | -0.108 | no |
| rscalp | audusd | 2936 | -0.136 | -0.003 | 1973 | -0.165 | -0.019 | -6.401 | -0.287 | -0.311 | no |
| rintra | audusd | 748 | -0.057 | +0.011 | 449 | -0.160 | -0.073 | -2.407 | -0.236 | -0.247 | no |
| scalp | usdcad | 5694 | -0.207 | -0.065 | 3943 | -0.244 | -0.066 | -7.028 | -0.300 | -0.422 | no |
| intraday | usdcad | 1270 | -0.144 | -0.088 | 870 | -0.091 | -0.009 | -1.394 | -0.121 | -0.174 | no |
| rscalp | usdcad | 2931 | -0.167 | -0.007 | 1967 | -0.178 | +0.022 | -5.269 | -0.242 | -0.379 | no |
| rintra | usdcad | 694 | -0.133 | -0.038 | 470 | -0.149 | -0.036 | -2.128 | -0.186 | -0.262 | no |
| scalp | usdchf | 5405 | -0.245 | -0.104 | 3732 | -0.218 | -0.074 | -5.93 | -0.314 | -0.362 | no |
| intraday | usdchf | 1290 | -0.106 | -0.045 | 860 | -0.091 | -0.024 | -0.992 | -0.144 | -0.157 | no |
| rscalp | usdchf | 2774 | -0.164 | -0.011 | 1898 | -0.157 | -0.003 | -5.115 | -0.261 | -0.311 | no |
| rintra | usdchf | 612 | -0.139 | -0.048 | 424 | -0.170 | -0.082 | -2.734 | -0.233 | -0.258 | no |
| intraday | btc | 360 | +0.002 | +0.049 | 884 | -0.147 | -0.077 | -1.676 | -0.147 | -0.217 | no |
| rintra | btc | 174 | -0.091 | -0.025 | 524 | -0.171 | -0.080 | -3.626 | -0.171 | -0.263 | no |
| intraday | eth | 378 | +0.079 | +0.119 | 751 | -0.040 | +0.003 | -0.489 | -0.040 | -0.084 | no |
| rintra | eth | 235 | -0.143 | -0.086 | 445 | -0.086 | -0.034 | -1.437 | -0.086 | -0.139 | no |
| intraday | sol | 502 | -0.050 | -0.024 | 885 | -0.126 | -0.089 | -2.097 | -0.126 | -0.164 | no |
| rintra | sol | 254 | -0.102 | -0.067 | 515 | -0.107 | -0.059 | -2.634 | -0.107 | -0.154 | no |
| intraday | xrp | 332 | +0.126 | +0.162 | 630 | -0.084 | -0.040 | -1.023 | -0.084 | -0.128 | no |
| rintra | xrp | 195 | -0.019 | +0.034 | 421 | -0.034 | +0.022 | -0.583 | -0.034 | -0.089 | no |

## Cost a trade, in R (all windows)

| market | trades | shadow-best | measured |
|---|---|---|---|
| xau | 14082 | 0.158 | 0.055 |
| eurusd | 16169 | 0.201 | 0.137 |
| gbpusd | 16905 | 0.172 | 0.126 |
| audusd | 18260 | 0.215 | 0.119 |
| usdcad | 17839 | 0.199 | 0.148 |
| usdchf | 16995 | 0.216 | 0.132 |
| btc | 1942 | 0.071 | 0.071 |
| eth | 1809 | 0.047 | 0.047 |
| sol | 2156 | 0.037 | 0.037 |
| xrp | 1578 | 0.046 | 0.046 |

Cost inputs (`costModel` on the rebuilt 12 Nov broker file): xau spread 0.06, commission 0.000024 of the price a round trip, `quotes+commission`; eurusd spread 0, commission 0.000045 of the price a round trip, `quotes+commission`; the other four majors as EUR/USD; the coins `default`.

## Placebo

40 random partitions of the re-costed trades into cells of the same sizes, the same rule: 0 keeps at 1x (largest OOS t 0.926), 0 keeps at 2x (largest OOS t -0.305).

## Not done, said plainly

- The slippage on forex market legs stays the default half pip each way (no demo fill evidence for exits; entries fill within 0.1 pip of the council's price on the mirror). The gross column bounds what any slippage figure could give: no gold or forex cell is positive gross in both windows.
- The coins keep the CFD round trip (no broker record in the fixture); their scalp and rscalp streams are untested (no coin M1 history), as in shadow-best.
- One snapshot of quotes (8-12 Nov 2026) costs trades of 2020-26; the raw-spread account's past quotes are not known.

## To repeat

```sh
node research/edge/shadow-best-raw/run.mjs fetch <candleDir>
node research/edge/shadow-best-raw/run.mjs market <key> <candleDir> <outDir>   # each of the ten markets (shadow-best's replay, unchanged)
node research/edge/shadow-best-raw/run.mjs report <outDir>
```

Tests: `tests/shadow-best-raw.test.mjs`.
