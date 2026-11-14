# Gold volatility breakout (T1): what it earns at realistic costs

Paper research, cost accounting only: no rule is tested and no pass / fail is given on a rule. T1 of `gold-vol-breakout` is imported unchanged from `original.mjs`, a verbatim copy of that study's `run.mjs` (sha256 in `result.json`). A stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44: none of its records read). Nothing live changed, no proposal: a forward paper record is the owner's decision. The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: ACCOUNTING (no rule tested): T1 pooled 2007-26 stays positive with month t ≥ 2 at measured demo costs (+0.147R, t +6.85) and does not at pessimistic costs + 0.10 slippage (+0.036R, t +1.64)**

## Harness gate (the replicate's figures at $0.60, exact)

| Window | n | Net R | Gross R | Month t | Gross t | Net 2x | Total R | Exact |
|---|---|---|---|---|---|---|---|---|
| main 2007-01-01 → 2015-12-31 | 1657 | +0.111 | +0.203 | +3.19 | +5.96 | +0.018 | +183.68 | yes |
| H1 2007-01-01 → 2011-12-31 | 929 | +0.120 | +0.217 | +2.83 | +5.33 | +0.023 | +111.22 | yes |
| H2 2012-01-01 → 2015-12-31 | 728 | +0.100 | +0.186 | +1.70 | +3.20 | +0.013 | +72.46 | yes |
| pooled 2007-01-01 → 2026-11-12 | 3713 | +0.073 | +0.155 | +3.35 | +7.24 | −0.009 | +272.23 | yes |

Route S with no slippage equals `vbTrade`'s own $0.60 net on every pooled trade: yes (largest difference 0).

## 1. Break-even cost (no extra slippage)

Round-trip cost a trade per ounce at which the mean net R is 0, and at which the month t of net R falls to 2 ("none": the gross t is already under 2). The same as a cost proportional to price, in basis points.

| Window | n | Gross R | Gross t | Median stop $ | Break-even $ | t-2 $ | Break-even bp of price | t-2 bp |
|---|---|---|---|---|---|---|---|---|
| 2007-11 | 929 | +0.217 | +5.33 | 7.87 | $1.34 | $0.81 | 13.75 bp | 8.23 bp |
| 2012-15 | 728 | +0.186 | +3.20 | 7.62 | $1.29 | $0.48 | 9.52 bp | 3.56 bp |
| 2016-20 | 935 | +0.111 | +2.87 | 6.49 | $0.65 | $0.19 | 4.86 bp | 1.45 bp |
| 2021-26 | 1121 | +0.121 | +3.21 | 13.49 | $1.48 | $0.54 | 6.70 bp | 2.48 bp |
| 2007-26 | 3713 | +0.155 | +7.24 | 8.57 | $1.14 | $0.81 | 8.18 bp | 5.85 bp |

For scale: route D charges 0.42 bp of price (about $0.17 at $4,000 gold, $0.03 at $700); route S $0.60; route P $1.00 / $0.70 / $0.60 by era.

## 2-3. Net R a trade by route and stop-entry slippage (month t)

Slippage s × M on the entry, M = median high − low of the 12 M5 candles ending with the fill candle (median M 1.08 $ pooled).

| Route | Slippage | 2007-11 | 2012-15 | 2016-20 | 2021-26 | 2007-26 |
|---|---|---|---|---|---|---|
| D: demo measured, proportional to price | 0.00 × M | +0.210 (t +5.15) | +0.178 (t +3.06) | +0.102 (t +2.62) | +0.113 (t +3.00) | +0.147 (t +6.85) |
| D: demo measured, proportional to price | 0.05 × M | +0.203 (t +4.95) | +0.171 (t +2.94) | +0.095 (t +2.44) | +0.106 (t +2.81) | +0.140 (t +6.52) |
| D: demo measured, proportional to price | 0.10 × M | +0.195 (t +4.75) | +0.164 (t +2.82) | +0.088 (t +2.26) | +0.099 (t +2.62) | +0.133 (t +6.18) |
| D: demo measured, proportional to price | 0.20 × M | +0.180 (t +4.35) | +0.151 (t +2.59) | +0.074 (t +1.90) | +0.085 (t +2.25) | +0.119 (t +5.51) |
| D$: demo measured, today's dollars | 0.00 × M | +0.202 (t +4.93) | +0.172 (t +2.94) | +0.094 (t +2.41) | +0.111 (t +2.93) | +0.141 (t +6.56) |
| D$: demo measured, today's dollars | 0.05 × M | +0.194 (t +4.73) | +0.165 (t +2.83) | +0.087 (t +2.23) | +0.104 (t +2.74) | +0.134 (t +6.22) |
| D$: demo measured, today's dollars | 0.10 × M | +0.187 (t +4.53) | +0.158 (t +2.71) | +0.080 (t +2.05) | +0.097 (t +2.55) | +0.127 (t +5.89) |
| D$: demo measured, today's dollars | 0.20 × M | +0.172 (t +4.14) | +0.144 (t +2.48) | +0.066 (t +1.70) | +0.083 (t +2.18) | +0.113 (t +5.22) |
| S: studies' model, $0.30 spread + half-spread slippage each side | 0.00 × M | +0.120 (t +2.83) | +0.100 (t +1.70) | +0.009 (t +0.22) | +0.072 (t +1.86) | +0.073 (t +3.35) |
| S: studies' model, $0.30 spread + half-spread slippage each side | 0.05 × M | +0.112 (t +2.64) | +0.093 (t +1.59) | +0.002 (t +0.05) | +0.065 (t +1.68) | +0.066 (t +3.02) |
| S: studies' model, $0.30 spread + half-spread slippage each side | 0.10 × M | +0.105 (t +2.46) | +0.086 (t +1.47) | −0.005 (t −0.12) | +0.058 (t +1.49) | +0.059 (t +2.70) |
| S: studies' model, $0.30 spread + half-spread slippage each side | 0.20 × M | +0.090 (t +2.08) | +0.072 (t +1.24) | −0.019 (t −0.47) | +0.044 (t +1.13) | +0.045 (t +2.04) |
| P: pessimistic by era (assumption): $1.00 / $0.70 / $0.60 | 0.00 × M | +0.055 (t +1.25) | +0.085 (t +1.46) | −0.006 (t −0.16) | +0.072 (t +1.86) | +0.051 (t +2.29) |
| P: pessimistic by era (assumption): $1.00 / $0.70 / $0.60 | 0.05 × M | +0.048 (t +1.08) | +0.078 (t +1.34) | −0.013 (t −0.33) | +0.065 (t +1.68) | +0.043 (t +1.96) |
| P: pessimistic by era (assumption): $1.00 / $0.70 / $0.60 | 0.10 × M | +0.040 (t +0.90) | +0.071 (t +1.22) | −0.020 (t −0.50) | +0.058 (t +1.49) | +0.036 (t +1.64) |
| P: pessimistic by era (assumption): $1.00 / $0.70 / $0.60 | 0.20 × M | +0.025 (t +0.56) | +0.058 (t +0.99) | −0.034 (t −0.84) | +0.044 (t +1.13) | +0.022 (t +1.00) |

## The two pre-registered conditions

| Condition | Window | n | Net R | Total R | Month t | p | Holm p (10) | Placebos beaten (of 40) | Positive with t ≥ 2 |
|---|---|---|---|---|---|---|---|---|---|
| D, measured demo | 2007-11 | 929 | +0.210 | +195.12 | +5.15 | 0 | 0 | 40 | yes |
| D, measured demo | 2012-15 | 728 | +0.178 | +129.69 | +3.06 | 0.001 | 0.009 | 40 | yes |
| D, measured demo | 2016-20 | 935 | +0.102 | +95.03 | +2.62 | 0.004 | 0.027 | 40 | yes |
| D, measured demo | 2021-26 | 1121 | +0.113 | +126.76 | +3.00 | 0.001 | 0.009 | 40 | yes |
| D, measured demo | 2007-26 | 3713 | +0.147 | +546.60 | +6.85 | 0 | 0 | 40 | yes |
| P + 0.10 × M | 2007-11 | 929 | +0.040 | +37.25 | +0.90 | 0.183 | 0.366 | 40 | no |
| P + 0.10 × M | 2012-15 | 728 | +0.071 | +51.96 | +1.22 | 0.111 | 0.333 | 40 | no |
| P + 0.10 × M | 2016-20 | 935 | −0.020 | −18.72 | −0.50 | 0.691 | 0.691 | 40 | no |
| P + 0.10 × M | 2021-26 | 1121 | +0.058 | +64.58 | +1.49 | 0.068 | 0.271 | 40 | no |
| P + 0.10 × M | 2007-26 | 3713 | +0.036 | +135.08 | +1.64 | 0.05 | 0.252 | 40 | no |

## 4. Time of fill (descriptive)

| Window | Session (UTC) | n | Share | Gross R | Net R, D | Net R, P + 0.10 | Mean stop $ | Median M $ |
|---|---|---|---|---|---|---|---|---|
| 2007-26 | Asia | 985 | 26.5 % | +0.383 | +0.373 | +0.240 | 12.03 | 0.89 |
| 2007-26 | London | 1066 | 28.7 % | +0.113 | +0.105 | −0.007 | 10.81 | 0.91 |
| 2007-26 | New York | 1662 | 44.8 % | +0.047 | +0.041 | −0.057 | 12.79 | 1.35 |
| 2007-11 | Asia | 173 | 18.6 % | +0.599 | +0.589 | +0.334 | 7.68 | 0.62 |
| 2007-11 | London | 288 | 31.0 % | +0.179 | +0.173 | +0.007 | 8.66 | 0.79 |
| 2007-11 | New York | 468 | 50.4 % | +0.098 | +0.093 | −0.048 | 10.06 | 1.27 |
| 2021-26 | Asia | 346 | 30.9 % | +0.357 | +0.348 | +0.289 | 21.43 | 1.68 |
| 2021-26 | London | 299 | 26.7 % | −0.025 | −0.033 | −0.089 | 17.55 | 1.4 |
| 2021-26 | New York | 476 | 42.5 % | +0.041 | +0.034 | −0.019 | 20.87 | 2.04 |

## Reading

No rule was tested; the same 3713 pooled trades were charged under each cost assumption. Before costs T1 makes +0.155R a trade pooled 2007-26 (gross month t +7.24); it breaks even at $1.14 a round trip and keeps month t 2 up to $0.81 (8.18 bp / 5.85 bp of price). By window, t-2 cost: 2007-11 $0.81, 2012-15 $0.48, 2016-20 $0.19, 2021-26 $0.54. At the measured demo cost (0.42 bp of price, no slippage) pooled +0.147R (t +6.85); with 0.10 × M slippage +0.133R (t +6.18). At the studies' $0.60 +0.073R (t +3.35). Pessimistic by era with 0.10 × M +0.036R (t +1.64); 2007-11 +0.040R, 2016-20 −0.020R. Cautions, said plainly: the demo figure is one day of quotes on one demo account in November 2026 and carries no gold slippage measurement; it is applied to 2007-26 as a share of price, which assumes today's relative spread held then. At 2007 prices that share is about $0.03 a round trip, far under any retail gold spread of the time; the same figure in today's dollars (route D$) gives +0.141R (t +6.56). The era spreads are assumptions, not measurements. The thinnest window is 2016-20 (gross t +2.87, month t 2 only up to $0.19 a round trip): it is flat or negative at $0.60 and under P. Fills in Asia hours (985 of 3713) carry most of the gross (+0.383R a trade against +0.047R for New York fills), and Asia is where spreads are widest, which no route here charges separately. Whether T1 is worth anything therefore turns on the cost actually paid: an all-in round trip (slippage included) under $0.81 keeps the pooled month t over 2, under $0.48-0.54 keeps it in 2012-15 and 2021-26, and 2016-20 needs under $0.19. Nothing live changes; a forward paper record is the owner's decision.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy; 5206 weekdays built 2006-11-01 → 2026-11-12; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close
- Demo cost: council-data `ctrader/symbols.json` at 4400129e, XAUUSD median quoted spread $0.07 over 110 quotes 2026-11-12T23:08:51Z → 2026-11-13T21:58:59Z at $3884.75, plus commission 0.000024 of price a round trip: 0.42 bp of price. One day of quotes on one demo account; no slippage measured for gold.
- Route S: `council/fills.mjs` `spreadOf` spot $0.30 + `SLIP_SPREADS` 0.5 spread on each market order (stop entry, stop / time exit) = $0.60. Route P: spread $0.50 before 2012, $0.35 2012-19, $0.30 from 2020 (assumptions, not measured; no historical gold spread is in this repository) with the same slippage = $1.00 / $0.70 / $0.60.
- Financing: `FIN.xau.long` × `nights` on buys; every trade exits before the 22:00 UTC rollover, so 0.
- To repeat: `node research/edge/gold-vol-breakout-costs/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD from 2006-11, from the candle proxy, out of git).
