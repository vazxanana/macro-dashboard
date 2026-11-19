# The high-volume return premium on index, metal, energy and forex CFDs: result

**Verdict: FAIL. Pooled OOS high-minus-all +2.69R a month net, t +1.99, Holm p 0.186 (bar: t >= 2 after Holm); indices alone t +3.52, reported, not the primary.**

Pre-registered bar (PREREGISTRATION.md, pushed alone first): pooled OOS H = 5 t >= 2 with Holm p <= 0.05 missed; pooled IS > 0 met; OOS > 0 at 2x costs, the difference and the high-volume longs themselves missed; above >= 38 of 40 placebos met.

Out of sample 2017-01 to 2026-10: 8189 high-volume days of 69639 eligible (pooled, H = 5). High-volume longs +0.0059R a trade net (gross +0.0457R) against all days -0.0026R (gross +0.0399R). High minus all, month sums: gross +2.6349R (t +1.94), net +2.6875R (t +1.99, Newey-West +1.89), 2x costs +2.74R.
In sample 2005-01 to 2016-12: 8621 high-volume days; high minus all net +2.2593R a month (t +2.7), gross +2.2257R (t +2.65).
Placebo (40 seeds, the same number of random eligible days per market, OOS): the real pooled mean +2.6875R beats 40 of 40; placebo 5th / 50th / 95th percentile -0.717 / +0.0227 / +0.6856R a month.

Every trade is a long with a stop at 1R = 2 x ATR(20) below its entry. Net of a round-trip spread (indices 0.03 %, forex 0.015 %, gold 0.02 %, silver / copper / energies 0.10 %, platinum / palladium 0.20 %) and overnight financing per rollover (gold 0.0148 %, other longs 0.015 %, forex 0.004 % of the entry price; assumed, today's rate for every year). The volume is OANDA's quote count, a noisy proxy for traded volume. Paper research: no live rule, size, filter, stop or council member changed.

## The five tests (H = 5, base costs, high minus all, calendar-month sums)

| Set | IS high days | IS gross R/month (t) | IS net R/month (t) | OOS high days | OOS gross R/month (t) | OOS net R/month (t) | Newey-West t | OOS 2x R/month | p | Holm p | Passes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| pooled | 8621 | +2.2257 (+2.65) | +2.2593 (+2.7) | 8189 | +2.6349 (+1.94) | +2.6875 (+1.99) | +1.89 | +2.74 | 0.04659 | 0.18636 | no |
| indices | 3938 | +2.6081 (+4) | +2.632 (+4.06) | 4229 | +3.6278 (+3.47) | +3.6591 (+3.52) | +3.49 | +3.6905 | 0.00043 | 0.00215 | yes |
| metals | 1451 | -0.1201 (-0.51) | -0.1156 (-0.49) | 1305 | -0.444 (-1.44) | -0.4367 (-1.42) | -1.45 | -0.4294 | 0.15561 | 0.34926 | no |
| energy | 949 | -0.2399 (-1.34) | -0.2379 (-1.34) | 796 | -0.384 (-1.58) | -0.3804 (-1.57) | -1.39 | -0.3767 | 0.11642 | 0.34926 | no |
| fx | 2283 | -0.0223 (-0.1) | -0.0192 (-0.09) | 1859 | -0.1649 (-0.62) | -0.1546 (-0.58) | -0.58 | -0.1443 | 0.56191 | 0.56191 | no |

## Per trade (H = 5, base costs)

| Set | Window | Kind | n | Gross R | Spread R | Financing R | Net R | Net 2x R | Stops (gap) |
|---|---|---|---|---|---|---|---|---|---|
| pooled | IS | high | 8621 | +0.015 | 0.0137 | 0.023 | -0.0217 | -0.0584 | 1887 (87) |
| pooled | IS | low | 12110 | +0.0083 | 0.0141 | 0.027 | -0.0327 | -0.0737 | 2118 (75) |
| pooled | IS | all | 74501 | +0.019 | 0.0138 | 0.0254 | -0.0201 | -0.0593 | 13430 (548) |
| pooled | OOS | high | 8189 | +0.0457 | 0.0137 | 0.0261 | +0.0059 | -0.034 | 1746 (57) |
| pooled | OOS | low | 11616 | +0.0245 | 0.0143 | 0.0305 | -0.0203 | -0.065 | 1908 (48) |
| pooled | OOS | all | 69639 | +0.0399 | 0.014 | 0.0286 | -0.0026 | -0.0452 | 11744 (350) |
| indices | IS | high | 3938 | +0.0216 | 0.0101 | 0.0306 | -0.0191 | -0.0599 | 1003 (84) |
| indices | IS | low | 5971 | +0.0025 | 0.0109 | 0.0357 | -0.0441 | -0.0907 | 1084 (69) |
| indices | IS | all | 36021 | +0.0252 | 0.0106 | 0.0337 | -0.0191 | -0.0634 | 7031 (510) |
| indices | OOS | high | 4229 | +0.0658 | 0.0109 | 0.0333 | +0.0216 | -0.0227 | 962 (51) |
| indices | OOS | low | 6159 | +0.019 | 0.0121 | 0.0394 | -0.0325 | -0.084 | 1059 (45) |
| indices | OOS | all | 36007 | +0.0484 | 0.0116 | 0.037 | -0.0002 | -0.0488 | 6497 (299) |
| metals | IS | high | 1451 | +0.0559 | 0.0296 | 0.0217 | +0.0046 | -0.0467 | 275 (1) |
| metals | IS | low | 1786 | +0.0558 | 0.0313 | 0.0246 | -0.0001 | -0.056 | 303 (0) |
| metals | IS | all | 11721 | +0.0285 | 0.0297 | 0.0232 | -0.0244 | -0.0772 | 2014 (7) |
| metals | OOS | high | 1305 | +0.0991 | 0.0259 | 0.0228 | +0.0505 | +0.0018 | 220 (1) |
| metals | OOS | low | 1753 | +0.0699 | 0.0252 | 0.0256 | +0.0191 | -0.0318 | 238 (0) |
| metals | OOS | all | 11111 | +0.0679 | 0.0255 | 0.024 | +0.0183 | -0.0312 | 1589 (5) |
| energy | IS | high | 949 | -0.0034 | 0.0171 | 0.0161 | -0.0367 | -0.07 | 180 (2) |
| energy | IS | low | 1224 | +0.0142 | 0.0179 | 0.0177 | -0.0213 | -0.0569 | 199 (3) |
| energy | IS | all | 7815 | +0.0165 | 0.0174 | 0.0169 | -0.0178 | -0.0521 | 1280 (23) |
| energy | OOS | high | 796 | -0.0079 | 0.0156 | 0.0141 | -0.0375 | -0.0672 | 182 (4) |
| energy | OOS | low | 1173 | +0.0467 | 0.0161 | 0.0158 | +0.0148 | -0.0171 | 159 (1) |
| energy | OOS | all | 6671 | +0.0426 | 0.0156 | 0.0151 | +0.012 | -0.0187 | 1038 (24) |
| fx | IS | high | 2283 | -0.0147 | 0.0081 | 0.0137 | -0.0365 | -0.0583 | 429 (0) |
| fx | IS | low | 3129 | -0.0099 | 0.0089 | 0.0152 | -0.034 | -0.058 | 532 (3) |
| fx | IS | all | 18944 | +0.0023 | 0.0084 | 0.0144 | -0.0205 | -0.0433 | 3105 (8) |
| fx | OOS | high | 1859 | -0.0144 | 0.0106 | 0.0174 | -0.0425 | -0.0706 | 382 (1) |
| fx | OOS | low | 2531 | -0.0039 | 0.0112 | 0.019 | -0.034 | -0.0642 | 452 (2) |
| fx | OOS | all | 15850 | 0 | 0.0108 | 0.0183 | -0.029 | -0.0581 | 2620 (22) |

## Reported only (never deciding)

| Comparison | Window | Mean R/month (t) |
|---|---|---|
| H = 5 pooled, high-volume longs alone (net) | IS | -1.2979 (-0.92) |
| H = 5 pooled, low minus all (net) | IS | -2.088 (-2.22) |
| H = 5 pooled, high minus low (net) | IS | +4.3473 (+2.96) |
| H = 5 pooled, high-volume longs alone (net) | OOS | +0.4084 (+0.23) |
| H = 5 pooled, low minus all (net) | OOS | -3.0464 (-2.9) |
| H = 5 pooled, high minus low (net) | OOS | +5.7338 (+2.99) |
| H = 5 pooled, high minus all, no return cap (net) | IS | +3.754 (+3.43) |
| H = 5 pooled, high minus all, no return cap (net) | OOS | +3.8425 (+2.08) |
| H = 20 pooled, high minus all (net; Newey-West t +3.24) | IS | +3.8896 (+3.39) |
| H = 20 pooled, high minus all (net; Newey-West t +2.59) | OOS | +5.2899 (+2.67) |
| H = 20 indices, high minus all (net; Newey-West t +5.09) | IS | +4.6882 (+5.5) |
| H = 20 indices, high minus all (net; Newey-West t +5.08) | OOS | +7.5335 (+4.9) |
| H = 20 metals, high minus all (net; Newey-West t -1.01) | IS | -0.4299 (-1.03) |
| H = 20 metals, high minus all (net; Newey-West t -2.02) | OOS | -1.2064 (-2.03) |
| H = 20 energy, high minus all (net; Newey-West t -0.76) | IS | -0.2216 (-0.76) |
| H = 20 energy, high minus all (net; Newey-West t -1.92) | OOS | -0.8617 (-2.08) |
| H = 20 fx, high minus all (net; Newey-West t -0.42) | IS | -0.1471 (-0.44) |
| H = 20 fx, high minus all (net; Newey-West t -0.29) | OOS | -0.1754 (-0.33) |
| H = 20 pooled, high minus low (net) | IS | +7.1557 (+4.1) |
| H = 20 pooled, high minus low (net) | OOS | +8.1501 (+2.72) |

## By market (H = 5, high minus all, net R a month)

| Market | Group | First | Last | Candles | IS high days | IS R/month | OOS high days | OOS R/month (t) |
|---|---|---|---|---|---|---|---|---|
| spx500 | indices | 2005-01-03 | 2026-11-06 | 5666 | 256 | +0.2427 | 269 | +0.274 (+2.26) |
| nas100 | indices | 2005-01-03 | 2026-11-06 | 5666 | 283 | +0.2415 | 274 | +0.3653 (+2.94) |
| us30 | indices | 2005-01-03 | 2026-11-06 | 5652 | 264 | +0.3605 | 256 | +0.2753 (+2.43) |
| us2000 | indices | 2005-01-03 | 2026-11-06 | 5657 | 302 | +0.2576 | 250 | +0.2804 (+2.25) |
| de40 | indices | 2005-01-03 | 2026-11-06 | 5558 | 295 | +0.2648 | 266 | +0.3555 (+3.52) |
| uk100 | indices | 2005-01-04 | 2026-11-06 | 5526 | 236 | +0.315 | 225 | +0.1912 (+1.85) |
| fr40 | indices | 2005-01-03 | 2026-11-06 | 5591 | 270 | +0.303 | 233 | +0.313 (+3.47) |
| eu50 | indices | 2005-01-03 | 2026-11-06 | 5559 | 280 | +0.2791 | 266 | +0.3924 (+4.2) |
| ch20 | indices | 2005-01-03 | 2026-11-06 | 5491 | 272 | +0.3463 | 259 | +0.1901 (+1.87) |
| nl25 | indices | 2008-01-21 | 2026-11-06 | 4812 | 202 | +0.1063 | 244 | +0.2217 (+2.14) |
| es35 | indices | 2016-12-02 | 2026-11-06 | 2523 | 0 | 0 | 197 | +0.3414 (+3.14) |
| jp225 | indices | 2005-01-03 | 2026-11-06 | 5659 | 276 | -0.0054 | 268 | +0.2025 (+1.88) |
| au200 | indices | 2005-01-03 | 2026-11-06 | 5576 | 278 | +0.1472 | 257 | +0.1956 (+2.13) |
| hk33 | indices | 2005-01-03 | 2026-11-06 | 5391 | 283 | -0.0622 | 242 | -0.056 (-0.45) |
| cn50 | indices | 2011-08-30 | 2026-11-06 | 3855 | 118 | -0.0171 | 278 | -0.1455 (-1) |
| sg30 | indices | 2005-01-03 | 2026-11-06 | 5594 | 216 | -0.1629 | 284 | +0.105 (+0.93) |
| in50 | indices | 2011-08-26 | 2022-07-12 | 2735 | 107 | +0.0156 | 161 | +0.1575 (+2.18) |
| xau | metals | 2006-03-20 | 2026-11-06 | 5364 | 279 | -0.0074 | 244 | -0.1024 (-0.81) |
| xag | metals | 2006-03-20 | 2026-11-06 | 5365 | 287 | +0.0492 | 257 | -0.1525 (-1.64) |
| xpt | metals | 2005-01-04 | 2026-11-06 | 5645 | 328 | -0.0956 | 270 | -0.1892 (-1.49) |
| xpd | metals | 2005-01-04 | 2026-11-06 | 5646 | 335 | -0.0489 | 289 | -0.0432 (-0.56) |
| xcu | metals | 2005-01-03 | 2026-11-06 | 5649 | 222 | -0.0129 | 245 | +0.0507 (+0.56) |
| wtico | energy | 2005-01-03 | 2026-11-06 | 5661 | 310 | -0.0123 | 241 | +0.0458 (+0.43) |
| bco | energy | 2005-01-04 | 2026-11-06 | 5631 | 330 | -0.0563 | 256 | +0.0793 (+0.71) |
| natgas | energy | 2005-01-03 | 2026-11-06 | 5660 | 309 | -0.1694 | 299 | -0.5054 (-4.23) |
| eurusd | fx | 2005-01-03 | 2026-11-06 | 5693 | 341 | -0.0643 | 265 | +0.0257 (+0.22) |
| gbpusd | fx | 2005-01-03 | 2026-11-06 | 5693 | 351 | -0.0729 | 295 | -0.1066 (-1.01) |
| audusd | fx | 2005-01-03 | 2026-11-06 | 5693 | 301 | +0.0218 | 268 | -0.0443 (-0.47) |
| nzdusd | fx | 2005-01-03 | 2026-11-06 | 5693 | 316 | +0.1427 | 259 | +0.0125 (+0.15) |
| usdjpy | fx | 2005-01-03 | 2026-11-06 | 5693 | 305 | -0.0323 | 257 | +0.1132 (+1.08) |
| usdcad | fx | 2005-01-03 | 2026-11-06 | 5693 | 329 | -0.0393 | 266 | -0.1221 (-1.32) |
| usdchf | fx | 2005-01-03 | 2026-11-06 | 5693 | 340 | +0.0251 | 249 | -0.0329 (-0.4) |

## By year (H = 5, pooled, net R a trade)

| Year | High-volume days | High net R | All days | All net R |
|---|---|---|---|---|
| 2005 | 566 | +0.0948 | 4356 | +0.0353 |
| 2006 | 746 | +0.0235 | 5684 | +0.0399 |
| 2007 | 801 | -0.0546 | 5702 | +0.0076 |
| 2008 | 888 | -0.1654 | 5985 | -0.1264 |
| 2009 | 561 | +0.1179 | 6650 | +0.0678 |
| 2010 | 767 | -0.0749 | 6467 | +0.0075 |
| 2011 | 639 | -0.083 | 6452 | -0.0734 |
| 2012 | 702 | -0.1071 | 6393 | +0.0029 |
| 2013 | 889 | +0.0146 | 6496 | -0.0089 |
| 2014 | 692 | +0.0102 | 6789 | -0.0707 |
| 2015 | 662 | +0.0304 | 6886 | -0.0854 |
| 2016 | 708 | +0.0167 | 6641 | -0.013 |
| 2017 | 761 | +0.0375 | 7194 | +0.0486 |
| 2018 | 992 | -0.1643 | 7119 | -0.0848 |
| 2019 | 602 | +0.0765 | 7371 | +0.0371 |
| 2020 | 885 | +0.0002 | 7194 | +0.025 |
| 2021 | 771 | +0.0966 | 7077 | -0.0342 |
| 2022 | 800 | +0.0043 | 6679 | -0.0666 |
| 2023 | 709 | -0.0427 | 7098 | -0.0148 |
| 2024 | 1024 | -0.0175 | 7010 | +0.0245 |
| 2025 | 853 | +0.1422 | 7056 | +0.0707 |
| 2026 | 792 | -0.0185 | 5841 | -0.0449 |

## Reading

- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that shorting high-activity days works, and it does not test the effect on real traded volume: the quote count may simply not carry it.
- Reported, not deciding: the index group alone passes its own Holm test (OOS +3.6591R a month, t +3.52; IS t +4.06), while metals, energies and forex are negative in both windows. The high-volume index longs themselves make +0.0216R a trade net OOS and -0.0227R at 2x costs, so the premium is relative to other days, not a trade that clears its costs. Chosen after seeing the groups, an index-only rule would need its own pre-registration on other data (other years or real futures volume).
- The comparison is the same long on any eligible day of that market in that month, so the market's drift cancels; the costs of the two longs nearly cancel too, which is why the bar also asks the high-volume longs themselves to stay positive at 2x costs.
- The placebo draws as many random eligible days per market as there were high-volume days: it shows how far a random set of days strays from the benchmark.

## What this cannot show

- A quote count is not traded volume; spot forex and metals have no central volume. Price series without dividends; assumed spreads and financing, today's rates for every year. Overlapping trades and co-moving markets: only calendar-month sums are tested.

To repeat: `node research/edge/volume-premium/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/volume-premium.test.mjs`.
