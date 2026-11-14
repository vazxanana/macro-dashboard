# Gold H1 Bollinger band fade in a quiet regime: result (2026-11-14)

**Verdict: FAIL, 0 of 3 pass: OOS 2017-26 net R a trade T1 −0.209 (n 1628, t −6.05), T2 −0.235 (n 411, t −3.01), T3 −0.228 (n 519, t −3.57).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday mean-reversion rule on spot gold, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- OANDA mid H1 XAU/USD 2006-03-19 to 2026-11-13 (125704 candles); M5 (1431423 candles from 2006-11-01) only to order a stop and a target inside an hour.
- Bollinger(20, 2, population sd) on H1 closes, ADX(14) and ATR(14) Wilder, all at the signal close. ADX under the cut and a close outside the band: sell above, buy below, at the next H1 open.
- Stop: the signal candle's extreme ± 0.5 × ATR(14). Target: the middle band at the signal close, fixed; skipped under 0.5R away. Out at the close of the 12th H1 candle, or at the first open after a closure. Stop first when one M5 candle holds both; an M5 open past the stop fills there. One position at a time.
- Costs: $0.60 a round trip; buys pay `FIN.xau.long` (0.000148 of price a rollover) per `nights()`; 2× = $1.20 and twice the financing. IS = entries 2007-16, OOS = entries 2017 to 31 Oct 2026.

## Results (R of the stop distance; t on calendar-month sums)

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Median 1R $ | Cost R | Cost share | t net | t gross | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 ADX < 20, any hour | IS 2007-16 | 1718 | −0.101 | −0.370 | −0.640 | 31.7 | −636.30 | −637.24 | 2.73 | +0.270 | n/a (gross ≤ 0) | −10.78 | −3.03 |  |  |
| T1 ADX < 20, any hour | OOS 2017-26 | 1628 | −0.007 | −0.209 | −0.411 | 33.3 | −340.52 | −343.00 | 3.6 | +0.202 | n/a (gross ≤ 0) | −6.05 | −0.20 | 1.0000 | no |
| T2 ADX < 20, signals 22:00-06:00 UTC | IS 2007-16 | 333 | −0.261 | −0.575 | −0.889 | 24.9 | −191.37 | −192.07 | 2.26 | +0.314 | n/a (gross ≤ 0) | −6.53 | −3.42 |  |  |
| T2 ADX < 20, signals 22:00-06:00 UTC | OOS 2017-26 | 411 | −0.030 | −0.235 | −0.441 | 29.2 | −96.73 | −96.73 | 3.49 | +0.206 | n/a (gross ≤ 0) | −3.01 | −0.38 | 1.0000 | no |
| T3 ADX < 15, any hour | IS 2007-16 | 509 | −0.121 | −0.421 | −0.721 | 31.2 | −214.39 | −216.06 | 2.39 | +0.300 | n/a (gross ≤ 0) | −5.61 | −1.68 |  |  |
| T3 ADX < 15, any hour | OOS 2017-26 | 519 | −0.024 | −0.228 | −0.432 | 32.4 | −118.38 | −123.72 | 3.5 | +0.204 | n/a (gross ≤ 0) | −3.57 | −0.38 | 1.0000 | no |

## Pass checks (all needed)

| Test | OOS t ≥ 2, Holm p ≤ 0.05 | IS net > 0 | OOS net at 2× > 0 | OOS n ≥ 200 | Placebo ≥ 38 of 40 |
|---|---|---|---|---|---|
| T1 | no | no | no | yes | no (8) |
| T2 | no | no | no | yes | no (6) |
| T3 | no | no | no | yes | no (17) |

## Placebo (40 seeds: the same OOS signal candles, the side at random, stop and target mirrored around the entry)

| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | −0.209 | −0.182 | −0.140 | −0.133 | 8 of 40 |
| T2 | −0.235 | −0.170 | −0.062 | −0.030 | 6 of 40 |
| T3 | −0.228 | −0.205 | −0.120 | −0.076 | 17 of 40 |

## By side (reported)

| Test | Side | IS n | IS gross | IS net | OOS n | OOS gross | OOS net | OOS t |
|---|---|---|---|---|---|---|---|---|
| T1 | buy | 850 | −0.079 | −0.354 | 744 | +0.035 | −0.172 | −3.13 |
| T1 | sell | 868 | −0.122 | −0.386 | 884 | −0.042 | −0.240 | −5.17 |
| T2 | buy | 153 | −0.329 | −0.623 | 179 | +0.041 | −0.165 | −1.37 |
| T2 | sell | 180 | −0.202 | −0.534 | 232 | −0.084 | −0.290 | −2.76 |
| T3 | buy | 254 | −0.027 | −0.333 | 233 | +0.043 | −0.168 | −1.55 |
| T3 | sell | 255 | −0.215 | −0.509 | 286 | −0.079 | −0.277 | −3.24 |

## OOS halves (reported)

| Test | 2017-21 n | net R | t | 2022-26 n | net R | t |
|---|---|---|---|---|---|---|
| T1 | 799 | −0.303 | −5.97 | 829 | −0.119 | −2.64 |
| T2 | 182 | −0.280 | −2.19 | 229 | −0.200 | −2.04 |
| T3 | 240 | −0.234 | −2.49 | 279 | −0.223 | −2.54 |

## By year (net R total, entries)

| Year | T1 n | T1 gross | T1 net | T2 n | T2 gross | T2 net | T3 n | T3 gross | T3 net |
|---|---|---|---|---|---|---|---|---|---|
| 2007 | 191 | −29.01 | −130.66 | 25 | −15.30 | −34.56 | 46 | −7.15 | −37.66 |
| 2008 | 161 | −34.06 | −67.24 | 16 | −4.06 | −8.30 | 49 | −16.68 | −29.16 |
| 2009 | 171 | −21.54 | −63.67 | 24 | −5.69 | −13.98 | 65 | −2.52 | −19.46 |
| 2010 | 179 | −5.13 | −51.78 | 29 | −10.87 | −19.98 | 52 | +3.95 | −10.86 |
| 2011 | 201 | +6.04 | −41.00 | 47 | −1.02 | −14.00 | 52 | +19.79 | +5.67 |
| 2012 | 195 | −42.24 | −84.59 | 35 | −17.63 | −26.62 | 50 | −19.45 | −31.02 |
| 2013 | 157 | −0.66 | −33.51 | 32 | +2.39 | −4.47 | 44 | −19.30 | −29.00 |
| 2014 | 170 | −26.82 | −71.85 | 42 | −22.73 | −34.05 | 61 | −16.95 | −35.31 |
| 2015 | 141 | −0.31 | −37.69 | 39 | −8.90 | −21.10 | 38 | −2.97 | −13.89 |
| 2016 | 152 | −19.04 | −54.32 | 44 | −2.99 | −14.30 | 52 | −0.43 | −13.70 |
| 2017 | 118 | −9.82 | −45.19 | 23 | −0.97 | −8.96 | 29 | +5.00 | −5.54 |
| 2018 | 162 | −7.33 | −61.05 | 34 | −12.10 | −24.35 | 52 | +4.03 | −13.62 |
| 2019 | 190 | +10.99 | −54.10 | 40 | +15.18 | −2.26 | 56 | −0.01 | −17.99 |
| 2020 | 165 | −13.00 | −39.71 | 47 | +3.09 | −5.75 | 46 | −11.30 | −19.10 |
| 2021 | 164 | −9.28 | −42.02 | 38 | −0.68 | −9.61 | 57 | +12.02 | +0.10 |
| 2022 | 149 | −11.76 | −38.20 | 27 | +3.92 | −1.48 | 42 | +0.06 | −8.29 |
| 2023 | 190 | +35.78 | −3.34 | 40 | +6.69 | −3.31 | 64 | −8.45 | −21.63 |
| 2024 | 189 | +7.99 | −19.75 | 39 | −5.95 | −11.34 | 60 | −0.52 | −10.13 |
| 2025 | 178 | +6.81 | −9.46 | 67 | −4.14 | −9.95 | 71 | −0.10 | −6.64 |
| 2026 | 123 | −21.81 | −27.71 | 56 | −17.27 | −19.73 | 42 | −13.37 | −15.52 |

- T1 funnel (2007-26): 4429 signal candles, 3346 trades; skipped: busy 1073, target under 0.5R 8, stop side 2, data end 0. Exits IS: stop 1087, target 409, time 165, gap 57; OOS: stop 1031, target 391, gap 63, time 143.
- T2 funnel (2007-26): 953 signal candles, 744 trades; skipped: busy 209, target under 0.5R 0, stop side 0, data end 0. Exits IS: stop 248, time 10, target 74, gap 1; OOS: stop 286, target 109, time 16.
- T3 funnel (2007-26): 1255 signal candles, 1028 trades; skipped: busy 220, target under 0.5R 4, stop side 3, data end 0. Exits IS: target 143, stop 338, time 21, gap 7; OOS: stop 332, target 135, time 36, gap 16.

## What this means

No test meets the pre-registered bar. Every stream loses before costs too: in sample the fade made −0.101R a trade gross on T1 (month t −3.03), out of sample −0.007R (t −0.20); the largest gross month t of any stream in either window is −0.20. The stop sits a median $3.6 from the entry out of sample, so the $0.60 round trip and the buys' financing cost 0.202R a trade on T1 and turn a flat stream into a steady loss. A quiet ADX does not make a close outside the band come back to the middle more often than chance: the rule does no better than the same trades with the side drawn at random (it beats 8, 6 and 17 of 40 seeds), and the Asian-hours and ADX < 15 versions are no better than T1. Not an edge; not a gate, filter, exit or size for any live system; no proposal. Nothing live changed.

## Repeat

`node research/edge/gold-h1-bb-fade/run.mjs <xau-h1.json> <xau-5m.json.gz>` (OANDA mid XAU_USD `[[t, o, h, l, c], ...]`, kept out of git).
