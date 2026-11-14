# RSI divergence at gold's swing highs and lows: result (2026-11-14)

**Verdict: FAIL, 0 of 3 pass: T1 (H4) made −0.094R a trade net out of sample (n 251, month t −1.36, Holm p 1.00), −0.017R in sample; T2 and T3 fail too.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone rule on spot gold that trades both sides, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44); none of that book's positions was read. Paper research only: nothing live changed and no proposal is written.

## Rule

- OANDA mid H1 XAU/USD, 2006-03-19 to 2026-11-13 (125704 H1 candles; Sunday UTC stub hours dropped; 32259 H4 candles built by UTC 4-hour bucket). Windows: IS 2007-16, OOS 2017 to 2026-10.
- Pivot = a high (low) beyond the 3 bars on each side, known 3 bars later. Bearish divergence: the new pivot high is above the previous pivot high 5-60 bars back while RSI(14) is lower there and that earlier RSI was at least 60 (T3: 70); bullish mirrors it (40 / 30).
- Entry at the next bar's open after the confirmation bar; stop 0.25 x ATR(14) beyond the new pivot; target 2R; out at the 30th bar's close; stop first when one bar holds both; one position at a time per test.
- Costs: $0.60 a round trip; buys pay `FIN.xau.long` (0.000148 of price a rollover) per `nights()`; 2× = $1.20 and twice the financing.

## Results (R of the stop distance; t on calendar-month sums of net R)

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Median 1R $ | t net | t gross | Holm p (OOS) | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 H4, RSI(P1) >= 60 / <= 40 | IS 2007-16 | 269 | +0.063 | −0.017 | −0.098 | 39.4 | −4.70 | −36.08 | 11.07 | −0.20 | 0.73 |  |  |
| T1 H4, RSI(P1) >= 60 / <= 40 | OOS 2017-26 | 251 | −0.026 | −0.094 | −0.162 | 36.7 | −23.59 | −29.31 | 15.4 | −1.36 | −0.37 | 1.0000 | no |
| T2 H1, same rule | IS 2007-16 | 837 | +0.024 | −0.105 | −0.235 | 39.1 | −88.21 | −94.79 | 6.34 | −2.44 | 0.57 |  |  |
| T2 H1, same rule | OOS 2017-26 | 844 | +0.010 | −0.102 | −0.215 | 38.4 | −86.38 | −98.95 | 7.97 | −2.53 | 0.26 | 1.0000 | no |
| T3 H4, RSI(P1) >= 70 / <= 30 | IS 2007-16 | 152 | +0.009 | −0.075 | −0.159 | 38.2 | −11.39 | −24.08 | 10.71 | −0.67 | 0.08 |  |  |
| T3 H4, RSI(P1) >= 70 / <= 30 | OOS 2017-26 | 122 | +0.054 | −0.011 | −0.077 | 41.0 | −1.36 | −11.25 | 16.16 | −0.11 | 0.54 | 1.0000 | no |

## By side (net R a trade, month t)

| Test | Side | IS n | IS net R | IS t | OOS n | OOS net R | OOS t |
|---|---|---|---|---|---|---|---|
| T1 | buy | 109 | −0.005 | −0.04 | 110 | −0.144 | −1.36 |
| T1 | sell | 160 | −0.026 | −0.22 | 141 | −0.055 | −0.56 |
| T2 | buy | 354 | −0.101 | −1.67 | 368 | −0.031 | −0.48 |
| T2 | sell | 483 | −0.109 | −1.66 | 476 | −0.157 | −3.03 |
| T3 | buy | 61 | −0.064 | −0.38 | 44 | −0.167 | −1.02 |
| T3 | sell | 91 | −0.082 | −0.54 | 78 | +0.076 | 0.56 |

## OOS halves (reported)

| Test | 2017-21 n | net R | t | 2022-26 n | net R | t |
|---|---|---|---|---|---|---|
| T1 | 131 | −0.140 | −1.47 | 120 | −0.044 | −0.43 |
| T2 | 441 | −0.200 | −3.61 | 403 | +0.004 | 0.08 |
| T3 | 60 | −0.082 | −0.58 | 62 | +0.057 | 0.40 |

## Placebo (40 seeds: each OOS trade moved to a random OOS bar, same side and stop distance in ATR units, same exits and costs)

| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | −0.094 | −0.066 | +0.060 | +0.120 | 17 of 40 |
| T2 | −0.102 | −0.118 | −0.050 | −0.013 | 23 of 40 |
| T3 | −0.011 | −0.114 | +0.081 | +0.122 | 30 of 40 |

## Pass checks (all needed: OOS net > 0; OOS t ≥ 2 and Holm p ≤ 0.05; IS net > 0; positive at 2× costs; beats ≥ 38 of 40 placebos; OOS n ≥ 30)

| Test | OOS > 0 | t / Holm | IS > 0 | 2× costs | Placebo | n |
|---|---|---|---|---|---|---|
| T1 | no | no | no | no | no | yes |
| T2 | no | no | no | no | no | yes |
| T3 | no | no | no | no | no | yes |

- T1 funnel: 568 signals, 520 trades; skipped: busy 48, stop too close 0, stop side 0, data end 0. Exits IS: time 39, target 76, stop 154; OOS: stop 142, target 59, time 50.
- T2 funnel: 1854 signals, 1681 trades; skipped: busy 172, stop too close 0, stop side 1, data end 0. Exits IS: stop 438, target 200, time 199; OOS: time 196, stop 450, target 198.
- T3 funnel: 286 signals, 274 trades; skipped: busy 12, stop too close 0, stop side 0, data end 0. Exits IS: time 23, stop 90, target 39; OOS: stop 65, target 30, time 27.

| Year | T1 n | T1 net R | T2 n | T2 net R | T3 n | T3 net R |
|---|---|---|---|---|---|---|
| 2007 | 27 | +10.54 | 75 | −3.40 | 14 | +9.57 |
| 2008 | 29 | +2.92 | 93 | −12.53 | 15 | −1.01 |
| 2009 | 27 | +3.64 | 65 | +2.67 | 12 | −1.62 |
| 2010 | 29 | +4.47 | 88 | −19.66 | 17 | −8.07 |
| 2011 | 30 | −2.11 | 100 | −15.17 | 21 | −2.16 |
| 2012 | 24 | +1.57 | 85 | +28.36 | 12 | +5.18 |
| 2013 | 27 | +1.35 | 89 | −37.91 | 14 | +0.71 |
| 2014 | 28 | −13.90 | 90 | −12.05 | 15 | −7.15 |
| 2015 | 23 | −8.53 | 70 | −11.54 | 17 | −2.96 |
| 2016 | 25 | −4.66 | 82 | −6.98 | 15 | −3.89 |
| 2017 | 30 | −12.50 | 110 | −28.68 | 16 | −4.74 |
| 2018 | 29 | −6.94 | 78 | −17.26 | 11 | −2.84 |
| 2019 | 27 | +3.27 | 75 | −18.26 | 11 | +0.96 |
| 2020 | 15 | +0.19 | 88 | −9.40 | 6 | +0.75 |
| 2021 | 30 | −2.38 | 90 | −14.50 | 16 | +0.96 |
| 2022 | 30 | +1.48 | 77 | +6.27 | 14 | −1.22 |
| 2023 | 30 | −5.33 | 80 | +1.09 | 15 | +0.62 |
| 2024 | 21 | +2.20 | 93 | +7.73 | 9 | +3.62 |
| 2025 | 23 | −1.35 | 80 | +2.52 | 16 | −0.08 |
| 2026 | 16 | −2.25 | 73 | −15.89 | 8 | +0.61 |

## What this means

No test meets the pre-registered bar. Before costs the largest out-of-sample gross month t is 0.54: a new swing high (low) that RSI fails to confirm is not followed by a reversal often enough to pay a 2R trade with the stop past the swing. The placebo keeps the buy / sell mix and the stop size, so it carries the same drift and the same costs; the seeds beaten say how the rule compares with random bars, not that it makes money when its own net R is not positive. Not an edge; not a gate, filter, exit or size for any live system; no proposal. Nothing live changed.

## Repeat

`node research/edge/gold-rsi-divergence/run.mjs <xau-h1.json>` (OANDA mid H1 XAU_USD `[[t, o, h, l, c], ...]`, kept out of git).
