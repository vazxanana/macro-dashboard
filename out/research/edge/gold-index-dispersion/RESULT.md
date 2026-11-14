# Result: spot gold after a day of wide dispersion across world equity indices (14 Nov 2026)

**Verdict: FAIL: buying gold for 5 days after a wide-dispersion day made -0.037R a trade less than an ordinary day out of sample (n 128, month t -0.64); 0 of 3 tests pass.**

A stand-alone rule on gold: not a gate, entry, exit or size of the live gold book, and none of the book's 2006-17 positions
was read (docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure, commit
`dbeb17de3`). Code: `run.mjs`. Every figure: `result.json`. Nothing here is an edge; nothing live changed and no proposal is
written.

Data: council-data `research/daily/` (OANDA mid, UTC daily candles, weekends folded into Monday): gold `xau` 20 Mar 2006 to
13 Nov 2026 (5,369 candles, 90 without a dispersion reading), and the 13 index CFDs fixed in the pre-registration (`au200 ch20
de40 eu50 fr40 hk33 jp225 nas100 sg30 spx500 uk100 us2000 us30`). Event = a gold date whose cross-sectional sd of the 13 index
returns is above the 90th percentile of the 250 previous readings: 286 events in 2007-16, 261 in 2017-26 (to October). Buy at
gold's close, stop 2 x ATR(20), out after H gold candles or at the stop, one trade at a time; costs $0.60 a round trip plus
`FIN.xau.long` (0.000148 of price) a rollover. **Excess** = net R minus the mean net R of the same trade entered on every gold
candle of the same calendar year (the baseline).

## The three tests (R a trade; t on calendar-month sums of the entry month)

| Test | Window | n | excess | t excess | net | t net | gross | t gross | baseline | win % | stops | excess 2x | net 2x |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 (primary): hold 5 | 2017-26 | 128 | -0.037 | -0.64 | +0.004 | 0.07 | +0.055 | 0.96 | +0.041 | 50.78 | 21 | -0.036 | -0.047 |
| T1 | 2007-16 | 123 | +0.036 | 0.50 | +0.030 | 0.40 | +0.075 | 1.01 | -0.006 | 51.22 | 24 | +0.038 | -0.016 |
| T2: hold 1 | 2017-26 | 198 | +0.015 | 0.63 | +0.013 | 0.54 | +0.034 | 1.46 | -0.003 | 50.00 | 5 | +0.016 | -0.009 |
| T2 | 2007-16 | 205 | +0.009 | 0.33 | -0.007 | -0.28 | +0.015 | 0.53 | -0.016 | 48.29 | 3 | +0.011 | -0.029 |
| T3: hold 3 | 2017-26 | 152 | +0.059 | 1.20 | +0.080 | 1.62 | +0.115 | 2.34 | +0.021 | 53.95 | 9 | +0.060 | +0.044 |
| T3 | 2007-16 | 155 | +0.032 | 0.64 | +0.021 | 0.41 | +0.055 | 1.08 | -0.011 | 52.26 | 16 | +0.034 | -0.014 |

| Test | one-sided p (OOS excess) | Holm p | Placebo seeds beaten (38 of 40 needed) | Placebo mean / max | Pass |
|---|---|---|---|---|---|
| T1 | 0.7376 | 0.7376 | 8 | -0.012 / +0.090 | no |
| T2 | 0.2641 | 0.5282 | 33 | -0.003 / +0.053 | no |
| T3 | 0.1176 | 0.3528 | 38 | +0.000 / +0.078 | no |

The primary test fails every bar but "net > 0": out of sample the 5-day buy after a dispersion day did worse than the same buy
on an ordinary day of the same year (-0.037R, t -0.64) and beat only 8 of 40 random sets of days. T3 (3 days) is the best
reading, +0.059R over the baseline out of sample (t 1.20, Holm p 0.35), positive at 2x costs and in sample and above 38 of 40
placebos, but far from t 2; with T1 negative at 5 days it reads as noise in the hold length, not as a lead. T2 (1 day) is near
zero in both windows.

## What this says

Days when the world's equity markets split apart are not followed by unusual gold returns: the effect is within about
±0.06R a trade of an ordinary day in both windows and changes sign between holds. Gold is not a measurable refuge from
cross-country disagreement on these candles. No threshold, lookback, index set, hold or side other than the three
pre-registered ones was run, and none will be on these data.
