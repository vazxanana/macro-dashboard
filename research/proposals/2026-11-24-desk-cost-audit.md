# Desk cost audit: what each reading pays the spread, and what is left (24 Nov 2026)

Arithmetic on the stored desk files, no new test, nothing live changed, no rule proposed. The first step of the `wyz` skill.
Script and figures: `2026-11-24-desk-cost-audit.mjs` / `.json` (the files: `git show origin/council-data:<desk>/desk.json`;
Engulfing, MSNR and LIT records from 22-26 Dec 2025, Mosha from 19 May 2026, all to 24 Nov 2026; closed records only).

**Cost R** = round trip (`combo-grid-2` `COSTS`, demo figures; ASSUMED for silver and the Nasdaq) / the trade's opening risk.
"Net" = the desk's booked R minus cost R. t = trade-level t of net R; month t = t of calendar-month sums of net R.

## What it shows

1. **Costs are not what sinks the desks.** Median cost is 0.02-0.10R a trade on almost every reading (the 30-pip stop on gold is
   exactly 0.10R), far below the 0.4-0.5R that killed the MSNR switch triggers. The heavy payers are the few readings with M1 /
   M5 stops, by their tail: the M1 EF entry (median 0.095R, 90th percentile 0.25R, 48% of trades over 0.1R), the H1 > M15 > M5
   SOP chain (0.29R at the 90th), LIT, the earlier scalp method at other hours.
2. **What sinks them is that they are at zero before costs.** Of 30 readings with 100+ closed trades, before costs most sit
   within ±0.05R a trade; after costs **none reaches t 1.3 (trade or month)**. 15 are negative with t below -1, the clearest
   losers being the M1 EF entry (-0.145R after costs, n 14,092, t -11.9), the H1 SOP chain (-0.235R, n 3,784), the plan and
   short method with the three-candle engulf (-0.15R each, n about 1,400), the Mosha barrier QM at 1R (-0.093R, n 3,886) and the
   gold plan (-0.257R, n 327).
3. **The best after costs, none of them evidence** (picked from about 40 readings after looking, one year or less, no holdout):

| Reading | n | cost R (median) | R before | R after | t | month t |
|---|---:|---:|---:|---:|---:|---:|
| Engulf rule, D1 | 187 | 0.006 | +0.136 | +0.127 | 1.29 | 1.19 |
| Mosha barrier Janda, 6R | 661 | 0.034 | +0.107 | +0.069 | 0.67 | 0.59 |
| Earlier scalp method, 12-16 UTC | 472 | 0.077 | +0.158 | +0.074 | 0.62 | 0.84 |
| Mosha barrier, BO at the tap, 6R | 3,643 | 0.042 | +0.061 | +0.012 | 0.28 | 0.17 |
| Plan with the Daily, next-candle engulf | 387 | 0.100 | +0.069 | +0.003 | 0.06 | 0.06 |

The Daily engulf rule is the live Gold daily engulf family (its own studies: about +0.14R a position, t about 1.5 on untouched
2006-17); the 12-16 UTC scalp method already failed on 2010-19 (`msnr-main-6r`). Nothing here should be added or traded on this
reading.

## What follows

- A wider stop will not rescue these readings: their cost is already small; their entries make about zero.
- The readings that lose clearly after costs with large n (the M1 EF entry, the H1 > M15 > M5 chain, the three-candle plan and
  short method, the gold plan, the barrier QM at 1R) are candidates for the owner to stop recording, to keep the desks
  readable. That is a desk decision for the owner; this note only reports.
- The next study the `wyz` skill names stands: the fade with a working-chart ATR stop, pre-registered, after costs, on data the
  fade work never read.
