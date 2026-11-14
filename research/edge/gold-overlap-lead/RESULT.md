# Result: does gold's Sydney/Tokyo overlap (22:00-01:59 UTC) lead the rest of the day? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following the overlap move from 02:00 to 20:00 UTC beat the same-side day by nothing (T1 OOS excess +0.019R, month t +1.20, n 1482; in sample -0.013R).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any result). Stand-alone paper research on XAU/USD: it reads and
changes nothing of the live gold book, uses none of its 2006-17 positions, and no rule, size, filter, stop or config changed.
Not an edge; no proposal.

## Data and rule

OANDA mid XAU/USD H1 through `/md/bars`, 124,242 candles 2006-06-01 to 2026-10-30 (cache outside git, deleted). Session day =
22:00 UTC of the previous date to 21:59 UTC (Sunday's reopen belongs to Monday), 5,239 eligible days. Overlap = the candles
opening 22:00-01:00 UTC; ratio = |overlap move| / previous session day's range (median 0.118). Trade: the 02:00 UTC open in the
overlap's direction, stop 1 x ATR(14) of earlier days, out at 20:00 UTC (no rollover). $0.60 a round trip plus financing on
buys (zero nights here). Excess = net R minus the mean net R of every eligible day's same-side trade in the same calendar year.

## Results (R of the stop; t on calendar-month sums of excess R)

| Test | Window | n | Gross R | Net R | Excess R | Month t | Excess at 2x costs | Net at 2x costs | Win % | Stops | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 follow, >= 0.10 | IS | 1405 | −0.007 | −0.041 | −0.013 | −0.75 | −0.012 | −0.075 | 43.6 | 168 | 18.54 |
| T1 follow, >= 0.10 | OOS | 1482 | +0.024 | −0.004 | +0.019 | +1.20 | +0.019 | −0.032 | 48.8 | 154 | 24.26 |
| T2 buys, >= 0.10 | IS | 753 | −0.024 | −0.058 | −0.030 | −1.28 | −0.029 | −0.091 | 44.2 | 83 | 18.54 |
| T2 buys, >= 0.10 | OOS | 801 | +0.024 | −0.004 | +0.006 | +0.29 | +0.006 | −0.031 | 49.2 | 86 | 24.00 |
| T3 strong, >= 0.25 | IS | 452 | +0.057 | +0.023 | +0.048 | +1.64 | +0.049 | −0.011 | 49.3 | 54 | 18.38 |
| T3 strong, >= 0.25 | OOS | 541 | +0.016 | −0.011 | +0.009 | +0.36 | +0.008 | −0.037 | 49.7 | 70 | 25.45 |

(IS = 2007-16, OOS = 2017 to 2026-10.)

## The pre-registered checks

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS month t >= 2 and Holm p < 0.05 | no (t +1.20, Holm p 0.698) | no (t +0.29, Holm p 1) | no (t +0.36, Holm p 1) |
| In-sample excess > 0 | no (−0.013) | no (−0.030) | yes (+0.048) |
| 2x costs: OOS excess > 0 and net > 0 | no (net −0.032) | no (net −0.031) | no (net −0.037) |
| Beats >= 38 of 40 placebos | no (32 of 40) | no (20 of 40) | no (22 of 40) |
| n >= 100 in both windows | yes | yes | yes |
| **Passes** | **no** | **no** | **no** |

Placebo (40 seeded draws: random eligible days of the same year carrying that year's signal directions): median OOS month t
+0.34 (T1), +0.30 (T2), +0.12 (T3).

## Reported, not tested

- Baseline, every eligible day 02:00 → 20:00 UTC: buys IS net −0.030R (t −2.16), OOS −0.010R (t −0.75); sells IS −0.029R,
  OOS −0.039R (t −2.99). The costs alone (~0.03R on a median $18-25 stop) take what the hours' drift gives.
- OOS halves for T1: 2017-21 excess +0.003R (t +0.12, n 753); 2022-26 +0.036R (t +1.58, n 729). The later half is the gold
  bull run with wider stops; one half does not make a rule.
- T3's in-sample +0.048R (t +1.64) did not repeat out of sample (+0.009R, t +0.36).

## Reading

The overlap's direction carries no usable information for gold's next eighteen hours: every excess is within about 0.05R of
zero, the in-sample and out-of-sample signs disagree for T1 and T2, and the placebo puts the OOS t inside its own range. Do not
use the 22:00-01:59 UTC move as a direction filter or a trade. The study does not test the overlap range against the London
breakout (`gold-asia-break` covers the 00:00-06:59 London-time range) or the Sunday gap (`gold-weekend-gap`).

To repeat: `node --use-env-proxy research/edge/gold-overlap-lead/run.mjs fetch <dir>`, then `… full <dir>`.
Tests: `tests/gold-overlap-lead.test.mjs`.
