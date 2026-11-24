# The other Equinox fade and gap rules, only the trades whose cost is small against their risk (result, 24 Nov 2026)

**Verdict: FAIL. 0 of 4 rules pass with only the trades whose cost is at most 10 % of their risk. After costs in 2015-26: Break fade −0.050R (n 72658, month t -8.06); Round-number fade −0.059R (n 10261, month t -3.74); Box fade −0.012R (n 87168, month t -2.27); FVG return −0.009R (n 26637, month t -1.31).**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Nothing live changed; the desks stay paper records.

| Rule | Trades | 2005-14 n | Before costs | After costs (month t) | 2015-26 n | Before costs | After costs (month t) | Holm p |
|---|---|---|---|---|---|---|---|---|
| Break fade | all | 171515 | +0.054R | −0.088R (-15.58) | 201772 | +0.042R | −0.118R (-28.35) |  |
| Break fade | **kept (the test)** | 90121 | +0.037R | −0.028R (-4.22) | 72658 | +0.020R | −0.050R (-8.06) | 1 |
| Break fade | dropped | 81394 | +0.074R | −0.156R (-18) | 129114 | +0.055R | −0.156R (-27.81) |  |
| Round-number fade | all | 94177 | +0.102R | −0.194R (-31.74) | 88734 | +0.051R | −0.307R (-34.05) |  |
| Round-number fade | **kept (the test)** | 15606 | +0.039R | −0.027R (-2.34) | 10261 | +0.004R | −0.059R (-3.74) | 1 |
| Round-number fade | dropped | 78571 | +0.115R | −0.227R (-32.97) | 78473 | +0.057R | −0.339R (-36.06) |  |
| Box fade | all | 115370 | +0.050R | −0.034R (-5.89) | 138713 | +0.050R | −0.052R (-11.54) |  |
| Box fade | **kept (the test)** | 87045 | +0.053R | +0.003R (0.57) | 87168 | +0.046R | −0.012R (-2.27) | 1 |
| Box fade | dropped | 28325 | +0.041R | −0.149R (-13.37) | 51545 | +0.057R | −0.119R (-17.56) |  |
| FVG return | all | 45209 | +0.042R | −0.089R (-14.91) | 52668 | +0.035R | −0.113R (-21.41) |  |
| FVG return | **kept (the test)** | 27517 | +0.055R | +0.003R (0.45) | 26637 | +0.049R | −0.009R (-1.31) | 1 |
| FVG return | dropped | 17692 | +0.023R | −0.233R (-20.76) | 26031 | +0.021R | −0.221R (-29.06) |  |

Average cost of a trade, 2015-26: Break fade 0.16R (kept 0.07R); Round-number fade 0.358R (kept 0.063R); Box fade 0.102R (kept 0.058R); FVG return 0.148R (kept 0.057R).

## Context only (no verdict; no threshold or market is adopted from this)

| Rule | Cost at most | 2005-14 n | After costs (t) | 2015-26 n | After costs (t) |
|---|---|---|---|---|---|
| Break fade | 5 % of the risk | 24820 | −0.024R (-2.19) | 11856 | −0.048R (-3.2) |
| Break fade | 20 % of the risk | 143897 | −0.037R (-6.72) | 159884 | −0.071R (-17.67) |
| Break fade | 30 % of the risk | 155845 | −0.047R (-8.47) | 184237 | −0.086R (-21.98) |
| Round-number fade | 5 % of the risk | 3850 | −0.014R (-0.51) | 3099 | −0.040R (-1.55) |
| Round-number fade | 20 % of the risk | 40344 | −0.041R (-5.02) | 28062 | −0.103R (-8.85) |
| Round-number fade | 30 % of the risk | 58140 | −0.064R (-9.35) | 44062 | −0.142R (-13.47) |
| Box fade | 5 % of the risk | 46082 | +0.023R (3.08) | 33493 | −0.006R (-0.74) |
| Box fade | 20 % of the risk | 106488 | −0.012R (-2.14) | 125817 | −0.030R (-6.6) |
| Box fade | 30 % of the risk | 111428 | −0.022R (-3.84) | 133739 | −0.040R (-8.73) |
| FVG return | 5 % of the risk | 13887 | +0.026R (2.8) | 10728 | +0.016R (1.32) |
| FVG return | 20 % of the risk | 37461 | −0.024R (-4.23) | 41798 | −0.041R (-7.67) |
| FVG return | 30 % of the risk | 40619 | −0.041R (-7.5) | 46816 | −0.058R (-10.97) |

## Kept trades by market, 2015-26, after costs (n)

| Market | Break fade | Round-number fade | Box fade | FVG return |
|---|---|---|---|---|
| xau | −0.044R (4794) | −0.048R (3513) | −0.039R (6223) | +0.010R (2027) |
| xag (cost assumed) | −0.062R (654) | −0.042R (541) | −0.090R (1203) | +0.151R (355) |
| eurusd | −0.036R (10441) | −0.061R (710) | +0.014R (9874) | +0.008R (3317) |
| gbpusd | −0.032R (10341) | −0.070R (869) | +0.005R (9798) | −0.016R (3380) |
| usdjpy | −0.090R (8785) | −0.131R (1429) | −0.033R (10782) | −0.021R (3164) |
| audusd | −0.054R (8694) | −0.025R (661) | −0.013R (11275) | −0.017R (3349) |
| nzdusd (cost assumed) | −0.048R (5237) | −0.072R (454) | −0.008R (9600) | −0.002R (2498) |
| usdcad (cost assumed) | −0.027R (9459) | −0.090R (677) | −0.015R (10649) | −0.007R (3186) |
| usdchf (cost assumed) | −0.041R (5969) | −0.142R (375) | +0.024R (7450) | −0.040R (2357) |
| eurjpy (cost assumed) | −0.081R (8284) | +0.035R (1032) | −0.031R (10314) | −0.010R (3004) |

Costs: the shared table (assumed, not measured, on five of the ten markets). These windows are the ones the rules were found on.
