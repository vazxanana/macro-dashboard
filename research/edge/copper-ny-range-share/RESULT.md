# Copper: the share of the day's range New York made, followed for 2-5 days (gold-ny-range-share replicated). Result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: descriptive only (77 / 79 events, under 100 a window); following a New York-made copper day for 5 days beat the same side by +0.044R out of sample (month t +0.39, n 79, Holm p 1.00).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A replication of `gold-ny-range-share`
(gold: out-of-sample excess +0.138R, t +2.63, n 198; in sample -0.012R, t -0.25) on a market it was not found on, with the
rule, thresholds, hold, stop, baseline, placebo, control and three-test layout copied unchanged from `silver-ny-range-share`.
The pre-registration counted 77 in-sample and 79 out-of-sample signal days before any outcome was read, under the 100 a
window this replication required, so it was declared **descriptive only** in advance: it could not pass. A stand-alone rule on
copper, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only: nothing
live changed and no proposal is written.

## Rule (as pre-registered)

- OANDA mid XCU/USD H1 via the candle proxy, 3 Jan 2006 to 30 Oct 2026 (116,949 candles); UTC days, weekend candles to Monday;
  a day needs 18 H1 candles. The copper H1 history is thin before 2013 (150-213 eligible days a year in 2007-12), so the
  in-sample window holds fewer days than gold's: 4,654 eligible days in all.
- NY share = 1 - (00-13 UTC range) / (00-21 UTC range). Median 0.19 (gold 0.275, silver 0.270): New York adds less of copper's
  range. Signal: NY share >= 0.60 → follow New York's move. 164 signal days, 87 up.
- T1: 5-day hold, out of sample 2017-26 (primary). T2: 2-day hold, out of sample. T3: 5-day hold, 2007-26 pooled.
- Entry at the next day's first H1 open, stop 2 x ATR(14) of the daily candles, out at the close of the last day or the stop.
- Costs: 0.10 % of the entry price a round trip (`research/edge/trend-breadth`'s group "silver, copper, energies").
  **No financing is charged**, on buys or sells: `council/fills.mjs` has no copper rate. This flatters the buys.
- Excess = net R minus the mean net R of the every-day trade of the same side in the same calendar year; t on calendar-month
  sums; Holm over the three tests' judged-window p.

## Tests (R of the 2 x ATR stop)

| Test | Window | n | Gross R | Net R | Excess R | Month t (excess) | Net month t |
|---|---|---|---|---|---|---|---|
| T1 follow NY, 5 days | IS | 77 | +0.023 | +0.000 | +0.003 | +0.04 | +0.00 |
| T1 follow NY, 5 days | OOS | 79 | +0.054 | +0.029 | +0.044 | +0.39 | +0.27 |
| T2 follow NY, 2 days | IS | 77 | +0.008 | -0.015 | +0.003 | +0.06 | -0.26 |
| T2 follow NY, 2 days | OOS | 79 | +0.106 | +0.082 | +0.100 | +1.20 | +1.01 |
| T3 follow NY, 5 days, pooled | 2007-26 | 156 | +0.038 | +0.015 | +0.024 | +0.36 | +0.23 |

| Test | Holm p | 2x costs (excess / net) | Placebo beaten | Control beaten | Failed checks |
|---|---|---|---|---|---|
| T1 | 1.000 | +0.044 / +0.005 | 24 of 40 | 26 of 40 | excess t, net t, placebo, control, n |
| T2 | 0.696 | +0.100 / +0.057 | 31 of 40 | 38 of 40 | excess t, net t, placebo, n |
| T3 | 1.000 | +0.024 / -0.009 | 14 of 40 | 28 of 40 | excess t, net t, 2x costs, placebo, control, n |

Out-of-sample halves, T1: 2017-21 excess +0.055R (n 48, t +0.38), 2022-26 +0.026R (n 31, t +0.14).
Baseline every-day trade out of sample, 5 days: long +0.036R net (t +1.30), short -0.087R (t -3.15).
Placebo = the real signal days with seeded random sides (T1 median t +0.16); control = per year as many random days on their
own rule side (T1 median t -0.09).

## Reading

Too few events to judge, as declared before the run, and nothing in the numbers asks for a second look. The sign is the
same as on gold and silver in both windows (excess +0.003R in sample, +0.044R out of sample for T1), but it is a third of
silver's and a third of gold's out-of-sample size, with month t under 0.4, and the real T1 t sits in the middle of the
placebo and control draws (24 and 26 of 40). The 2-day hold (T2) reads +0.100R out of sample with t +1.20: under 2, and the
best of three looks on 79 events is not evidence. Copper's New York session makes a day's range far less often than gold's
(median share 0.19), which is why the rule fires about once a month. Three markets with the same small positive sign is weak
support at most for a New York follow-through effect in metals; no market reaches t 2 out of sample except gold, and gold
failed in sample. Nothing here is a council rule.

## Files

`run.mjs` (fetch / count / full; silver-ny-range-share's code with the market and the cost changed and the financing
sensitivity removed), `result.json`, `tests/copper-ny-range-share.test.mjs`. Candles kept out of git and deleted.
To repeat: `node --use-env-proxy research/edge/copper-ny-range-share/run.mjs fetch <dir>`, then `… full <dir>`.
