# Result: turnaround-tuesday-hourcost (23 Nov 2026)

**Verdict: PASS (accounting, no rule tested).** At the demo broker's measured hourly NAS100 spread (C1), `turnaround-tuesday`'s
one passing cell, R2 on NAS100 (buy the New York close of a "Monday" down more than 1 %, sell the next trading day's close),
makes **+0.11R a trade on 2016 → Nov 2026 (n 81, t 2.63, Holm p 0.0173 over the four recosted cells; 40 of 40 placebos)**,
against +0.098R (t 2.33, Holm p 0.0392) at the study's assumed cost. Every check of the study's own bar holds (C1-C5); the
stress case C2 holds too (+0.109R, t 2.59, Holm p 0.019). **This is accounting on years the study already read: the result
no longer leans on its assumed cost, which is not new evidence that the rule is an edge.** Its forward record (one trade so
far) is still the judge. Nothing live changed.

## Why the cost hardly matters here

The study charged 0.05 % of price a round trip on NAS100. The demo quotes NAS100 at 0.8-0.9 points in every UTC hour
(2.7-3.0 × 10⁻⁵ of price; tick probe, council-data commit 46e678088, 2026-11-20T04:51Z, 44 windows an hour for hours 0-20,
14 / 24 / 36 for 21 / 22 / 23) with no commission (`ctrader/symbols.json` `commissionRT` 0; US500 also 0): **0.003 % a round
trip, about a seventeenth of the assumed cost.** The rule needs about 0.435 % of price a round trip to break even (financing
kept), so cost is not its weak point; financing (one night at DGS2 + 2.5 %) is now the larger charge.

## The four cells, out of sample 2016 → Nov 2026 (judged on the study's bar: C1 net t ≥ 2 and Holm < 0.05, C2 n, C3 2008-15 > 0, C4 vs all Tuesdays, C5 placebo)

| Cell | assumed cost: net R, t, Holm p | measured C1: net R, t, Holm p | month-sum t (C1) | placebo | 2008-15 (C1) | round trip, % of price | break-even % | pass |
|---|---|---|---|---|---|---|---|---|
| S&P 500 R1 | +0.013, 0.54, 0.3272 | +0.029, 1.19, 0.2017 | 1.27 | 33 / 40 | +0.024 | 0.004 | 0.07 | no |
| S&P 500 R2 | +0.069, 1.10, 0.3272 | +0.080, 1.28, 0.2017 | 1.17 | 37 / 40 | +0.126 | 0.004 | 0.259 | no |
| Nasdaq 100 R1 | +0.030, 1.23, 0.3272 | +0.044, 1.84, 0.0996 | 1.90 | 33 / 40 | +0.008 | 0.003 | 0.147 | no |
| **Nasdaq 100 R2** | +0.098, 2.33, 0.0392 | **+0.110, 2.63, 0.0173** | 2.29 | 40 / 40 | +0.114 (t 2.36) | 0.003 | 0.435 | **yes** |

C4 (the rule's Tuesdays against all Tuesdays, before costs) is unchanged by cost: NAS100 R2 +0.594 % difference, Welch t 2.59.
The other three cells still fail C1, C4 and C5 (NAS100 R1 now passes C3 at +0.008R; its t stays under 2). Under C2 (the 90th
percentile spread plus 0.10 × the median H1 range on a stop exit) every figure moves by about 0.001R.

## The forward record at measured cost (reported, not judged)

One forward trade so far (weeks after 12 Nov 2026, NAS100 H1 through the site's candle proxy to 23 Nov 2026): 16 Nov 2026, time
exit, gross −0.124R; −0.135R at the assumed cost (the forward file's figure, reproduced) and **−0.128R at the measured cost**.
The forward study's bands stay as it pre-registered them (on the assumed-cost trades); this study does not change them.

## How it was run

- Harness gate: the re-written `cellsFor` (one change: each trade's cost comes from a function) at the study's constant costs
  reproduces `turnaround-tuesday/result.json` exactly (every cell's windows, comparisons, placebo seeds, skipped days, trades,
  p values and checks). Candles: the study's own `fetch.mjs` (OANDA mid H1, 2007-09-30 → 2026-11-12), out of git.
- Hour of a price = the UTC start hour of the H1 candle it comes from: entries and time exits at 19:00 / 20:00 UTC (17:00 on a
  half day), stop exits the candle that hit the stop. Every hour used had 10+ windows.
- Limits: 60 weekdays of one demo account; today's relative spread charged to every year; the spread of the first 2 minutes
  of an hour stands for the hour; OANDA mid candles; no slippage at C1. One small correction to the pre-registration's
  wording: US500 is on file in `ctrader/symbols.json` with `commissionRT` 0 (it said "not on file, taken as 0"); the charge is
  the same.

To repeat: `node --use-env-proxy research/edge/turnaround-tuesday/fetch.mjs <dir>` (with `MD_BASE=https://aureumdesk.co.uk/md/`),
NAS100 H1 from 2026-09-01 as `<dir>/nas100-fwd-1h.json.gz` for the forward line, the probe files from council-data commit
46e678088, then `node research/edge/turnaround-tuesday-hourcost/run.mjs <dir> ticks-NAS100.json ticks-US500.json symbols.json 46e678088`.
Test: `tests/turnaround-tuesday-hourcost.test.mjs`.
