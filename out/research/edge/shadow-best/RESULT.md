# Which shadow streams to keep: result

Pre-registration: `PREREGISTRATION.md` (committed alone first, 12 Nov 2026). Paper research only: nothing live changed.

**Verdict: FAIL, 0 of 32 cells: no engine shadow stream is worth keeping**

Plainly: every (setup, market) stream of the four engine setups (scalp, intraday, rscalp, rintra) loses after costs out of sample (2024-26), and none is positive in both windows with an out-of-sample t of 2. The placebo (40 random partitions of the same sizes) gives 0 keeps, so the rule is not loose. The family as a whole: -0.227R a trade in sample (n 61469), -0.223R out of sample (n 46266); before costs -0.043 / -0.037.

What follows (owner, 12 Nov 2026: "yes apply the cut when it's done"): the Trader stops recording new shadow signals of these four setups on every market (`council/shadow-cut.mjs`, keep list empty). The 11 days of forward shadow trades that looked best (XRP / USD/CHF / BTC scalps) are 3 of 55 streams on about 20-70 trades each, what luck gives; on 2020-26 the same streams lose.

## Every cell (net R a trade after costs; t on calendar-month sums)

| setup | market | IS n | IS net | IS gross | IS t | OOS n | OOS net | OOS gross | OOS t | kept |
|---|---|---|---|---|---|---|---|---|---|---|
| scalp | xau | 4191 | -0.266 | -0.058 | -7.604 | 3310 | -0.102 | +0.022 | -2.435 | no |
| intraday | xau | 901 | -0.099 | -0.003 | -1.29 | 725 | -0.032 | +0.024 | -0.387 | no |
| rscalp | xau | 2215 | -0.248 | -0.030 | -8.344 | 1832 | -0.249 | -0.110 | -7.33 | no |
| rintra | xau | 484 | -0.121 | -0.011 | -1.784 | 424 | +0.014 | +0.074 | 0.139 | no |
| scalp | eurusd | 5174 | -0.221 | -0.011 | -6.578 | 3499 | -0.285 | -0.052 | -7.382 | no |
| intraday | eurusd | 1193 | -0.242 | -0.147 | -4.295 | 757 | -0.166 | -0.057 | -1.985 | no |
| rscalp | eurusd | 2675 | -0.234 | -0.012 | -8.961 | 1797 | -0.286 | -0.049 | -8.466 | no |
| rintra | eurusd | 656 | -0.135 | -0.012 | -2.92 | 418 | -0.170 | -0.034 | -2.523 | no |
| scalp | gbpusd | 5131 | -0.203 | -0.034 | -6.914 | 3643 | -0.268 | -0.062 | -7.035 | no |
| intraday | gbpusd | 1252 | -0.142 | -0.074 | -2.449 | 837 | -0.132 | -0.046 | -1.942 | no |
| rscalp | gbpusd | 2855 | -0.190 | -0.000 | -5.593 | 1991 | -0.217 | +0.015 | -4.733 | no |
| rintra | gbpusd | 750 | -0.095 | -0.004 | -1.869 | 446 | -0.076 | +0.042 | -1.265 | no |
| scalp | audusd | 5900 | -0.307 | -0.091 | -11.877 | 4096 | -0.303 | -0.053 | -7.149 | no |
| intraday | audusd | 1308 | -0.190 | -0.095 | -3.421 | 850 | -0.108 | +0.013 | -1.599 | no |
| rscalp | audusd | 2936 | -0.241 | -0.003 | -8.133 | 1973 | -0.287 | -0.019 | -10.162 | no |
| rintra | audusd | 748 | -0.116 | +0.011 | -2.639 | 449 | -0.236 | -0.073 | -3.421 | no |
| scalp | usdcad | 5694 | -0.258 | -0.065 | -10.596 | 3943 | -0.300 | -0.066 | -8.593 | no |
| intraday | usdcad | 1270 | -0.168 | -0.088 | -2.967 | 870 | -0.121 | -0.009 | -1.854 | no |
| rscalp | usdcad | 2931 | -0.225 | -0.007 | -8.116 | 1967 | -0.242 | +0.022 | -6.974 | no |
| rintra | usdcad | 694 | -0.167 | -0.038 | -2.855 | 470 | -0.186 | -0.036 | -2.619 | no |
| scalp | usdchf | 5405 | -0.329 | -0.104 | -12.831 | 3732 | -0.314 | -0.074 | -8.102 | no |
| intraday | usdchf | 1290 | -0.148 | -0.045 | -2.625 | 860 | -0.144 | -0.024 | -1.556 | no |
| rscalp | usdchf | 2774 | -0.256 | -0.011 | -8.819 | 1898 | -0.261 | -0.003 | -8.201 | no |
| rintra | usdchf | 612 | -0.196 | -0.048 | -3.193 | 424 | -0.233 | -0.082 | -3.67 | no |
| intraday | btc | 360 | +0.002 | +0.049 | 0.016 | 884 | -0.147 | -0.077 | -1.676 | no |
| rintra | btc | 174 | -0.091 | -0.025 | -0.896 | 524 | -0.171 | -0.080 | -3.626 | no |
| intraday | eth | 378 | +0.079 | +0.119 | 0.949 | 751 | -0.040 | +0.003 | -0.489 | no |
| rintra | eth | 235 | -0.143 | -0.086 | -1.767 | 445 | -0.086 | -0.034 | -1.437 | no |
| intraday | sol | 502 | -0.050 | -0.024 | -0.661 | 885 | -0.126 | -0.089 | -2.097 | no |
| rintra | sol | 254 | -0.102 | -0.067 | -1.374 | 515 | -0.107 | -0.059 | -2.634 | no |
| intraday | xrp | 332 | +0.126 | +0.162 | 0.678 | 630 | -0.084 | -0.040 | -1.023 | no |
| rintra | xrp | 195 | -0.019 | +0.034 | -0.168 | 421 | -0.034 | +0.022 | -0.583 | no |

## Placebo

40 random partitions of the family into cells of the same sizes (fixed hash), the same rule: 0 keeps; largest out-of-sample t -0.291.

## Not done, said plainly

- No M1 history of the coins: their scalp and rscalp streams are untested (as in shadow-scalp-filters).
- swing, position, rswing and m30m1 are not part of this study and are not cut.
- The replay takes every engine signal (no Coach filters, news guard or caps), as pre-registered.

## To repeat

```sh
node research/edge/shadow-scalp-filters/run.mjs fetch <candleDir>
node --max-old-space-size=3500 research/edge/shadow-best/run.mjs market <key> <candleDir> <outDir>   # each of the ten markets
node research/edge/shadow-best/run.mjs report <outDir>
```

Tests: `tests/shadow-best.test.mjs`.
