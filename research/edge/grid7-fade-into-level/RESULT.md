# Fading the first structure break: into an opposite Daily level against a clear way (result)

**Verdict: FAIL. 0 of 20 into-minus-clear tests pass before costs; largest confirmation Welch t m15 any swing: into +0.042R a trade (n 175,274, month t 8.77) against clear +0.014R (n 6,344) in 2015-26, Welch t 1.20 (discovery 0.01).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

`grid7-wide-fade`'s own fade trades (imported, not edited): the first structure break on M15 or H1 ("none" context), entered
AGAINST it at the next 5-minute open, stop 1 ATR of the trigger timeframe, exit 2R or the opposite swing. Each trade is placed
by what lies ahead of the break on the Daily (17:00 New York candles, closed by the break; levels known and standing then):
an opposite level (supply above an up break, demand below a down break) of four kinds: Daily engulf zone (`council/eg-methods.mjs`
`zones`, 3-candle span), DOM zone (`combo-grid-3` `buildZones('dom')`), V / A turn of the closes (`buildZones('av')`), the
previous day's high / low; and "any" of them. Places: **into** = the close has not fully crossed it and it is within 1 Daily
ATR ahead (inside counts); **through** = crossed, within 1 Daily ATR behind; **clear** = neither. Discovery = fills 2005-14,
confirmation = 2015 to October 2026. Primary test: into minus clear, Welch t >= 2 in both windows and Holm over 20.
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## Gate

The "any" set's three places summed reproduce `grid7-wide-fade`'s four atr cells: **yes**.

| Fade cell | Window | n here | of which unplaced | R here | n fade | R fade |
|---|---|---:|---:|---:|---:|---:|
| m15 none atr 2R all | discovery | 171,523 | 114 | +0.054 | 171,523 | +0.054 |
| m15 none atr 2R all | confirmation | 201,769 | 0 | +0.042 | 201,769 | +0.042 |
| m15 none atr swing all | discovery | 161,032 | 106 | +0.059 | 161,032 | +0.059 |
| m15 none atr swing all | confirmation | 186,577 | 0 | +0.040 | 186,577 | +0.040 |
| h1 none atr 2R all | discovery | 45,310 | 47 | +0.018 | 45,310 | +0.018 |
| h1 none atr 2R all | confirmation | 52,936 | 0 | +0.007 | 52,936 | +0.007 |
| h1 none atr swing all | discovery | 41,790 | 43 | +0.019 | 41,790 | +0.019 |
| h1 none atr swing all | confirmation | 48,548 | 0 | -0.003 | 48,548 | -0.003 |

**Deviation from the pre-registration (said here, decided before any result was seen):** gold and silver candles start on
19 March 2006, so their first fade trades come before 15 Daily candles exist and have no Daily ATR. The pre-registration does
not say where they go. They are kept out of every place ("unplaced", counted in the table above) and the gate compares
places + unplaced with the fade. They are a few dozen trades of March-April 2006, all in discovery.

## The bar, test by test

- n >= 300 in into and clear in both windows: 20 of 20.
- Into minus clear > 0 with Welch t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05: 0.
- **All four: 0.**

## The 20 tests

Into minus clear, R a trade before costs; Welch t (trade level); month t = the paired monthly difference of the two cells'
month sums; through minus clear beside; net = the same difference after costs.

| Test | diff 05-14 | Welch 05-14 | month t 05-14 | diff 15-26 | Welch 15-26 | month t 15-26 | Holm | through - clear 05-14 / 15-26 (Welch) | net diff 15-26 | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m15 eg 2R | -0.001 | -0.11 | 5.49 | -0.009 | -1.16 | 4.63 | 1.000 | -0.056 (-1.99) / -0.023 (-0.87) | -0.015 | no |
| m15 eg swing | +0.007 | 0.69 | 5.48 | -0.003 | -0.33 | 3.78 | 1.000 | -0.068 (-1.82) / -0.030 (-0.84) | -0.010 | no |
| m15 dom 2R | -0.004 | -0.48 | 5.33 | -0.005 | -0.70 | 4.35 | 1.000 | -0.023 (-0.82) / -0.016 (-0.62) | -0.011 | no |
| m15 dom swing | -0.005 | -0.44 | 4.49 | -0.003 | -0.32 | 3.46 | 1.000 | -0.030 (-0.78) / -0.020 (-0.57) | -0.009 | no |
| m15 av 2R | -0.014 | -2.03 | -2.11 | -0.019 | -2.89 | -2.57 | 1.000 | -0.035 (-1.69) / -0.017 (-0.88) | -0.026 | no |
| m15 av swing | -0.022 | -2.36 | -2.34 | -0.019 | -2.14 | -1.84 | 1.000 | -0.059 (-2.15) / -0.016 (-0.61) | -0.026 | no |
| m15 pd 2R | -0.036 | -3.24 | 5.59 | -0.015 | -1.42 | 5.91 | 1.000 | -0.034 (-2.69) / -0.013 (-1.06) | -0.041 | no |
| m15 pd swing | -0.029 | -2.01 | 5.18 | -0.008 | -0.61 | 4.88 | 1.000 | -0.018 (-1.06) / -0.000 (-0.00) | -0.034 | no |
| m15 any 2R | -0.019 | -0.99 | 10.41 | -0.003 | -0.14 | 10.13 | 1.000 | -0.022 (-0.79) / -0.037 (-1.40) | -0.029 | no |
| m15 any swing | +0.000 | 0.01 | 8.85 | +0.028 | 1.20 | 8.77 | 1.000 | +0.004 (0.11) / +0.004 (0.10) | +0.001 | no |
| h1 eg 2R | -0.037 | -2.41 | -0.54 | -0.032 | -2.20 | -1.12 | 1.000 | -0.058 (-1.30) / -0.030 (-0.69) | -0.036 | no |
| h1 eg swing | -0.011 | -0.56 | 0.58 | -0.029 | -1.49 | -1.30 | 1.000 | -0.074 (-1.27) / +0.008 (0.14) | -0.032 | no |
| h1 dom 2R | +0.014 | 0.88 | 1.86 | -0.048 | -3.11 | -1.59 | 1.000 | +0.062 (1.36) / -0.088 (-2.09) | -0.049 | no |
| h1 dom swing | +0.028 | 1.33 | 1.87 | -0.059 | -2.98 | -2.14 | 1.000 | +0.094 (1.50) / -0.153 (-2.82) | -0.062 | no |
| h1 av 2R | -0.033 | -2.44 | -1.90 | -0.039 | -3.11 | -2.83 | 1.000 | -0.074 (-2.23) / -0.082 (-2.67) | -0.046 | no |
| h1 av swing | -0.001 | -0.08 | 0.08 | -0.046 | -2.80 | -2.59 | 1.000 | -0.080 (-1.81) / -0.052 (-1.23) | -0.053 | no |
| h1 pd 2R | -0.015 | -0.49 | 0.96 | -0.097 | -3.27 | -1.00 | 1.000 | -0.002 (-0.05) / -0.091 (-3.05) | -0.114 | no |
| h1 pd swing | +0.021 | 0.56 | 0.44 | -0.145 | -3.84 | -3.00 | 1.000 | +0.060 (1.55) / -0.117 (-3.05) | -0.163 | no |
| h1 any 2R | -0.055 | -0.88 | 2.18 | -0.171 | -2.88 | 0.41 | 1.000 | -0.051 (-0.75) / -0.175 (-2.66) | -0.193 | no |
| h1 any swing | +0.007 | 0.09 | 2.06 | -0.248 | -3.24 | -1.07 | 1.000 | -0.010 (-0.12) / -0.226 (-2.62) | -0.270 | no |

## Every cell

R a trade before costs (month-sum t), after costs beside; share = the place's share of that timeframe and exit's trades in the window.

| Cell | n 05-14 | share | R 05-14 (t) | net 05-14 | n 15-26 | share | R 15-26 (t) | net 15-26 | cost R 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| m15 eg into 2R | 120,929 | 70.5% | +0.055 (10.17) | -0.087 | 145,718 | 72.2% | +0.040 (9.39) | -0.122 | 0.163 |
| m15 eg into swing | 113,526 | 70.5% | +0.062 (9.07) | -0.080 | 134,892 | 72.3% | +0.040 (7.46) | -0.123 | 0.163 |
| m15 eg through 2R | 2,735 | 1.6% | -0.000 (-0.01) | -0.118 | 3,037 | 1.5% | +0.025 (0.87) | -0.106 | 0.131 |
| m15 eg through swing | 2,613 | 1.6% | -0.013 (-0.34) | -0.131 | 2,882 | 1.5% | +0.013 (0.32) | -0.118 | 0.131 |
| m15 eg clear 2R | 47,745 | 27.9% | +0.056 (6.55) | -0.088 | 53,014 | 26.3% | +0.049 (6.65) | -0.107 | 0.156 |
| m15 eg clear swing | 44,787 | 27.8% | +0.055 (5.09) | -0.089 | 48,803 | 26.2% | +0.043 (4.28) | -0.112 | 0.156 |
| m15 dom into 2R | 121,204 | 70.7% | +0.054 (9.90) | -0.087 | 148,477 | 73.6% | +0.041 (8.65) | -0.121 | 0.162 |
| m15 dom into swing | 113,763 | 70.7% | +0.058 (8.27) | -0.082 | 137,244 | 73.6% | +0.040 (6.77) | -0.122 | 0.162 |
| m15 dom through 2R | 2,719 | 1.6% | +0.034 (1.29) | -0.087 | 3,303 | 1.6% | +0.030 (1.08) | -0.108 | 0.138 |
| m15 dom through swing | 2,596 | 1.6% | +0.033 (0.81) | -0.089 | 3,138 | 1.7% | +0.023 (0.59) | -0.116 | 0.139 |
| m15 dom clear 2R | 47,486 | 27.7% | +0.057 (7.10) | -0.091 | 49,989 | 24.8% | +0.046 (5.87) | -0.110 | 0.156 |
| m15 dom clear swing | 44,567 | 27.7% | +0.063 (6.01) | -0.086 | 46,195 | 24.8% | +0.043 (4.31) | -0.113 | 0.156 |
| m15 av into 2R | 79,782 | 46.5% | +0.048 (6.54) | -0.097 | 96,797 | 48.0% | +0.033 (5.84) | -0.132 | 0.165 |
| m15 av into swing | 74,904 | 46.5% | +0.049 (5.42) | -0.096 | 89,822 | 48.1% | +0.031 (4.82) | -0.133 | 0.165 |
| m15 av through 2R | 5,030 | 2.9% | +0.027 (1.21) | -0.089 | 5,865 | 2.9% | +0.035 (1.63) | -0.099 | 0.134 |
| m15 av through swing | 4,798 | 3.0% | +0.012 (0.40) | -0.103 | 5,574 | 3.0% | +0.034 (1.15) | -0.101 | 0.134 |
| m15 av clear 2R | 86,597 | 50.5% | +0.062 (10.46) | -0.080 | 99,107 | 49.1% | +0.052 (9.89) | -0.106 | 0.158 |
| m15 av clear swing | 81,224 | 50.5% | +0.071 (8.79) | -0.070 | 91,181 | 48.9% | +0.050 (6.61) | -0.107 | 0.157 |
| m15 pd into 2R | 113,551 | 66.2% | +0.050 (8.50) | -0.102 | 133,828 | 66.3% | +0.040 (8.26) | -0.129 | 0.169 |
| m15 pd into swing | 106,064 | 65.9% | +0.053 (7.39) | -0.098 | 122,828 | 65.8% | +0.038 (6.44) | -0.132 | 0.169 |
| m15 pd through 2R | 38,407 | 22.4% | +0.052 (6.14) | -0.071 | 45,422 | 22.5% | +0.042 (5.62) | -0.100 | 0.142 |
| m15 pd through swing | 36,552 | 22.7% | +0.065 (5.00) | -0.058 | 42,972 | 23.0% | +0.046 (4.42) | -0.096 | 0.142 |
| m15 pd clear 2R | 19,451 | 11.3% | +0.086 (6.85) | -0.043 | 22,519 | 11.2% | +0.055 (4.83) | -0.089 | 0.144 |
| m15 pd clear swing | 18,310 | 11.4% | +0.082 (5.05) | -0.047 | 20,777 | 11.1% | +0.046 (3.12) | -0.098 | 0.144 |
| m15 any into 2R | 160,302 | 93.5% | +0.054 (10.90) | -0.090 | 189,668 | 94.0% | +0.043 (10.80) | -0.119 | 0.162 |
| m15 any into swing | 150,407 | 93.5% | +0.059 (9.15) | -0.084 | 175,274 | 93.9% | +0.042 (8.77) | -0.120 | 0.162 |
| m15 any through 2R | 5,203 | 3.0% | +0.051 (2.19) | -0.074 | 5,201 | 2.6% | +0.008 (0.38) | -0.116 | 0.124 |
| m15 any through swing | 4,976 | 3.1% | +0.063 (1.94) | -0.063 | 4,959 | 2.7% | +0.018 (0.63) | -0.106 | 0.124 |
| m15 any clear 2R | 5,904 | 3.4% | +0.073 (3.41) | -0.050 | 6,900 | 3.4% | +0.046 (2.07) | -0.090 | 0.136 |
| m15 any clear swing | 5,543 | 3.4% | +0.059 (2.18) | -0.065 | 6,344 | 3.4% | +0.014 (0.51) | -0.121 | 0.136 |
| h1 eg into 2R | 33,256 | 73.5% | +0.010 (1.09) | -0.071 | 39,910 | 75.4% | -0.000 (-0.06) | -0.090 | 0.090 |
| h1 eg into swing | 30,595 | 73.3% | +0.018 (1.53) | -0.062 | 36,598 | 75.4% | -0.011 (-0.99) | -0.101 | 0.090 |
| h1 eg through 2R | 1,052 | 2.3% | -0.011 (-0.31) | -0.084 | 1,135 | 2.1% | +0.002 (0.04) | -0.079 | 0.081 |
| h1 eg through swing | 1,000 | 2.4% | -0.045 (-0.82) | -0.118 | 1,074 | 2.2% | +0.026 (0.42) | -0.055 | 0.081 |
| h1 eg clear 2R | 10,955 | 24.2% | +0.047 (2.81) | -0.034 | 11,891 | 22.5% | +0.032 (2.20) | -0.054 | 0.086 |
| h1 eg clear swing | 10,152 | 24.3% | +0.029 (1.37) | -0.051 | 10,876 | 22.4% | +0.018 (0.98) | -0.068 | 0.086 |
| h1 dom into 2R | 33,715 | 74.5% | +0.020 (2.38) | -0.059 | 40,923 | 77.3% | -0.002 (-0.24) | -0.091 | 0.089 |
| h1 dom into swing | 31,039 | 74.4% | +0.024 (2.12) | -0.055 | 37,470 | 77.2% | -0.013 (-1.26) | -0.103 | 0.090 |
| h1 dom through 2R | 1,054 | 2.3% | +0.069 (1.58) | -0.005 | 1,208 | 2.3% | -0.042 (-1.07) | -0.133 | 0.091 |
| h1 dom through swing | 996 | 2.4% | +0.090 (1.42) | +0.016 | 1,125 | 2.3% | -0.107 (-2.18) | -0.198 | 0.091 |
| h1 dom clear 2R | 10,494 | 23.2% | +0.007 (0.42) | -0.078 | 10,805 | 20.4% | +0.046 (3.41) | -0.042 | 0.087 |
| h1 dom clear swing | 9,712 | 23.3% | -0.004 (-0.19) | -0.089 | 9,953 | 20.5% | +0.046 (2.50) | -0.041 | 0.087 |
| h1 av into 2R | 23,215 | 51.3% | +0.005 (0.50) | -0.077 | 28,088 | 53.1% | -0.008 (-0.87) | -0.101 | 0.093 |
| h1 av into swing | 21,457 | 51.4% | +0.022 (1.42) | -0.060 | 25,838 | 53.2% | -0.023 (-1.91) | -0.115 | 0.093 |
| h1 av through 2R | 1,866 | 4.1% | -0.036 (-1.19) | -0.106 | 2,218 | 4.2% | -0.051 (-1.75) | -0.130 | 0.079 |
| h1 av through swing | 1,755 | 4.2% | -0.057 (-1.51) | -0.126 | 2,095 | 4.3% | -0.028 (-0.73) | -0.108 | 0.080 |
| h1 av clear 2R | 20,182 | 44.6% | +0.038 (3.34) | -0.041 | 22,630 | 42.7% | +0.031 (2.96) | -0.054 | 0.085 |
| h1 av clear swing | 18,535 | 44.4% | +0.023 (1.64) | -0.056 | 20,615 | 42.5% | +0.023 (1.70) | -0.062 | 0.086 |
| h1 pd into 2R | 24,284 | 53.7% | +0.012 (1.26) | -0.073 | 28,009 | 52.9% | -0.000 (-0.01) | -0.093 | 0.093 |
| h1 pd into swing | 21,955 | 52.6% | +0.004 (0.32) | -0.081 | 25,102 | 51.7% | -0.022 (-2.15) | -0.115 | 0.093 |
| h1 pd through 2R | 18,687 | 41.3% | +0.025 (1.91) | -0.050 | 22,424 | 42.4% | +0.006 (0.47) | -0.080 | 0.086 |
| h1 pd through swing | 17,712 | 42.4% | +0.042 (2.25) | -0.033 | 21,211 | 43.7% | +0.006 (0.36) | -0.081 | 0.086 |
| h1 pd clear 2R | 2,292 | 5.1% | +0.027 (0.78) | -0.039 | 2,503 | 4.7% | +0.096 (2.73) | +0.021 | 0.076 |
| h1 pd clear swing | 2,080 | 5.0% | -0.017 (-0.46) | -0.083 | 2,235 | 4.6% | +0.123 (2.71) | +0.047 | 0.075 |
| h1 any into 2R | 42,425 | 93.7% | +0.018 (2.30) | -0.063 | 50,068 | 94.6% | +0.005 (0.71) | -0.085 | 0.090 |
| h1 any into swing | 39,038 | 93.5% | +0.020 (2.08) | -0.060 | 45,846 | 94.4% | -0.007 (-0.76) | -0.097 | 0.090 |
| h1 any through 2R | 2,313 | 5.1% | +0.021 (0.66) | -0.055 | 2,273 | 4.3% | +0.001 (0.03) | -0.069 | 0.070 |
| h1 any through swing | 2,238 | 5.4% | +0.003 (0.07) | -0.072 | 2,174 | 4.5% | +0.015 (0.38) | -0.055 | 0.070 |
| h1 any clear 2R | 525 | 1.2% | +0.072 (1.02) | +0.013 | 595 | 1.1% | +0.176 (2.70) | +0.108 | 0.068 |
| h1 any clear swing | 471 | 1.1% | +0.013 (0.18) | -0.046 | 528 | 1.1% | +0.241 (3.03) | +0.173 | 0.068 |

## Checks

- Cut test: 10 cuts on xau, eurusd: 249,883 signals with their places known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); the fade's own no-trade rules apply unchanged.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved | no Daily ATR yet |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 44,349 | 44,165 | 4 | 0 | 180 | 2 | 113 |
| xag | 2006-03-19 | 44,574 | 32,021 | 92 | 0 | 12,461 | 2 | 48 |
| eurusd | 2004-01-01 | 49,724 | 49,635 | 24 | 0 | 9 | 2 | 0 |
| gbpusd | 2004-01-01 | 49,435 | 49,314 | 57 | 0 | 8 | 3 | 0 |
| usdjpy | 2004-01-01 | 48,700 | 48,586 | 39 | 0 | 15 | 1 | 0 |
| audusd | 2004-01-01 | 50,388 | 50,292 | 34 | 0 | 8 | 0 | 0 |
| nzdusd | 2004-01-01 | 49,832 | 49,773 | 1 | 0 | 6 | 2 | 0 |
| usdcad | 2004-01-01 | 50,174 | 50,050 | 52 | 0 | 2 | 1 | 0 |
| usdchf | 2004-01-01 | 49,243 | 49,126 | 52 | 0 | 3 | 2 | 0 |
| eurjpy | 2004-01-01 | 48,668 | 48,594 | 3 | 0 | 5 | 3 | 0 |

## What it means

No test clears the bar: on these ten markets and both decades, the fade does not do measurably better when the break runs
into an opposite Daily level than when the way is clear (by the pre-registered bar). The before-cost tilt of `grid7-wide-fade`
is not concentrated at Daily levels of these four kinds. Do not re-test variants of these 60 cells on these years. Nothing
live changed; no rule is proposed.

**Where the breaks are.** On M15 (2R) in 2015-26 94.0% of the fade trades have an opposite Daily level of
some kind within 1 Daily ATR ahead and only 3.4% are clear: "into a level" is the usual case, not a special one.
The other way round: 11 of the 20 tests show into WORSE than clear with Welch t <= -2 in 2015-26 (m15 av 2R; m15 av swing; h1 eg 2R; h1 dom 2R; h1 dom swing; h1 av 2R; h1 av swing; h1 pd 2R; h1 pd swing; h1 any 2R; h1 any swing);
that is the opposite of the reading tested, and it is not a pre-registered test either.

**The month t column** is the paired difference of the two cells' month SUMS, so it mostly measures that "into" holds far more
trades than "clear" (a positive tilt times more trades), not that a trade into a level does better: the Welch t on R a trade is
the pre-registered test.
