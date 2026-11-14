# Gold session VWAP: fade, follow or pull back? Result (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests pass: fading the 2 sd close to VWAP made −0.310R a trade net out of sample (2021-now, n 1061, month t −4.97); follow and pullback failed too.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday rule on spot
gold, not a gate, exit, entry or size of the gold book; no candle before 2016 (docs/owner-decisions.md item 44). Paper research
only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- OANDA mid XAU/USD M5 with OANDA tick volume, through the candle proxy (`fetch.mjs`), 2016-01-01 to 2026-11-13.
- Trading day = 18:00 New York the day before → 16:00 New York; a day with any CME-shut candle (`ict/calendar.mjs`) or under 150 candles is skipped: 2714 days kept (122 CME-shut, 0 thin).
- VWAP = Σ v·(H+L+C)/3 ÷ Σ v from the 18:00 anchor; sd = volume-weighted standard deviation of the typical price around it; both from candles closed at or before the signal.
- Signals on M5 closes ending 03:00-15:00 New York, first signal of the day only, out by 16:00 New York; every trade has a fixed stop (≥ $1 away).
- T1 fade: close beyond ±2 sd → against it at the next open, target a limit at VWAP, stop at the 3 sd band. T2 follow: with it, stop at the 1 sd band, out at 16:00. T3 pullback: after a close beyond ±1.5 sd, a limit at the last VWAP in the excursion's direction, stop 1 sd, target 1.5 sd.
- Costs: $0.30 spread round trip + $0.15 slippage per market order (market entry, stop, time exit; a limit entry or target pays none); no financing (flat before the 17:00 rollover). 2× costs doubles both.

## Results (R of the stop distance; t on calendar-month sums of net R)

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | t net | t gross | Holm p (OOS) | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 fade (primary) | IS 2016-20 | 599 | +0.083 | −0.252 | −0.588 | 30.6 | −151.21 | −157.55 | −3.91 | +1.30 |  |  |
| T1 fade (primary) | OOS 2021-now | 1061 | −0.079 | −0.310 | −0.540 | 25.3 | −328.42 | −362.71 | −4.97 | −1.33 | 1.0000 | no |
| T2 follow | IS 2016-20 | 1011 | +0.072 | −0.228 | −0.528 | 22.3 | −230.17 | −284.14 | −3.08 | +1.00 |  |  |
| T2 follow | OOS 2021-now | 1345 | +0.038 | −0.138 | −0.314 | 22.2 | −185.39 | −253.05 | −1.96 | +0.56 | 1.0000 | no |
| T3 pullback | IS 2016-20 | 920 | −0.059 | −0.256 | −0.453 | 38.4 | −235.41 | −249.12 | −6.60 | −1.59 |  |  |
| T3 pullback | OOS 2021-now | 1177 | +0.006 | −0.113 | −0.233 | 41.7 | −133.55 | −172.20 | −3.07 | +0.18 | 1.0000 | no |

## Placebo (40 seeds, random side on the same signals, exits mirrored around the same entry, out of sample)

| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | −0.310 | −0.285 | −0.222 | −0.202 | 7 of 40 |
| T2 | −0.138 | −0.178 | −0.088 | −0.023 | 36 of 40 |
| T3 | −0.113 | −0.193 | −0.143 | −0.130 | 40 of 40 |

## Pass checks (all needed: OOS t ≥ 2 and Holm p ≤ 0.05, IS net > 0, OOS net at 2× costs > 0, above the placebo 95th percentile, OOS n ≥ 100)

| Test | t / Holm | IS sign | 2× costs | Placebo | n |
|---|---|---|---|---|---|
| T1 | no | no | no | no | yes |
| T2 | no | no | no | no | yes |
| T3 | no | no | no | yes | yes |

## Reported, not tested

Exits (IS / OOS):

- T1: IS {"stop":405,"target":168,"time":25,"gap":1}; OOS {"stop":782,"target":243,"time":34,"gap":2}; signals not traded {"stop under $1":721,"open beyond stop":123}
- T2: IS {"time":257,"stop":752,"gap":2}; OOS {"time":335,"stop":1007,"gap":3}; signals not traded {"stop under $1":148}
- T3: IS {"time":77,"stop":531,"target":310,"gap":2}; OOS {"stop":656,"target":425,"time":94,"gap":2}; signals not traded {"no touch by 15:00":453,"stop under $1":139}

Net R a trade by year (n):

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2016 | −0.259 (138) | −0.238 (217) | −0.196 (194) |
| 2017 | −0.464 (74) | −0.437 (182) | −0.335 (161) |
| 2018 | −0.253 (101) | −0.095 (188) | −0.341 (178) |
| 2019 | −0.303 (113) | −0.394 (198) | −0.299 (179) |
| 2020 | −0.123 (173) | −0.014 (226) | −0.141 (208) |
| 2021 | −0.245 (182) | −0.328 (235) | −0.268 (212) |
| 2022 | −0.630 (173) | +0.006 (239) | −0.080 (221) |
| 2023 | −0.446 (152) | −0.516 (235) | −0.188 (214) |
| 2024 | −0.316 (185) | −0.053 (232) | −0.110 (201) |
| 2025 | −0.285 (199) | −0.004 (219) | −0.169 (175) |
| 2026 | +0.049 (170) | +0.133 (185) | +0.213 (154) |

## Reading

Before costs the three rules are −0.079R (T1), +0.038R (T2) and +0.006R (T3) a trade out of sample; the
cost of a trade sized to a stop of about one session standard deviation is what decides the net. Against the random-side
placebo the rules beat 7, 36 and 40 of 40 seeds: where a rule sits above its placebo, the side carries a
little information, but not enough to pay for the spread and slippage on a stop this tight. Not an edge; never call the
session VWAP a filter, gate or bias for any council system on this evidence. Any follow-up needs its own pre-registration on
other data.

To repeat: `node --use-env-proxy research/edge/gold-vwap/fetch.mjs <dir>`, then `node research/edge/gold-vwap/run.mjs <dir>`.
Tests: `tests/gold-vwap.test.mjs`.
