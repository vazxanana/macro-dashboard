# Volume-conditioned reversal of big daily moves on index, metal, energy and forex CFDs: result

**Verdict: FAIL. Low-volume fades pooled OOS -0.2R a month net, t -0.59, Holm p 1.000 (bar: t >= 2 after Holm); low minus high t +2.36.**

Pre-registered bar (PREREGISTRATION.md, pushed alone first): T1 OOS t >= 2 with Holm p <= 0.05 missed; T1 IS > 0 missed; T1 OOS > 0 at 2x costs missed; above >= 38 of 40 placebos missed.

Out of sample 2017-01 to 2026-10, pooled: 8892 big-move days (1975 low-volume, 6917 high-volume). Low-volume fades -0.0121R a trade net (gross +0.0274R); high-volume fades -0.0424R (gross -0.008R). Month sums: low -0.2029R net (t -0.59, gross t +1.35), 2x costs -0.8642R; low minus high +2.2827R (t +2.36).
In sample 2005-01 to 2016-12, pooled: 2106 low-volume and 7218 high-volume fades; low -1.0921R a month net (t -3.52, gross -0.5601R, t -1.82); low minus high +0.5378R (t +0.72).
Placebo (deciding, 40 seeds: per market as many random OOS big-move days of any volume class as it had low-volume fades, faded): the real -0.2029R a month beats 35 of 40; 5th / 50th / 95th percentile -1.1046 / -0.5694 / -0.0971R. Reported placebo (random eligible days, random side): beats 39 of 40; median -0.7064R.

Every trade is a fade with a stop at 1R = 1.5 x ATR(20) against it. Net of a round-trip spread (indices 0.03 %, forex 0.015 %, gold 0.02 %, silver / copper / energies 0.10 %, platinum / palladium 0.20 %) and overnight financing per rollover on both sides (gold long 0.0148 %, gold short 0, other markets 0.015 %, forex 0.004 % of the entry price; assumed, today's rate for every year). Volume is OANDA's quote count, a proxy for volume, not traded volume. Paper research: no live rule, size, filter, stop or council member changed.

## The six tests (OOS, base costs, calendar-month sums; Holm over the six)

| Test | Set | IS gross R/month (t) | IS net R/month (t) | OOS gross R/month (t) | OOS net R/month (t) | Newey-West t | OOS 2x R/month | p | Holm p | Passes |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | low-volume fades, pooled | -0.5601 (-1.82) | -1.0921 (-3.52) | +0.4585 (+1.35) | -0.2029 (-0.59) | -0.71 | -0.8642 | 0.55519 | 1 | no |
| T2 | low minus high, pooled | -0.5693 (-0.77) | +0.5378 (+0.72) | +0.9282 (+1) | +2.2827 (+2.36) | +2.61 | +3.6373 | 0.01827 | 0.10962 | no |
| T3 | low-volume fades, indices | -0.1435 (-0.59) | -0.3927 (-1.61) | +0.2289 (+0.79) | -0.1351 (-0.47) | -0.52 | -0.4992 | 0.63836 | 1 | no |
| T4 | low-volume fades, metals | -0.213 (-1.87) | -0.3578 (-3.03) | -0.0232 (-0.24) | -0.1582 (-1.63) | -1.46 | -0.2932 | 0.1031 | 0.5155 | no |
| T5 | low-volume fades, energy | -0.1061 (-1.34) | -0.1597 (-2.01) | +0.0679 (+0.79) | +0.0222 (+0.26) | +0.29 | -0.0235 | 0.79486 | 1 | no |
| T6 | low-volume fades, fx | -0.0975 (-0.85) | -0.1819 (-1.59) | +0.1849 (+1.2) | +0.0683 (+0.45) | +0.44 | -0.0484 | 0.65271 | 1 | no |

## The four groups, low and high (month sums, net, base costs; reported)

| Set | Kind | IS fades | IS R/month (t) | OOS fades | OOS R/month (t) | OOS gross R/month (t) |
|---|---|---|---|---|---|---|
| pooled | low | 2106 | -1.0921 (-3.52) | 1975 | -0.2029 (-0.59) | +0.4585 (+1.35) |
| pooled | high | 7218 | -1.6299 (-2.31) | 6917 | -2.4856 (-2.39) | -0.4697 (-0.46) |
| indices | low | 940 | -0.3927 (-1.61) | 1000 | -0.1351 (-0.47) | +0.2289 (+0.79) |
| indices | high | 3610 | -0.2776 (-0.5) | 3665 | -0.5742 (-0.69) | +0.5506 (+0.66) |
| metals | low | 387 | -0.3578 (-3.03) | 313 | -0.1582 (-1.63) | -0.0232 (-0.24) |
| metals | high | 1033 | -0.6615 (-3.28) | 1111 | -0.6299 (-2.85) | -0.2095 (-0.97) |
| energy | low | 241 | -0.1597 (-2.01) | 186 | +0.0222 (+0.26) | +0.0679 (+0.79) |
| energy | high | 761 | -0.116 (-0.86) | 677 | -0.6151 (-3.24) | -0.4555 (-2.44) |
| fx | low | 538 | -0.1819 (-1.59) | 476 | +0.0683 (+0.45) | +0.1849 (+1.2) |
| fx | high | 1814 | -0.5748 (-2.27) | 1464 | -0.6664 (-1.7) | -0.3553 (-0.92) |

## Per trade (base costs)

| Set | Window | Kind | n | Gross R | Spread R | Financing R | Net R | Net 2x R | Stops (gap) |
|---|---|---|---|---|---|---|---|---|---|
| pooled | IS | low | 2106 | -0.0383 | 0.0182 | 0.0182 | -0.0747 | -0.111 | 354 (12) |
| pooled | IS | high | 7218 | +0.0002 | 0.0161 | 0.0166 | -0.0325 | -0.0652 | 1466 (56) |
| pooled | IS | all | 9327 | -0.0085 | 0.0166 | 0.0169 | -0.0421 | -0.0756 | 1820 (68) |
| pooled | OOS | low | 1975 | +0.0274 | 0.0181 | 0.0214 | -0.0121 | -0.0516 | 325 (7) |
| pooled | OOS | high | 6917 | -0.008 | 0.0166 | 0.0178 | -0.0424 | -0.0768 | 1596 (74) |
| pooled | OOS | all | 8892 | -0.0001 | 0.0169 | 0.0186 | -0.0357 | -0.0712 | 1921 (81) |
| indices | IS | low | 940 | -0.022 | 0.0129 | 0.0253 | -0.0602 | -0.0983 | 139 (10) |
| indices | IS | high | 3610 | +0.0229 | 0.0122 | 0.0218 | -0.0111 | -0.045 | 759 (45) |
| indices | IS | all | 4553 | +0.0135 | 0.0123 | 0.0225 | -0.0213 | -0.0562 | 898 (55) |
| indices | OOS | low | 1000 | +0.027 | 0.0148 | 0.0282 | -0.0159 | -0.0589 | 185 (5) |
| indices | OOS | high | 3665 | +0.0177 | 0.0131 | 0.0231 | -0.0185 | -0.0547 | 863 (54) |
| indices | OOS | all | 4665 | +0.0197 | 0.0135 | 0.0242 | -0.0179 | -0.0556 | 1048 (59) |
| metals | IS | low | 387 | -0.0792 | 0.0398 | 0.0141 | -0.1331 | -0.187 | 91 (0) |
| metals | IS | high | 1033 | -0.0418 | 0.0363 | 0.0141 | -0.0922 | -0.1427 | 219 (3) |
| metals | IS | all | 1420 | -0.052 | 0.0373 | 0.0141 | -0.1034 | -0.1548 | 310 (3) |
| metals | OOS | low | 313 | -0.0088 | 0.0349 | 0.016 | -0.0596 | -0.1105 | 56 (1) |
| metals | OOS | high | 1111 | -0.0223 | 0.0314 | 0.0133 | -0.0669 | -0.1116 | 250 (3) |
| metals | OOS | all | 1424 | -0.0193 | 0.0322 | 0.0139 | -0.0653 | -0.1113 | 306 (4) |
| energy | IS | low | 241 | -0.0634 | 0.02 | 0.012 | -0.0954 | -0.1274 | 36 (1) |
| energy | IS | high | 761 | +0.0108 | 0.0214 | 0.0114 | -0.0219 | -0.0547 | 142 (4) |
| energy | IS | all | 1002 | -0.007 | 0.021 | 0.0116 | -0.0396 | -0.0722 | 178 (5) |
| energy | OOS | low | 186 | +0.0431 | 0.0177 | 0.0113 | +0.0141 | -0.0149 | 20 (0) |
| energy | OOS | high | 677 | -0.0794 | 0.0183 | 0.0095 | -0.1072 | -0.135 | 157 (16) |
| energy | OOS | all | 863 | -0.053 | 0.0182 | 0.0099 | -0.0811 | -0.1091 | 177 (16) |
| fx | IS | low | 538 | -0.0261 | 0.011 | 0.0116 | -0.0487 | -0.0713 | 88 (1) |
| fx | IS | high | 1814 | -0.0256 | 0.0103 | 0.0097 | -0.0456 | -0.0656 | 346 (4) |
| fx | IS | all | 2352 | -0.0257 | 0.0105 | 0.0101 | -0.0463 | -0.0669 | 434 (5) |
| fx | OOS | low | 476 | +0.0458 | 0.0142 | 0.0147 | +0.0169 | -0.012 | 64 (1) |
| fx | OOS | high | 1464 | -0.0286 | 0.0132 | 0.0118 | -0.0537 | -0.0788 | 326 (1) |
| fx | OOS | all | 1940 | -0.0104 | 0.0135 | 0.0126 | -0.0364 | -0.0624 | 390 (2) |

## By market (net R a trade)

| Market | Group | First | Last | Candles | IS low n | IS low R | IS high n | IS high R | OOS low n | OOS low R | OOS high n | OOS high R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spx500 | indices | 2005-01-03 | 2026-11-06 | 5666 | 60 | -0.0602 | 270 | +0.0154 | 54 | -0.1781 | 247 | -0.0381 |
| nas100 | indices | 2005-01-03 | 2026-11-06 | 5666 | 81 | +0.0167 | 260 | +0.0268 | 61 | -0.0859 | 240 | -0.0272 |
| us30 | indices | 2005-01-03 | 2026-11-06 | 5652 | 74 | +0.0483 | 267 | -0.0538 | 56 | -0.0268 | 229 | -0.0621 |
| us2000 | indices | 2005-01-03 | 2026-11-06 | 5657 | 73 | +0.0488 | 272 | +0.0446 | 55 | +0.0095 | 228 | -0.0339 |
| de40 | indices | 2005-01-03 | 2026-11-06 | 5558 | 59 | -0.1745 | 270 | -0.0444 | 53 | +0.1532 | 222 | -0.0075 |
| uk100 | indices | 2005-01-04 | 2026-11-06 | 5526 | 60 | -0.141 | 265 | -0.0096 | 54 | -0.0583 | 237 | -0.008 |
| fr40 | indices | 2005-01-03 | 2026-11-06 | 5591 | 60 | -0.1205 | 286 | +0.0351 | 60 | -0.2381 | 202 | +0.033 |
| eu50 | indices | 2005-01-03 | 2026-11-06 | 5559 | 72 | -0.0918 | 250 | +0.0438 | 65 | +0.0453 | 219 | +0.0419 |
| ch20 | indices | 2005-01-03 | 2026-11-06 | 5491 | 59 | -0.1497 | 276 | -0.0772 | 45 | -0.0741 | 210 | -0.0783 |
| nl25 | indices | 2008-01-21 | 2026-11-06 | 4812 | 54 | -0.1847 | 181 | +0.0051 | 58 | +0.1268 | 198 | -0.0211 |
| es35 | indices | 2016-12-02 | 2026-11-06 | 2523 | 0 | n/a | 0 | n/a | 51 | -0.0636 | 206 | -0.0361 |
| jp225 | indices | 2005-01-03 | 2026-11-06 | 5659 | 68 | +0.0145 | 264 | -0.0436 | 70 | +0.0293 | 228 | -0.0752 |
| au200 | indices | 2005-01-03 | 2026-11-06 | 5576 | 54 | -0.1497 | 199 | +0.0066 | 79 | -0.1276 | 223 | +0.0944 |
| hk33 | indices | 2005-01-03 | 2026-11-06 | 5391 | 58 | +0.1229 | 211 | -0.1074 | 68 | +0.0386 | 198 | -0.0173 |
| cn50 | indices | 2011-08-30 | 2026-11-06 | 3855 | 14 | -0.0243 | 115 | +0.0566 | 48 | +0.2382 | 246 | -0.0223 |
| sg30 | indices | 2005-01-03 | 2026-11-06 | 5594 | 66 | -0.1603 | 136 | -0.0104 | 88 | -0.0194 | 199 | -0.0239 |
| in50 | indices | 2011-08-26 | 2022-07-12 | 2735 | 28 | +0.0305 | 88 | -0.0814 | 35 | +0.0331 | 133 | -0.0323 |
| xau | metals | 2006-03-20 | 2026-11-06 | 5364 | 48 | -0.0396 | 217 | -0.0506 | 53 | -0.0307 | 240 | -0.0285 |
| xag | metals | 2006-03-20 | 2026-11-06 | 5365 | 55 | -0.0305 | 211 | -0.1111 | 60 | -0.057 | 238 | -0.0907 |
| xpt | metals | 2005-01-04 | 2026-11-06 | 5645 | 107 | -0.2669 | 219 | -0.1338 | 70 | -0.0794 | 216 | -0.1102 |
| xpd | metals | 2005-01-04 | 2026-11-06 | 5646 | 93 | -0.1907 | 217 | -0.0839 | 66 | -0.0508 | 206 | -0.1095 |
| xcu | metals | 2005-01-03 | 2026-11-06 | 5649 | 84 | -0.0197 | 169 | -0.0789 | 64 | -0.0735 | 211 | +0.0021 |
| wtico | energy | 2005-01-03 | 2026-11-06 | 5661 | 74 | -0.0429 | 254 | -0.0107 | 65 | -0.0055 | 227 | -0.1144 |
| bco | energy | 2005-01-04 | 2026-11-06 | 5631 | 76 | -0.1515 | 261 | +0.0497 | 60 | +0.019 | 229 | -0.0901 |
| natgas | energy | 2005-01-03 | 2026-11-06 | 5660 | 91 | -0.0912 | 246 | -0.1096 | 61 | +0.0301 | 221 | -0.1176 |
| eurusd | fx | 2005-01-03 | 2026-11-06 | 5693 | 79 | -0.0553 | 262 | -0.0548 | 67 | +0.062 | 219 | -0.1286 |
| gbpusd | fx | 2005-01-03 | 2026-11-06 | 5693 | 81 | -0.0048 | 242 | -0.0729 | 59 | +0.1489 | 207 | -0.0062 |
| audusd | fx | 2005-01-03 | 2026-11-06 | 5693 | 62 | -0.1641 | 269 | -0.041 | 76 | -0.0737 | 211 | -0.0474 |
| nzdusd | fx | 2005-01-03 | 2026-11-06 | 5693 | 69 | +0.0417 | 260 | -0.081 | 73 | +0.0615 | 197 | -0.0679 |
| usdjpy | fx | 2005-01-03 | 2026-11-06 | 5693 | 66 | -0.0619 | 283 | -0.0052 | 61 | +0.0445 | 213 | +0.0126 |
| usdcad | fx | 2005-01-03 | 2026-11-06 | 5693 | 83 | +0.0163 | 271 | -0.0302 | 77 | -0.0787 | 201 | -0.0633 |
| usdchf | fx | 2005-01-03 | 2026-11-06 | 5693 | 98 | -0.1165 | 227 | -0.0397 | 63 | -0.0067 | 216 | -0.0731 |

## By year (pooled, net R a trade)

| Year | Low-volume fades | Low net R | High-volume fades | High net R |
|---|---|---|---|---|
| 2005 | 88 | -0.0546 | 340 | +0.0195 |
| 2006 | 147 | -0.1109 | 502 | -0.0571 |
| 2007 | 146 | +0.0059 | 765 | -0.0344 |
| 2008 | 277 | -0.0328 | 907 | -0.0572 |
| 2009 | 143 | +0.0109 | 262 | +0.0733 |
| 2010 | 170 | -0.0837 | 563 | -0.0598 |
| 2011 | 257 | -0.0405 | 714 | +0.0448 |
| 2012 | 131 | -0.0804 | 451 | -0.0173 |
| 2013 | 162 | -0.0382 | 662 | -0.0783 |
| 2014 | 222 | -0.0758 | 835 | -0.1115 |
| 2015 | 180 | -0.1366 | 691 | +0.0701 |
| 2016 | 183 | -0.2552 | 526 | -0.0907 |
| 2017 | 199 | -0.0083 | 577 | -0.0165 |
| 2018 | 223 | -0.0637 | 889 | -0.1221 |
| 2019 | 199 | +0.0048 | 558 | +0.053 |
| 2020 | 176 | -0.0894 | 928 | -0.0835 |
| 2021 | 160 | +0.0829 | 670 | +0.0433 |
| 2022 | 276 | +0.0102 | 796 | -0.0724 |
| 2023 | 217 | -0.0213 | 453 | +0.0096 |
| 2024 | 203 | +0.0261 | 715 | -0.0524 |
| 2025 | 181 | -0.0476 | 698 | -0.0573 |
| 2026 | 141 | -0.0102 | 633 | -0.0402 |

## Reading

- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that the opposite (following low-volume moves) works, and it does not test the idea on real traded volume: the quote count may simply not carry it.
- Low minus high (T2) is +2.2827R a month OOS (t +2.36) and +0.5378R IS (t +0.72); the pre-registration read a negative sign as agreeing with Campbell, Grossman and Wang (high-volume moves reverse more). Said plainly: a difference of month SUMS also carries the count, and high-volume fades are about 4 times as many as low-volume ones, all losing after costs; per trade the OOS difference is +0.0303R net (+0.0354R gross), and neither set clears its costs.
- The deciding placebo draws big-move days of any volume class: it asks whether the volume split adds anything to fading a big move.

## What this cannot show

- A quote count is not traded volume; spot forex and metals have no central volume. Price series without dividends; assumed spreads and financing, today's rates for every year. Overlapping trades and co-moving markets: only calendar-month sums are tested.

To repeat: `node research/edge/volume-reversal/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/volume-reversal.test.mjs`.
