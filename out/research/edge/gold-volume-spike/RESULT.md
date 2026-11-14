# Gold activity spike: does an abnormal-activity H1 candle continue or reverse? Result (14 Nov 2026)

**Verdict: FAIL, 0 of 3 pass: OOS 2021-now net R a trade, continuation −0.054 (n 515, t −0.85), reversal −0.363 (t −2.65), strong-close +0.061 (t +1.02).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday rule on spot
gold, not a gate, exit, entry or size of the gold book; no candle before 2016 (docs/owner-decisions.md item 44). Paper research
only: nothing live changed and no proposal is written. Volume is OANDA's tick count (price updates), a proxy for activity.

## Rule (as pre-registered)

- OANDA mid XAU/USD M5 with tick volume (`fetch.mjs`), from 2016-01-01: 770445 M5 candles, 64181 H1 candles (UTC hours with 10+ M5 candles), 63721 with a 20-day baseline.
- Spike = H1 volume over 3x the median of the same New York hour on the 20 earlier days: 2522 spikes (1541 in 2016-20, 981 in 2021-now); 706 closed in the top quarter and 590 in the bottom quarter of their range (all eligible candles: 50.3 % in an outer quarter).
- Entry at the next M5 open (within 15 min of the hour's end), stop $0.30 past the spike candle's far extreme for the side (≥ $1 away), out after 4 hours; one position at a time per test.
- T1: with the candle's direction. T2: against an outer-quarter close (sell a top-quarter close, stop above its high). T3: with an outer-quarter close (buy a top-quarter close, stop under its low).
- Costs: $0.30 spread + $0.15 slippage on entry and on exit ($0.60 a trade; 2× = $1.20); buys pay `FIN.xau.long` per `nights()` rollover.

## Results (R of the stop distance; t on calendar-month sums of net R)

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Median stop $ | t net | t gross | Holm p (OOS) | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 continuation (all) | IS 2016-20 | 841 | −0.009 | −0.155 | −0.295 | 37.6 | −129.97 | −138.12 | 5.61 | −3.89 | −0.25 |  |  |
| T1 continuation (all) | OOS 2021-now | 515 | +0.061 | −0.054 | −0.162 | 39.0 | −27.93 | −56.04 | 8.36 | −0.85 | +0.79 | 1.0000 | no |
| T2 reversal (outer close) | IS 2016-20 | 394 | +0.285 | −0.072 | −0.420 | 25.9 | −28.48 | −73.61 | 1.77 | −0.53 | +2.02 |  |  |
| T2 reversal (outer close) | OOS 2021-now | 307 | −0.050 | −0.363 | −0.664 | 20.2 | −111.30 | −115.12 | 2.13 | −2.65 | −0.44 | 1.0000 | no |
| T3 continuation (outer close) | IS 2016-20 | 531 | −0.062 | −0.172 | −0.278 | 37.5 | −91.46 | −101.36 | 6.90 | −4.86 | −2.03 |  |  |
| T3 continuation (outer close) | OOS 2021-now | 339 | +0.147 | +0.061 | −0.018 | 44.5 | +20.64 | −20.15 | 10.21 | +1.02 | +2.06 | 0.4617 | no |

## Placebo (40 seeds: random non-spike OOS H1 candles of the same New York hour and class, same side and stop rule)

| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | −0.054 | −0.218 | −0.149 | −0.054 | 40 of 40 |
| T2 | −0.363 | −0.228 | +0.077 | +0.181 | 7 of 40 |
| T3 | +0.061 | −0.167 | −0.040 | −0.005 | 40 of 40 |

## Pass checks (all needed: OOS t ≥ 2 and Holm p ≤ 0.05, IS net > 0, OOS net at 2× costs > 0, above the placebo 95th percentile, OOS n ≥ 100)

| Test | t / Holm | IS sign | 2× costs | Placebo | n |
|---|---|---|---|---|---|
| T1 | no | no | no | yes | yes |
| T2 | no | no | no | no | yes |
| T3 | no | no | no | yes | yes |

## Releases, reported both ways (not a test; 49 spike candles hold a CPI / NFP / FOMC time; tags cover CPI from 2018 with gaps, NFP and FOMC from 2022)

| Test | OOS all: n, net R, t | OOS untagged (re-run): n, net R, t | OOS tagged: n, net R, t |
|---|---|---|---|
| T1 | 515, −0.054, −0.85 | 493, −0.056, −0.87 | 43, +0.041, +0.31 |
| T2 | 307, −0.363, −2.65 | 284, −0.383, −2.60 | 28, −0.244, −0.74 |
| T3 | 339, +0.061, +1.02 | 322, +0.046, +0.73 | 32, +0.194, +1.34 |

## Reported, not tested

Exits and signals not traded:

- T1: IS {"time":574,"stop":266,"gap":1}; OOS {"time":326,"stop":189}; not traded {"no prompt next open":107,"position open":1028,"stop under $1":31}
- T2: IS {"stop":273,"time":121}; OOS {"stop":237,"time":69,"gap":1}; not traded {"stop under $1":476,"position open":68,"no prompt next open":51}
- T3: IS {"time":394,"stop":135,"gap":2}; OOS {"time":251,"stop":88}; not traded {"position open":375,"no prompt next open":51}

Spikes by New York hour of the candle's start: 00h 105, 01h 86, 02h 89, 03h 69, 04h 99, 05h 92, 06h 92, 07h 104, 08h 114, 09h 53, 10h 61, 11h 74, 12h 112, 13h 111, 14h 226, 15h 173, 16h 107, 18h 186, 19h 136, 20h 97, 21h 112, 22h 105, 23h 119.

Net R a trade by year (n):

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2016 | −0.119 (205) | +0.229 (101) | −0.125 (126) |
| 2017 | −0.155 (173) | +0.134 (48) | −0.222 (100) |
| 2018 | −0.294 (100) | −0.731 (34) | −0.078 (59) |
| 2019 | −0.222 (139) | +0.136 (63) | −0.255 (94) |
| 2020 | −0.082 (224) | −0.282 (148) | −0.164 (152) |
| 2021 | −0.108 (86) | −0.328 (49) | −0.054 (56) |
| 2022 | +0.043 (164) | −0.502 (90) | +0.161 (111) |
| 2023 | −0.205 (82) | −0.659 (50) | −0.007 (58) |
| 2024 | −0.246 (52) | +0.420 (33) | −0.206 (36) |
| 2025 | −0.124 (83) | −0.160 (51) | +0.065 (50) |
| 2026 | +0.295 (48) | −0.672 (34) | +0.369 (28) |

## Reading

Before costs the three streams make +0.061R (T1), −0.050R (T2) and +0.147R (T3) a trade out of sample.
T2 and T3 take opposite sides of the same outer-quarter spikes (with different stops), so their gross figures say which way an
abnormal-activity candle with a decisive close tends to go over the next four hours. Before costs, T2 is +0.285R in 2016-20 and −0.050R in 2021-now,
T3 −0.062R and +0.147R: the direction flipped between the two windows, so neither reading is stable. The costs, on a stop the size of an
abnormal H1 candle, decide the net. Not an edge; never use an H1 activity spike as a filter, gate or bias for a council system on this evidence.
Any follow-up needs its own pre-registration on other data.

To repeat: `node --use-env-proxy research/edge/gold-volume-spike/fetch.mjs <dir>`, then `node research/edge/gold-volume-spike/run.mjs <dir>`.
Tests: `tests/gold-volume-spike.test.mjs`.
