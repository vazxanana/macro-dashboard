# Result: the ICT "optimal trade entry" retracement limit on gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a limit at the 0.705 retracement of an H1 structure-break leg loses after costs in and out of sample (T1 out of sample -0.230R a trade, n 740, month t -3.42).**

Pre-registration: `PREREGISTRATION.md` (pushed alone first). OANDA mid M5 XAU/USD, 1 Dec 2015 (warm-up) to 13 Nov 2026, H1 and D1
built from it; 6,263 qualifying impulses from 2016 (leg >= 1.5 x ATR(14) H1). A limit at 0.705 of the leg, stop $0.30 beyond the
origin, valid 24 H1 candles, out after 72 H1 candles, one order or position at a time per test, fills and exits on M5, stop first
on a tie. Costs: $0.60 a round trip and overnight financing on buys (`FIN.xau.long`). In sample = fills 2016-2020, out of sample
= fills 2021 to 13 Nov 2026; t on calendar-month sums (60 and 71 months, empty months counted).

| Test | Window | n | Gross R a trade | Net R a trade | Month t gross | Month t net | Net at 2x costs | PF net | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|
| T1 target the leg's extreme | IS 2016-20 | 628 | -0.034 | -0.279 | -0.64 | -5.12 | -0.523 | 0.67 | -178.9R |
| | OOS 2021-26 | 740 | -0.094 | -0.230 | -1.44 | -3.42 | -0.366 | 0.72 | -197.5R |
| T2 target the -0.27 extension | IS 2016-20 | 589 | -0.062 | -0.308 | -1.02 | -5.00 | -0.554 | 0.67 | -184.7R |
| | OOS 2021-26 | 707 | -0.092 | -0.229 | -1.23 | -2.98 | -0.367 | 0.74 | -191.3R |
| T3 T1 with the D1 50-day average | IS 2016-20 | 401 | +0.012 | -0.241 | +0.19 | -3.67 | -0.494 | 0.71 | -110.5R |
| | OOS 2021-26 | 485 | -0.038 | -0.182 | -0.44 | -2.13 | -0.327 | 0.77 | -114.1R |

| Test | One-sided p (OOS) | Holm p | Placebo draws beaten (of 40) | Placebo median, OOS net R | Pass checks met |
|---|---|---|---|---|---|
| T1 | 0.9997 | 1.000 | 35 | -0.279 | n only |
| T2 | 0.9986 | 1.000 | 35 | -0.283 | n only |
| T3 | 0.9834 | 1.000 | 39 | -0.287 | n and placebo |

- **Before costs there is nothing to pay for.** Every test is within 0.1R a trade of zero before costs in both windows (the best,
  T3 in sample, +0.012R, month t 0.19). The median risk is $3.6-3.8, so costs take 0.14-0.25R a trade (more in 2016-20, when
  legs were smaller) from a stream that is already flat to slightly negative.
- **The placebo is not the point.** T3 beats 39 of 40 random-side draws, but every draw is also a loss (median -0.287R): the real
  sides lose a little less than random sides on the same fills, which is not a profit.
- **By side, out of sample (T1)**: buys -0.086R a trade net (n 390, PF 0.89), sells -0.390R (n 350, PF 0.55); gold's rise since
  2021 is all that keeps the buys near zero. No year from 2016 to 2026 is positive net in T1 or T2; T3 has one (2025, +15.4R).
- **What happens to the orders (T1)**: 1,368 filled, 1,207 expired unfilled, 4 cancelled by a gap through the stop, 3,683
  impulses ignored while an order or position was open. Out of sample 531 stopped, 206 reached the target, 3 timed out: the
  target is about 2R away and is reached about 28 % of the time, under the third that break-even needs before costs.

What it means: buying (or selling) the 0.62-0.79 "optimal trade entry" of a mechanically defined H1 displacement leg is not an
edge on gold 2016-2026; the D1 trend filter and the extension target change nothing measurable. It does not judge an entry chosen
by eye on a leg a trader picks, nor other definitions of the leg (a fair value gap, a session window, a higher-timeframe draw).
This was a stand-alone rule, never a gate, exit, entry or size of the live gold book; nothing live changed and no proposal is made.

To repeat: `node --use-env-proxy research/edge/gold-ote-retrace/run.mjs fetch <file.json.gz>` (about 776,000 M5 candles, kept
out of git), then `node research/edge/gold-ote-retrace/run.mjs full <file.json.gz>`. Tests: `tests/gold-ote-retrace.test.mjs`.
