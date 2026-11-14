# Result: Luxus's "retrace to the 50 % at origin, or a new CF" on gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a limit at the 50 % of an H4 BO buy leg with Daily and Weekly bullish made +0.056R a trade net out of sample (n 69, month t 0.5).**

Pre-registration: `PREREGISTRATION.md` (pushed alone, before any candle was read for this rule). Paper research only: a
stand-alone rule, never a gate, exit, entry or size of the live gold book; nothing live changed, nothing was written to the Mosha
desk. This page is written by `run.mjs` from `result.json`.

Data: OANDA mid M5 XAU/USD via the site proxy, 2006-06-01 to 2026-11-13 (1,459,980 M5 candles; H4 33316, D1 5316, W1 1068).
Costs: $0.60 a round trip plus financing on buys (nights x 0.000148 x entry / risk). t on calendar-month sums of the window, empty months 0;
Holm over the three tests on the out-of-sample one-sided p. Windows by fill time: replication 2007-19, in sample 2020-23, out of sample 2024 to Oct 2026.

| Test | Window | n | Win % | Gross R a trade | Net R a trade | Month t gross | Month t net | Net at 2x costs | PF net | Worst DD | Median risk $ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Replication 2007-19 | 221 | 46.6 | −0.075 | −0.166 | -1 | -2.28 | −0.257 | 0.71 | -44.6R | 10.3 |
|  | In sample 2020-23 | 73 | 37 | −0.266 | −0.336 | -2.32 | -2.85 | −0.405 | 0.49 | -25.4R | 15.79 |
|  | Out of sample 2024-26 | 69 | 55.1 | +0.099 | +0.056 | 0.88 | 0.5 | +0.013 | 1.12 | -5.3R | 33.16 |
| T2 | Replication 2007-19 | 99 | 24.2 | +0.034 | −0.430 | 0.16 | -2.05 | −0.895 | 0.61 | -45.5R | 1.27 |
|  | In sample 2020-23 | 62 | 21 | −0.228 | −0.612 | -0.9 | -2.22 | −0.997 | 0.44 | -42.8R | 1.52 |
|  | Out of sample 2024-26 | 72 | 23.6 | +0.306 | −0.021 | 0.82 | -0.06 | −0.348 | 0.98 | -19.7R | 2.02 |
| T3 | Replication 2007-19 | 93 | 54.8 | +0.087 | +0.029 | 0.95 | 0.33 | −0.029 | 1.06 | -4.7R | 10.76 |
|  | In sample 2020-23 | 34 | 50 | −0.010 | −0.047 | -0.07 | -0.33 | −0.085 | 0.91 | -5.2R | 17.03 |
|  | Out of sample 2024-26 | 13 | 69.2 | +0.360 | +0.348 | 0.99 | 0.97 | +0.336 | 2.11 | -2R | 63.85 |

| Test | One-sided p (OOS) | Holm p | Placebo draws beaten, OOS (of 40) | Placebo median OOS | Control net OOS | Test minus control OOS | Checks met |
|---|---|---|---|---|---|---|---|
| T1 | 0.3085 | 0.6171 | 22 | +0.054 | +0.031 | +0.025 | cost2, n30 |
| T2 | 0.5239 | 0.6171 | 34 | −0.228 | −0.339 | +0.318 | n30 |
| T3 | 0.166 | 0.4981 | 40 | −0.233 | −0.122 | +0.470 | cost2 |

## The tests

- **T1**: buy limit at the 50 % at origin of an H4 BO buy, Daily and Weekly bullish. H4 BOs on its side: 1898; with Daily and Weekly agreeing: 835; skipped while busy: 54; orders: filled 364, cancelled 417. Out of sample exits: 30 stopped, 38 target, 1 time. Control (every H4 open, 1.75 ATR stop, 1.76 ATR target). Years (net R): 2020 −6.5, 2021 −6.3, 2022 −2.5, 2023 −9.2, 2024 −2.4, 2025 +9.6, 2026 −3.4.
- **T2**: buy at the zone of the break of an M5 CF made before the 50 % is touched, Daily and Weekly bullish. H4 BOs on its side: 1898; with Daily and Weekly agreeing: 835; skipped while busy: 56; orders: touched50 130, small 347, filled 233, noRoom 64, expired 4, cancelled 1. Out of sample exits: 55 stopped, 17 target, 0 time. Control (every H4 open, 0.1 ATR stop, 0.43 ATR target). Years (net R): 2020 −12.0, 2021 +4.3, 2022 −19.4, 2023 −10.9, 2024 −3.1, 2025 −13.9, 2026 +15.5.
- **T3**: sell limit at the 50 % at origin of an H4 BO sell, Daily and Weekly bearish (mirror of T1). H4 BOs on its side: 1603; with Daily and Weekly agreeing: 352; skipped while busy: 29; orders: filled 144, cancelled 179. Out of sample exits: 4 stopped, 8 target, 1 time. Control (every H4 open, 2.23 ATR stop, 2.22 ATR target). Years (net R): 2020 −2.1, 2021 −0.3, 2022 0.0, 2023 +0.8, 2024 −0.1, 2026 +4.6.

## What it means

Pass bar (pre-registered): out-of-sample net month t >= 2 with Holm p < 0.05, the in-sample net mean positive, the out-of-sample net mean still positive at 2x costs, 30+ out-of-sample trades; the study passes only on Test 1. Test 1 does not (oosT2, holm, isPos not met).

Closest prior study: `gold-ote-retrace` (a limit at the 0.705 of an H1 structure-break leg, FAIL, out of sample -0.230R a trade). This one
differs by the H4 BO leg, the 50 % at origin, the Daily AND Weekly last-BO agreement and the CF branch (see the pre-registration).

This tests a mechanical reading of one lesson: the structure (a close beyond the last swing), the 50 % of the H4 leg from its origin, the
Daily and Weekly agreement, and, for the CF branch, the desk's unconfirmed VR. It does not judge the teacher's own discretionary
reading of a chart. Assumptions A1-A11 are listed in the pre-registration. Nothing live changed and no proposal is made.
