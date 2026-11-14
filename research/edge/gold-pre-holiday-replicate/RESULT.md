# Result: does the gold pre-holiday long replicate on other data? (14 Nov 2026)

**Verdict: PASS: R1-T1, R1-T2, R2-T1 meet every condition; T1 net +0.137R in euros (n 181, t +3.27) and +0.116R on HistData (n 81, t +2.05); not independent of the original's years.**

Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any return was computed). The rule is the original
`gold-pre-holiday` code byte for byte (`original.mjs`, sha256 pinned); only the candles, the cost per feed and the windows
are this study's. **R1 and R2 cannot be independent of the original**: they read the same holidays in the same years on
gold (XAU/EUR is gold over EUR/USD; HistData is another feed of the same market). They check that the original's figure
is not one feed's artefact or the dollar's own holiday move. The independent test is R3, the forward check below, with
nothing computed now. Nothing live changed; not a gold-book system or a gate on one (owner item 44).

Data: R1 OANDA mid M5 XAU/EUR grouped to H1, 2006-03-20 to 2026-11-13 (127099 H1 candles, 5353 days); R2 HistData
XAU/USD M1 (bid, labels to UTC by `council/histdata.mjs`), 2018-01-02 to 2026-10-30 (51544 H1 candles). Costs: R1 0.016 % of
price a round trip, R2 $0.60 an ounce; both the original's financing `nights` x `FIN.xau.long` (assumed for XAU/EUR). Judged
holidays up to 31 Oct 2026: R1 2007-26, R2 2018-26 (the original's out-of-sample years; the HistData files start in 2018).

## The four tests (R a trade, t per event; month-sum t beside it, not judged)

| Test | window | n | gross R | gross t | net R | net t | month-sum t | net R 2x | won | stops | skipped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R1-T1 | whole | 181 | +0.153 | +3.66 | +0.137 | +3.27 | +3.22 (163) | +0.121 | 58.56 % | 11 | 0 |
| R1-T1 | 2007-2016 | 89 | +0.082 | +1.37 | +0.064 | +1.07 | +1.05 (81) | +0.046 | 49.44 % | 6 |  |
| R1-T1 | 2017-2026 | 92 | +0.222 | +3.83 | +0.208 | +3.59 | +3.54 (83) | +0.193 | 67.39 % | 5 |  |
| R1-T2 | whole | 181 | +0.240 | +3.76 | +0.209 | +3.29 | +3.23 (161) | +0.179 | 58.56 % | 29 | 0 |
| R1-T2 | 2007-2016 | 89 | +0.188 | +1.97 | +0.157 | +1.64 | +1.60 (81) | +0.125 | 56.18 % | 16 |  |
| R1-T2 | 2017-2026 | 92 | +0.289 | +3.40 | +0.260 | +3.08 | +3.06 (81) | +0.230 | 60.87 % | 13 |  |
| R2-T1 | whole | 81 | +0.142 | +2.51 | +0.116 | +2.05 | +2.02 (73) | +0.089 | 60.49 % | 3 | 2 |
| R2-T1 | 2018-2021 | 34 | +0.229 | +2.66 | +0.191 | +2.22 | +2.15 (31) | +0.152 | 70.59 % | 1 |  |
| R2-T1 | 2022-2026 | 47 | +0.080 | +1.06 | +0.062 | +0.83 | +0.82 (42) | +0.044 | 53.19 % | 2 |  |
| R2-T2 | whole | 81 | +0.194 | +2.13 | +0.153 | +1.70 | +1.72 (71) | +0.113 | 54.32 % | 13 | 2 |
| R2-T2 | 2018-2021 | 34 | +0.196 | +1.24 | +0.141 | +0.90 | +0.86 (31) | +0.087 | 52.94 % | 8 |  |
| R2-T2 | 2022-2026 | 47 | +0.192 | +1.77 | +0.162 | +1.50 | +1.64 (40) | +0.132 | 55.32 % | 5 |  |

## The bar

| Test | net t | one-sided p | Holm p | both halves positive | net R 2x | placebo (beat) | passes |
|---|---|---|---|---|---|---|---|
| R1-T1 | +3.27 | 0.0006 | 0.0024 | yes | +0.121 | 40 of 40 (seed means −0.110 to +0.116, median −0.005) | **yes** |
| R1-T2 | +3.29 | 0.0006 | 0.0024 | yes | +0.179 | 40 of 40 (seed means −0.120 to +0.142, median +0.014) | **yes** |
| R2-T1 | +2.05 | 0.0218 | 0.0436 | yes | +0.089 | 38 of 40 (seed means −0.200 to +0.147, median +0.021) | **yes** |
| R2-T2 | +1.70 | 0.0465 | 0.0465 | yes | +0.113 | 34 of 40 (seed means −0.109 to +0.274, median +0.058) | no |

Reading: the same fragility as the original shows on both feeds. In euros T1's first half (2007-2016) is +0.064R, t +1.07,
against +0.208R, t +3.59 in 2017-2026; on HistData T1 is +0.191R (t +2.22) in 2018-2021 and +0.062R
(t +0.83) in 2022-2026. The figure is not one feed's artefact, nor the dollar's own move (it holds, if anything
larger, priced in euros), but it is still the same holidays of the same years: the bar passing here adds no independent
evidence that the effect is real or lasting. R3 does.

## Against the original's XAU/USD trades (same holidays; reported only)

| Test | holidays matched | correlation of net R | correlation of % move | same sign |
|---|---|---|---|---|
| R1-T1 | 181 | +0.71 | +0.80 | 79.01 % |
| R1-T2 | 181 | +0.79 | +0.83 | 80.66 % |
| R2-T1 | 81 | +1.00 | +1.00 | 96.3 % |
| R2-T2 | 81 | +1.00 | +1.00 | 97.53 % |

High correlations are what "not independent" means in numbers: R1 and R2 re-read the original's days.

## By holiday (net R, whole window, reported only)

| Holiday | R1-T1 n | net R | t | R1-T2 net R | R2-T1 n | net R | t | R2-T2 net R |
|---|---|---|---|---|---|---|---|---|
| Christmas Day | 19 | +0.217 | +2.36 | +0.321 | 8 | +0.363 | +2.20 | +0.487 |
| Good Friday | 20 | +0.105 | +0.63 | +0.176 | 9 | +0.150 | +0.60 | +0.502 |
| Independence Day | 20 | +0.047 | +0.42 | +0.055 | 9 | +0.319 | +1.84 | +0.143 |
| Juneteenth | 5 | −0.133 | −1.01 | −0.239 | 5 | −0.225 | −1.36 | −0.112 |
| Labor Day | 20 | +0.250 | +1.52 | +0.629 | 9 | +0.149 | +0.80 | −0.046 |
| Martin Luther King Day | 20 | +0.268 | +1.58 | +0.383 | 8 | −0.086 | −0.36 | +0.048 |
| Memorial Day | 20 | +0.220 | +2.39 | +0.035 | 9 | +0.121 | +1.14 | −0.075 |
| New Year's Day | 18 | +0.199 | +1.59 | +0.088 | 7 | +0.123 | +1.24 | +0.254 |
| Presidents' Day | 20 | +0.061 | +0.53 | +0.287 | 9 | +0.082 | +0.44 | +0.316 |
| Thanksgiving Day | 19 | −0.064 | −0.77 | +0.003 | 8 | +0.007 | +0.05 | −0.079 |

## R3: the forward check (pre-registered, nothing computed)

The next twelve months of NYSE full holidays (`ict/calendar.mjs` `cmeYear`, 15 Nov 2026 to 14 Nov 2027; 3 July, the day
after Thanksgiving and Christmas Eve stay trading days, as in the original):

| # | Holiday | Date |
|---|---|---|
| 1 | Thanksgiving Day | 2026-11-26 |
| 2 | Christmas Day | 2026-12-25 |
| 3 | New Year's Day | 2027-01-01 |
| 4 | Martin Luther King Day | 2027-01-18 |
| 5 | Presidents' Day | 2027-02-15 |
| 6 | Good Friday | 2027-03-26 |
| 7 | Memorial Day | 2027-05-31 |
| 8 | Juneteenth | 2027-06-18 |
| 9 | Independence Day | 2027-07-05 |
| 10 | Labor Day | 2027-09-06 |

**Pass line for a future reader**: run the original's T1 unchanged (`original.mjs`, the same sha256) on OANDA mid H1 XAU/USD
for exactly these ten events, net of its costs. **T1 passes the forward check if its mean net R over the ten is above 0.**
T2 is reported beside it, not judged. Ten events give no t worth judging (about t 0.8 at the original's mean and spread):
the line only asks whether the sign holds on data nobody had seen. A fail sends T1 back to "not shown"; a pass is one
more year of the same sign, not a proven edge.

## To repeat

`node research/edge/gold-pre-holiday-replicate/run.mjs fetch-hist <dir>` (git show from `origin/council-data`, no network), then
`… run <dir> <xaueur-5m.json.gz>` with OANDA mid M5 XAU/EUR rows `[t,o,h,l,c,v]` from the candle proxy (kept out of git). The
original's trades for the comparison are read from `origin/gold-pre-holiday` (`git show`).
