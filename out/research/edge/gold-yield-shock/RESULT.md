# Result: spot gold after a US 10-year yield shock day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a yield-up shock day beats the year's every-day buy by +0.003R a trade net out of sample 2017-26 (n 124, month t 0.04).**

Rules as pre-registered (`PREREGISTRATION.md`, pushed before any run): a shock day is a day when the 10-year Treasury CFD's
return is 1.5 sd or more (sd of the 250 previous common days) from zero; trade gold at the next daily open against its
same-day reaction, stop 2 x ATR(20), one trade at a time; each trade is compared with the same-side, same-hold trade entered
at every gold candle of the same year. Costs $0.60 a round trip plus `nights x FIN.xau.long x entry` on buys. Data: council-data
`research/daily/xau.json` and `usb10y.json` (commit `83e686f`), weekend stubs folded. Paper research only; not a gate, entry,
exit or size of the live gold book, and nothing live changed.

## The three tests (excess = net R minus the year's every-day baseline; t on calendar-month sums)

| Test | Window | Events | n | Gross R | Net R | Excess net | Month t net | Month t excess | Net at 2x | Excess at 2x |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 yield-up shock, buy, 5 days (primary) | 2007-16 | 159 | 124 | +0.057 | +0.013 | +0.030 | 0.22 | 0.52 | -0.032 | +0.032 |
| | 2017-26 | 158 | 124 | +0.090 | +0.042 | +0.003 | 0.59 | 0.04 | -0.006 | +0.006 |
| T2 yield-down shock, sell, 5 days | 2007-16 | 161 | 120 | -0.106 | -0.123 | -0.064 | -1.66 | -0.90 | -0.140 | -0.063 |
| | 2017-26 | 162 | 128 | -0.109 | -0.122 | -0.021 | -1.79 | -0.32 | -0.136 | -0.021 |
| T3 yield-up shock, buy, 1 day | 2007-16 | 159 | 159 | +0.003 | -0.018 | -0.001 | -0.54 | -0.02 | -0.039 | +0.001 |
| | 2017-26 | 158 | 158 | +0.037 | +0.017 | +0.023 | 0.42 | 0.59 | -0.003 | +0.024 |

Holm over the three OOS excess tests: T1 p 0.484 (Holm 0.968), T2 0.626 (0.968), T3 0.278 (0.833). No test passes any of
conditions 1, 3 or 5; T1 is positive in sample (+0.030R excess) but the out-of-sample excess is nil.

## Placebo (40 seeded draws of random eligible OOS days, same side, hold and baseline)

- T1: the real excess t 0.04 is above 23 of 40 draws (median -0.12, 5th-95th -1.78 to 2.18).
- T2: -0.32, above 19 of 40.
- T3: 0.59, above 26 of 40.

All three sit in the middle of their placebo: a yield shock day tells nothing about gold's next one or five days.

## Reading

- Gold does move against the yield on the shock day (on average -0.52 % / -0.79 % on yield-up days, +0.65 % / +0.61 % on
  yield-down days, in sample / out of sample), but that move neither reverts nor continues in a way a next-open trade can use.
- The yield-up buy's gross +0.09R out of sample is what any gold buy of those years earned (excess before costs 0.00R).
- Selling after a yield-down shock loses in both windows because gold rose in most years; against the year's every-day sell
  it is -0.02R to -0.06R, inside noise.
- Not tested: other thresholds, holds, the 2-year or 30-year bond, or the same-day intraday reaction. Choosing one now, after
  these tables, would be a re-fit, not a test.

To repeat: `node research/edge/gold-yield-shock/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-yield-shock/run.mjs full <dir>`. Test: `tests/gold-yield-shock.test.mjs`.
