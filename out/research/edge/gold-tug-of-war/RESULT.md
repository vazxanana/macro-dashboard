# Result: gold's Asian hours against its London and New York hours over 20 days (14 Nov 2026)

Pre-registered in `PREREGISTRATION.md` (pushed alone, first); computed by `run.mjs`; every figure below is in `result.json`.
Paper research only. Item 44 holds: a stand-alone daily rule on XAU/USD, not a gate, exit, entry or size of the live gold book,
and nothing live changed.

**Verdict: FAIL, 0 of 3: following Asia when its 20-day drift and the West's disagree earns nothing over the same-side week out of sample (excess −0.036R a trade, month t −0.83, n 318).**

T1 (primary) was flat in sample (+0.004R excess, t 0.10, n 360) and slightly negative out of sample (−0.036R, t −0.83, Holm
p 1.00); the net trade lost in both windows (−0.015R and −0.040R a trade) and at 2x costs (−0.072R). The OOS t is below the
median of both the placebo and the control: 33 of 40 placebo draws and 33 of 40 control draws scored at least as high. Only
"same sign in sample" of the seven pass checks held, and only by +0.004R.

## Data and rule

OANDA mid XAU/USD H1 through `/md/bars`, 125,474 candles 19 Mar 2006 to 30 Oct 2026 (cache outside git, deleted after the run),
grouped into New York sessions (17:00 to 17:00 New York, `council/histdata.mjs` `nyOffsetH`), 5,272 usable days (20+ candles),
5,271 with an Asian / Western split. Asian part = previous close to the close of the last candle starting before 03:00 New York;
Western part = from there to the 17:00 New York close. Signal at day i's close when the 20-day sums of the two parts have
opposite signs; side = Asia's sign (1,449 signal days in sample, 1,201 out of sample; about two thirds buys). Entry at day i+1's
first H1 open, stop 2 x ATR(14), out at the close of the hold's last day or at the stop; one position at a time. Costs $0.60 a
round trip plus `nights x FIN.xau.long x entry` on buys (0.000148 of price a night, the demo broker's XAUUSD swap of 11 Nov 2026).
Excess = net R minus the mean net R of the same-side trade entered on every usable day of the same window.

## Results (R a trade; t on calendar-month sums)

| Test | Window | n | Buys / sells | Gross | Net | Excess | t gross | t net | t excess | Net at 2x | Total net R | Max DD R | Median stop $ |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| T1 follow Asia, 5 days | IS 2007-16 | 360 | 245 / 115 | +0.022 | −0.015 | +0.004 | +0.53 | −0.36 | +0.10 | −0.051 | −5.24 | −9.84 | 37.74 |
| T1 follow Asia, 5 days | OOS 2017-26 | 318 | 190 / 128 | −0.008 | −0.040 | −0.036 | −0.18 | −0.91 | −0.83 | −0.072 | −12.67 | −20.25 | 48.21 |
| T2 strong Asia, 5 days | IS 2007-16 | 210 | 151 / 59 | +0.017 | −0.018 | −0.002 | +0.36 | −0.39 | −0.04 | | −3.86 | −11.00 | 40.17 |
| T2 strong Asia, 5 days | OOS 2017-26 | 171 | 113 / 58 | +0.022 | −0.011 | −0.018 | +0.41 | −0.20 | −0.33 | | −1.86 | −13.98 | 50.01 |
| T3 follow Asia, 10 days | IS 2007-16 | 199 | 132 / 67 | +0.037 | −0.017 | +0.002 | +0.54 | −0.24 | +0.02 | | −3.31 | −8.71 | 37.32 |
| T3 follow Asia, 10 days | OOS 2017-26 | 177 | 101 / 76 | +0.054 | +0.004 | +0.008 | +0.72 | +0.06 | +0.10 | | +0.79 | −15.12 | 47.18 |

Holm over the three OOS excess t: T1 p 0.41 → 1.00, T2 p 0.74 → 1.00, T3 p 0.92 → 1.00. Months: 120 in sample, 118 out of
sample. Same-side every-day baselines (5-day hold, net): IS buy +0.000R, sell −0.060R; OOS buy +0.066R, sell −0.107R.

## Placebo and control (T1, out of sample excess t; actual −0.83)

| | Draws | Median | 95th percentile | Max | Draws at or above the actual |
|---|---:|---:|---:|---:|---:|
| Placebo: signal days shuffled within their calendar year | 40 | −0.01 | 1.27 | 2.11 | 33 |
| Control: each day's Asian and Western parts swapped at random | 40 | 0.08 | 1.81 | 2.96 | 33 |

The rule scores below the middle of both: the session split carries no information about the next week that a random relabelling
of the same days does not.

## By year (T1, net R and excess R summed)

The excess was positive in 9 of 20 years. The out-of-sample loss is mostly 2019 (−8.26R excess), 2020 (−3.59R) and 2024
(−4.90R); 2017-18 were the best years (+4.02R, +2.18R). No stretch is stable.

## Notes

- One detail of T2 differs from the count made before the pre-registration: the run's median uses whatever past days exist
  (at least 125 of the 250), so early 2007 can signal; the count had waited for a full 250. In sample T2 has 210 trades
  instead of the counted 202. It does not change the verdict (T2 is not the primary test, and it is flat either way).
- T1 out of sample is 318 trades, not the counted 319: the last signal's 5-day hold runs past the end of the file.
- Read plainly: after a month in which Asia pushed gold one way and the West the other, the next week is a coin toss after
  costs. Not an edge, not a filter, nothing to propose. Do not re-run with another split hour, window length or hold on the
  same data.
