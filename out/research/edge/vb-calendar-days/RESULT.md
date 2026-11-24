# Result: the gold and USD/JPY breakouts by calendar position (24 Nov 2026)

**Verdict: FAIL, 0 of 4.** Turn of the month: gold T1 Holm p 0.24 (confirmation month t 1.89), USD/JPY T2 Holm p 0.98; weekday: gold T3 Holm p 0.36, USD/JPY T4 Holm p 0.79. Neither breakout is shown to depend on the calendar.

Pre-registered in `PREREGISTRATION.md` (committed alone first, 21c8b1b7ec). Paper research only: nothing live changed, no
rule is proposed. Code `run.mjs`, every figure `result.json`.

Rules imported unchanged: gold = `gold-vol-breakout-hourcost` (T1, k 0.5) charged at route C1 (the demo's measured hourly
spreads + commission, 0.05 × M stop slippage); USD/JPY = `index-vol-breakout/original.mjs` `vbTrade` with
`fx-vol-breakout` `charge` (0.000045 of the entry + 0.5 pip). Harness gate (both exact): gold 2021-01-01 → 2026-11-12 n 1121,
+0.105R, month t 2.79 (the forward baseline); USD/JPY 2005-2015 n 2089, +0.079R, t 2.95 (`usdjpy-vol-breakout-early`).
OANDA mid M5 from the shared cache. Discovery 2005-2014 (gold from 21 Mar 2006), confirmation 2015 → 20 Nov 2026. TOM = last
built trading day of a month + first three of the next; weekday = the trade day's UTC weekday. All R after costs unless said.

## Turn of the month (T1, T2): month t of (mean TOM net R − mean other net R) per month

| Test | Window | TOM n | TOM net R (gross) | Rest n | Rest net R (gross) | Months | Diff | Month t | p | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 gold | 2006-14 | 296 | +0.404 (+0.422) | 1315 | +0.140 (+0.155) | 106 | +0.316 | 2.81 | 0.006 | |
| T1 gold | 2015-26 | 407 | +0.227 (+0.243) | 1843 | +0.070 (+0.086) | 142 | +0.186 | 1.89 | 0.060 | 0.241 |
| T2 USD/JPY | 2005-14 | 357 | +0.002 (+0.031) | 1537 | +0.113 (+0.142) | 119 | −0.081 | −0.92 | 0.361 | |
| T2 USD/JPY | 2015-26 | 409 | +0.056 (+0.088) | 1866 | +0.055 (+0.087) | 143 | +0.001 | 0.02 | 0.985 | 0.985 |

Checks T1: same sign yes, discovery p < 0.05 yes, TOM positive in both windows yes (n 407), placebo 39 of 40 beaten yes,
**confirmation month t ≥ 2 and Holm p < 0.05: no** (1.89, 0.24) → fail. T2 fails every check except "TOM positive" (the sign
flips, placebo 0 of 40).

## Weekday (T3, T4): Kruskal-Wallis on per-trade net R, 2,000 label permutations

| Test | Window | Mon | Tue | Wed | Thu | Fri | Best | Perm p | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| T3 gold | 2006-14 | +0.203 (284) | +0.369 (340) | +0.026 (322) | +0.193 (351) | +0.143 (314) | Tue | 0.339 | |
| T3 gold | 2015-26 | +0.182 (392) | +0.105 (471) | +0.034 (461) | +0.122 (474) | +0.061 (452) | Mon | 0.119 | 0.358 |
| T4 USD/JPY | 2005-14 | +0.053 (336) | +0.221 (384) | +0.014 (401) | +0.149 (389) | +0.022 (384) | Tue | 0.038 | |
| T4 USD/JPY | 2015-26 | −0.010 (409) | +0.031 (477) | +0.138 (482) | +0.131 (455) | −0.026 (452) | Wed | 0.395 | 0.790 |

Net R a trade (n). The best weekday changes between windows on both markets. Descriptive, not judged: best-vs-rest month t
in confirmation 1.27 (gold Monday), 1.54 (USD/JPY Wednesday). Wednesday is gold's weakest day in both windows (+0.03R): one
cell of ten picked after looking, not a finding.

## Reading

- Weekday: nothing. Both omnibus tests are far from significant in confirmation and the best day moves.
- USD/JPY's turn of the month: nothing (difference +0.001R in confirmation).
- Gold's turn of the month is the near miss: TOM trades beat the rest in both windows (+0.40 vs +0.14R, then +0.23 vs
  +0.07R), discovery t 2.81, 39 of 40 placebos, but confirmation t 1.89 and Holm p 0.24 miss the bar. Descriptive split
  (`result.json` `tomSides`): in confirmation the gap is there for buys (+0.243 vs +0.054R) and sells (+0.207 vs +0.086R),
  so it is not gold's own month-turn drift (`gold-turn-of-month` read buy-and-hold). Not an edge and not a filter; a
  hypothesis at most, judged only by a forward record (no untouched OANDA M5 gold years are left).
- The breakouts stay what their own studies say: gold +0.098R and USD/JPY +0.055R a trade after costs in 2015-26.

Caveats: today's measured relative cost charged on every year; OANDA mid candles; TOM counts holiday candles as trading days.
