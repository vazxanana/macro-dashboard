# Result: gold-pre-holiday-hourcost (23 Nov 2026)

**Verdict: PASS (accounting, no rule tested).** At the demo broker's measured hourly gold spread plus its commission (C1),
`gold-pre-holiday`'s T1 (long spot gold from the open to the close of the last trading day before an NYSE holiday, stop
1 × ATR(14)) makes **+0.157R a trade out of sample 2017 → Oct 2026 (n 92, t 2.77 per event, Holm p 0.0094; 40 of 40
placebos; +0.154R at 2x costs)**, against +0.133R (t 2.35, Holm p 0.0209) at the study's assumed $0.60. Every check of the
study's own bar holds; T2 passes too (+0.241R, t 2.80); T3 still fails (t 1.62, 37 of 40). **This is accounting on years
the study already read: the result no longer leans on its assumed cost, which is not new evidence that the rule is an
edge.** The weaknesses the study named stay: in-sample 2007-16 is thin (T1 +0.065R, t 1.00 at measured cost) and about nine
events a year. Its forward record (first event: Thanksgiving, 25 Nov 2026) is the judge. Nothing live changed.

## The cost

The tick probe's XAUUSD hour profile (council-data commit 0459ec37e, 2026-11-20T00:58Z; the later copy of that file no longer
carries the hour profile) puts the quoted spread at $0.07-0.11 in every UTC hour (1.7-2.6 × 10⁻⁵ of price; 44 windows for
hours 0-20, 14 / 24 / 36 for 21 / 22 / 23), plus the demo's commission 0.000024 of price a round trip. T1's out-of-sample
trades paid **$0.10 an ounce on average** (C1) and $0.16 under C2, against the study's $0.60. T1 would need about $3.40 an ounce
a round trip to break even out of sample.

## The three tests (R a trade net of costs and financing; t per event; Holm over T1-T3)

| Test | assumed $0.60: OOS net R, t, Holm p | measured C1: OOS net R, t, Holm p | month-sum t (C1) | 2007-16 (C1) | 2x costs (C1) | placebo | pass |
|---|---|---|---|---|---|---|---|
| **T1** last day before | +0.133, 2.35, 0.0209 | **+0.157, 2.77, 0.0094** | 2.66 | +0.065 (t 1.00) | +0.154 | 40 / 40 | **yes** |
| T2 last two days before | +0.216, 2.53, 0.0197 | +0.241, 2.80, 0.0094 | 2.78 | +0.159 (t 1.77) | +0.223 | 40 / 40 | yes |
| T3 first day after | +0.090, 1.26, 0.1054 | +0.115, 1.62, 0.0543 | 1.55 | +0.083 | +0.111 | 37 / 40 | no |

Under C2 (the 90th percentile spread plus 0.10 × the median H1 range on a stop exit): T1 +0.156R (t 2.74, Holm p 0.0108),
T2 +0.237R (t 2.75), T3 +0.113R (t 1.58, fails).

## How it was run

- Harness gate: the re-written `study()` (one change: each trade's cost comes from a function) at $0.60 reproduces
  `gold-pre-holiday/result.json` exactly (every test's in-sample / out-of-sample / whole summary, placebo, Holm p, checks).
  Candles: OANDA mid H1 XAU/USD 2006-03-19 → 2026-11-13, 125,704 candles (as the study's), through the site's candle proxy,
  out of git.
- Hour of a price = the UTC start hour of the H1 candle it comes from: entries at the reopen (mostly 22:00 / 23:00 UTC, 21:00
  on some days), close exits at the day's last candle (20:00 / 21:00 UTC, earlier on an early close), stop exits the candle
  that hit the stop. Every hour used had 10+ windows.
- Limits: 60 weekdays of one demo account; today's relative spread charged to every year; the spread of the first 2 minutes
  of an hour stands for the hour, while the trade enters at the reopen and leaves at the last minutes before the daily break,
  both often wider than that (C2 is the stress for it, and the break-even is about 30 times the measured cost); OANDA mid
  candles; no slippage at C1.

To repeat: `node --use-env-proxy research/edge/gold-pre-holiday-hourcost/run.mjs fetch <dir>`, the probe file from council-data
commit 0459ec37e and `ctrader/symbols.json`, then `node research/edge/gold-pre-holiday-hourcost/run.mjs run <dir> ticks-XAUUSD.json
symbols.json 0459ec37e`. Test: `tests/gold-pre-holiday-hourcost.test.mjs`.
