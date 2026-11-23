# The MSNR direction call as a filter: WITH against AGAINST (result)

**Verdict: FAIL. 0 of 18 cells pass; WITH the call made -0.029R a trade before costs in 2015-26 against -0.028R AGAINST it (1R cells, 2,317,808 / 2,305,778 trades); best cell H4 engulf 2R: WITH -0.028R vs AGAINST -0.037R a trade in 2015-26 (n 362,213 / 361,300, Welch t 2.70; 2005-14 t 5.09).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants.

## What was run

The desk's direction call (`council/eg-methods.mjs` `direction()`, unchanged) on three ladders: D1 working with weekly key levels
(triggers on H1), H4 with Daily key levels (triggers on M15), H1 with H4 key levels (triggers on M5). Three plain triggers on the
trigger chart: a structure break (3 a side), a swing-low-to-swing-high box closed out (2 a side), an engulf completing within 3
candles. Each taken in its own direction at the next 5-minute open, stop past the trigger's swing + 0.1 ATR, 1R or 2R target
(time limit 2 days / 1 day / 8 hours). Split by whether the trigger's direction equals the call. Ten markets pooled (xau, xag,
eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy), OANDA mid 5-minute candles; discovery = fills 2005-2014,
confirmation = 2015 to October 2026. Costs after the fact only; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar

- n >= 300 a side in both windows: 18 of 18.
- WITH beats AGAINST, Welch t >= 2 in both windows: 1.
- Month series of the difference, month t >= 2 in both windows: 0.
- Holm p < 0.05 (confirmation): 0.
- **All four: 0.**

Pooled over the nine 1R cells: WITH -0.022R (n 1,884,153) vs AGAINST -0.022R (n 1,882,502) in 2005-14;
WITH -0.029R (n 2,317,808) vs AGAINST -0.028R (n 2,305,778) in 2015-26 (before costs).

## Every cell

R a trade before costs (calendar-month-sum t); after costs beside; "diff t" = Welch t of WITH minus AGAINST; "month t" = t of the
month series of the difference.

| Cell | Window | WITH n | WITH R (t) | WITH net | AGAINST n | AGAINST R (t) | AGAINST net | diff | diff t | month t | Holm | Pass |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| D1 break 1R | 05-14 | 22,909 | -0.001 (-0.17) | -0.033 | 22,115 | -0.014 (-1.66) | -0.045 | +0.012 | 1.39 | 0.81 |  |  |
| D1 break 1R | 15-26 | 26,774 | -0.014 (-1.93) | -0.052 | 26,346 | -0.004 (-0.46) | -0.041 | -0.010 | -1.28 | -0.96 | 1.000 | no |
| D1 break 2R | 05-14 | 22,909 | +0.016 (1.24) | -0.016 | 22,115 | -0.003 (-0.29) | -0.035 | +0.019 | 1.67 | 0.90 |  |  |
| D1 break 2R | 15-26 | 26,774 | -0.015 (-1.36) | -0.052 | 26,346 | +0.000 (0.01) | -0.037 | -0.015 | -1.41 | -0.90 | 1.000 | no |
| D1 box 1R | 05-14 | 19,019 | -0.007 (-0.74) | -0.031 | 18,438 | -0.009 (-1.11) | -0.032 | +0.001 | 0.15 | -0.07 |  |  |
| D1 box 1R | 15-26 | 22,206 | -0.018 (-2.27) | -0.048 | 21,790 | +0.006 (0.62) | -0.023 | -0.024 | -2.84 | -1.72 | 1.000 | no |
| D1 box 2R | 05-14 | 19,019 | +0.004 (0.29) | -0.019 | 18,438 | -0.008 (-0.72) | -0.032 | +0.012 | 1.10 | 0.47 |  |  |
| D1 box 2R | 15-26 | 22,206 | -0.011 (-0.94) | -0.040 | 21,790 | +0.014 (1.12) | -0.015 | -0.025 | -2.35 | -1.44 | 1.000 | no |
| D1 engulf 1R | 05-14 | 76,116 | -0.020 (-3.49) | -0.079 | 75,453 | -0.025 (-5.46) | -0.084 | +0.006 | 1.13 | 0.50 |  |  |
| D1 engulf 1R | 15-26 | 90,186 | -0.019 (-3.93) | -0.089 | 89,403 | -0.016 (-3.35) | -0.088 | -0.003 | -0.54 | -0.36 | 1.000 | no |
| D1 engulf 2R | 05-14 | 76,116 | -0.011 (-1.23) | -0.071 | 75,453 | -0.031 (-3.76) | -0.090 | +0.019 | 2.82 | 1.19 |  |  |
| D1 engulf 2R | 15-26 | 90,186 | -0.020 (-2.67) | -0.091 | 89,403 | -0.014 (-1.83) | -0.086 | -0.006 | -0.91 | -0.48 | 1.000 | no |
| H4 break 1R | 05-14 | 88,435 | -0.016 (-2.92) | -0.084 | 86,796 | -0.040 (-8.20) | -0.109 | +0.025 | 5.24 | 3.04 |  |  |
| H4 break 1R | 15-26 | 104,786 | -0.024 (-5.48) | -0.104 | 103,030 | -0.031 (-7.10) | -0.110 | +0.007 | 1.52 | 0.93 | 0.971 | no |
| H4 break 2R | 05-14 | 88,435 | -0.010 (-1.07) | -0.078 | 86,796 | -0.044 (-6.11) | -0.112 | +0.034 | 5.44 | 2.71 |  |  |
| H4 break 2R | 15-26 | 104,786 | -0.026 (-3.67) | -0.106 | 103,030 | -0.038 (-5.71) | -0.117 | +0.011 | 1.91 | 0.98 | 0.476 | no |
| H4 box 1R | 05-14 | 70,978 | -0.016 (-2.46) | -0.066 | 69,586 | -0.033 (-6.44) | -0.084 | +0.017 | 3.31 | 1.64 |  |  |
| H4 box 1R | 15-26 | 84,509 | -0.021 (-4.25) | -0.083 | 82,628 | -0.026 (-5.72) | -0.088 | +0.005 | 1.12 | 0.67 | 1.000 | no |
| H4 box 2R | 05-14 | 70,978 | -0.008 (-0.77) | -0.058 | 69,586 | -0.033 (-4.14) | -0.084 | +0.025 | 3.74 | 1.61 |  |  |
| H4 box 2R | 15-26 | 84,509 | -0.023 (-3.02) | -0.086 | 82,628 | -0.028 (-3.83) | -0.090 | +0.005 | 0.76 | 0.42 | 1.000 | no |
| H4 engulf 1R | 05-14 | 297,711 | -0.020 (-5.75) | -0.129 | 297,096 | -0.029 (-10.34) | -0.138 | +0.009 | 3.49 | 1.71 |  |  |
| H4 engulf 1R | 15-26 | 362,213 | -0.023 (-8.04) | -0.150 | 361,300 | -0.027 (-10.06) | -0.154 | +0.004 | 1.78 | 0.88 | 0.603 | no |
| H4 engulf 2R | 05-14 | 297,711 | -0.020 (-3.39) | -0.130 | 297,096 | -0.039 (-8.33) | -0.148 | +0.018 | 5.09 | 2.02 |  |  |
| H4 engulf 2R | 15-26 | 362,213 | -0.028 (-5.82) | -0.155 | 361,300 | -0.037 (-8.30) | -0.164 | +0.009 | 2.70 | 1.10 | 0.063 | no |
| H1 break 1R | 05-14 | 259,472 | -0.031 (-8.87) | -0.140 | 258,844 | -0.031 (-11.23) | -0.142 | +0.001 | 0.29 | 0.11 |  |  |
| H1 break 1R | 15-26 | 312,058 | -0.039 (-13.69) | -0.164 | 307,627 | -0.035 (-13.59) | -0.161 | -0.004 | -1.67 | -1.17 | 1.000 | no |
| H1 break 2R | 05-14 | 259,472 | -0.035 (-6.43) | -0.144 | 258,844 | -0.041 (-9.32) | -0.151 | +0.006 | 1.75 | 0.89 |  |  |
| H1 break 2R | 15-26 | 312,058 | -0.049 (-10.55) | -0.174 | 307,627 | -0.044 (-12.15) | -0.170 | -0.005 | -1.38 | -0.84 | 1.000 | no |
| H1 box 1R | 05-14 | 214,080 | -0.031 (-8.90) | -0.119 | 214,175 | -0.034 (-10.99) | -0.122 | +0.003 | 0.88 | 0.45 |  |  |
| H1 box 1R | 15-26 | 260,751 | -0.035 (-11.47) | -0.140 | 255,946 | -0.033 (-12.28) | -0.138 | -0.002 | -0.89 | -0.58 | 1.000 | no |
| H1 box 2R | 05-14 | 214,080 | -0.034 (-6.53) | -0.122 | 214,175 | -0.043 (-9.77) | -0.131 | +0.009 | 2.31 | 1.14 |  |  |
| H1 box 2R | 15-26 | 260,751 | -0.044 (-9.23) | -0.149 | 255,946 | -0.039 (-9.87) | -0.144 | -0.004 | -1.26 | -0.70 | 1.000 | no |
| H1 engulf 1R | 05-14 | 835,433 | -0.020 (-8.45) | -0.188 | 839,999 | -0.011 (-5.54) | -0.180 | -0.008 | -5.44 | -3.36 |  |  |
| H1 engulf 1R | 15-26 | 1,054,325 | -0.029 (-15.80) | -0.228 | 1,057,708 | -0.027 (-17.06) | -0.226 | -0.002 | -1.48 | -0.86 | 1.000 | no |
| H1 engulf 2R | 05-14 | 835,433 | -0.013 (-3.23) | -0.181 | 839,999 | -0.004 (-1.23) | -0.173 | -0.009 | -3.99 | -1.97 |  |  |
| H1 engulf 2R | 15-26 | 1,054,325 | -0.031 (-10.03) | -0.229 | 1,057,708 | -0.026 (-9.74) | -0.225 | -0.004 | -2.11 | -0.99 | 1.000 | no |

## Call age (reported, not judged)

Young = call age at or under the median of the discovery signals (per market and ladder), old = over it. WITH vs AGAINST mean R
and Welch t in each half.

| Cell | Window | young WITH | young AGAINST | young t | old WITH | old AGAINST | old t |
|---|---|---:|---:|---:|---:|---:|---:|
| D1 break 1R | 05-14 | -0.019 (11,422) | -0.014 (11,317) | -0.35 | +0.016 (11,487) | -0.013 (10,798) | 2.31 |
| D1 break 1R | 15-26 | -0.014 (14,941) | -0.006 (14,745) | -0.72 | -0.014 (11,833) | -0.001 (11,601) | -1.11 |
| D1 box 1R | 05-14 | -0.024 (9,476) | -0.014 (9,450) | -0.74 | +0.009 (9,543) | -0.003 (8,988) | 0.91 |
| D1 box 1R | 15-26 | -0.019 (12,423) | -0.001 (12,208) | -1.60 | -0.017 (9,783) | +0.014 (9,582) | -2.48 |
| D1 engulf 1R | 05-14 | -0.037 (38,189) | -0.023 (38,276) | -1.98 | -0.002 (37,927) | -0.028 (37,177) | 3.58 |
| D1 engulf 1R | 15-26 | -0.017 (50,320) | -0.014 (50,144) | -0.50 | -0.020 (39,866) | -0.018 (39,259) | -0.24 |
| H4 break 1R | 05-14 | -0.028 (44,349) | -0.043 (43,917) | 2.39 | -0.004 (44,086) | -0.037 (42,879) | 5.00 |
| H4 break 1R | 15-26 | -0.020 (58,819) | -0.035 (57,677) | 2.59 | -0.029 (45,967) | -0.025 (45,353) | -0.63 |
| H4 box 1R | 05-14 | -0.029 (35,646) | -0.039 (35,464) | 1.37 | -0.003 (35,332) | -0.027 (34,122) | 3.28 |
| H4 box 1R | 15-26 | -0.018 (47,806) | -0.032 (46,622) | 2.13 | -0.024 (36,703) | -0.019 (36,006) | -0.72 |
| H4 engulf 1R | 05-14 | -0.026 (149,701) | -0.029 (150,231) | 0.94 | -0.013 (148,010) | -0.028 (146,865) | 3.99 |
| H4 engulf 1R | 15-26 | -0.019 (203,023) | -0.029 (202,989) | 2.97 | -0.027 (159,190) | -0.025 (158,311) | -0.67 |
| H1 break 1R | 05-14 | -0.038 (129,748) | -0.031 (129,937) | -1.86 | -0.023 (129,724) | -0.032 (128,907) | 2.25 |
| H1 break 1R | 15-26 | -0.042 (160,378) | -0.034 (158,107) | -2.29 | -0.036 (151,680) | -0.036 (149,520) | -0.04 |
| H1 box 1R | 05-14 | -0.039 (107,429) | -0.033 (108,236) | -1.44 | -0.023 (106,651) | -0.034 (105,939) | 2.67 |
| H1 box 1R | 15-26 | -0.038 (134,564) | -0.029 (132,292) | -2.28 | -0.032 (126,187) | -0.037 (123,654) | 1.08 |
| H1 engulf 1R | 05-14 | -0.025 (421,223) | -0.009 (426,225) | -7.34 | -0.014 (414,210) | -0.014 (413,774) | -0.32 |
| H1 engulf 1R | 15-26 | -0.032 (543,697) | -0.023 (547,537) | -4.39 | -0.026 (510,628) | -0.031 (510,171) | 2.44 |

## The fade, split by the call (reported, not judged)

The same trigger entered against its direction, stop past the trigger candle's extreme + 0.1 ATR; "fade WITH" = the fade's side
equals the call.

| Cell | Window | fade WITH n | fade WITH R (t) | net | fade AGAINST n | fade AGAINST R (t) | net | diff t |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| D1 break 1R | 05-14 | 21,045 | +0.037 (4.51) | -0.147 | 21,787 | +0.033 (4.59) | -0.158 | 0.34 |
| D1 break 1R | 15-26 | 24,946 | -0.007 (-0.94) | -0.234 | 25,233 | -0.011 (-1.45) | -0.242 | 0.49 |
| D1 break 2R | 05-14 | 21,045 | +0.111 (9.21) | -0.073 | 21,787 | +0.102 (8.93) | -0.090 | 0.68 |
| D1 break 2R | 15-26 | 24,946 | +0.045 (4.24) | -0.182 | 25,233 | +0.036 (3.51) | -0.195 | 0.73 |
| D1 box 1R | 05-14 | 17,723 | +0.042 (4.82) | -0.134 | 18,242 | +0.035 (4.52) | -0.146 | 0.58 |
| D1 box 1R | 15-26 | 20,713 | -0.002 (-0.33) | -0.224 | 21,001 | -0.023 (-2.79) | -0.248 | 2.11 |
| D1 box 2R | 05-14 | 17,723 | +0.112 (8.75) | -0.064 | 18,242 | +0.095 (8.48) | -0.086 | 1.10 |
| D1 box 2R | 15-26 | 20,713 | +0.049 (4.59) | -0.172 | 21,001 | +0.019 (1.62) | -0.206 | 2.16 |
| D1 engulf 1R | 05-14 | 71,387 | +0.059 (14.34) | -0.145 | 71,929 | +0.057 (12.94) | -0.151 | 0.35 |
| D1 engulf 1R | 15-26 | 83,532 | +0.001 (0.27) | -0.244 | 84,246 | +0.000 (0.03) | -0.250 | 0.24 |
| D1 engulf 2R | 05-14 | 71,387 | +0.127 (21.32) | -0.076 | 71,929 | +0.126 (20.14) | -0.082 | 0.10 |
| D1 engulf 2R | 15-26 | 83,532 | +0.049 (7.60) | -0.197 | 84,246 | +0.055 (8.02) | -0.195 | -0.90 |
| H4 break 1R | 05-14 | 71,598 | -0.028 (-6.18) | -0.346 | 72,924 | -0.032 (-7.67) | -0.351 | 0.67 |
| H4 break 1R | 15-26 | 81,960 | -0.051 (-11.31) | -0.437 | 82,600 | -0.055 (-11.79) | -0.448 | 0.75 |
| H4 break 2R | 05-14 | 71,598 | +0.097 (16.36) | -0.221 | 72,924 | +0.091 (15.28) | -0.229 | 0.79 |
| H4 break 2R | 15-26 | 81,960 | +0.055 (9.47) | -0.331 | 82,600 | +0.054 (9.02) | -0.339 | 0.08 |
| H4 box 1R | 05-14 | 59,125 | -0.028 (-5.94) | -0.331 | 60,172 | -0.029 (-6.47) | -0.333 | 0.14 |
| H4 box 1R | 15-26 | 67,503 | -0.050 (-10.16) | -0.421 | 68,694 | -0.050 (-8.93) | -0.427 | -0.03 |
| H4 box 2R | 05-14 | 59,125 | +0.099 (15.21) | -0.204 | 60,172 | +0.093 (14.57) | -0.211 | 0.71 |
| H4 box 2R | 15-26 | 67,503 | +0.054 (8.65) | -0.316 | 68,694 | +0.057 (7.74) | -0.319 | -0.42 |
| H4 engulf 1R | 05-14 | 245,834 | -0.026 (-8.51) | -0.365 | 246,034 | -0.028 (-8.99) | -0.368 | 0.56 |
| H4 engulf 1R | 15-26 | 286,816 | -0.053 (-15.47) | -0.461 | 286,505 | -0.059 (-17.82) | -0.472 | 2.26 |
| H4 engulf 2R | 05-14 | 245,834 | +0.093 (21.00) | -0.246 | 246,034 | +0.088 (18.96) | -0.253 | 1.35 |
| H4 engulf 2R | 15-26 | 286,816 | +0.049 (12.04) | -0.358 | 286,505 | +0.042 (10.64) | -0.371 | 1.98 |
| H1 break 1R | 05-14 | 165,906 | -0.119 (-20.57) | -0.541 | 167,455 | -0.125 (-20.13) | -0.543 | 1.60 |
| H1 break 1R | 15-26 | 173,975 | -0.138 (-25.79) | -0.641 | 177,155 | -0.140 (-23.50) | -0.643 | 0.78 |
| H1 break 2R | 05-14 | 165,906 | +0.051 (10.53) | -0.371 | 167,455 | +0.049 (9.98) | -0.369 | 0.33 |
| H1 break 2R | 15-26 | 173,975 | +0.018 (3.49) | -0.485 | 177,155 | +0.018 (3.42) | -0.484 | -0.12 |
| H1 box 1R | 05-14 | 142,316 | -0.110 (-20.33) | -0.521 | 142,772 | -0.119 (-21.02) | -0.525 | 2.49 |
| H1 box 1R | 15-26 | 151,220 | -0.136 (-26.34) | -0.627 | 154,480 | -0.133 (-23.15) | -0.621 | -0.78 |
| H1 box 2R | 05-14 | 142,316 | +0.060 (11.90) | -0.351 | 142,772 | +0.054 (11.04) | -0.351 | 1.03 |
| H1 box 2R | 15-26 | 151,220 | +0.017 (3.26) | -0.474 | 154,480 | +0.019 (3.61) | -0.469 | -0.29 |
| H1 engulf 1R | 05-14 | 543,402 | -0.149 (-23.48) | -0.590 | 540,392 | -0.143 (-22.97) | -0.585 | -2.68 |
| H1 engulf 1R | 15-26 | 603,454 | -0.156 (-28.85) | -0.674 | 599,935 | -0.156 (-27.45) | -0.675 | -0.01 |
| H1 engulf 2R | 05-14 | 543,402 | +0.020 (4.33) | -0.422 | 540,392 | +0.026 (6.16) | -0.415 | -2.46 |
| H1 engulf 2R | 15-26 | 603,454 | -0.002 (-0.44) | -0.520 | 599,935 | +0.001 (0.21) | -0.519 | -1.03 |

## Per market, H4 engulf 2R

| Market | WITH 05-14 | AGAINST 05-14 | WITH 15-26 | AGAINST 15-26 |
|---|---:|---:|---:|---:|
| xau | +0.002 (26,337) | -0.016 (26,066) | +0.010 (35,461) | -0.017 (35,242) |
| xag | +0.020 (20,851) | -0.004 (20,933) | -0.024 (27,969) | -0.050 (27,826) |
| eurusd | -0.022 (31,918) | -0.072 (31,626) | -0.045 (37,217) | -0.037 (37,444) |
| gbpusd | -0.044 (31,910) | -0.052 (32,034) | -0.051 (37,336) | -0.033 (37,393) |
| usdjpy | +0.005 (31,153) | -0.006 (31,032) | +0.004 (37,207) | -0.008 (36,958) |
| audusd | -0.027 (31,107) | -0.022 (31,303) | -0.030 (37,482) | -0.031 (37,458) |
| nzdusd | -0.022 (30,720) | -0.036 (30,810) | -0.029 (37,650) | -0.035 (37,371) |
| usdcad | -0.037 (31,051) | -0.074 (30,721) | -0.022 (37,588) | -0.059 (37,442) |
| usdchf | -0.042 (31,153) | -0.071 (31,286) | -0.056 (37,206) | -0.052 (36,979) |
| eurjpy | -0.019 (31,511) | -0.018 (31,285) | -0.032 (37,097) | -0.047 (37,187) |

## Checks

- Cut test: 10 cuts on xau, eurusd: 4,400,753 signals (with their call and age) known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and risks under the round trip are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`). Triggers before the first call switch (call 0) are in neither side.

| Market | candles from | signals | no call yet | simulated | dropped (bad data) | past the stop | risk under cost | age medians D1 / H4 / H1 |
|---|---|---:|---:|---:|---:|---:|---:|---|
| xau | 2006-03-19 | 793,638 | 1,265 | 1,210,243 | 27 | 449 | 10,030 | 64 / 45 / 35 |
| xag | 2006-03-19 | 772,311 | 2,058 | 668,495 | 1613 | 591 | 208,082 | 45 / 45 / 33 |
| eurusd | 2004-01-01 | 889,300 | 620 | 1,583,932 | 450 | 355 | 842 | 44 / 44 / 34 |
| gbpusd | 2004-01-01 | 890,366 | 849 | 1,563,806 | 822 | 424 | 1,043 | 29 / 47 / 35 |
| usdjpy | 2004-01-01 | 878,732 | 308 | 1,504,611 | 673 | 365 | 1,501 | 40 / 42 / 35 |
| audusd | 2004-01-01 | 892,106 | 482 | 1,556,125 | 544 | 406 | 838 | 42 / 41 / 36 |
| nzdusd | 2004-01-01 | 883,708 | 565 | 1,475,285 | 15 | 636 | 1,149 | 35 / 44 / 37 |
| usdcad | 2004-01-01 | 876,408 | 631 | 1,488,151 | 758 | 348 | 1,425 | 32 / 48 / 36 |
| usdchf | 2004-01-01 | 872,659 | 712 | 1,455,238 | 752 | 613 | 2,786 | 31 / 44 / 33 |
| eurjpy | 2004-01-01 | 888,451 | 661 | 1,558,616 | 24 | 421 | 655 | 52 / 41 / 36 |

## What it means

Taking these plain triggers with the direction call did not do measurably better than taking them against it, on ten
markets over 22 years, in both windows. Read simply, the call does not sort these entries into better and worse ones. Do not re-test
variants of these 18 cells on these years. Nothing live changed; no rule is proposed.

**The nearest cell.** H4 engulf 2R: WITH beat AGAINST by +0.018R a trade in 2005-14 (Welch t 5.09) and
+0.009R in 2015-26 (t 2.70), but the month series of the difference reached t 2.02 / 1.10 and the
Holm p is 0.063: with hundreds of thousands of overlapping intraday trades the trade-level t overstates the evidence.
Both sides lose before costs (WITH -0.028R, AGAINST -0.037R in 2015-26) and far more after them
(-0.155R / -0.164R): even a real tilt of a hundredth of an R would sort losing trades from slightly
more losing ones.

**The fade.** Fading the triggers (stop just past the trigger candle) is above zero before costs at 2R on several cells and below
zero at 1R. Split by the call, no fade cell differs with Welch t >= 2 in both windows (the H4 engulf fades come nearest: t 0.56 /
2.26 at 1R, 1.35 / 1.98 at 2R, the fade WITH the call a little better). After costs every fade cell loses heavily, because its
stop is small against the round trip.

**Call age (seen after the fact, a hypothesis only).** On the H4 ladder the YOUNG calls (age at or under the median) put WITH
ahead of AGAINST in both windows on all six cells (t 0.94-2.97 in 2005-14, 2.08-4.63 in 2015-26), while the old calls flip from
positive in 2005-14 to slightly negative in 2015-26; on the H1 ladder the young calls put WITH BEHIND against in both windows
(t -1.44 to -7.34). These are trade-level t on overlapping trades, read after the run and not part of the bar; the WITH side still
loses before costs. A fresh H4 call as a filter would need its own pre-registration on other data before anyone reads it as more
than a pattern.
