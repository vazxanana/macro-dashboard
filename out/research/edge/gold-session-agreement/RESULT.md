# Result: when Asia, London and New York all move gold the same way, does the next day follow? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following a day on which all three gold sessions moved the same way earned nothing over the same-side day out of sample (OOS excess -0.001R, month t -0.05, n 640).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any result). Stand-alone paper research on XAU/USD: it reads and
changes nothing of the live gold book, uses none of its 2006-17 positions, and no rule, size, filter, stop or config changed.

## Data and rule

OANDA mid XAU/USD H1 through `/md/bars`, 125,589 candles 2006-03-19 to 2026-11-06 (cache outside git, deleted). UTC days
(weekend candles to Monday, 18+ candles), 5,291 eligible days with all three sessions. Sessions by the candle's UTC hour:
Asia 00-06, London 07-12, New York 13-20. Agreement = all three session moves non-zero and of one sign (25 % of eligible
days, 1,340; 54 % of them up). Trade: next day's first H1 open in that direction, stop 1 x ATR(14), out at the day's close
(T1, T3) or the 5th day's (T2). Costs $0.60 a round trip plus `nights x FIN.xau.long x entry` on buys. Excess = net R minus
the mean net R of the same-side trade on every eligible day of the same calendar year.

## Results (R a trade; t on calendar-month sums of the excess)

| Test | Window | n | Gross | Net | Excess | Month t |
|---|---|---|---|---|---|---|
| T1 follow, 1 day | IS | 659 | +0.074 | +0.035 | +0.060 | +2.38 |
| T1 follow, 1 day | OOS | 640 | +0.012 | -0.022 | -0.001 | -0.05 |
| T2 follow, 5 days | IS | 659 | +0.075 | +0.016 | +0.020 | +0.37 |
| T2 follow, 5 days | OOS | 639 | +0.082 | +0.025 | +0.011 | +0.17 |
| T3 strong, 1 day | IS | 265 | +0.019 | -0.021 | +0.002 | +0.06 |
| T3 strong, 1 day | OOS | 267 | +0.069 | +0.035 | +0.051 | +1.46 |

- **T1 (primary)**: the in-sample lift (+0.060R, t 2.38) did not repeat: OOS excess -0.001R, Holm p 1.00; OOS halves
  +0.035R (2017-21, t 0.91) and -0.037R (2022-26, t -1.07); signal trades lose -0.022R net (-0.055R at 2x costs).
  Placebo: the real t beats 25 of 40 random draws (median placebo t -0.27). Checks failed: month t, 2x costs, placebo.
- **T2** (5-day hold): OOS excess +0.011R, t 0.17, Holm p 1.00; IS +0.020R, t 0.37. Placebo: beats 31 of 40.
- **T3** (each session >= 0.10 x ATR): OOS excess +0.051R, t 1.46, Holm p 0.44; IS +0.002R (t 0.06); all of the OOS gain
  is 2017-21 (+0.101R, t 1.95), 2022-26 -0.002R. Placebo: beats 38 of 40. Not a lead: no in-sample support, below t 2.
- Baseline, 1-day: buys OOS +0.005R net (t 0.37), sells -0.062R (t -4.63); IS buys -0.023R, sells -0.045R. The baseline
  carries gold's up-drift, so the excess reads only what agreement adds.

## Reading

Three-session agreement on gold is a day-level form of one-day momentum, and it carries no information about the next day
out of sample beyond what any same-side day of the same year has. The 2007-16 lift was a sample feature. Not an edge, not
a filter, not a proposal. Nothing live changed.

To repeat: `node --use-env-proxy research/edge/gold-session-agreement/run.mjs fetch <dir>`, then `… count <dir>` and
`… full <dir>`. Tests: `tests/gold-session-agreement.test.mjs`.
