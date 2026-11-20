# Result: the gotobi fade on the demo broker's executable quotes (20 Nov 2026)

**Verdict: COST MEASURED, the cost does not undo the study's result: a round trip at 00:55 and 06:00 UTC costs 0.81 pip (median, commission included; 90th percentile 0.96, worst 1.49) against the study's assumed 2.0 and its t-2 line of 1.95. Return on executable quotes, judged (n 211 ≥ 150): FAIL on the pre-registered bar: +0.163R a trade, month t 1.80 (per-trade t 2.01; with 0.3 pip extra slippage +0.138R, t 1.52).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before any broker quote of these days was read). Data: council-data `research/probe/ticks-USDJPY.json` (commit d8505176, the demo broker's own USD/JPY bid and ask at 00:55:00 and 06:00:00 UTC), 214 gotobi days in the history (2023-11-24 → 2026-11-13), 211 with fresh quotes at both marks, 211 traded (D needs 15 of the 20 prior business days). D and the stop path: the gotobi study's own functions on OANDA mid M5. Nothing live changed; the demo job (owner item 61) is untouched.

## The cost, measured

| | Median | 90th pct | Max |
|---|---|---|---|
| Spread at 00:55 (pip) | 0.2 | 0.3 | 1.2 |
| Spread at 06:00 (pip) | 0 | 0.3 | 0.6 |
| Round trip with commission (pip) | 0.81 | 0.96 | 1.49 |

Half the spread at each end plus USD 22.5 per million a side (about 0.7 pip at 155-160 yen). The study assumed 2 pips (0.3 spread + 2 × 0.5 slippage + commission); `gotobi-cost` put break-even at 3.73 and month t ≥ 2 up to 1.95. **Slippage beyond the quote is not measured** (the quotes are the price a market order meets; the demo job's own fills will show it).

## The same days, three prices

| Pricing | n | Net R a trade | Gross R | Per-trade t | Month t (months) | Won | Stopped |
|---|---|---|---|---|---|---|---|
| E: broker bid / ask | 211 | +0.163 | +0.194 | 2.01 | 1.80 (37) | 49.8% | 56 |
| E+: and 0.3 pip a side | 211 | +0.138 | +0.169 | 1.71 | 1.52 | 49.3% | 57 |
| M: OANDA mid, the study's cost | 211 | +0.114 | +0.203 | 1.40 | 1.23 | 48.3% | 55 |

Feed agreement: daily gross R of E and M correlate 0.9996; same sign on 98.6% of days.

## What it means

- **The cost question is closed for this account**: about 0.8 pip, a third of what the study charged. On the same days the measured price adds about +0.049R a trade to the study's mid-and-assumed-cost figure.
- **Three years alone do not prove the return** (pre-registered: month t ≥ 2 needed with n ≥ 150; it is 1.80). This is a short window, not the study's evidence: `gotobi` 2016-26 (t 2.74) and its replications stand as they were. Read together, the sign and size here (+0.16R on executable prices) agree with them.
- The forward demo record (owner item 61; the first morning, 20 Nov, was missed for a job fault, fixed in its own PR) will add slippage and the real fills.

To repeat: `node research/edge/gotobi-exec/run.mjs <ticks-USDJPY.json> <usdjpy-5m.json.gz> [probeCommit]` (OANDA mid M5 USD/JPY from October 2022, kept out of git).
