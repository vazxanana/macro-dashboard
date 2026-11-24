# The two breakouts by a public gauge known the day before (result, 24 Nov 2026)

**Verdict: FAIL, 0 of 5. On minus off, net R a trade in the confirmation window: G1 gold, implied volatility rising +0.003R (Welch t 0.05, month t -1.82, Holm 1; discovery −0.130R); G2 gold, policy uncertainty high +0.040R (Welch t 0.72, month t -0.13, Holm 1; discovery +0.018R); G3 gold, real yields moving −0.001R (Welch t -0.01, month t -0.06, Holm 1; discovery +0.027R); J1 USD/JPY, equity volatility rising −0.013R (Welch t -0.24, month t -2.03, Holm 1; discovery +0.067R); J2 USD/JPY, US 2-year moving −0.024R (Welch t -0.45, month t -0.87, Holm 1; discovery +0.022R).**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Harness gate reproduced (gold n 3713 / 0.139R, USD/JPY n 2089 / 0.079R). Nothing live changed.

| Test | Discovery on | Discovery off | Confirmation on | Confirmation off | Welch t | Month t | Holm p | |
|---|---|---|---|---|---|---|---|---|
| G1 gold, implied volatility rising (GVZCLS) | +0.072R (n 623) | +0.203R (n 934) | +0.105R (n 737) | +0.102R (n 1143) | 0.05 | -1.82 | 1 | FAIL |
| G2 gold, policy uncertainty high (USEPUINDXD) | +0.197R (n 836) | +0.180R (n 775) | +0.116R (n 1230) | +0.076R (n 1020) | 0.72 | -0.13 | 1 | FAIL |
| G3 gold, real yields moving (DFII10) | +0.203R (n 761) | +0.176R (n 850) | +0.098R (n 1080) | +0.099R (n 1170) | -0.01 | -0.06 | 1 | FAIL |
| J1 USD/JPY, equity volatility rising (VIXCLS) | +0.132R (n 787) | +0.064R (n 1107) | +0.048R (n 962) | +0.060R (n 1313) | -0.24 | -2.03 | 1 | FAIL |
| J2 USD/JPY, US 2-year moving (DGS2) | +0.105R (n 842) | +0.083R (n 1052) | +0.042R (n 1075) | +0.066R (n 1200) | -0.45 | -0.87 | 1 | FAIL |

Net R a trade after the measured costs. Windows: discovery to 2014, confirmation 2015 on (G1: 2008-07 → 2016 and 2017 on).
