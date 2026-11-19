# Gold H1 Vortex crossover, against gold's own drift: result (2026-11-14)

**Verdict: FAIL, 0 of 3 pass: OOS 2017-26 net R a trade T1 −0.075 (n 2330, t −2.09), T2 −0.061 (n 1469, t −1.49), T3 −0.029 (n 1993, t −0.70).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday rule on spot gold, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- OANDA mid H1 XAU/USD 2006-03-19 to 2026-11-13 (125704 candles).
- Vortex(N): VI+ = Σ|high − previous low| / ΣTR, VI− = Σ|low − previous high| / ΣTR over the last N candles. A cross (the sign of VI+ − VI− changes) buys or sells at the next H1 open.
- Stop 1.5 × ATR(14) Wilder from the entry, no target, out at the close of the 24th H1 candle (or at the first open after a closure). An open past the stop fills there. One position at a time; a cross met while in a trade is skipped.
- Costs: $0.60 a round trip; buys pay `FIN.xau.long` (0.000148 of price a rollover) per `nights()`; 2× = $1.20 and twice the financing. IS = entries 2007-16, OOS = entries 2017 to 31 Oct 2026.
- Excess = a trade's net R minus the mean net R of the same-side trade (same stop, hold and costs) entered on every eligible H1 candle of its month: what the turn adds over gold's own drift.

## Results (R of the stop distance; t on calendar-month sums)

| Test | Window | n | Gross R | Net R | Net at 2× | Excess R | t excess | Win % | Total net R | Worst DD R | Median 1R $ | Cost R | t net | t gross | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Vortex(14), both sides | IS 2007-16 | 2633 | +0.040 | −0.107 | −0.254 | +0.025 | 0.97 | 31.6 | −281.53 | −294.39 | 4.88 | +0.147 | −3.33 | 1.32 |  |  |
| T1 Vortex(14), both sides | OOS 2017-26 | 2330 | +0.045 | −0.075 | −0.195 | +0.057 | 1.89 | 32.7 | −174.61 | −221.88 | 6.49 | +0.120 | −2.09 | 1.29 | 1.0000 | no |
| T2 Vortex(42), both sides | IS 2007-16 | 1574 | +0.169 | +0.020 | −0.129 | +0.128 | 2.88 | 33.2 | +31.58 | −69.78 | 4.79 | +0.149 | 0.41 | 3.56 |  |  |
| T2 Vortex(42), both sides | OOS 2017-26 | 1469 | +0.058 | −0.061 | −0.179 | +0.058 | 1.58 | 32.5 | −88.95 | −118.17 | 6.38 | +0.119 | −1.49 | 1.45 | 1.0000 | no |
| T3 Vortex(14), buys only | IS 2007-16 | 2222 | +0.055 | −0.104 | −0.264 | −0.003 | −0.14 | 31.9 | −231.76 | −262.37 | 4.94 | +0.160 | −2.71 | 1.44 |  |  |
| T3 Vortex(14), buys only | OOS 2017-26 | 1993 | +0.108 | −0.029 | −0.165 | +0.019 | 0.75 | 33.2 | −56.92 | −151.30 | 6.41 | +0.137 | −0.70 | 2.76 | 1.0000 | no |

## Pass checks (all needed)

| Test | OOS t ≥ 2, Holm p ≤ 0.05 | IS net > 0 | OOS net at 2× > 0 | OOS excess > 0, t ≥ 2 | Placebo ≥ 38 of 40 | OOS n ≥ 200 |
|---|---|---|---|---|---|---|
| T1 | no | no | no | no | no (29) | yes |
| T2 | no | yes | no | no | no (28) | yes |
| T3 | no | no | no | no | no (18) | yes |

## Placebo (40 seeds: each OOS signal moved to a random eligible OOS H1 candle, side kept, one at a time)

| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | −0.075 | −0.096 | −0.050 | −0.025 | 29 of 40 |
| T2 | −0.061 | −0.080 | −0.028 | −0.007 | 28 of 40 |
| T3 | −0.029 | −0.029 | +0.005 | +0.021 | 18 of 40 |

## By side (reported)

| Test | Side | IS n | IS net | IS excess | OOS n | OOS gross | OOS net | OOS excess | OOS t |
|---|---|---|---|---|---|---|---|---|---|
| T1 | buy | 1288 | −0.094 | +0.039 | 1147 | +0.153 | +0.016 | +0.096 | 0.30 |
| T1 | sell | 1345 | −0.119 | +0.013 | 1183 | −0.060 | −0.163 | +0.019 | −3.19 |
| T2 | buy | 774 | +0.035 | +0.151 | 743 | +0.083 | −0.055 | +0.017 | −0.95 |
| T2 | sell | 800 | +0.006 | +0.105 | 726 | +0.033 | −0.066 | +0.101 | −1.07 |
| T3 | buy | 2222 | −0.104 | −0.003 | 1993 | +0.108 | −0.029 | +0.019 | −0.70 |

## OOS halves (reported)

| Test | 2017-21 n | net R | excess R | t | 2022-26 n | net R | excess R | t |
|---|---|---|---|---|---|---|---|---|
| T1 | 1180 | −0.148 | +0.022 | −3.20 | 1150 | 0.000 | +0.094 | 0.00 |
| T2 | 760 | −0.129 | +0.027 | −2.37 | 709 | +0.013 | +0.092 | 0.21 |
| T3 | 1009 | −0.088 | +0.020 | −1.82 | 984 | +0.032 | +0.017 | 0.50 |

## By year (net and excess R totals, entries)

| Year | T1 n | T1 net | T1 excess | T2 n | T2 net | T2 excess | T3 n | T3 net | T3 excess |
|---|---|---|---|---|---|---|---|---|---|
| 2007 | 266 | −25.52 | +22.79 | 153 | −40.66 | −8.97 | 217 | +10.83 | +20.75 |
| 2008 | 272 | −17.49 | −17.51 | 143 | +54.75 | +55.37 | 228 | −16.30 | −15.72 |
| 2009 | 257 | −33.18 | +9.97 | 164 | +12.83 | +34.92 | 212 | −6.16 | −12.50 |
| 2010 | 268 | −68.04 | −19.89 | 174 | −22.16 | +4.16 | 227 | −24.90 | −16.66 |
| 2011 | 328 | −75.47 | −30.30 | 166 | +13.72 | +21.27 | 263 | +1.18 | −9.68 |
| 2012 | 261 | −13.71 | +11.49 | 164 | +63.68 | +83.01 | 230 | −53.86 | −18.02 |
| 2013 | 246 | +23.61 | +36.90 | 159 | −21.14 | −15.52 | 212 | −48.45 | +4.99 |
| 2014 | 243 | −4.33 | +32.85 | 148 | −18.69 | −5.66 | 210 | −33.56 | +8.99 |
| 2015 | 257 | −53.75 | −7.08 | 154 | −19.75 | +1.14 | 226 | −48.67 | +7.32 |
| 2016 | 235 | −13.65 | +27.78 | 149 | +8.99 | +31.30 | 197 | −11.85 | +23.06 |
| 2017 | 223 | −44.60 | −8.22 | 135 | −2.38 | +18.75 | 197 | −16.71 | +5.18 |
| 2018 | 253 | −65.53 | +4.85 | 161 | −28.34 | +9.46 | 200 | −41.15 | +18.26 |
| 2019 | 236 | −25.32 | +27.90 | 161 | −38.32 | −6.08 | 211 | −22.61 | −5.29 |
| 2020 | 222 | +0.15 | +8.66 | 136 | +0.19 | +7.90 | 193 | +13.08 | −11.78 |
| 2021 | 246 | −39.23 | −7.21 | 167 | −29.08 | −9.60 | 208 | −21.45 | +13.46 |
| 2022 | 249 | +17.35 | +46.27 | 160 | −6.03 | +18.02 | 204 | −8.54 | +12.16 |
| 2023 | 254 | −19.67 | +20.51 | 136 | +18.05 | +33.82 | 223 | −11.05 | +7.23 |
| 2024 | 240 | −28.60 | −5.26 | 149 | +2.36 | +13.19 | 208 | +7.31 | −12.89 |
| 2025 | 229 | −8.52 | +10.71 | 140 | −5.51 | +3.39 | 197 | +43.08 | +7.68 |
| 2026 | 178 | +39.35 | +35.40 | 124 | +0.11 | −3.17 | 152 | +1.13 | +3.02 |

- T1 funnel (2007-26): 12551 crosses, 4963 trades; skipped while in a trade 7588, data end 0. Exits IS: stop 1608, time 780, gap 245; OOS: stop 1392, time 694, gap 244.
- T2 funnel (2007-26): 6369 crosses, 3043 trades; skipped while in a trade 3326, data end 0. Exits IS: stop 947, time 487, gap 140; OOS: stop 857, time 444, gap 168.
- T3 funnel (2007-26): 6284 crosses, 4215 trades; skipped while in a trade 2069, data end 0. Exits IS: stop 1331, time 654, gap 237; OOS: stop 1188, time 589, gap 216.

## What this means

The primary test does not meet the pre-registered bar, nor does any other. Before costs the Vortex turn made +0.045R a trade out of sample on T1 (month t 1.29) and +0.040R in sample (t 1.32); against the same-side trade on every hour of the month it adds +0.057R (t 1.89) out of sample and +0.025R (t 0.97) in sample. The stop sits a median $6.49 from the entry out of sample, so the round trip and the buys' financing cost 0.120R a trade. The same signals moved to random hours: T1 beats 29 of 40 seeds, T2 28, T3 18. Not an edge; not a gate, filter, exit or size for any live system; no proposal. Nothing live changed.

## Repeat

`node research/edge/gold-h1-vortex/run.mjs <xau-h1.json>` (OANDA mid XAU_USD H1 `[[t, o, h, l, c], ...]`, kept out of the repository).
