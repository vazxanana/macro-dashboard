# Gold's daily reopen gap (NDOG): fade, follow, or magnet? (result)

**Verdict: FAIL, 0 of 3: gold's 17:00 → 18:00 New York reopen gap is usually within a spread; fading it (OOS −0.077R net, t −1.52) or following it (−0.034R, t −0.32) does not pay.**

Pre-registered in `PREREGISTRATION.md` (commit 2a604684, pushed alone before any trade was computed). Built 2026-11-14. Paper
research only: nothing live changed, no proposal. **A new stand-alone intraday rule, not a gate, exit, entry or size of the gold
book** (item 44 respected: no candle before 2015-12-01 read, and those only for the 20-day ATR warm-up).

## What was tested

Evenings Monday-Thursday (the Sunday reopen is the weekend gap, tested in `gold-weekend-gap`). Prior close C = close of the
16:55 New York M5 candle; reopen O = open of the first M5 candle at or after 18:00; gap G = O − C; eligible when
|G| ≥ 0.05 x ATR20 (20 trading days of 18:00 → 17:00). Early closes, holidays and their eves skipped by `ict/calendar.mjs`
`cmeShut` (110 evenings). Every trade has a stop at 0.25 x ATR20 beyond the entry; stop first in a candle that holds both.

- **T1 fade**: at the reopen candle's close, toward C; target C (a limit); out at 02:00 New York.
- **T2 follow**: at the reopen candle's close, with the gap; no target; out at 02:00.
- **T3 midpoint magnet**: if the NDOG midpoint (C + O) / 2 was untouched from the reopen through 02:55, toward it at the 03:00
  open; target the midpoint; out at 08:00.

Costs: $0.30 spread + $0.15 slippage on each market order ($0.60 a round trip, $0.45 when the target is reached); 2x costs
double both. Financing by `council/fills.mjs` (`nights` x `FIN.xau.long`) on longs: 0 on every trade (no window crosses the
22:00 UTC rollover). Data: OANDA mid M5 XAU/USD through the candle proxy, 2015-12-01 → 2026-11-13 (776,000 candles; a sample
week was checked against a fresh proxy answer, identical).

## How big the gap really is

OANDA spot gold printed **22 M5 candles** inside the 17:00-18:00 break in almost eleven years, so the gap is real, but small:

| Window | Evenings | Gap exactly 0 | Gap ≤ $0.30 (the spread) | Median \|gap\| | ≥ 0.05 x ATR | ≥ 0.1 x ATR | Gap filled by 02:00 / by 12:00 | Midpoint touched by 02:55 / 12:00 |
|---|---|---|---|---|---|---|---|---|
| 2016-20 | 992 | 55 | 438 | $0.35 | 168 | 17 | 88.1 % / 96.4 % | 94.1 % / 97.0 % |
| 2021 → now | 1,165 | 12 | 351 | $0.57 | 143 | 33 | 75.5 % / 89.5 % | 90.2 % / 95.1 % |

(Fill shares are of the eligible evenings, counted from the reopen candle.) Gold's NDOG is nearly always revisited, but that
says it is close, not that it pulls: a fade's target sits about 0.1 x ATR away against a 0.25 x ATR stop and a $0.45-0.60 cost.

## Results (R of the 0.25 x ATR20 stop; t on calendar-month sums of net R)

| Test | Window | n | Buys / sells | Gross R | Net R | Net R at 2x costs | Month t gross | Month t net | One-sided p | Total net R | Win % | Exits stop / target / time | Worst DD R | Median stop $ |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| T1 fade | 2016-20 | 107 | 36 / 71 | +0.016 | −0.118 | −0.252 | 0.30 | −1.98 | 0.974 | −12.61 | 60.7 | 20 / 81 / 6 | 14.29 | 3.43 |
| T1 fade | 2021 → now | 142 | 40 / 102 | −0.027 | −0.077 | −0.127 | −0.55 | −1.52 | 0.933 | −10.93 | 69.7 | 39 / 97 / 6 | 13.50 | 12.15 |
| T2 follow | 2016-20 | 146 | 94 / 52 | −0.044 | −0.210 | −0.376 | −0.52 | −2.47 | 0.992 | −30.62 | 40.4 | 52 / 0 / 94 | 31.39 | 3.44 |
| T2 follow | 2021 → now | 143 | 103 / 40 | +0.026 | −0.034 | −0.094 | 0.25 | −0.32 | 0.626 | −4.81 | 39.2 | 61 / 0 / 82 | 20.11 | 11.54 |
| T3 midpoint | 2016-20 | 10 | 2 / 8 | +0.181 | +0.028 | −0.124 | 0.67 | 0.10 | 0.459 | +0.28 | 70.0 | 3 / 4 / 3 | 3.60 | 3.28 |
| T3 midpoint | 2021 → now | 14 | 3 / 11 | +0.127 | +0.056 | −0.015 | 0.55 | 0.25 | 0.402 | +0.78 | 42.9 | 3 / 2 / 9 | 4.24 | 10.67 |

Skipped: T1 62 evenings whose reopen candle already traded through C; T2 22 whose reopen candle closed back beyond C; T3 287
eligible evenings whose midpoint was touched before London (T3 is almost never set up). No trade was dropped for a data hole.

## Pass bar (all lines needed)

| Test | OOS net > 0 | OOS t ≥ 2 | Holm p < 0.05 | IS net > 0 | OOS 2x costs > 0 | OOS n bar | Above placebo p95 | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 | no | no | no | no | no | yes (142 ≥ 60) | no | 1.00 | **no** |
| T2 | no | no | no | no | no | yes (143 ≥ 60) | no | 1.00 | **no** |
| T3 | yes | no | no | yes | no | no (14 < 30) | no | 1.00 | **no** |

## Placebo (40 seeds, random side per trade, same days, entries, distances and costs), OOS mean net R

| Test | p5 | p50 | p95 | Real |
|---|---:|---:|---:|---:|
| T1 | −0.141 | −0.052 | +0.007 | −0.077 |
| T2 | −0.196 | −0.010 | +0.210 | −0.034 |
| T3 | −0.369 | −0.021 | +0.243 | +0.056 |

Each real stream sits inside what a coin toss gives on the same days.

## By year (total net R, trades)

| Test | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | −2.98 (27) | −3.46 (21) | −2.97 (23) | −3.72 (22) | +0.52 (14) | +0.30 (7) | −4.22 (18) | +0.91 (19) | −3.30 (14) | −3.88 (42) | −0.73 (42) |
| T2 | −7.10 (39) | −8.56 (31) | −9.26 (32) | −3.82 (26) | −1.89 (18) | +1.90 (8) | +2.73 (18) | −6.16 (19) | +0.07 (14) | −8.31 (42) | +4.96 (42) |

## Reading

- On OANDA spot gold the CME 17:00-18:00 break is a one-hour pause in quoting, not a re-pricing: the median gap is $0.35-0.57,
  30-44 % of evenings are within the $0.30 spread, and only 311 evenings in eleven years reach 0.05 x ATR.
- Fading the gap: the fill is likely (70 % win rate out of sample) but small, and the stops that are hit cost more than the
  fills earn; before costs it is within 0.03R of zero in both windows. Following it loses in sample and is flat out of sample.
- The ICT "NDOG as a magnet" reading has no room on spot gold: the midpoint is already touched before London on 90-94 % of
  eligible evenings, so the London trade exists on 24 evenings in eleven years and shows nothing (n 14 out of sample, t 0.25).
- Agrees with `ict-concepts` (`gap-ndog`, FAIL, its positive total from stub-candle stops) and `ict-nwog` (FAIL as a filter).
  Futures (GC) gaps differ from spot CFD gaps; this study does not judge the GC gap.

## Reproduce

```
node --use-env-proxy research/edge/gold-gap-open/fetch.mjs <dir>    # OANDA mid M5 gold from 2015-12-01, kept out of git
node research/edge/gold-gap-open/run.mjs <dir>                     # writes result.json, prints the tables
```

Tests: `tests/gold-gap-open.test.mjs`.
