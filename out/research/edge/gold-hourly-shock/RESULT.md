# Gold after a return shock on one H1 candle: fade or follow? Result (2026-11-14)

**Verdict: FAIL, 0 of 3 pass: OOS 2017-now net R a trade T1 −0.349 (n 1051, t −5.56), T2 −0.103 (n 937, t −1.88), T3 −0.345 (n 949, t −5.21).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday rule on spot gold, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.

## Data and events

- OANDA mid H1 XAU/USD, 2006-03-19 to 2026-11-13, 125704 candles. Shock = a candle whose close-to-close log return is beyond 3 x the sd of the 500 previous non-gap H1 returns (no return across a closure of over 6 h counts).
- Shocks from 2008: 2151 (999 up), IS 2008-16 1079, OOS 2017-now 1072; 179 contain a CPI, payrolls or FOMC release minute (557 release minutes listed; CPI 2008-11 is not in the repository, so those hours are not tagged).
- Entry at the next H1 open; T1 / T3 stop $0.30 beyond the shock extreme, target its 50%; T2 stop at its 50%, no target; out at the 6th candle's close; stop first when a candle holds both; one position at a time per test.
- Costs: $0.60 a round trip; buys pay `FIN.xau.long` (0.000148 of price a rollover) per `nights()`; 2× = $1.20 and twice the financing. A stop or target inside a candle is stamped at the candle's end for the financing count (a rollover in that hour is charged).

## Results (R of the stop distance; t on calendar-month sums of net R)

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Median 1R $ | t net | t gross | Holm p (OOS) | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 fade (against the shock, target the 50%) | IS 2008-16 | 1041 | −0.020 | −0.422 | −0.824 | 33.0 | −439.45 | −444.16 | 2.22 | −7.48 | −0.37 |  |  |
| T1 fade (against the shock, target the 50%) | OOS 2017-now | 1051 | +0.069 | −0.349 | −0.768 | 29.7 | −367.02 | −381.33 | 2.11 | −5.56 | 1.10 | 1.0000 | no |
| T2 follow (with the shock, stop at the 50%) | IS 2008-16 | 933 | +0.085 | −0.071 | −0.226 | 34.7 | −65.83 | −96.54 | 4.47 | −1.16 | 1.43 |  |  |
| T2 follow (with the shock, stop at the 50%) | OOS 2017-now | 937 | +0.029 | −0.103 | −0.234 | 34.3 | −96.17 | −111.24 | 5.92 | −1.88 | 0.53 | 1.0000 | no |
| T3 fade, non-release shocks only | IS 2008-16 | 966 | +0.004 | −0.404 | −0.811 | 33.6 | −390.04 | −395.08 | 2.15 | −6.89 | 0.06 |  |  |
| T3 fade, non-release shocks only | OOS 2017-now | 949 | +0.084 | −0.345 | −0.775 | 29.7 | −327.71 | −341.73 | 1.99 | −5.21 | 1.29 | 1.0000 | no |

## OOS halves

| Test | 2017-21 n | net R | t | 2022-now n | net R | t |
|---|---|---|---|---|---|---|
| T1 | 500 | −0.397 | −4.67 | 551 | −0.306 | −3.32 |
| T2 | 448 | −0.170 | −2.28 | 489 | −0.041 | −0.52 |
| T3 | 450 | −0.370 | −4.23 | 499 | −0.323 | −3.26 |

## Placebo (40 seeds: random OOS H1 candles of the same UTC hour, |z| from the 95th percentile (2.055) up to 3, same rule)

| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | −0.349 | −0.539 | −0.499 | −0.488 | 40 of 40 |
| T2 | −0.103 | −0.166 | −0.116 | −0.090 | 39 of 40 |
| T3 | −0.345 | −0.552 | −0.490 | −0.456 | 40 of 40 |

## Pass checks (all needed: OOS net > 0; OOS t ≥ 2 and Holm p ≤ 0.05; IS and both OOS halves positive; positive at 2× costs; beats ≥ 38 of 40 placebos; OOS n ≥ 30)

| Test | OOS > 0 | t / Holm | Halves | 2× costs | Placebo | n |
|---|---|---|---|---|---|---|
| T1 | no | no | no | no | yes | yes |
| T2 | no | no | no | no | yes | yes |
| T3 | no | no | no | no | yes | yes |

## Reported, not tested

| Stream | Shocks | IS n | IS net R | IS t | OOS n | OOS net R | OOS t |
|---|---|---|---|---|---|---|---|
| T1 trades of the stream | release only | 75 | −0.659 | −4.39 | 102 | −0.385 | −1.76 |
| T1 trades of the stream | non-release only | 966 | −0.404 | −6.89 | 949 | −0.345 | −5.21 |
| T2 trades of the stream | release only | 74 | +0.257 | 1.30 | 100 | −0.231 | −2.16 |
| T2 trades of the stream | non-release only | 859 | −0.099 | −1.56 | 837 | −0.087 | −1.47 |
| T3, broad tag (no weekday 08:00 New York hour) | own stream | 828 | −0.375 | −5.66 | 801 | −0.289 | −3.70 |

The release split takes the trades of each one-at-a-time stream and splits them by the shock's tag; T3 is the non-release stream run on its own.

- T1 funnel: 2151 shocks, 2092 trades; skipped: busy 0, stop too close 39, stop side 2, target passed 18, data end 0. Exits IS: stop 668, target 328, time 38, gap 7; OOS: stop 725, target 297, gap 5, time 24.
- T2 funnel: 2151 shocks, 1870 trades; skipped: busy 268, stop too close 2, stop side 11, target passed 0, data end 0. Exits IS: time 449, stop 464, gap 20; OOS: time 413, stop 500, gap 24.
- T3 funnel: 1972 shocks, 1915 trades; skipped: busy 0, stop too close 38, stop side 2, target passed 17, data end 0. Exits IS: stop 613, target 312, time 34, gap 7; OOS: stop 656, target 270, gap 5, time 18.

| Year | T1 n | T1 net R | T2 n | T2 net R | T3 n | T3 net R |
|---|---|---|---|---|---|---|
| 2008 | 110 | −20.72 | 102 | +17.60 | 104 | −18.26 |
| 2009 | 100 | −59.07 | 92 | −4.15 | 96 | −53.18 |
| 2010 | 106 | −53.64 | 94 | +2.39 | 99 | −53.88 |
| 2011 | 155 | −54.39 | 132 | −31.92 | 150 | −48.48 |
| 2012 | 92 | −14.49 | 88 | −20.89 | 85 | −9.77 |
| 2013 | 142 | −72.88 | 122 | +26.53 | 128 | −64.52 |
| 2014 | 126 | −45.22 | 115 | −24.26 | 119 | −43.10 |
| 2015 | 108 | −56.68 | 99 | −4.53 | 94 | −44.32 |
| 2016 | 102 | −62.36 | 89 | −26.60 | 91 | −54.54 |
| 2017 | 84 | −59.14 | 80 | −17.33 | 72 | −48.04 |
| 2018 | 96 | −52.18 | 88 | −27.58 | 88 | −45.56 |
| 2019 | 100 | −49.61 | 92 | −18.14 | 87 | −52.17 |
| 2020 | 122 | −1.00 | 103 | −6.29 | 118 | +2.87 |
| 2021 | 98 | −36.57 | 85 | −6.67 | 85 | −23.56 |
| 2022 | 114 | −18.45 | 102 | +6.40 | 101 | −13.18 |
| 2023 | 128 | −46.90 | 109 | +15.88 | 117 | −60.48 |
| 2024 | 98 | −61.45 | 87 | −18.28 | 87 | −57.15 |
| 2025 | 106 | −5.84 | 98 | −31.12 | 99 | −0.91 |
| 2026 | 105 | −35.86 | 93 | +6.95 | 95 | −29.52 |

Shocks by UTC hour (2008-now): 0h 38, 1h 71, 2h 25, 3h 8, 4h 12, 5h 29, 6h 46, 7h 46, 8h 58, 9h 43, 10h 36, 11h 56, 12h 297, 13h 370, 14h 353, 15h 227, 16h 106, 17h 80, 18h 99, 19h 87, 20h 22, 21h 2, 22h 21, 23h 19.

## What this means

No test meets the pre-registered bar. Before costs the three streams sit within about 0.1R of zero in both windows (largest gross month t 1.43): after a 3-sd hour gold neither reliably gives back half the candle nor runs on over the next six hours. The fade's stop sits about $2 from the entry, so the $0.60 round trip alone costs it 0.3-0.4R a trade (gross minus net in the table), and the loss is that cost. The placebo "beats" only say the rule loses less than the same rule on random large hours of the same clock hour (whose stops are tighter still); they are not evidence of an edge when the rule itself loses. The one positive line, T2 on release shocks in sample (n 74, t 1.30), reverses out of sample and was not a test. Not an edge; not a gate, filter, exit or size for any live system; no proposal. Nothing live changed.

## Repeat

`node research/edge/gold-hourly-shock/run.mjs <xau-h1.json>` (OANDA mid H1 XAU_USD `[[t, o, h, l, c], ...]`, kept out of git).
